import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const subscriptionPath = new URL('../app/(app)/settings/subscription.tsx', import.meta.url);
const workersPath = new URL('../app/(app)/workers/add.tsx', import.meta.url);
const supabaseConfigPath = new URL('../supabase/config.toml', import.meta.url);

test('app surfaces a direct team billing website link', async () => {
  const [subscriptionSource, workersSource] = await Promise.all([
    readFile(subscriptionPath, 'utf8'),
    readFile(workersPath, 'utf8'),
  ]);

  assert.match(subscriptionSource, /openURL\('https:\/\/gaspilotapp\.com\/team'\)/);
  assert.match(workersSource, /openURL\('https:\/\/gaspilotapp\.com\/team'\)/);
});

test('supabase auth redirect allowlist includes non-www team billing domain', async () => {
  const source = await readFile(supabaseConfigPath, 'utf8');
  assert.match(source, /https:\/\/gaspilotapp\.com\/\*\*/);
});
