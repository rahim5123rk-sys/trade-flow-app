// ============================================
// FILE: src/services/DocumentGenerator.ts
// (Formerly InvoiceGenerator.ts)
// ============================================

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../config/supabase';

export type DocumentType = 'invoice' | 'quote';

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatPercent: number;
}

export interface DocumentData {
  type: DocumentType; // ✅ NEW: Toggle between Invoice and Quote
  number: number;     // Invoice # or Quote #
  reference?: string;
  date: string;
  
  // For Invoice: "Due Date", For Quote: "Valid Until"
  expiryDate: string; 
  status: string;
  
  // Billing (Granular)
  customerName: string;
  customerCompany?: string;
  customerAddress1: string;
  customerCity: string;
  customerPostcode: string;
  
  // Job Site (Granular)
  jobAddress1: string;
  jobCity: string;
  jobPostcode: string;
  
  jobDate?: string;
  
  items: LineItem[];
  discountPercent: number;
  partialPayment: number;
  
  notes?: string;       
  paymentInfo?: string; // For Invoices: Bank Details. For Quotes: Scope/Exclusions.
}

interface CompanyInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
  logoUrl?: string;
  signatureBase64?: string;
  invoiceTerms?: string;
  quoteTerms?: string; // ✅ NEW: Specific terms for quotes
}

async function getCompanyInfo(companyId: string): Promise<CompanyInfo> {
  const { data } = await supabase.from('companies').select('*').eq('id', companyId).single();
  const s = data?.settings || {};
  return {
    name: data?.name || 'Your Company',
    email: data?.email || '',
    phone: data?.phone || '',
    address: data?.address || '',
    logoUrl: data?.logo_url || null,
    signatureBase64: s.signatureBase64 || null,
    invoiceTerms: s.invoiceTerms || '',
    quoteTerms: s.quoteTerms || '',
  };
}

