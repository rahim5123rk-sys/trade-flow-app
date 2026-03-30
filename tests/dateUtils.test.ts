import test from 'node:test';
import assert from 'node:assert/strict';

import { formatLocalDateKey } from '../src/utils/dates';

test('formatLocalDateKey uses local calendar date components instead of UTC ISO conversion', () => {
  const localDate = new Date(2026, 2, 30, 0, 30, 0, 0);
  const expected = [
    localDate.getFullYear(),
    String(localDate.getMonth() + 1).padStart(2, '0'),
    String(localDate.getDate()).padStart(2, '0'),
  ].join('-');

  assert.equal(formatLocalDateKey(localDate), expected);
});

test('formatLocalDateKey keeps late-night dates on the same local day', () => {
  const localDate = new Date(2026, 2, 29, 23, 55, 0, 0);
  const expected = [
    localDate.getFullYear(),
    String(localDate.getMonth() + 1).padStart(2, '0'),
    String(localDate.getDate()).padStart(2, '0'),
  ].join('-');

  assert.equal(formatLocalDateKey(localDate), expected);
});
