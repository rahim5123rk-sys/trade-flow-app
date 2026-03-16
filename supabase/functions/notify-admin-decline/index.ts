// supabase/functions/notify-admin-decline/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Validate caller JWT
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return new Response('Unauthorized', { status: 401 });

  // Read body BEFORE other awaits — req body stream can only be read once
  let jobId: string;
  try {
    const body = await req.json();
    jobId = body.jobId;
    if (!jobId || typeof jobId !== 'string') {
      return new Response('Bad Request: jobId required', { status: 400 });
    }
  } catch {
    return new Response('Bad Request: invalid JSON', { status: 400 });
  }

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  // Fetch caller profile
  const { data: callerProfile } = await supabaseAdmin
    .from('profiles')
    .select('company_id, display_name')
    .eq('id', user.id)
    .single();
  if (!callerProfile) return new Response('Profile not found', { status: 404 });

  // Verify job belongs to caller's company
  const { data: job } = await supabaseAdmin
    .from('jobs')
    .select('title, company_id')
    .eq('id', jobId)
    .single();

  if (!job || job.company_id !== callerProfile.company_id) {
    return new Response('Forbidden', { status: 403 });
  }

  // Notify all admins in company
  const { data: admins } = await supabaseAdmin
    .from('profiles')
    .select('push_token')
    .eq('company_id', callerProfile.company_id)
    .eq('role', 'admin');

  let notified = 0;
  for (const admin of admins ?? []) {
    if (!admin.push_token) continue;
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: admin.push_token,
        title: 'Job Declined',
        body: `${callerProfile.display_name ?? 'A worker'} declined: ${job.title}`,
        data: { type: 'job_declined', jobId },
        sound: 'default',
      }),
    });
    notified++;
  }

  return new Response(JSON.stringify({ notified }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
