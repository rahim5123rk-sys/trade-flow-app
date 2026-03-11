// ============================================
// FILE: src/services/pdf/shared.ts
// Shared PDF infrastructure for all gas form PDFs
//
// Contains:
//  - Asset helpers (logo loading, image data URIs)
//  - Company & engineer data fetching
//  - HTML helpers (escapeHtml, tick/check icons)
//  - Base CSS for the slate/charcoal A4-landscape theme
//  - Header & footer HTML builders
//  - Print / share / upload utilities
//  - Generic locked-payload lifecycle
// ============================================

import { Asset } from 'expo-asset';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Image, Platform } from 'react-native';
import { supabase } from '../../config/supabase';
import { escapeHtml } from '../../utils/escapeHtml';
import { getSignedUrl, uploadPdfBase64AndGetUrl } from '../storage';

// ─── Re-export escape helper ────────────────────────────────────

export const esc = (v: unknown): string => escapeHtml(v);

// ─── Shared type contracts ──────────────────────────────────────

export interface CompanyInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
  logoUrl: string;
  signatureBase64: string;
}

export interface EngineerInfo {
  name: string;
  gasSafeNumber: string;
  gasLicenceNumber: string;
}

/**
 * Base locked-payload shape every form type must extend.
 * `kind` acts as a discriminator for polymorphic deserialization.
 */
export interface BaseLockedPayload<K extends string = string, D = unknown> {
  kind: K;
  version: number;
  savedAt: string;
  pdfData: D;
  company: CompanyInfo;
  engineer: EngineerInfo;
}

// ─── Asset helpers ──────────────────────────────────────────────

function getMimeTypeFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

async function getImageDataUriFromUri(uri: string): Promise<string> {
  const base64 = await LegacyFileSystem.readAsStringAsync(uri, {
    encoding: 'base64' as any,
  });
  return `data:${getMimeTypeFromUri(uri)};base64,${base64}`;
}

export async function getGasSafeLogoBase64(): Promise<string> {
  try {
    const moduleRef = require('../../../assets/images/gaslogo.png');
    const asset = Asset.fromModule(moduleRef);
    if (!asset.localUri) await asset.downloadAsync();
    const uri = asset.localUri || Image.resolveAssetSource(moduleRef).uri;
    if (!uri) return '';
    return await getImageDataUriFromUri(uri);
  } catch {
    return '';
  }
}

export async function getCompanyLogoSrc(companyLogoUrl: string): Promise<string> {
  if (!companyLogoUrl) return '';
  return companyLogoUrl;
}

export async function getLatestCompanyLogoUrl(
  companyId?: string,
  fallbackLogoUrl = '',
): Promise<string> {
  if (!companyId) return fallbackLogoUrl;
  try {
    const { data } = await supabase
      .from('companies')
      .select('logo_url')
      .eq('id', companyId)
      .single();
    if (!data?.logo_url) return '';
    return await getSignedUrl(data.logo_url);
  } catch {
    return fallbackLogoUrl;
  }
}

// ─── Fetch company + engineer info from Supabase ────────────────

export async function getCompanyAndEngineer(
  companyId: string,
  userId: string,
): Promise<{ company: CompanyInfo; engineer: EngineerInfo }> {
  const { data } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  const s = data?.settings || {};
  const userDetails = s.userDetailsById?.[userId] || {};

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single();

  return {
    company: {
      name: data?.name || '',
      email: data?.email || '',
      phone: data?.phone || '',
      address: data?.address || '',
      logoUrl: data?.logo_url ? await getSignedUrl(data.logo_url) : '',
      signatureBase64: s.signatureBase64 || '',
    },
    engineer: {
      name: profile?.display_name || '',
      gasSafeNumber: userDetails.gasSafeRegisterNumber || '',
      gasLicenceNumber: userDetails.gasLicenceNumber || '',
    },
  };
}

// ─── HTML helpers ───────────────────────────────────────────────

/** Green ✓ / red ✗ / grey N/A based on Yes/No/Pass/Fail */
export const tickH = (val: string): string => {
  if (!val) return '';
  if (val === 'Yes' || val === 'Pass')
    return '<span style="color:#16a34a;font-weight:800;">✓</span>';
  if (val === 'No' || val === 'Fail')
    return '<span style="color:#dc2626;font-weight:800;">✗</span>';
  return '<span style="color:#6b7280;">N/A</span>';
};

