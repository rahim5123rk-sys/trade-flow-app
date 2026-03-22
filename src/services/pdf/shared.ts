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

/** Combine optional text parts into a single notes string, separated by blank lines. */
export const combineNotes = (...parts: Array<string | null | undefined>) =>
  parts.map((part) => part?.trim()).filter(Boolean).join('\n\n');

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

export async function getGasSafeLogoBase64(engineer?: EngineerInfo): Promise<string> {
  const hasGasSafeNumber = engineer?.gasSafeNumber && engineer.gasSafeNumber.trim().length > 0;
  if (!hasGasSafeNumber) return '';

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
  const engineerForRender = payload.engineer || {} as EngineerInfo;
  const gasSafeLogoBase64 = await getGasSafeLogoBase64(engineerForRender);
  const liveCompanyLogoUrl = await getLatestCompanyLogoUrl(companyId, payload?.company?.logoUrl || '');
  const companyLogoSrc = await getCompanyLogoSrc(liveCompanyLogoUrl);
  const companyForRender: CompanyInfo = { ...(payload?.company || {} as CompanyInfo), logoUrl: liveCompanyLogoUrl };
  const html = buildHtmlFn(
    payload.pdfData,
    companyForRender,
    engineerForRender,
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
