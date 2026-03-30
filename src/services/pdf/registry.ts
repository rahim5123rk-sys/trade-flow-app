// ============================================
// FILE: src/services/pdf/registry.ts
// Polymorphic document registry
//
// Maps locked-payload `kind` to the correct PDF
// generator so the documents screens can handle
// any form type without hard-coding each one.
// ============================================

import type { BaseLockedPayload, CompanyInfo, EngineerInfo } from './shared';
import {
    generatePdfBase64FromPayload,
    generatePdfFromPayload,
    generatePdfUrlFromPayload,
} from './shared';

// ─── Registration types ─────────────────────────────────────────

interface FormPdfRegistration<P extends BaseLockedPayload = BaseLockedPayload> {
  /** Human-readable label e.g. "Gas Safety Certificate" */
  label: string;
  /** Short label for the documents list card */
  shortLabel: string;
  /** Ionicons icon name */
  icon: string;
  /** Accent colour for the documents list */
  color: string;
  /** Build full HTML from the locked payload's pdfData */
  buildHtml: (
    pdfData: P['pdfData'],
    company: CompanyInfo,
    engineer: EngineerInfo,
    gasSafeLogoBase64: string,
    companyLogoSrc: string,
  ) => string;
  /** Derive a human-readable title for the PDF file */
  titleFn: (payload: P) => string;
}

// The registry map, keyed by `kind`
const REGISTRY = new Map<string, FormPdfRegistration<any>>();

// ─── PDF filename mapping ───────────────────────────────────────

const FILE_NAME_PREFIX: Record<string, string> = {
  cp12: 'Gas-Safety-Record',
  service_record: 'Service-Record',
  commissioning: 'Commissioning-Certificate',
  decommissioning: 'Decommissioning-Certificate',
  warning_notice: 'Warning-Notice',
  breakdown_report: 'Breakdown-Report',
  installation_cert: 'Installation-Certificate',
};

/**
 * Get a descriptive PDF filename for a document kind + reference.
 * e.g. "Gas-Safety-Record-REF-0042.pdf", "Invoice-INV-0001.pdf"
 */
export function getDocumentFileName(kind: string, ref?: string): string {
  const prefix = FILE_NAME_PREFIX[kind] || kind;
  return ref ? `${prefix}-${ref}.pdf` : `${prefix}.pdf`;
}

/**
 * Register a new form-type PDF generator.
 * Call this at module scope in each form's PDF generator file.
 */
export function registerFormPdf<P extends BaseLockedPayload>(
  kind: string,
  reg: FormPdfRegistration<P>,
): void {
  REGISTRY.set(kind, reg);
}

/**
 * Look up a registration by kind.
 */
export function getFormPdfRegistration(kind: string): FormPdfRegistration | undefined {
  return REGISTRY.get(kind);
}

/**
 * Get all registered form kinds.
 */
export function getRegisteredKinds(): string[] {
  return Array.from(REGISTRY.keys());
}

// ─── Polymorphic API ────────────────────────────────────────────

/**
 * Parse a document's `payment_info` JSON into a typed locked payload,
 * returning null if it doesn't match any registered kind.
 */
export function parseLockedPayload(paymentInfoJson: string | null | undefined): BaseLockedPayload | null {
  if (!paymentInfoJson) return null;
  try {
    const parsed = JSON.parse(paymentInfoJson);
    if (!parsed?.kind || !REGISTRY.has(parsed.kind)) return null;
    return parsed as BaseLockedPayload;
  } catch {
    return null;
  }
}

/**
 * Generate/share/save/view a PDF from any registered locked payload.
 */
export async function generateRegisteredPdf(
  payload: BaseLockedPayload,
  mode: 'share' | 'save' | 'view',
  companyId?: string,
  certRef?: string,
): Promise<void> {
  const reg = REGISTRY.get(payload.kind);
  if (!reg) throw new Error(`No PDF generator registered for kind "${payload.kind}"`);
  const fileName = getDocumentFileName(payload.kind, certRef);
  return generatePdfFromPayload(payload, reg.buildHtml, reg.titleFn, mode, companyId, fileName);
}

/**
 * Generate base64 for a PDF from any registered locked payload.
 */
export async function generateRegisteredPdfBase64(
  payload: BaseLockedPayload,
  companyId?: string,
): Promise<string> {
  const reg = REGISTRY.get(payload.kind);
  if (!reg) throw new Error(`No PDF generator registered for kind "${payload.kind}"`);
  return generatePdfBase64FromPayload(payload, reg.buildHtml, companyId);
}

/**
 * Generate a signed URL for a PDF from any registered locked payload.
 */
export async function generateRegisteredPdfUrl(
  payload: BaseLockedPayload,
  companyId: string,
  certRef: string,
): Promise<string> {
  const reg = REGISTRY.get(payload.kind);
  if (!reg) throw new Error(`No PDF generator registered for kind "${payload.kind}"`);
  return generatePdfUrlFromPayload(payload, reg.buildHtml, companyId, certRef);
}
