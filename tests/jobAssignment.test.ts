import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAssignedWorkerIds } from '../src/utils/jobAssignments';

test('resolveAssignedWorkerIds forces workers to assign jobs to themselves', () => {
  assert.deepEqual(
    resolveAssignedWorkerIds({
      assignedTo: ['worker-2'],
      currentUserId: 'worker-1',
      isAdmin: false,
    }),
    ['worker-1'],
  );
});

test('resolveAssignedWorkerIds keeps admin selections', () => {
  assert.deepEqual(
    resolveAssignedWorkerIds({
      assignedTo: ['worker-2', 'worker-3'],
      currentUserId: 'admin-1',
      isAdmin: true,
    }),
    ['worker-2', 'worker-3'],
  );
});

test('resolveAssignedWorkerIds falls back to current user when nobody is selected', () => {
  assert.deepEqual(
    resolveAssignedWorkerIds({
      assignedTo: [],
      currentUserId: 'worker-1',
      isAdmin: false,
    }),
    ['worker-1'],
  );
});

test('resolveAssignedWorkerIds allows admin to leave unassigned', () => {
  assert.deepEqual(
    resolveAssignedWorkerIds({
      assignedTo: [],
      currentUserId: 'admin-1',
      isAdmin: true,
    }),
    [],
  );
});
