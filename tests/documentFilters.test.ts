import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDocumentTypeQueryFilters, matchesDocumentFilters } from '../src/utils/documentFilters';

const legacyCp12Document = {
  id: '1',
  type: 'quote',
  payment_info: JSON.stringify({ kind: 'cp12' }),
};

const realQuoteDocument = {
  id: '2',
  type: 'quote',
  payment_info: null,
};

test('matchesDocumentFilters includes legacy gas forms saved as quote fallback', () => {
  assert.equal(matchesDocumentFilters(legacyCp12Document as any, ['cp12']), true);
  assert.equal(matchesDocumentFilters(realQuoteDocument as any, ['cp12']), false);
});

test('buildDocumentTypeQueryFilters includes quote fallback when gas form filters are requested', () => {
  assert.deepEqual(
    buildDocumentTypeQueryFilters(['cp12', 'service_record']),
    ['cp12', 'service_record', 'quote'],
  );
});

test('buildDocumentTypeQueryFilters leaves invoice and quote filters unchanged', () => {
  assert.deepEqual(buildDocumentTypeQueryFilters(['invoice', 'quote']), ['invoice', 'quote']);
});