/** Render a check mark in a specific Yes/No/N/A column */
export const checkInH = (val: string, col: 'Yes' | 'No' | 'N/A'): string => {
  if (!val) return '';
  if (col === 'Yes' && (val === 'Yes' || val === 'Pass'))
    return '<span style="color:#16a34a;font-weight:800;font-size:10pt;">✓</span>';
  if (col === 'No' && (val === 'No' || val === 'Fail'))
    return '<span style="color:#dc2626;font-weight:800;font-size:10pt;">✗</span>';
  if (col === 'N/A' && val === 'N/A')
    return '<span style="color:#9ca3af;font-weight:700;font-size:7pt;">N/A</span>';
  return '';
};

/** Parse a comma-separated address into { line1, line2, city, postcode } */
export function parseAddress(address: string): {
  line1: string;
  line2: string;
  city: string;
  postcode: string;
} {
  const parts = (address || '').split(',').map((s) => s.trim()).filter(Boolean);
  const line1 = parts[0] || address || '';
  let line2 = '';
  let city = '';
  let postcode = '';

  if (parts.length >= 4) {
    line2 = parts.slice(1, -2).join(', ');
    city = parts[parts.length - 2] || '';
    postcode = parts[parts.length - 1] || '';
  } else if (parts.length === 3) {
    line2 = parts[1] || '';
    postcode = parts[2] || '';
  } else if (parts.length === 2) {
    line2 = parts[1] || '';
  }

  return { line1, line2, city, postcode };
}

// ─── Shared CSS ─────────────────────────────────────────────────

/**
 * Base CSS for the slate/charcoal A4 landscape PDF theme.
 * All form-specific generators can extend with additional rules.
 */
export function getBaseCss(): string {
  return `
  @page { margin: 0; size: A4 landscape; }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    width: 297mm;
    margin: 0; padding: 0;
  }

  body {
    font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
    font-size: 7pt;
    line-height: 1.2;
    color: #111827;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 100%;
    padding: 3mm;
    display: flex;
    flex-direction: column;
  }

  /* ── Global table styles ── */
  table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
  td, th {
    border: 0.5px solid #d1d5db;
    padding: 2px 4px;
    vertical-align: middle;
    font-size: 6pt;
  }
  th {
    background: #334155;
    color: #fff;
    font-weight: 700;
    font-size: 5.5pt;
    text-transform: uppercase;
    letter-spacing: 0.2px;
    text-align: left;
  }
  td { background: #fff; }

  .label-cell {
    background: #f1f5f9;
    font-weight: 600;
    color: #1e293b;
    width: 32%;
    font-size: 5.5pt;
  }
  .value-cell {
    background: #fff;
    color: #111827;
    font-size: 6pt;
  }

  /* ── Section header bars ── */
  .shdr {
    background: linear-gradient(90deg, #334155 0%, #475569 100%);
    color: #fff;
    font-weight: 700;
    font-size: 6.5pt;
    text-align: center;
    text-transform: uppercase;
    padding: 3px 6px;
    letter-spacing: 0.5px;
  }

  /* ── Appliance table (CP12) ── */
  .at { table-layout: fixed; }
  .at th, .at td { font-size: 5pt; text-align: center; padding: 1px 2px; word-wrap: break-word; overflow-wrap: break-word; }
  .at th { font-size: 4.5pt; line-height: 1.1; background: #334155; }
  .at .grp { background: #1e293b; color: #fff; font-size: 5pt; font-weight: 700; }
  .at td { font-size: 5.5pt; }
  .at tbody td { height: 15px; }
  .at .rn { background: #e2e8f0 !important; font-weight: 700; color: #334155; width: 14px; }
  .at tr.empty td { height: 15px; }

  /* ── Checklist table ── */
  .cl td, .cl th { font-size: 6pt; text-align: center; }
  .cl .lbl { text-align: left; font-weight: 400; color: #374151; }
  .cl .cnum { width: 16px; text-align: center; background: #e2e8f0; font-weight: 700; color: #334155; font-size: 5.5pt; }
  .cl .yna { width: 26px; }

  /* ── Faults table ── */
  .flt th { font-size: 5.5pt; font-weight: 600; background: #f1f5f9; color: #1e293b; vertical-align: top; width: 18%; }
  .flt td { font-size: 6pt; background: #fff; min-height: 12px; vertical-align: top; }
  .flt tr.tall-row th, .flt tr.tall-row td { height: 22px; }

  /* ── Signature footer ── */
  .sig-img { height: 38px; max-width: 100%; display: block; margin: 0 auto; }
  .sig-hdr { background: #f1f5f9; color: #1e293b; font-size: 6pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }

  .next-due {
    background: #fefce8 !important;
    font-weight: 800;
    font-size: 9pt;
    text-align: center;
    color: #92400e;
    vertical-align: middle;
  }
  .next-due-label {
    font-size: 5pt;
    font-weight: 700;
    text-transform: uppercase;
    color: #78350f;
    display: block;
    margin-bottom: 2px;
  }
  .date-box-label {
    font-size: 5pt;
    font-weight: 700;
    text-transform: uppercase;
    color: #78350f;
    display: block;
    margin-bottom: 2px;
  }
  .certbox {
    background: #f1f5f9 !important;
    font-weight: 800;
    font-size: 8pt;
    text-align: center;
    color: #334155;
    vertical-align: middle;
  }
  .certbox-label {
    font-size: 5pt;
    font-weight: 700;
    text-transform: uppercase;
    color: #1e293b;
    display: block;
    margin-bottom: 2px;
  }

  /* ── Warning footer ── */
  .warn {
    border: 1px solid #fca5a5;
    background: #fff7f7;
    text-align: center;
    font-size: 5.5pt;
    font-weight: 600;
    color: #991b1b;
    padding: 3px 8px;
    line-height: 1.4;
    margin-top: -0.5px;
  }

  /* ── Utilities ── */
  .mt { margin-top: -1px; }
  `;
}

