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
  /** Supabase document `type` column value */
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

export interface CustomerFormFields {
  customerName: string;
  customerCompany?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postCode?: string;
  phone?: string;
  email?: string;
}

/** Build the address string shared between pdfData and customerSnapshot. */
export function buildCustomerAddress(fields: Pick<CustomerFormFields, 'addressLine1' | 'addressLine2' | 'city' | 'postCode'>): string {
  return [fields.addressLine1, fields.addressLine2, fields.city, fields.postCode].filter(Boolean).join(', ');
}

/** Build the CustomerSnapshot object for document creation. */
export function buildCustomerSnapshot(customerForm: CustomerFormFields): CustomerSnapshot {
  return {
    name: customerForm.customerName || 'Customer',
    company_name: customerForm.customerCompany || null,
    address_line_1: customerForm.addressLine1 || null,
    address_line_2: customerForm.addressLine2 || null,
    city: customerForm.city || null,
    postal_code: customerForm.postCode || null,
    phone: customerForm.phone || null,
    email: customerForm.email || null,
    address: buildCustomerAddress(customerForm),
  };
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
    user_id: userId,
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

  if (saveError) throw saveError;

  return { lockedPayload, documentId: insertedRows?.[0]?.id as string };
}

// ─── Get next cert reference ────────────────────────────────────

export async function getNextCertReference(reserve: boolean, companyId?: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_next_gas_cert_reference', {
    reserve,
    p_company_id: companyId || null,
  });
  if (error || typeof data !== 'string') {
    throw new Error(error?.message || 'Failed to generate certificate reference.');
  }
  return data;
}

export async function getNextInvoiceReference(reserve: boolean, companyId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_next_invoice_reference', {
    reserve,
    p_company_id: companyId,
  });
  if (error || typeof data !== 'string') {
    throw new Error(error?.message || 'Failed to generate invoice reference.');
  }
  return data;
}

export async function getNextQuoteReference(reserve: boolean, companyId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_next_quote_reference', {
    reserve,
    p_company_id: companyId,
  });
  if (error || typeof data !== 'string') {
    throw new Error(error?.message || 'Failed to generate quote reference.');
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
    certRef = await getNextCertReference(true, companyId);
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

  // Auto-save new customer to database if not already existing (with dedup)
  if (!params.customerId && params.customerSnapshot.name && params.customerSnapshot.name !== 'Customer') {
    void (async () => {
      try {
        // Check for existing customer first
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('company_id', companyId)
          .ilike('name', params.customerSnapshot.name)
          .limit(1)
          .maybeSingle();

        let customerId = existing?.id;
        if (!customerId) {
          const { data: inserted } = await supabase
            .from('customers')
            .insert({
              company_id: companyId,
              name: params.customerSnapshot.name,
              company_name: params.customerSnapshot.company_name || null,
              address_line_1: params.customerSnapshot.address_line_1 || null,
              address_line_2: params.customerSnapshot.address_line_2 || null,
              city: params.customerSnapshot.city || null,
              postal_code: params.customerSnapshot.postal_code || null,
              email: params.customerSnapshot.email || null,
              phone: params.customerSnapshot.phone || null,
            })
            .select('id')
            .single();
          customerId = inserted?.id;
        }

        if (customerId && documentId) {
          await supabase.from('documents').update({ customer_id: customerId }).eq('id', documentId);
        }
      } catch { /* silently fail — customer snapshot is already saved */ }
    })();
  }

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
    formLabel: config.label,
  });

  // Also trigger share sheet so engineer has a local copy
  await generateRegisteredPdf(lockedPayload, 'share', companyId, certRef);

  return documentId;
}
