import test from 'node:test';
import assert from 'node:assert/strict';

import { formatDateWithRelativeHint, formatLocalDateKey, formatRelativeDateLabel } from '../src/utils/dates';

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

test('formatRelativeDateLabel returns Tomorrow for dates on the next calendar day', () => {
  const baseDate = new Date(2026, 3, 9, 14, 0, 0, 0);
  const tomorrowMorning = new Date(2026, 3, 10, 9, 0, 0, 0);

  assert.equal(formatRelativeDateLabel(tomorrowMorning, baseDate), 'Tomorrow');
});

test('formatDateWithRelativeHint appends Tomorrow in brackets for the next calendar day', () => {
  const baseDate = new Date(2026, 3, 9, 14, 0, 0, 0);
  const tomorrowMorning = new Date(2026, 3, 10, 9, 0, 0, 0);

  assert.equal(
    formatDateWithRelativeHint(tomorrowMorning, { baseDate, includeYear: false }),
    'Fri 10 Apr (Tomorrow)'
  );
});

test('formatDateWithRelativeHint leaves non-relative dates as standard labels', () => {
  const baseDate = new Date(2026, 3, 9, 14, 0, 0, 0);
  const nextWeek = new Date(2026, 3, 16, 9, 0, 0, 0);

  assert.equal(
    formatDateWithRelativeHint(nextWeek, { baseDate, includeYear: false }),
    'Thu 16 Apr'
  );
});
