import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const CLEANUPS = [
  [/\s*for app store screenshots\.?/gi, ''],
  [/\s*seeded for screenshots\.?/gi, ''],
  [/\s*seeded for screenshot renewals\.?/gi, ''],
  [/\s{2,}/g, ' '],
];

function sanitizeNotes(notes) {
  return CLEANUPS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), notes).trim();
}

async function clean(table) {
  const { data, error } = await sb
    .from(table)
    .select('id, notes')
    .or('notes.ilike.%App Store screenshots%,notes.ilike.%seeded for screenshots%,notes.ilike.%screenshot renewals%');
  if (error) throw error;
  console.log(`${table}: found ${(data || []).length} rows to clean`);
  if (data?.length) console.log(`  sample: "${data[0].notes}"`);
  for (const row of data || []) {
    const cleaned = sanitizeNotes(row.notes);
    await sb.from(table).update({ notes: cleaned }).eq('id', row.id);
  }
  console.log(`${table}: ${(data || []).length} cleaned`);
}

await clean('jobs');
await clean('documents');
console.log('Done');
