// Pushes a GasPilot invoice document to Xero as a DRAFT invoice.
//
// Called from the mobile app after the invoice is saved + sent. Idempotent:
// re-pushing the same document_id updates the existing Xero invoice
// (via xero_invoice_sync mapping). If the Xero invoice has been Authorised
// in Xero, we skip update to avoid clobbering the admin's edits there.

import {
  CORS_HEADERS,
  getFreshAccessToken,
  serviceClient,
  userFromAuthHeader,
  xeroApi,
} from '../_shared/xero.ts';

interface InvoiceItem {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  vatPercent?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const user = await userFromAuthHeader(req);
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401, headers: CORS_HEADERS });

  const body = await req.json().catch(() => ({})) as { document_id?: string };
  const documentId = body.document_id;
  if (!documentId) return Response.json({ error: 'document_id required' }, { status: 400, headers: CORS_HEADERS });

  const sb = serviceClient();

  const { data: profile } = await sb.from('profiles').select('company_id, role').eq('id', user.id).maybeSingle();
  if (!profile?.company_id) return Response.json({ error: 'No company' }, { status: 400, headers: CORS_HEADERS });

  // Load the document + verify it belongs to this company + is an invoice.
  const { data: doc, error: dErr } = await sb
    .from('documents')
    .select('id, company_id, type, reference, expiry_date, customer_id, customer_snapshot, items, subtotal, discount_percent, total, notes')
    .eq('id', documentId)
    .maybeSingle();
  if (dErr) return Response.json({ error: dErr.message }, { status: 500, headers: CORS_HEADERS });
  if (!doc) return Response.json({ error: 'Document not found' }, { status: 404, headers: CORS_HEADERS });
  if (doc.company_id !== profile.company_id) return Response.json({ error: 'Forbidden' }, { status: 403, headers: CORS_HEADERS });
  if (doc.type !== 'invoice') return Response.json({ error: 'Only invoices can be pushed (MVP)' }, { status: 400, headers: CORS_HEADERS });

  let accessToken: string;
  let tenantId: string;
  try {
    ({ accessToken, tenantId } = await getFreshAccessToken(sb, profile.company_id));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400, headers: CORS_HEADERS });
  }

  // Upsert Xero contact from customer_snapshot (snapshot is safer than a live
  // customer row because it reflects what the admin actually invoiced).
  const snap = (doc.customer_snapshot ?? {}) as Record<string, unknown>;
  const contactName = (snap.name as string) || (snap.company_name as string) || 'Customer';
  const contactEmail = snap.email as string | undefined;

  let xeroContactId: string | null = null;
  if (doc.customer_id) {
    const { data: existing } = await sb
      .from('xero_contact_sync')
      .select('xero_contact_id')
      .eq('customer_id', doc.customer_id)
      .maybeSingle();
    xeroContactId = existing?.xero_contact_id ?? null;
  }

  if (!xeroContactId) {
    const contactPayload = {
      Contacts: [{
        Name: contactName,
        ...(contactEmail ? { EmailAddress: contactEmail } : {}),
        ...((snap.phone as string | undefined) ? { Phones: [{ PhoneType: 'DEFAULT', PhoneNumber: snap.phone as string }] } : {}),
        ...(snap.address ? { Addresses: [{
          AddressType: 'STREET',
          AddressLine1: (snap.address_line_1 as string | undefined) ?? '',
          City: (snap.city as string | undefined) ?? '',
          PostalCode: (snap.postal_code as string | undefined) ?? '',
          Country: 'United Kingdom',
        }] } : {}),
      }],
    };

    try {
      const res = await xeroApi<{ Contacts: Array<{ ContactID: string }> }>(
        '/api.xro/2.0/Contacts',
        accessToken,
        tenantId,
        { method: 'POST', body: JSON.stringify(contactPayload) },
      );
      xeroContactId = res.Contacts?.[0]?.ContactID ?? null;
    } catch (e) {
      // Contact creation can fail with 400 "contact name already exists".
      // Fall back to searching by name.
      const searchRes = await xeroApi<{ Contacts?: Array<{ ContactID: string }> }>(
        `/api.xro/2.0/Contacts?where=${encodeURIComponent(`Name="${contactName.replace(/"/g, '\\"')}"`)}`,
        accessToken,
        tenantId,
      ).catch(() => ({ Contacts: [] as Array<{ ContactID: string }> }));
      xeroContactId = searchRes.Contacts?.[0]?.ContactID ?? null;
      if (!xeroContactId) throw e;
    }

    if (doc.customer_id && xeroContactId) {
      await sb.from('xero_contact_sync').upsert({
        customer_id: doc.customer_id,
        company_id: profile.company_id,
        xero_contact_id: xeroContactId,
      }, { onConflict: 'customer_id' });
    }
  }

  // Line items. Xero accepts line amounts inclusive/exclusive of tax; we use
  // EXCLUSIVE and pass UnitAmount as the pre-VAT price, matching GasPilot's
  // data model. TaxType NOTREGISTERED if the admin isn't VAT registered —
  // but MVP: we trust vatPercent from the item. Zero VAT = NOTAX; 20% = OUTPUT2.
  const items = (doc.items ?? []) as InvoiceItem[];
  const lineItems = items.map((it) => {
    const vat = Number(it.vatPercent ?? 0);
    const taxType = vat === 0 ? 'NONE' : vat === 20 ? 'OUTPUT2' : vat === 5 ? 'OUTPUT' : 'NONE';
    return {
      Description: it.description || '(no description)',
      Quantity: Number(it.quantity ?? 1),
      UnitAmount: Number(it.unitPrice ?? 0),
      AccountCode: '200',
      TaxType: taxType,
    };
  });

  const dueDate = doc.expiry_date ? new Date(doc.expiry_date).toISOString().slice(0, 10) : undefined;

  // Check if we already synced this document.
  const { data: existingSync } = await sb
    .from('xero_invoice_sync')
    .select('xero_invoice_id, status')
    .eq('document_id', documentId)
    .maybeSingle();

  const invoicePayload: Record<string, unknown> = {
    Type: 'ACCREC',
    Contact: { ContactID: xeroContactId },
    LineItems: lineItems,
    Status: 'DRAFT',
    LineAmountTypes: 'Exclusive',
    InvoiceNumber: doc.reference ?? undefined,
    Reference: doc.reference ?? undefined,
    ...(dueDate ? { DueDate: dueDate } : {}),
    ...(doc.notes ? { Reference: String(doc.notes).slice(0, 255) } : {}),
    CurrencyCode: 'GBP',
  };

  let xeroInvoiceId: string;
  let xeroInvoiceNumber: string | undefined;
  let resultStatus = 'DRAFT';

  if (existingSync && existingSync.status === 'DRAFT') {
    // Update in place.
    try {
      const res = await xeroApi<{ Invoices: Array<{ InvoiceID: string; InvoiceNumber: string; Status: string }> }>(
        `/api.xro/2.0/Invoices/${existingSync.xero_invoice_id}`,
        accessToken,
        tenantId,
        { method: 'POST', body: JSON.stringify({ Invoices: [invoicePayload] }) },
      );
      xeroInvoiceId = res.Invoices[0].InvoiceID;
      xeroInvoiceNumber = res.Invoices[0].InvoiceNumber;
      resultStatus = res.Invoices[0].Status;
    } catch (e) {
      await sb.from('xero_invoice_sync').update({ last_error: (e as Error).message.slice(0, 1000) }).eq('document_id', documentId);
      return Response.json({ error: (e as Error).message }, { status: 500, headers: CORS_HEADERS });
    }
  } else {
    // Create new (or re-create after deletion / non-DRAFT status).
    try {
      const res = await xeroApi<{ Invoices: Array<{ InvoiceID: string; InvoiceNumber: string; Status: string }> }>(
        '/api.xro/2.0/Invoices',
        accessToken,
        tenantId,
        { method: 'POST', body: JSON.stringify({ Invoices: [invoicePayload] }) },
      );
      xeroInvoiceId = res.Invoices[0].InvoiceID;
      xeroInvoiceNumber = res.Invoices[0].InvoiceNumber;
      resultStatus = res.Invoices[0].Status;
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 500, headers: CORS_HEADERS });
    }
  }

  await sb.from('xero_invoice_sync').upsert({
    document_id: documentId,
    company_id: profile.company_id,
    xero_invoice_id: xeroInvoiceId,
    xero_invoice_number: xeroInvoiceNumber ?? null,
    status: resultStatus,
    synced_at: new Date().toISOString(),
    last_error: null,
  }, { onConflict: 'document_id' });

  return Response.json(
    { ok: true, xero_invoice_id: xeroInvoiceId, xero_invoice_number: xeroInvoiceNumber, status: resultStatus },
    { headers: CORS_HEADERS },
  );
});