// ─── Shared HTML sections ───────────────────────────────────────

export interface PdfHeaderData {
  /** Title shown in the cert e.g. "Gas Safety Record (CP12)" */
  title: string;
  /** e.g. "GAS SAFETY CERTIFICATE" or "GAS SERVICE RECORD" */
  subtitle: string;
  /** Label for left customer column e.g. "Landlord / Client" */
  customerLabel: string;
  customerName: string;
  customerAddress: string;
  /** Label for right address column e.g. "Tenant / Property" */
  propertyLabel: string;
  propertyAddress: string;
  /** Extra rows to show in property column (e.g. tenant name/email) */
  propertyExtraHtml?: string;
  /** Certificate reference number */
  certRef: string;
  /** Inspection / service date */
  inspectionDate: string;
}

/**
 * Builds the shared header block: logos, company details, customer/property,
 * engineer info. This is the top ~25% of every gas form PDF.
 */
export function buildHeaderHtml(
  data: PdfHeaderData,
  company: CompanyInfo,
  engineer: EngineerInfo,
  gasSafeLogoBase64: string,
  companyLogoSrc: string,
): string {
  const custAddr = parseAddress(data.customerAddress);
  const propAddr = parseAddress(data.propertyAddress);

  return `
<!-- ═══ HEADER BLOCK ═══ -->
<table>
  <tr>
    <td style="width:15%;text-align:center;vertical-align:middle;padding:4px;border:none;background:transparent;">
      ${gasSafeLogoBase64
        ? `<img src="${gasSafeLogoBase64}" style="height:35px;max-width:100%;object-fit:contain;"/>`
        : '<div style="font-size:8pt;color:#aaa;">Gas Safe</div>'}
    </td>
    <td style="width:60%;text-align:center;vertical-align:middle;border:none;background:transparent;">
      <div style="font-size:11pt;font-weight:800;color:#0f172a;letter-spacing:1px;text-transform:uppercase;">${esc(data.title)}</div>
      <div style="font-size:6pt;color:#475569;margin-top:1px;">${esc(data.subtitle)}</div>
    </td>
    <td style="width:25%;text-align:right;vertical-align:middle;padding:4px;border:none;background:transparent;">
      ${companyLogoSrc
        ? `<img src="${companyLogoSrc}" style="height:35px;max-width:100%;object-fit:contain;display:inline-block;"/>`
        : ''}
    </td>
  </tr>
</table>

<!-- ═══ COMPANY + CUSTOMER + PROPERTY ═══ -->
<table class="mt">
  <tr>
    <td style="width:33.33%;padding:0;vertical-align:top;">
      <table>
        <tr><td class="shdr" colspan="2">Company Details</td></tr>
        <tr><td class="label-cell">Company</td><td class="value-cell">${esc(company.name)}</td></tr>
        <tr><td class="label-cell">Address</td><td class="value-cell">${esc(company.address)}</td></tr>
        <tr><td class="label-cell">Phone</td><td class="value-cell">${esc(company.phone)}</td></tr>
        <tr><td class="label-cell">Email</td><td class="value-cell">${esc(company.email)}</td></tr>
      </table>
    </td>
    <td style="width:33.34%;padding:0 2px;vertical-align:top;">
      <table>
        <tr><td class="shdr" colspan="2">${esc(data.customerLabel)}</td></tr>
        <tr><td class="label-cell">Name</td><td class="value-cell">${esc(data.customerName)}</td></tr>
        <tr><td class="label-cell">Address</td><td class="value-cell">${esc(custAddr.line1)}${custAddr.line2 ? ', ' + esc(custAddr.line2) : ''}</td></tr>
        <tr><td class="label-cell">City</td><td class="value-cell">${esc(custAddr.city)}</td></tr>
        <tr><td class="label-cell">Postcode</td><td class="value-cell">${esc(custAddr.postcode)}</td></tr>
      </table>
    </td>
    <td style="width:33.33%;padding:0;vertical-align:top;">
      <table>
        <tr><td class="shdr" colspan="2">${esc(data.propertyLabel)}</td></tr>
        <tr><td class="label-cell">Address</td><td class="value-cell">${esc(propAddr.line1)}</td></tr>
        <tr><td class="label-cell">&nbsp;</td><td class="value-cell">${esc(propAddr.line2)}</td></tr>
        <tr><td class="label-cell">City</td><td class="value-cell">${esc(propAddr.city)}</td></tr>
        <tr><td class="label-cell">Postcode</td><td class="value-cell">${esc(propAddr.postcode)}</td></tr>
        ${data.propertyExtraHtml || ''}
      </table>
    </td>
  </tr>
</table>

<!-- ═══ ENGINEER & CERT DETAILS ═══ -->
<table class="mt">
  <tr>
    <td class="label-cell" style="width:12%;">Engineer</td>
    <td class="value-cell" style="width:21%;">${esc(engineer.name)}</td>
    <td class="label-cell" style="width:12%;">Gas Safe Reg.</td>
    <td class="value-cell" style="width:13%;">${esc(engineer.gasSafeNumber)}</td>
    <td class="label-cell" style="width:12%;">Licence No.</td>
    <td class="value-cell" style="width:13%;">${esc(engineer.gasLicenceNumber)}</td>
    <td class="label-cell" style="width:8%;">Cert Ref</td>
    <td class="value-cell" style="width:9%;">${esc(data.certRef)}</td>
  </tr>
</table>
`;
}

