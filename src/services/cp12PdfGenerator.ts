// ============================================
// FILE: src/services/cp12PdfGenerator.ts
// CP12 Gas Safety Certificate PDF generator
// ============================================

import { Asset } from 'expo-asset';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Image, Platform } from 'react-native';
import { supabase } from '../config/supabase';
import { CP12Appliance, CP12FinalChecks } from '../types/cp12';
import { escapeHtml } from '../utils/escapeHtml';
import { getSignedUrl, uploadPdfBase64AndGetUrl } from './storage';

// ─── Data contract ──────────────────────────────────────────────

export interface CP12PdfData {
  // Landlord
  landlordName: string;
  landlordCompany?: string;
  landlordAddress: string;
  landlordPostcode?: string;
  landlordEmail: string;
  landlordPhone: string;

  // Tenant
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;

  // Property
  propertyAddress: string;

  // Appliances
  appliances: CP12Appliance[];

  // Final checks
  finalChecks: CP12FinalChecks;

  // Review / sign
  inspectionDate: string;
  nextDueDate: string;
  customerSignature: string; // base64
  certRef: string;
}

// ─── Fetch company + engineer info from Supabase ────────────────

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

export interface CP12LockedPayload {
  kind: 'cp12';
  version: 1;
  savedAt: string;
  pdfData: CP12PdfData;
  company: CompanyInfo;
  engineer: EngineerInfo;
}

// ─── Load Gas Safe logo as base64 ────────────────────────────────

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

async function getGasSafeLogoBase64(): Promise<string> {
  try {
    const moduleRef = require('../../assets/images/gaslogo.png');
    const asset = Asset.fromModule(moduleRef);
    if (!asset.localUri) {
      await asset.downloadAsync();
    }
    const uri = asset.localUri || Image.resolveAssetSource(moduleRef).uri;
    if (!uri) return '';
    return await getImageDataUriFromUri(uri);
  } catch (err) {
    console.warn('Failed to load Gas Safe logo:', err);
    return ''; // Fall back to no logo if reading fails
  }
}

async function getCompanyLogoSrc(companyLogoUrl: string): Promise<string> {
  if (!companyLogoUrl) return '';
  return companyLogoUrl;
}

