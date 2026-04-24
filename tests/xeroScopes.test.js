import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const xeroSharedPath = new URL('../supabase/functions/_shared/xero.ts', import.meta.url);

function extractScopes(source) {
  const match = source.match(/XERO_SCOPES\s*=\s*'([^']+)'/);
  assert.ok(match, 'Expected XERO_SCOPES constant to exist');
  return match[1].trim().split(/\s+/);
}

test('xero integration requests only the minimum supported invoice scopes', async () => {
  const source = await readFile(xeroSharedPath, 'utf8');
  const scopes = extractScopes(source);

  assert.ok(scopes.includes('accounting.invoices'));
  assert.ok(scopes.includes('accounting.contacts'));
  assert.ok(scopes.includes('offline_access'));

  assert.ok(!scopes.includes('accounting.transactions'));
  assert.ok(!scopes.includes('openid'));
  assert.ok(!scopes.includes('profile'));
  assert.ok(!scopes.includes('email'));
});
