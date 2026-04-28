import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAllowlist, isAllowed } from '../supabase/functions/_shared/admin-auth-parse';

test('parseAllowlist trims whitespace and drops empties', () => {
  assert.deepEqual(
    parseAllowlist(' uuid-a , uuid-b ,, uuid-c '),
    ['uuid-a', 'uuid-b', 'uuid-c'],
  );
});

test('parseAllowlist returns [] for null/undefined/empty', () => {
  assert.deepEqual(parseAllowlist(undefined), []);
  assert.deepEqual(parseAllowlist(''), []);
  assert.deepEqual(parseAllowlist(null), []);
});

test('isAllowed checks membership exactly', () => {
  const list = parseAllowlist('uuid-a,uuid-b');
  assert.equal(isAllowed(list, 'uuid-a'), true);
  assert.equal(isAllowed(list, 'uuid-c'), false);
  assert.equal(isAllowed(list, ''), false);
});