export interface PdfSignatureFooterData {
  engineerSignatureBase64: string;
  customerSignatureBase64: string;
  engineerName: string;
  customerName: string;
  inspectionDate: string;
  nextDueDate: string;
  /** Column header for the customer column, defaults to "Customer Signature" */
  customerColumnLabel?: string;
  /** Label for the inspection date, defaults to "Inspection Date" */
  inspectionDateLabel?: string;
}

/**
 * Builds the 3-column signature footer:
 *   Engineer Signature | Customer Signature | Date & Next Inspection
 */
export function buildSignatureFooterHtml(data: PdfSignatureFooterData): string {
  const custLabel = data.customerColumnLabel || 'Customer Signature';
  const dateLabel = data.inspectionDateLabel || 'Inspection Date';
  return `
<!-- ═══ SIGNATURE FOOTER ═══ -->
<table class="mt" style="margin-top:2px;">
  <tr>
    <th class="sig-hdr" style="width:33.33%;">Engineer Signature</th>
    <th class="sig-hdr" style="width:33.33%;">${esc(custLabel)}</th>
    <th class="sig-hdr" style="width:33.34%;">Date &amp; Next Inspection</th>
  </tr>
  <tr>
    <td rowspan="3" style="text-align:center;vertical-align:middle;height:52px;">
      ${data.engineerSignatureBase64
        ? `<img src="${data.engineerSignatureBase64}" class="sig-img"/>`
        : '<div style="height:38px;"></div>'}
    </td>
    <td rowspan="3" style="text-align:center;vertical-align:middle;height:52px;">
      ${data.customerSignatureBase64
        ? `<img src="${data.customerSignatureBase64}" class="sig-img"/>`
        : '<div style="height:38px;"></div>'}
    </td>
    <td rowspan="3" class="next-due">
      <span class="date-box-label">${esc(dateLabel)}</span>
      ${esc(data.inspectionDate)}
      <br/>
      <span class="next-due-label" style="margin-top:6px;">Next Inspection Due</span>
      ${esc(data.nextDueDate || '')}
    </td>
  </tr>
  <tr>
    <th class="sig-hdr">Print Name</th>
    <td>${esc(data.engineerName)}</td>
    <th class="sig-hdr">Print Name</th>
    <td>${esc(data.customerName)}</td>
  </tr>
  <tr>
    <th class="sig-hdr">Date</th>
    <td>${esc(data.inspectionDate)}</td>
    <th class="sig-hdr">Date</th>
    <td>${esc(data.inspectionDate)}</td>
  </tr>
</table>
`;
}

/**
 * Builds the warning footer strip at the bottom of the PDF.
 */
export function buildWarningFooterHtml(message: string): string {
  return `
<div class="warn">${esc(message)}</div>
`;
}

