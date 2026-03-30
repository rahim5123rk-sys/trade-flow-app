import test from 'node:test';
import assert from 'node:assert/strict';

import { WORKER_SELECT_COLUMNS } from '../src/utils/workerQuery';

test('worker query does not request missing profile columns', () => {
  assert.equal(
    WORKER_SELECT_COLUMNS,
    'id, display_name, email, role, company_id, created_at, is_test_user',
  );
  assert.ok(!WORKER_SELECT_COLUMNS.includes('phone'));
  assert.ok(!WORKER_SELECT_COLUMNS.includes('avatar_url'));
});
