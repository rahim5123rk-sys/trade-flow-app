// supabase/functions/assign-job-workers/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendPush(token: string, title: string, body: string, data: Record<string, unknown>) {
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, data, sound: 'default' }),
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  const expectedToken = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { jobId: string; oldAssignedTo: string[]; newAssignedTo: string[] };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request: invalid JSON', { status: 400 });
  }
  const { jobId, oldAssignedTo, newAssignedTo } = body;

  if (!jobId || typeof jobId !== 'string') {
    return new Response('Bad Request: jobId required', { status: 400 });
  }

  const old = oldAssignedTo ?? [];
  const next = newAssignedTo ?? [];

  // Workers removed from job — delete their acceptance rows
  const removed = old.filter((id) => !next.includes(id));
  if (removed.length > 0) {
    await supabaseAdmin
      .from('job_acceptance')
      .delete()
      .eq('job_id', jobId)
      .in('worker_id', removed);
  }

  // Workers newly added
  const added = next.filter((id) => !old.includes(id));
  if (added.length === 0) return new Response(JSON.stringify({ notified: 0, skipped: 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });

  // Fetch job details for notification text
  const { data: job } = await supabaseAdmin
    .from('jobs')
    .select('title, customer_snapshot')
    .eq('id', jobId)
    .single();

  const address = (job?.customer_snapshot as any)?.address ?? 'No address';
  const title = job?.title ?? 'New Job';

  let notified = 0;
  let skipped = 0;

  for (const workerId of added) {
    // Upsert acceptance row — reset to pending on re-assignment
    const { error: upsertError } = await supabaseAdmin.from('job_acceptance').upsert(
      { job_id: jobId, worker_id: workerId, status: 'pending', updated_at: new Date().toISOString() },
      { onConflict: 'job_id,worker_id' }
    );
    if (upsertError) { skipped++; continue; }

    // Fetch worker push token
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('push_token')
      .eq('id', workerId)
      .single();

    if (!profile?.push_token) { skipped++; continue; }

    await sendPush(
      profile.push_token,
      'Job Assigned',
      `${title} — ${address}`,
      { type: 'job_assigned', jobId, title, address }
    );
    notified++;
  }

  return new Response(JSON.stringify({ notified, skipped }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
