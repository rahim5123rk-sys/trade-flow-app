import assert from 'node:assert/strict';
import test from 'node:test';

import { TimeoutError, withAbortTimeout } from '../src/utils/withTimeout';

test('withAbortTimeout returns the operation result before the timeout', async () => {
  const result = await withAbortTimeout(async () => 'ready', {
    timeoutMs: 50,
    label: 'quick op',
  });

  assert.equal(result, 'ready');
});

test('withAbortTimeout rejects with TimeoutError when the operation hangs', async () => {
  await assert.rejects(
    () =>
      withAbortTimeout(
        ({ signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              reject(signal.reason);
            });
          }),
        {
          timeoutMs: 20,
          label: 'profile fetch',
        },
      ),
    (error: unknown) => {
      assert.ok(error instanceof TimeoutError);
      assert.match((error as Error).message, /profile fetch timed out after 20ms/);
      return true;
    },
  );
});