async function getLatestCompanyLogoUrl(
  companyId?: string,
  fallbackLogoUrl: string = '',
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

async function getCompanyAndEngineer(
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

  // Engineer display_name from profiles
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

// ─── Tiny helpers ───────────────────────────────────────────────

/** Escape user values for safe HTML interpolation */
const esc = (v: unknown): string => escapeHtml(v);

// ─── Build HTML ─────────────────────────────────────────────────

function buildHtml(
  data: CP12PdfData,
  company: CompanyInfo,
  engineer: EngineerInfo,
  gasSafeLogoBase64: string = '',
  companyLogoSrc: string = '',
): string {
  const apps = data.appliances;
  const fc = data.finalChecks;
  const landlordAddressParts = (data.landlordAddress || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const landlordAddressLine1 = landlordAddressParts[0] || data.landlordAddress || '';
  const landlordAddressLine2 = landlordAddressParts.slice(1).join(', ');

  const propertyAddressParts = (data.propertyAddress || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const propertyAddressLine1 = propertyAddressParts[0] || data.propertyAddress || '';

  let propertyAddressLine2 = '';
  let propertyCity = '';
  let propertyPostcode = '';

  if (propertyAddressParts.length >= 4) {
    propertyAddressLine2 = propertyAddressParts.slice(1, -2).join(', ');
    propertyCity = propertyAddressParts[propertyAddressParts.length - 2] || '';
    propertyPostcode = propertyAddressParts[propertyAddressParts.length - 1] || '';
  } else if (propertyAddressParts.length === 3) {
    propertyAddressLine2 = propertyAddressParts[1] || '';
    propertyPostcode = propertyAddressParts[2] || '';
  } else if (propertyAddressParts.length === 2) {
    propertyAddressLine2 = propertyAddressParts[1] || '';
  }

  // Styled tick helpers — green ✓, red ✗, grey N/A
  const tickH = (val: string): string => {
    if (!val) return '';
    if (val === 'Yes' || val === 'Pass') return '<span style="color:#16a34a;font-weight:800;">✓</span>';
    if (val === 'No' || val === 'Fail') return '<span style="color:#dc2626;font-weight:800;">✗</span>';
    return '<span style="color:#6b7280;">N/A</span>';
  };

  const checkInH = (val: string, col: 'Yes' | 'No' | 'N/A'): string => {
    if (!val) return '';
    if (col === 'Yes' && (val === 'Yes' || val === 'Pass')) return '<span style="color:#16a34a;font-weight:800;font-size:10pt;">✓</span>';
    if (col === 'No' && (val === 'No' || val === 'Fail')) return '<span style="color:#dc2626;font-weight:800;font-size:10pt;">✗</span>';
    if (col === 'N/A' && val === 'N/A') return '<span style="color:#9ca3af;font-weight:700;font-size:7pt;">N/A</span>';
    return '';
  };

  // Build 5 appliance rows (always 5, pad empties)
  const appRows = [0, 1, 2, 3, 4]
    .map((i) => {
      const a = apps[i];
      const rowBg = i % 2 === 1 ? 'background:#f9fafb;' : 'background:#fff;';
      if (a) {
        const ph = a.operatingPressure
          ? a.operatingPressure + ' mBar'
          : a.heatInput
            ? a.heatInput + ' ' + (a.heatInputUnit || 'kW/h')
            : '';
        const lowCo = Number.parseFloat(a.fgaLow.co || '');
        const lowCo2 = Number.parseFloat(a.fgaLow.co2 || '');
        const highCo = Number.parseFloat(a.fgaHigh.co || '');
        const highCo2 = Number.parseFloat(a.fgaHigh.co2 || '');
        const lowRatio =
          Number.isFinite(lowCo) && Number.isFinite(lowCo2) && lowCo2 > 0
            ? (lowCo / lowCo2).toFixed(4)
            : '';
        const highRatio =
          Number.isFinite(highCo) && Number.isFinite(highCo2) && highCo2 > 0
            ? (highCo / highCo2).toFixed(4)
            : '';
        return `<tr>
        <td class="rn">${i + 1}</td>
        <td style="${rowBg}">${esc(a.location)}</td><td style="${rowBg}">${esc(a.make)}</td><td style="${rowBg}">${esc(a.model)}</td>
        <td style="${rowBg}">${esc(a.type)}</td><td style="${rowBg}">${esc(a.serialNumber)}</td><td style="${rowBg}">${esc(a.gcNumber)}</td>
        <td style="${rowBg}">${esc(a.flueType)}</td><td style="${rowBg}">${ph}</td>
        <td style="${rowBg}">${tickH(a.safetyDevices)}</td><td style="${rowBg}">${tickH(a.spillageTest)}</td><td style="${rowBg}">${tickH(a.smokePelletFlueTest)}</td>
        <td style="${rowBg}">${esc(a.fgaLow.co)}</td><td style="${rowBg}">${esc(a.fgaLow.co2)}</td><td style="${rowBg}">${lowRatio}</td>
        <td style="${rowBg}">${esc(a.fgaHigh.co)}</td><td style="${rowBg}">${esc(a.fgaHigh.co2)}</td><td style="${rowBg}">${highRatio}</td>
        <td style="${rowBg}">${tickH(a.satisfactoryTermination)}</td><td style="${rowBg}">${tickH(a.flueVisualCondition)}</td><td style="${rowBg}">${tickH(a.adequateVentilation)}</td>
        <td style="${rowBg}">${tickH(a.landlordsAppliance)}</td><td style="${rowBg}">${tickH(a.inspected)}</td><td style="${rowBg}">${tickH(a.applianceVisualCheck)}</td>
        <td style="${rowBg}">${tickH(a.applianceServiced)}</td><td style="${rowBg}">${tickH(a.applianceSafeToUse)}</td>
      </tr>`;
      }
      return `<tr class="empty"><td class="rn">${i + 1}</td>${`<td style="${rowBg}"></td>`.repeat(25)}</tr>`;
    })
    .join('\n');

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { margin: 0; size: A4 landscape; }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    width: 297mm;
    max-height: 210mm;
    margin: 0;
    padding: 0;
    overflow: hidden;
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
    max-height: 210mm;
    padding: 3mm;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    page-break-after: avoid;
  }

  /* ═══ GLOBAL TABLE STYLES ═══ */
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

  /* ═══ SECTION HEADER BARS ═══ */
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

  /* ═══ APPLIANCE TABLE ═══ */
  .at { table-layout: fixed; }
  .at th, .at td {
    font-size: 5pt;
    text-align: center;
    padding: 1px 2px;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .at th { font-size: 4.5pt; line-height: 1.1; background: #334155; }
  .at .grp {
    background: #1e293b;
    color: #fff;
    font-size: 5pt;
    font-weight: 700;
  }
  .at td { font-size: 5.5pt; }
  .at tbody td { height: 15px; }
  .at .rn {
    background: #e2e8f0 !important;
    font-weight: 700;
    color: #334155;
    width: 14px;
  }
  .at tr.empty td { height: 15px; }

  /* ═══ CHECKLIST TABLE ═══ */
  .cl td, .cl th { font-size: 6pt; text-align: center; }
  .cl .lbl { text-align: left; font-weight: 400; color: #374151; }
  .cl .cnum { width: 16px; text-align: center; background: #e2e8f0; font-weight: 700; color: #334155; font-size: 5.5pt; }
  .cl .yna { width: 26px; }

  /* ═══ FAULTS TABLE ═══ */
  .flt th { font-size: 5.5pt; font-weight: 600; background: #f1f5f9; color: #1e293b; vertical-align: top; width: 18%; }
  .flt td { font-size: 6pt; background: #fff; min-height: 12px; vertical-align: top; }
  .flt tr.tall-row th,
  .flt tr.tall-row td { height: 22px; }

  /* ═══ SIGNATURE FOOTER ═══ */
  .sig-img { height: 38px; max-width: 100%; display: block; margin: 0 auto; }
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
  .sig-hdr { background: #f1f5f9; color: #1e293b; font-size: 6pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }

  /* ═══ WARNING FOOTER ═══ */
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

  /* ═══ UTILITIES ═══ */
  .mt { margin-top: -1px; }
</style>
</head>
<body>
<div class="page">

<!-- ═══════════════════════════════════════════════════════════════════
     1. HEADER BLOCK
     ═══════════════════════════════════════════════════════════════════ -->
<table>
  <tr>
    <td style="width:13%; padding:5px 8px; vertical-align:middle; background:linear-gradient(135deg,#1e293b 0%,#334155 100%);">
      ${companyLogoSrc ? `<img src="${companyLogoSrc}" style="max-height:42px;max-width:124px;display:block;"/>` : '<div style="height:42px;"></div>'}
    </td>
    <td style="text-align:center; padding:5px 8px; vertical-align:middle; background:linear-gradient(135deg,#334155 0%,#475569 100%);">
      <div style="font-size:11pt; font-weight:800; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px; color:#fff;">
        Homeowner / Landlord Gas Safety Record
      </div>
      <div style="font-size:5.5pt; color:#cbd5e1; line-height:1.5;">
        This inspection is for gas safety purposes only to comply with the Gas Safety (Installation and Use) Regulations. Flues have been inspected
        and checked for satisfactory evacuation of products of combustion. A detailed internal inspection of the flue integrity, construction and the
        lining has NOT been carried out.
      </div>
    </td>
    <td style="width:13%; text-align:center; padding:5px 8px; vertical-align:middle; background:linear-gradient(135deg,#334155 0%,#1e293b 100%);">
      ${gasSafeLogoBase64 ? `<img src="${gasSafeLogoBase64}" style="height:46px;max-width:116px;display:block;margin:0 auto 3px;"/>` : ''}
      <div style="font-size:5pt; color:#cbd5e1; margin-top:2px; text-transform:uppercase; letter-spacing:0.3px;">Cert Ref</div>
      <div style="font-size:9pt; font-weight:800; color:#fff;">${esc(data.certRef)}</div>
      <div style="font-size:5pt; color:#cbd5e1; margin-top:3px; text-transform:uppercase; letter-spacing:0.3px;">Appliances</div>
      <div style="font-size:9pt; font-weight:800; color:#fff;">${apps.length}</div>
    </td>
  </tr>
</table>

<!-- ═══════════════════════════════════════════════════════════════════
     2. TOP DETAILS (LEFT / MIDDLE / RIGHT)
     ═══════════════════════════════════════════════════════════════════ -->
<table class="mt">
  <tr>
    <td style="width:33.33%; padding:0; vertical-align:top;">
      <table>
        <tr><td class="shdr" colspan="2">Engineer &amp; Company Details</td></tr>
        <tr><td class="label-cell">Engineer Name</td><td class="value-cell">${esc(engineer.name)}</td></tr>
        <tr><td class="label-cell">Company</td><td class="value-cell">${esc(company.name)}</td></tr>
        <tr><td class="label-cell">Address</td><td class="value-cell">${esc(company.address).replace(/\n/g, ', ')}</td></tr>
        <tr><td class="label-cell">Tel No.</td><td class="value-cell">${esc(company.phone)}</td></tr>
        <tr><td class="label-cell">Gas Safe Reg.</td><td class="value-cell">${esc(engineer.gasSafeNumber)}</td></tr>
        <tr><td class="label-cell">ID Card No.</td><td class="value-cell">${esc(engineer.gasLicenceNumber)}</td></tr>
        <tr><td class="label-cell">Email</td><td class="value-cell">${esc(company.email)}</td></tr>
      </table>
    </td>
    <td style="width:33.34%; padding:0 2px; vertical-align:top;">
      <table>
        <tr><td class="shdr" colspan="2">Inspection &amp; Property Details</td></tr>
        <tr><td class="label-cell">Tenant Name</td><td class="value-cell">${esc(data.tenantName)}</td></tr>
        <tr><td class="label-cell">Tenant Phone</td><td class="value-cell">${esc(data.tenantPhone)}</td></tr>
        <tr><td class="label-cell">Tenant Email</td><td class="value-cell">${esc(data.tenantEmail)}</td></tr>
        <tr>
          <td class="label-cell" rowspan="2" style="vertical-align:top; border-bottom:none;">Address</td>
          <td class="value-cell" style="border-bottom:none;">${esc(propertyAddressLine1)}</td>
        </tr>
        <tr><td class="value-cell" style="border-top:none; min-height:14px;">${esc(propertyAddressLine2)}&nbsp;</td></tr>
        <tr><td class="label-cell">Postcode</td><td class="value-cell">${esc(propertyPostcode)}</td></tr>
        <tr><td class="label-cell">City</td><td class="value-cell">${esc(propertyCity)}</td></tr>
      </table>
    </td>
    <td style="width:33.33%; padding:0; vertical-align:top;">
      <table>
        <tr><td class="shdr" colspan="2">Landlord Details</td></tr>
        <tr><td class="label-cell">Name</td><td class="value-cell">${esc(data.landlordName)}</td></tr>
        <tr><td class="label-cell">Company Name</td><td class="value-cell">${esc(data.landlordCompany || '')}</td></tr>
        <tr>
          <td class="label-cell" rowspan="2" style="vertical-align:top; border-bottom:none;">Address</td>
          <td class="value-cell" style="border-bottom:none;">${esc(landlordAddressLine1)}</td>
        </tr>
        <tr><td class="value-cell" style="border-top:none;">${esc(landlordAddressLine2)}</td></tr>
        <tr><td class="label-cell">Postcode</td><td class="value-cell">${esc(data.landlordPostcode || '')}</td></tr>
        <tr><td class="label-cell">Email</td><td class="value-cell">${esc(data.landlordEmail)}</td></tr>
        <tr><td class="label-cell">Phone / Mobile</td><td class="value-cell">${esc(data.landlordPhone)}</td></tr>
      </table>
    </td>
  </tr>
</table>

<!-- ═══════════════════════════════════════════════════════════════════
     3. APPLIANCE DETAILS GRID
     ═══════════════════════════════════════════════════════════════════ -->
<table class="mt">
  <tr><td class="shdr" colspan="26">Appliance Details &amp; Inspection Results</td></tr>
</table>
<table class="at mt">
  <thead>
    <tr>
      <th rowspan="3" style="width:14px;">#</th>
      <th class="grp" colspan="7">Appliance Details</th>
      <th class="grp" colspan="10">Flue Tests</th>
      <th class="grp" colspan="8">Inspection Details</th>
    </tr>
    <tr>
      <th rowspan="2">Location</th>
      <th rowspan="2">Make</th>
      <th rowspan="2">Model</th>
      <th rowspan="2">Type</th>
      <th rowspan="2">Serial No.</th>
      <th rowspan="2">GC No.</th>
      <th rowspan="2">Flue Type</th>
      <th rowspan="2">Op.&nbsp;Press. / Heat&nbsp;Input</th>
      <th rowspan="2">Safety Devices</th>
      <th rowspan="2">Spillage Test</th>
      <th rowspan="2">Smoke Pellet Test</th>
      <th class="grp" colspan="3">Initial Combustion</th>
      <th class="grp" colspan="3">Final Combustion</th>
      <th rowspan="2">Sat. Termin&shy;ation</th>
      <th rowspan="2">Flue Visual Cond.</th>
      <th rowspan="2">Adeq. Ventil&shy;ation</th>
      <th rowspan="2">Landlords Appliance</th>
      <th rowspan="2">Inspec&shy;ted</th>
      <th rowspan="2">Visual Check</th>
      <th rowspan="2">Serv&shy;iced</th>
      <th rowspan="2">Safe to Use</th>
    </tr>
    <tr>
      <th>CO (ppm)</th>
      <th>CO&#8322; (%)</th>
      <th>Ratio</th>
      <th>CO (ppm)</th>
      <th>CO&#8322; (%)</th>
      <th>Ratio</th>
    </tr>
  </thead>
  <tbody>
${appRows}
  </tbody>
</table>

<!-- ═══════════════════════════════════════════════════════════════════
     4. VISUAL INSPECTION CHECKLISTS
     ═══════════════════════════════════════════════════════════════════ -->
<table class="cl mt">
  <tr>
    <td class="shdr" colspan="5" style="width:50%;">Gas Installation Pipework</td>
    <td class="shdr" colspan="5" style="width:50%;">Alarm Checks</td>
  </tr>
  <tr>
    <th class="cnum">No.</th>
    <th style="text-align:left;">Check Description</th>
    <th class="yna">Yes</th>
    <th class="yna">No</th>
    <th class="yna">N/A</th>
    <th class="cnum">No.</th>
    <th style="text-align:left;">Check Description</th>
    <th class="yna">Yes</th>
    <th class="yna">No</th>
    <th class="yna">N/A</th>
  </tr>
  <tr>
    <td class="cnum">1</td>
    <td class="lbl">Satisfactory Visual Inspection of Pipework</td>
    <td style="text-align:center;">${checkInH(fc.visualInspection, 'Yes')}</td>
    <td style="text-align:center;">${checkInH(fc.visualInspection, 'No')}</td>
    <td style="text-align:center;">${checkInH(fc.visualInspection, 'N/A')}</td>
    <td class="cnum">5</td>
    <td class="lbl">CO Alarm Fitted</td>
    <td style="text-align:center;">${checkInH(fc.coAlarmFitted, 'Yes')}</td>
    <td style="text-align:center;">${checkInH(fc.coAlarmFitted, 'No')}</td>
    <td style="text-align:center;">${checkInH(fc.coAlarmFitted, 'N/A')}</td>
  </tr>
  <tr>
    <td class="cnum">2</td>
    <td class="lbl">Emergency Control Valve (ECV) Accessible</td>
    <td style="text-align:center;">${checkInH(fc.ecvAccessible, 'Yes')}</td>
    <td style="text-align:center;">${checkInH(fc.ecvAccessible, 'No')}</td>
    <td style="text-align:center;">${checkInH(fc.ecvAccessible, 'N/A')}</td>
    <td class="cnum">6</td>
    <td class="lbl">Testing of CO Alarm Satisfactory</td>
    <td style="text-align:center;">${checkInH(fc.coAlarmTestSatisfactory, 'Yes')}</td>
    <td style="text-align:center;">${checkInH(fc.coAlarmTestSatisfactory, 'No')}</td>
    <td style="text-align:center;">${checkInH(fc.coAlarmTestSatisfactory, 'N/A')}</td>
  </tr>
  <tr>
    <td class="cnum">3</td>
    <td class="lbl">Satisfactory Gas Tightness Test</td>
    <td style="text-align:center;">${checkInH(fc.tightnessTest, 'Yes')}</td>
    <td style="text-align:center;">${checkInH(fc.tightnessTest, 'No')}</td>
    <td style="text-align:center;">${checkInH(fc.tightnessTest, 'N/A')}</td>
    <td class="cnum">7</td>
    <td class="lbl">Smoke Alarm Fitted</td>
    <td style="text-align:center;">${checkInH(fc.smokeAlarmFitted, 'Yes')}</td>
    <td style="text-align:center;">${checkInH(fc.smokeAlarmFitted, 'No')}</td>
    <td style="text-align:center;">${checkInH(fc.smokeAlarmFitted, 'N/A')}</td>
  </tr>
  <tr>
    <td class="cnum">4</td>
    <td class="lbl">Equipotential Bonding Satisfactory</td>
    <td style="text-align:center;">${checkInH(fc.equipotentialBonding, 'Yes')}</td>
    <td style="text-align:center;">${checkInH(fc.equipotentialBonding, 'No')}</td>
    <td style="text-align:center;">${checkInH(fc.equipotentialBonding, 'N/A')}</td>
    <td class="cnum">8</td>
    <td class="lbl">Smoke Alarm Tested Satisfactory</td>
    <td style="text-align:center;">${checkInH(fc.smokeAlarmTested, 'Yes')}</td>
    <td style="text-align:center;">${checkInH(fc.smokeAlarmTested, 'No')}</td>
    <td style="text-align:center;">${checkInH(fc.smokeAlarmTested, 'N/A')}</td>
  </tr>
</table>

<!-- ═══════════════════════════════════════════════════════════════════
     5. FAULTS & WORKS BOX
     ═══════════════════════════════════════════════════════════════════ -->
<table class="flt mt">
  <tr><td class="shdr" colspan="2">Faults Identified &amp; Remedial Work</td></tr>
  <tr class="tall-row">
    <th>Give Details of Any Faults Identified</th>
    <td>${esc(fc.faults)}</td>
  </tr>
  <tr class="tall-row">
    <th>Rectification Work Carried Out</th>
    <td>${esc(fc.rectificationWork)}</td>
  </tr>
  <tr class="tall-row">
    <th>Details of Work Carried Out</th>
    <td>${esc(fc.workCarriedOut)}</td>
  </tr>
</table>

<!-- ═══════════════════════════════════════════════════════════════════
     6. SIGNATURES FOOTER
     ═══════════════════════════════════════════════════════════════════ -->
<table class="mt">
  <tr>
    <th colspan="2" class="sig-hdr" style="text-align:center; width:25%;">Engineer</th>
    <th colspan="2" class="sig-hdr" style="text-align:center; width:25%;">Received By (Customer / Tenant)</th>
    <td class="shdr" style="width:25%;">Next Inspection Date</td>
    <td class="shdr" style="width:15%;">Certificate No.</td>
  </tr>
  <tr>
    <th class="sig-hdr" style="width:7%;">Signature</th>
    <td style="height:38px; text-align:center;">
      ${company.signatureBase64 ? `<img src="${company.signatureBase64}" class="sig-img"/>` : ''}
    </td>
    <th class="sig-hdr" style="width:7%;">Signature</th>
    <td style="height:38px; text-align:center;">
      ${data.customerSignature ? `<img src="${data.customerSignature}" class="sig-img"/>` : ''}
    </td>
    <td rowspan="3" class="next-due">
      <span class="next-due-label">Next Inspection Due</span>
      ${esc(data.nextDueDate)}
    </td>
    <td rowspan="3" class="certbox">
      <span class="certbox-label">Certificate No.</span>
      ${esc(data.certRef)}
    </td>
  </tr>
  <tr>
    <th class="sig-hdr">Print Name</th>
    <td>${esc(engineer.name)}</td>
    <th class="sig-hdr">Print Name</th>
    <td>${esc(data.tenantName || data.landlordName || '')}</td>
  </tr>
  <tr>
    <th class="sig-hdr">Date</th>
    <td>${esc(data.inspectionDate)}</td>
    <th class="sig-hdr">Date</th>
    <td>${esc(data.inspectionDate)}</td>
  </tr>
</table>

<!-- ═══════════════════════════════════════════════════════════════════
     WARNING FOOTER
     ═══════════════════════════════════════════════════════════════════ -->
<div class="warn">
  IMPORTANT NOTICE: In accordance with the Gas Safety (Installation and Use) Regulations 1998 (Regulation 36), the landlord must retain this record for a minimum of 2 years.
  A copy must be issued to each existing tenant within 28 days of the check being completed, and to any new tenant before they move in.
</div>

</div>
</body>
</html>`;
}

async function printHtmlToPdf(html: string): Promise<string> {
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
    width: 842, // A4 landscape width in points (297mm)
    height: 595, // A4 landscape height in points (210mm)
  });
  return uri;
}

async function printHtmlToPdfBase64(html: string): Promise<string> {
  const { base64 } = await Print.printToFileAsync({
    html,
    base64: true,
    width: 842,
    height: 595,
  });

  if (!base64) {
    throw new Error('Failed to create CP12 PDF base64 output');
  }

  return base64;
}

async function shareHtmlAsPdf(html: string, title: string): Promise<void> {
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
      console.warn('CP12 share dismissed/failed on iOS:', err);
    });
    return;
  }

  await Sharing.shareAsync(uri, shareOptions);
}

export async function generateCP12PdfFromPayload(
  payload: CP12LockedPayload,
  mode: 'share' | 'save' | 'view' = 'share',
  companyId?: string,
): Promise<void> {
  const gasSafeLogoBase64 = await getGasSafeLogoBase64();
  const liveCompanyLogoUrl = await getLatestCompanyLogoUrl(
    companyId,
    payload.company.logoUrl,
  );
  const companyLogoSrc = await getCompanyLogoSrc(liveCompanyLogoUrl);
  const companyForRender: CompanyInfo = {
    ...payload.company,
    logoUrl: liveCompanyLogoUrl,
  };
  const html = buildHtml(
    payload.pdfData,
    companyForRender,
    payload.engineer,
    gasSafeLogoBase64,
    companyLogoSrc,
  );
  const title = `CP12 - ${payload.pdfData.landlordName || 'Gas Safety Record'}`;

  if (mode === 'view') {
    await Print.printAsync({ html });
    return;
  }

  if (mode === 'save') {
    await shareHtmlAsPdf(html, `${title} (Save)`);
    return;
  }

  await shareHtmlAsPdf(html, title);
}

export async function generateCP12PdfBase64FromPayload(
  payload: CP12LockedPayload,
  companyId?: string,
): Promise<string> {
  const gasSafeLogoBase64 = await getGasSafeLogoBase64();
  const liveCompanyLogoUrl = await getLatestCompanyLogoUrl(
    companyId,
    payload.company.logoUrl,
  );
  const companyLogoSrc = await getCompanyLogoSrc(liveCompanyLogoUrl);
  const companyForRender: CompanyInfo = {
    ...payload.company,
    logoUrl: liveCompanyLogoUrl,
  };
  const html = buildHtml(
    payload.pdfData,
    companyForRender,
    payload.engineer,
    gasSafeLogoBase64,
    companyLogoSrc,
  );
  return printHtmlToPdfBase64(html);
}

// ─── Public API ─────────────────────────────────────────────────

export async function buildCP12LockedPayload(
  data: CP12PdfData,
  companyId: string,
  userId: string,
): Promise<CP12LockedPayload> {
  const { company, engineer } = await getCompanyAndEngineer(companyId, userId);
  return {
    kind: 'cp12',
    version: 1,
    savedAt: new Date().toISOString(),
    pdfData: data,
    company,
    engineer,
  };
}

export async function generateCP12Pdf(
  data: CP12PdfData,
  companyId: string,
  userId: string,
  mode: 'share' | 'save' | 'view' = 'share',
): Promise<void> {
  const payload = await buildCP12LockedPayload(data, companyId, userId);
  await generateCP12PdfFromPayload(payload, mode, companyId);
}

/**
 * Generate a CP12 PDF and upload it to Supabase Storage (cp12-pdfs bucket).
 * Returns a 1-hour signed URL for viewing the PDF directly in a browser.
 */
export async function generateCP12PdfUrl(
  payload: CP12LockedPayload,
  companyId: string,
): Promise<string> {
  const base64 = await generateCP12PdfBase64FromPayload(payload, companyId);
  return uploadPdfBase64AndGetUrl(base64, companyId, payload.pdfData.certRef);
}
