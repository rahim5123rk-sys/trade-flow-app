import type { Document } from '../types';

export type DocumentFilterKey =
  | 'invoice'
  | 'quote'
  | 'cp12'
  | 'service_record'
  | 'commissioning'
  | 'decommissioning'
  | 'warning_notice'
  | 'breakdown_report'
  | 'installation_cert';

const GAS_FORM_KINDS = new Set<DocumentFilterKey>([
  'cp12',
  'service_record',
  'commissioning',
  'decommissioning',
  'warning_notice',
  'breakdown_report',
  'installation_cert',
]);

export function getPaymentInfoKind(doc: Pick<Document, 'payment_info'>): string | null {
  if (!doc.payment_info) return null;
  try {
    return JSON.parse(doc.payment_info)?.kind ?? null;
  } catch {
    return null;
  }
}

export function isGasFormDocument(doc: Pick<Document, 'type' | 'reference' | 'payment_info'>): boolean {
  if (GAS_FORM_KINDS.has(doc.type as DocumentFilterKey)) return true;
  if (doc.reference?.startsWith('CP12-') || doc.reference?.startsWith('SR-')) return true;
  const kind = getPaymentInfoKind(doc as Pick<Document, 'payment_info'>);
  return kind !== null && GAS_FORM_KINDS.has(kind as DocumentFilterKey);
}

export function getDocumentFilterKey(
  doc: Pick<Document, 'type' | 'reference' | 'payment_info'>,
): DocumentFilterKey | null {
  const type = doc.type as string;
  const kind = getPaymentInfoKind(doc as Pick<Document, 'payment_info'>);

  if (type === 'cp12' || doc.reference?.startsWith('CP12-') || kind === 'cp12') return 'cp12';
  if (type === 'service_record' || doc.reference?.startsWith('SR-') || kind === 'service_record') return 'service_record';
  if (type === 'commissioning' || kind === 'commissioning') return 'commissioning';
  if (type === 'decommissioning' || kind === 'decommissioning') return 'decommissioning';
  if (type === 'warning_notice' || kind === 'warning_notice') return 'warning_notice';
  if (type === 'breakdown_report' || kind === 'breakdown_report') return 'breakdown_report';
  if (type === 'installation_cert' || kind === 'installation_cert') return 'installation_cert';
  if (type === 'invoice' && !isGasFormDocument(doc)) return 'invoice';
  if (type === 'quote' && !isGasFormDocument(doc)) return 'quote';

  return null;
}

export function matchesDocumentFilters(
  doc: Pick<Document, 'type' | 'reference' | 'payment_info'>,
  filters?: DocumentFilterKey[],
): boolean {
  if (!filters || filters.length === 0) return true;
  const filterKey = getDocumentFilterKey(doc);
  return filterKey !== null && filters.includes(filterKey);
}

export function buildDocumentTypeQueryFilters(filters?: DocumentFilterKey[]): DocumentFilterKey[] | undefined {
  if (!filters || filters.length === 0) return undefined;

  const next = new Set(filters);
  const hasGasFormFilter = filters.some((filter) => GAS_FORM_KINDS.has(filter));

  if (hasGasFormFilter) {
    next.add('quote');
  }

  return Array.from(next);
}
