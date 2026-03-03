// ============================================
// FILE: src/services/formDocumentService.ts
// Shared service for saving/emailing gas form documents
//
// Encapsulates the createDocument + handleComplete
// flow that is identical across CP12, Service Record,
// and all future form types.
// ============================================

import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../config/supabase';
import { sanitizeRecipients, sendCp12CertificateEmail } from './email';
import {
    generateRegisteredPdf,
    generateRegisteredPdfBase64,
    generateRegisteredPdfUrl,
} from './pdf/registry';
import type { BaseLockedPayload } from './pdf/shared';
import { getCompanyAndEngineer } from './pdf/shared';

// ─── Types ──────────────────────────────────────────────────────

export interface FormDocumentConfig {
  /** The `kind` discriminator e.g. 'cp12', 'service_record', 'warning_notice' */
  kind: string;
  /** Supabase document `type` column value. Falls back to 'quote' if type check fails */
  documentType: string;
  /** Human-readable label e.g. "Gas Safety Certificate" */
  label: string;
}

export interface CustomerSnapshot {
  name: string;
  company_name?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
  address: string;
}

export interface SaveDocumentParams {
  config: FormDocumentConfig;
  companyId: string;
  userId: string;
  certRef: string;
  /** The form-specific PdfData to be wrapped in a locked payload */
  pdfData: any;
  customerSnapshot: CustomerSnapshot;
  customerId?: string | null;
  editingDocumentId?: string | null;
  /** Optional expiry/next-due date to store on the document row */
  expiryDate?: string | null;
}

export interface SaveDocumentResult {
  lockedPayload: BaseLockedPayload;
  documentId: string;
}

// ─── Build locked payload ───────────────────────────────────────

export async function buildLockedPayload(
  kind: string,
  pdfData: any,
  companyId: string,
  userId: string,
): Promise<BaseLockedPayload> {
  const { company, engineer } = await getCompanyAndEngineer(companyId, userId);
  return {
    kind,
    version: 1,
    savedAt: new Date().toISOString(),
    pdfData,
    company,
    engineer,
  };
}

// ─── Save / update a document row ───────────────────────────────

export async function saveFormDocument(
  params: SaveDocumentParams,
): Promise<SaveDocumentResult> {
  const {
    config,
    companyId,
    userId,
    certRef,
    pdfData,
    customerSnapshot,
    customerId,
    editingDocumentId,
    expiryDate,
  } = params;

  const lockedPayload = await buildLockedPayload(config.kind, pdfData, companyId, userId);

  // ── UPDATE existing document ──
  if (editingDocumentId) {
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        reference: certRef,
        expiry_date: expiryDate || null,
        customer_id: customerId || null,
        customer_snapshot: customerSnapshot,
        payment_info: JSON.stringify(lockedPayload),
      })
      .eq('id', editingDocumentId);

    if (updateError) throw updateError;
    return { lockedPayload, documentId: editingDocumentId };
  }

  // ── INSERT new document ──
  const docNumber = Number(String(Date.now()).slice(-8));
  const documentBase = {
    company_id: companyId,
    type: config.documentType as any,
    number: docNumber,
    reference: certRef,
    date: new Date().toISOString(),
    expiry_date: expiryDate || null,
    status: 'Sent' as const,
    customer_id: customerId || null,
    customer_snapshot: customerSnapshot,
    items: [],
    subtotal: 0,
    discount_percent: 0,
    total: 0,
    notes: `${config.label} (locked snapshot)`,
    payment_info: JSON.stringify(lockedPayload),
  };

  const { data: insertedRows, error: saveError } = await supabase
    .from('documents')
    .insert(documentBase)
    .select('id')
    .limit(1);

  if (saveError) {
    // Fallback: if type constraint fails (enum hasn't been added yet), use 'quote'
    const msg = (saveError.message || '').toLowerCase();
    if (msg.includes('type') || msg.includes('enum') || msg.includes('check constraint')) {
      const { data: fallbackRows, error: fbErr } = await supabase
        .from('documents')
        .insert({ ...documentBase, type: 'quote' as const })
        .select('id')
        .limit(1);
      if (fbErr) throw fbErr;
      return { lockedPayload, documentId: fallbackRows?.[0]?.id as string };
    }
    throw saveError;
  }

  return { lockedPayload, documentId: insertedRows?.[0]?.id as string };
}

// ─── Get next cert reference ────────────────────────────────────

export async function getNextCertReference(reserve: boolean): Promise<string> {
  const { data, error } = await supabase.rpc('get_next_gas_cert_reference', { reserve });
  if (error || typeof data !== 'string') {
    throw new Error(error?.message || 'Failed to generate certificate reference.');
  }
  return data;
}

// ─── Complete form action (save / view / email) ─────────────────

export interface CompleteFormParams {
  action: 'save' | 'email' | 'view';
  config: FormDocumentConfig;
  companyId: string;
  userId: string;
  certRef: string;
  pdfData: any;
  customerSnapshot: CustomerSnapshot;
  customerId?: string | null;
  editingDocumentId?: string | null;
  expiryDate?: string | null;

  // For email action
  emailRecipients?: string[];
  emailContext?: {
    propertyAddress: string;
    inspectionDate: string;
    nextDueDate: string;
    landlordName: string;
    tenantName: string;
  };

  // Callbacks
  onReset: () => void;
  setCertRef?: (ref: string) => void;
}

/**
 * Unified complete handler for all form types.
 * Handles save, view (open in browser), and email actions.
 * Returns the document ID on success.
 */
export async function completeFormAction(
  params: CompleteFormParams,
): Promise<string> {
  const {
    action,
    config,
    companyId,
    userId,
    editingDocumentId,
    expiryDate,
    emailRecipients,
    emailContext,
    onReset,
    setCertRef,
  } = params;

  // Resolve cert reference
  let certRef = params.certRef;
  if (!editingDocumentId || !certRef) {
    certRef = await getNextCertReference(true);
    setCertRef?.(certRef);
  }

  // Save document
  const { lockedPayload, documentId } = await saveFormDocument({
    config,
    companyId,
    userId,
    certRef,
    pdfData: params.pdfData,
    customerSnapshot: params.customerSnapshot,
    customerId: params.customerId,
    editingDocumentId,
    expiryDate,
  });

  if (!documentId) throw new Error(`Failed to create ${config.label} document.`);

  const savedLabel = editingDocumentId ? 'Updated' : 'Saved';

  if (action === 'save') {
    return documentId;
  }

  if (action === 'view') {
    const pdfUrl = await generateRegisteredPdfUrl(lockedPayload, companyId, certRef);
    void WebBrowser.openBrowserAsync(pdfUrl);
    return documentId;
  }

  // Email
  const recipients = sanitizeRecipients(emailRecipients || []);
  if (!recipients.length) {
    throw new Error('No valid email recipients found.');
  }

  const pdfBase64 = await generateRegisteredPdfBase64(lockedPayload, companyId);

  await sendCp12CertificateEmail({
    to: recipients,
    certRef,
    propertyAddress: emailContext?.propertyAddress || '',
    inspectionDate: emailContext?.inspectionDate || '',
    nextDueDate: emailContext?.nextDueDate || '',
    landlordName: emailContext?.landlordName || '',
    tenantName: emailContext?.tenantName || '',
    pdfBase64,
  });

  // Also trigger share sheet so engineer has a local copy
  await generateRegisteredPdf(lockedPayload, 'share', companyId);

  return documentId;
}