export async function generateDocument(data: DocumentData, companyId: string): Promise<void> {
  const company = await getCompanyInfo(companyId);
  const isQuote = data.type === 'quote';

  // --- Calculations ---
  let subtotal = 0;
  let totalVat = 0;
  const lineRows = data.items.map((item) => {
    const totalExVat = item.quantity * item.unitPrice;
    const vatAmount = totalExVat * (item.vatPercent / 100);
    subtotal += totalExVat;
    totalVat += vatAmount;
    return { ...item, totalExVat, vatAmount };
  });

  const discountAmount = subtotal * (data.discountPercent / 100);
  const adjustedVat = totalVat * ((subtotal - discountAmount) / subtotal) || 0; 
  const grandTotal = (subtotal - discountAmount) + adjustedVat;
  const balanceDue = grandTotal - data.partialPayment;

  // --- Labels ---
  const title = isQuote ? 'QUOTE' : 'INVOICE';
  const numberLabel = isQuote ? 'Quote #:' : 'Invoice #:';
  const dateLabel = isQuote ? 'Date Issued:' : 'Invoice Date:';
  const expiryLabel = isQuote ? 'Valid Until:' : 'Due Date:';
  const totalLabel = isQuote ? 'Total Estimate' : 'Amount Due';
  const footerTitle = isQuote ? 'Acceptance' : 'Payment Instructions';
  const termsText = isQuote 
    ? (company.quoteTerms || 'This quote is valid for 30 days. Sign above to accept.') 
    : (company.invoiceTerms || 'Payment due on receipt.');

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { margin: 0; size: A4; }
  * { box-sizing: border-box; }
  body { 
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
    color: #334155; font-size: 11px; line-height: 1.3; margin: 0; 
    padding: 20mm; padding-bottom: 45mm; -webkit-print-color-adjust: exact;
  }
  .row { display: flex; flex-direction: row; justify-content: space-between; gap: 20px; }
  .col { flex: 1; }
  .text-right { text-align: right; }
  .bold { font-weight: 700; color: #0f172a; }

  /* HEADER */
  .header { margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
  .company-logo { height: 60px; width: auto; object-fit: contain; margin-bottom: 8px; display: block; }
  .company-title { font-size: 16px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 4px; }
  .company-text { font-size: 10px; color: #475569; display: block; margin-bottom: 1px; }

  .doc-title { font-size: 24px; font-weight: 800; color: #cbd5e1; text-align: right; margin-bottom: 10px; letter-spacing: 2px; }
  .meta-row { display: flex; justify-content: flex-end; gap: 12px; margin-bottom: 3px; }
  .meta-label { font-weight: 600; color: #64748b; font-size: 10px; }
  .meta-val { font-weight: 700; color: #0f172a; font-size: 10px; min-width: 70px; text-align: right; }

  /* ADDRESS GRID */
  .address-grid { display: flex; gap: 30px; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #f1f5f9; }
  .addr-box { flex: 1; }
  .addr-header { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
  .addr-name { font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
  .addr-text { font-size: 11px; color: #334155; display: block; margin-bottom: 1px; }

  /* TABLE */
  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { background: #f8fafc; color: #64748b; font-weight: 700; font-size: 9px; text-transform: uppercase; padding: 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  td { padding: 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; font-size: 10px; }
  .col-desc { width: 45%; }
  .col-num { text-align: right; white-space: nowrap; }

  /* TOTALS */
  .totals-container { display: flex; justify-content: flex-end; margin-top: 10px; page-break-inside: avoid; }
  .totals-table { width: 220px; }
  .t-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 10px; }
  .t-label { color: #64748b; }
  .t-val { color: #0f172a; font-weight: 600; }
  .t-grand { border-top: 2px solid #0f172a; margin-top: 6px; padding-top: 6px; }
  .t-grand .t-label { font-size: 12px; font-weight: 700; color: #0f172a; }
  .t-grand .t-val { font-size: 14px; font-weight: 800; color: #0f172a; }

  /* NOTES */
  .notes-box { margin-top: 20px; padding: 10px; background: #fffbeb; border: 1px dashed #e2e8f0; border-radius: 4px; page-break-inside: avoid; }
  .notes-title { font-size: 9px; font-weight: 700; color: #b45309; text-transform: uppercase; margin-bottom: 2px; }
  .notes-content { font-size: 10px; color: #334155; }

  /* FOOTER */
  .footer { position: fixed; bottom: 15mm; left: 20mm; right: 20mm; height: 35mm; background: #fff; border-top: 1px solid #0f172a; padding-top: 10px; display: flex; justify-content: space-between; gap: 20px; }
  .left-box { flex: 1; font-size: 9px; line-height: 1.4; color: #475569; }
  .box-title { font-weight: 700; font-size: 9px; color: #0f172a; text-transform: uppercase; margin-bottom: 3px; }
  
  .sig-box { width: 140px; text-align: right; display: flex; flex-direction: column; justify-content: flex-end; }
  .sig-img { height: 35px; width: auto; object-fit: contain; align-self: flex-end; margin-bottom: 2px; }
  .sig-line { border-top: 1px solid #cbd5e1; font-size: 8px; color: #94a3b8; padding-top: 2px; text-transform: uppercase; text-align: center; }
  .terms { position: fixed; bottom: 8mm; left: 0; right: 0; text-align: center; font-size: 8px; color: #94a3b8; }
</style>
</head>
<body>

  <div class="header">
    <div class="col">
      ${company.logoUrl ? `<img src="${company.logoUrl}" class="company-logo" />` : ''}
      <div class="company-title">${company.name}</div>
      <div class="company-text">${company.address.replace(/\n/g, ', ')}</div>
      <div class="company-text">${company.phone}</div>
      <div class="company-text">${company.email}</div>
    </div>
    <div class="col">
      <div class="doc-title">${title}</div>
      <div class="meta-row"><span class="meta-label">${numberLabel}</span><span class="meta-val">#${String(data.number).padStart(4, '0')}</span></div>
      <div class="meta-row"><span class="meta-label">${dateLabel}</span><span class="meta-val">${data.date}</span></div>
      <div class="meta-row"><span class="meta-label">${expiryLabel}</span><span class="meta-val">${data.expiryDate}</span></div>
      ${data.reference ? `<div class="meta-row"><span class="meta-label">Reference:</span><span class="meta-val">${data.reference}</span></div>` : ''}
    </div>
  </div>

  <div class="address-grid">
    <div class="addr-box">
      <div class="addr-header">Bill To</div>
      <div class="addr-name">${data.customerName}</div>
      ${data.customerCompany ? `<div class="addr-text">${data.customerCompany}</div>` : ''}
      <div class="addr-text">${data.customerAddress1}</div>
      <div class="addr-text">${data.customerCity}</div>
      <div class="addr-text">${data.customerPostcode}</div>
    </div>
    <div class="addr-box text-right">
      <div class="addr-header" style="border-color:transparent;">Job / Site Address</div>
      <div class="addr-text">${data.jobAddress1}</div>
      <div class="addr-text">${data.jobCity}</div>
      <div class="addr-text">${data.jobPostcode}</div>
      ${data.jobDate ? `<div class="addr-text" style="margin-top:4px; font-weight:600;">Job Date: ${data.jobDate}</div>` : ''}
    </div>
  </div>

  <table>
    <thead><tr><th class="col-desc">Description</th><th class="col-num">Qty</th><th class="col-num">Price</th><th class="col-num">VAT</th><th class="col-num">Total</th></tr></thead>
    <tbody>
      ${lineRows.map(row => `<tr><td class="col-desc"><div class="bold">${row.description}</div></td><td class="col-num">${row.quantity}</td><td class="col-num">£${row.unitPrice.toFixed(2)}</td><td class="col-num">${row.vatPercent}%</td><td class="col-num">£${row.totalExVat.toFixed(2)}</td></tr>`).join('')}
    </tbody>
  </table>

  <div class="totals-container">
    <div class="totals-table">
      <div class="t-row"><span class="t-label">Subtotal</span><span class="t-val">£${subtotal.toFixed(2)}</span></div>
      ${data.discountPercent > 0 ? `<div class="t-row"><span class="t-label">Discount (${data.discountPercent}%)</span><span class="t-val">-£${discountAmount.toFixed(2)}</span></div>` : ''}
      <div class="t-row"><span class="t-label">Total VAT</span><span class="t-val">£${adjustedVat.toFixed(2)}</span></div>
      <div class="t-row t-grand"><span class="t-label">${totalLabel}</span><span class="t-val">£${balanceDue.toFixed(2)}</span></div>
    </div>
  </div>

  ${data.notes ? `<div class="notes-box"><div class="notes-title">Job Notes</div><div class="notes-content">${data.notes.replace(/\n/g, '<br/>')}</div></div>` : ''}

  <div class="footer">
    <div class="left-box">
      <div class="box-title">${footerTitle}</div>
      ${isQuote 
        ? `<div style="height:30px; border-bottom:1px dashed #cbd5e1; width:200px; margin-top:15px;"></div><div style="font-size:8px; color:#94a3b8; margin-top:4px;">Customer Signature</div>` 
        : `<div style="white-space: pre-wrap;">${data.paymentInfo || 'Please update bank details in Settings.'}</div>`
      }
    </div>
    <div class="sig-box">
      ${company.signatureBase64 ? `<img src="${company.signatureBase64}" class="sig-img" />` : '<div style="height:35px;"></div>'}
      <div class="sig-line">Authorised Signature</div>
    </div>
  </div>
  <div class="terms">${termsText}</div>
</body>
</html>
  `;

  if (!(await Sharing.isAvailableAsync())) {
    alert("Sharing is not available on this device");
    return;
  }

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${title} #${data.number}`, UTI: 'com.adobe.pdf' });
}