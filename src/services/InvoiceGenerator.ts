// ============================================
// FILE: src/services/invoiceGenerator.ts
// ============================================

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../config/supabase';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatPercent: number;
}

export interface InvoiceData {
  invoiceNumber: number;
  invoiceRef?: string;
  date: string;          // e.g. "29th September 2025"
  dueDate: string;
  status: 'Unpaid' | 'Paid' | 'Overdue';
  // Bill To
  customerName: string;
  customerCompany?: string;
  customerAddress: string;
  // Inspection / Job Address (optional, if different)
  inspectionName?: string;
  inspectionAddress?: string;
  // Line items
  items: InvoiceLineItem[];
  // Totals
  discountPercent?: number;
  partialPayment?: number;
  // Notes & terms
  notes?: string;
  terms?: string;
}

export const generateInvoice = async (
  invoice: InvoiceData,
  companyId: string
) => {
  // 1. Fetch company details
  let company: any = {
    name: 'Your Business',
    address: '',
    phone: '',
    email: '',
    logo_url: null,
    trade: '',
  };

  try {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();
    if (data) company = data;
  } catch (e) {
    console.warn('Could not fetch company data for invoice', e);
  }

  // 2. Calculate totals
  const subtotal = invoice.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const vatTotal = invoice.items.reduce(
    (sum, item) =>
      sum + item.quantity * item.unitPrice * (item.vatPercent / 100),
    0
  );
  const discount = invoice.discountPercent
    ? subtotal * (invoice.discountPercent / 100)
    : 0;
  const partial = invoice.partialPayment || 0;
  const amountDue = subtotal + vatTotal - discount - partial;

  // 3. Build line item rows
  const lineItemsHtml = invoice.items
    .map(
      (item, i) => `
      <tr>
        <td style="text-align:center; padding:10px 8px; border-bottom:1px solid #e2e8f0; font-size:13px;">${i + 1}</td>
        <td style="padding:10px 8px; border-bottom:1px solid #e2e8f0; font-size:13px;">${item.description}</td>
        <td style="text-align:center; padding:10px 8px; border-bottom:1px solid #e2e8f0; font-size:13px;">${item.quantity}</td>
        <td style="text-align:right; padding:10px 8px; border-bottom:1px solid #e2e8f0; font-size:13px;">${item.unitPrice.toFixed(2)}</td>
        <td style="text-align:center; padding:10px 8px; border-bottom:1px solid #e2e8f0; font-size:13px;">${item.vatPercent}</td>
        <td style="text-align:right; padding:10px 8px; border-bottom:1px solid #e2e8f0; font-size:13px;">${(item.quantity * item.unitPrice * (item.vatPercent / 100)).toFixed(2)}</td>
        <td style="text-align:right; padding:10px 8px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:600;">${(item.quantity * item.unitPrice).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  // 4. Status colour
  const statusColor =
    invoice.status === 'Paid'
      ? '#10B981'
      : invoice.status === 'Overdue'
      ? '#EF4444'
      : '#F59E0B';

  // 5. Construct HTML matching the uploaded invoice layout
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1e293b;
            padding: 40px;
            font-size: 14px;
            line-height: 1.5;
          }

          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
          .logo-box { width: 80px; height: 80px; }
          .logo-img { max-width: 80px; max-height: 80px; object-fit: contain; }

          .company-info { text-align: right; }
          .company-name { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
          .company-detail { font-size: 12px; color: #475569; line-height: 1.6; }
          .company-detail strong { color: #0f172a; }

          .invoice-meta { margin-bottom: 24px; }
          .invoice-number { font-size: 28px; font-weight: 800; color: #0f172a; }
          .invoice-ref { font-size: 14px; color: #64748b; margin-top: 2px; }
          .meta-row { display: flex; gap: 4px; margin-top: 4px; font-size: 13px; color: #475569; }
          .meta-row strong { color: #0f172a; min-width: 80px; display: inline-block; }
          .status-badge {
            display: inline-block;
            margin-top: 8px;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 700;
            color: ${statusColor};
            background: ${statusColor}15;
          }

          .addresses { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }
          .addr-col { flex: 1; }
          .addr-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
          .addr-name { font-weight: 700; color: #0f172a; font-size: 14px; }
          .addr-company { font-size: 13px; color: #475569; font-style: italic; }
          .addr-text { font-size: 13px; color: #475569; line-height: 1.6; }

          .dates-row { text-align: right; margin-bottom: 16px; font-size: 13px; color: #475569; }
          .dates-row strong { color: #0f172a; }

          table.invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          table.invoice-table thead th {
            background: #f1f5f9;
            padding: 10px 8px;
            font-size: 11px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            text-align: left;
            border-bottom: 2px solid #e2e8f0;
          }
          table.invoice-table thead th:first-child { text-align: center; width: 30px; }
          table.invoice-table thead th:nth-child(3),
          table.invoice-table thead th:nth-child(5) { text-align: center; }
          table.invoice-table thead th:nth-child(4),
          table.invoice-table thead th:nth-child(6),
          table.invoice-table thead th:nth-child(7) { text-align: right; }

          .totals-section { display: flex; justify-content: flex-end; margin-bottom: 30px; }
          .totals-box { width: 280px; }
          .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #64748b; }
          .total-row span:last-child { font-weight: 600; color: #0f172a; }
          .grand-total { border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 10px; }
          .grand-total span { font-size: 16px; font-weight: 800; color: #0f172a; }

          .notes-section { margin-bottom: 20px; }
          .notes-title { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
          .notes-subtitle { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
          .notes-text { font-size: 13px; color: #475569; line-height: 1.6; white-space: pre-line; }

          .terms-section { margin-top: 16px; }
          .terms-title { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
          .terms-text { font-size: 13px; color: #475569; }
        </style>
      </head>
      <body>

        <!-- Header -->
        <div class="header">
          <div class="logo-box">
            ${
              company.logo_url
                ? `<img src="${company.logo_url}" class="logo-img" />`
                : ''
            }
          </div>
          <div class="company-info">
            <div class="company-name">${company.name}</div>
            <div class="company-detail">
              <strong>Address:</strong> ${company.address || ''}<br>
              <strong>Tel Number:</strong> ${company.phone || ''}<br>
              ${company.email ? `<strong>Email:</strong> ${company.email}` : ''}
            </div>
          </div>
        </div>

        <!-- Invoice Meta -->
        <div class="invoice-meta">
          <div class="invoice-number">Invoice: #${invoice.invoiceNumber}</div>
          ${invoice.invoiceRef ? `<div class="invoice-ref">Invoice Ref: ${invoice.invoiceRef}</div>` : ''}
          <div class="meta-row"><strong>Date:</strong> ${invoice.date}</div>
          <div class="meta-row"><strong>Due Date:</strong> ${invoice.dueDate}</div>
          <div class="status-badge">Status ${invoice.status}</div>
        </div>

        <!-- Addresses -->
        <div class="addresses">
          <div class="addr-col">
            <div class="addr-label">Bill To:</div>
            <div class="addr-name">${invoice.customerName}</div>
            ${invoice.customerCompany ? `<div class="addr-company">${invoice.customerCompany}</div>` : ''}
            <div class="addr-text">${invoice.customerAddress.replace(/\n/g, '<br>')}</div>
          </div>
          ${
            invoice.inspectionAddress
              ? `
          <div class="addr-col" style="text-align: right;">
            <div class="addr-label">Inspection Address Details</div>
            ${invoice.inspectionName ? `<div class="addr-name">${invoice.inspectionName}</div>` : ''}
            <div class="addr-text">${invoice.inspectionAddress.replace(/\n/g, '<br>')}</div>
          </div>`
              : ''
          }
        </div>

        <!-- Dates Row -->
        <div class="dates-row">
          <strong>Date:</strong> ${invoice.date} &nbsp;&nbsp;
          <strong>Due Date:</strong> ${invoice.dueDate}
        </div>

        <!-- Line Items Table -->
        <table class="invoice-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit Price (£)</th>
              <th>VAT (%)</th>
              <th>VAT (£)</th>
              <th>Total (£)</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHtml}
          </tbody>
        </table>

        <!-- Totals -->
        <div class="totals-section">
          <div class="totals-box">
            <div class="total-row">
              <span>Discount %</span>
              <span>${invoice.discountPercent || 0}</span>
            </div>
            <div class="total-row">
              <span>Subtotal £</span>
              <span>${(subtotal - discount).toFixed(0)}</span>
            </div>
            <div class="total-row">
              <span>VAT Total £</span>
              <span>${vatTotal.toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>Partial Payment</span>
              <span>${partial}</span>
            </div>
            <div class="total-row grand-total">
              <span>Amount Due £</span>
              <span>${amountDue.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <!-- Notes -->
        ${
          invoice.notes
            ? `
        <div class="notes-section">
          <div class="notes-title">Notes</div>
          <div class="notes-text">${invoice.notes.replace(/\n/g, '<br>')}</div>
        </div>`
            : ''
        }

        <!-- Terms -->
        ${
          invoice.terms
            ? `
        <div class="terms-section">
          <div class="terms-title">Terms</div>
          <div class="terms-text">${invoice.terms}</div>
        </div>`
            : ''
        }

      </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, {
      UTI: '.pdf',
      mimeType: 'application/pdf',
    });
    return uri;
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    throw error;
  }
};