// ─── PDF output utilities ───────────────────────────────────────

/** Convert HTML to a PDF file URI (no base64) */
export async function printHtmlToPdf(html: string): Promise<string> {
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
    width: 842,   // A4 landscape width in points
    height: 595,  // A4 landscape height in points
  });
  return uri;
}

/** Convert HTML to a PDF and return base64 */
export async function printHtmlToPdfBase64(html: string): Promise<string> {
  const { base64 } = await Print.printToFileAsync({
    html,
    base64: true,
    width: 842,
    height: 595,
  });
  if (!base64) throw new Error('Failed to create PDF base64 output');
  return base64;
}

/** Share a PDF via the system share sheet */
export async function shareHtmlAsPdf(html: string, title: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }
  const uri = await printHtmlToPdf(html);
  const shareOptions = {
    mimeType: 'application/pdf',
    dialogTitle: title,
    UTI: 'com.adobe.pdf',
  } as const;

  if (Platform.OS === 'ios') {
    void Sharing.shareAsync(uri, shareOptions).catch((err) => {
      console.warn('PDF share dismissed/failed on iOS:', err);
    });
    return;
  }
  await Sharing.shareAsync(uri, shareOptions);
}

// ─── Generic payload lifecycle helpers ──────────────────────────

/**
 * Resolve live company logo + Gas Safe logo, then call the form-specific
 * `buildHtml` function. Returns { html, title } for downstream use.
 */
export async function resolveAndBuildHtml<P extends BaseLockedPayload>(
  payload: P,
  buildHtmlFn: (
    pdfData: P['pdfData'],
    company: CompanyInfo,
    engineer: EngineerInfo,
    gasSafeLogoBase64: string,
    companyLogoSrc: string,
  ) => string,
  titleFn: (payload: P) => string,
  companyId?: string,
): Promise<{ html: string; title: string }> {
  const gasSafeLogoBase64 = await getGasSafeLogoBase64();
  const liveCompanyLogoUrl = await getLatestCompanyLogoUrl(companyId, payload.company.logoUrl);
  const companyLogoSrc = await getCompanyLogoSrc(liveCompanyLogoUrl);
  const companyForRender: CompanyInfo = { ...payload.company, logoUrl: liveCompanyLogoUrl };
  const html = buildHtmlFn(
    payload.pdfData,
    companyForRender,
    payload.engineer,
    gasSafeLogoBase64,
    companyLogoSrc,
  );
  return { html, title: titleFn(payload) };
}

/**
 * Generate a PDF from a locked payload — share, save, or view.
 */
export async function generatePdfFromPayload<P extends BaseLockedPayload>(
  payload: P,
  buildHtmlFn: (
    pdfData: P['pdfData'],
    company: CompanyInfo,
    engineer: EngineerInfo,
    gasSafeLogoBase64: string,
    companyLogoSrc: string,
  ) => string,
  titleFn: (payload: P) => string,
  mode: 'share' | 'save' | 'view' = 'share',
  companyId?: string,
): Promise<void> {
  const { html, title } = await resolveAndBuildHtml(payload, buildHtmlFn, titleFn, companyId);
  if (mode === 'view') {
    await Print.printAsync({ html });
    return;
  }
  await shareHtmlAsPdf(html, mode === 'save' ? `${title} (Save)` : title);
}

/**
 * Generate a PDF from a locked payload and return its base64.
 */
export async function generatePdfBase64FromPayload<P extends BaseLockedPayload>(
  payload: P,
  buildHtmlFn: (
    pdfData: P['pdfData'],
    company: CompanyInfo,
    engineer: EngineerInfo,
    gasSafeLogoBase64: string,
    companyLogoSrc: string,
  ) => string,
  companyId?: string,
): Promise<string> {
  const { html } = await resolveAndBuildHtml(
    payload,
    buildHtmlFn,
    () => '',
    companyId,
  );
  return printHtmlToPdfBase64(html);
}

/**
 * Generate a PDF, upload to Supabase Storage (doc-pdfs bucket), return signed URL.
 */
export async function generatePdfUrlFromPayload<P extends BaseLockedPayload>(
  payload: P,
  buildHtmlFn: (
    pdfData: P['pdfData'],
    company: CompanyInfo,
    engineer: EngineerInfo,
    gasSafeLogoBase64: string,
    companyLogoSrc: string,
  ) => string,
  companyId: string,
  certRef: string,
): Promise<string> {
  const base64 = await generatePdfBase64FromPayload(payload, buildHtmlFn, companyId);
  return uploadPdfBase64AndGetUrl(base64, companyId, certRef);
}
