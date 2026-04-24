import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const invoicePath = new URL('../app/(app)/invoice.tsx', import.meta.url);
const typesPath = new URL('../src/types/index.ts', import.meta.url);
const migrationsDir = new URL('../supabase/migrations/', import.meta.url);

async function findToggleMigration() {
  const { readdir } = await import('node:fs/promises');
  const files = await readdir(migrationsDir);
  return files.find((name) => /xero|invoice.*sync|sync.*xero/i.test(name));
}

test('invoice screen persists and gates per-invoice Xero sync', async () => {
  const [invoiceSource, typesSource, migrationFile] = await Promise.all([
    readFile(invoicePath, 'utf8'),
    readFile(typesPath, 'utf8'),
    findToggleMigration(),
  ]);

  assert.match(invoiceSource, /const \[syncToXero, setSyncToXero\] = useState/);
  assert.match(invoiceSource, /sync_to_xero:\s*syncToXero/);
  assert.match(invoiceSource, /existingDoc\.sync_to_xero/);
  assert.match(invoiceSource, /if \(syncToXero\)[\s\S]*invoke\('xero-push-invoice'/);
  assert.match(invoiceSource, /from\('xero_connection_status'\)/);

  assert.match(typesSource, /sync_to_xero\?: boolean;|sync_to_xero: boolean;/);
  assert.ok(migrationFile, 'Expected a migration file for invoice Xero sync toggle');
});
