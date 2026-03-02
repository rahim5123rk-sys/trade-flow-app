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
import { getSignedUrl } from './storage';

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

/** Render ✓ or ✗ for Yes/No/Pass/Fail values in table cells */
const tick = (val: string): string => {
  if (!val) return '';
  if (val === 'Yes' || val === 'Pass') return '✓';
  if (val === 'No' || val === 'Fail') return '✗';
  return 'N/A';
};

/** For checklist tables: place ✓ in the correct Yes/No/N/A column */
const checkIn = (val: string, col: 'Yes' | 'No' | 'N/A'): string => {
  if (!val) return '';
  if (col === 'Yes' && (val === 'Yes' || val === 'Pass')) return '✓';
  if (col === 'No' && (val === 'No' || val === 'Fail')) return '✓';
  if (col === 'N/A' && val === 'N/A') return '✓';
  return '';
};

/** Escape empty values — returns blank for rigid form fields */
const esc = (v: string) => v || '';

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


  // Build 5 appliance rows (always 5, pad empties)
  const appRows = [0, 1, 2, 3, 4]
    .map((i) => {
      const a = apps[i];
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
        <td>${esc(a.location)}</td><td>${esc(a.make)}</td><td>${esc(a.model)}</td>
        <td>${esc(a.type)}</td><td>${esc(a.serialNumber)}</td><td>${esc(a.gcNumber)}</td>
        <td>${esc(a.flueType)}</td><td>${ph}</td>
        <td>${tick(a.safetyDevices)}</td><td>${tick(a.spillageTest)}</td><td>${tick(a.smokePelletFlueTest)}</td>
        <td>${esc(a.fgaLow.co)}</td><td>${esc(a.fgaLow.co2)}</td><td>${lowRatio}</td>
        <td>${esc(a.fgaHigh.co)}</td><td>${esc(a.fgaHigh.co2)}</td><td>${highRatio}</td>
        <td>${tick(a.satisfactoryTermination)}</td><td>${tick(a.flueVisualCondition)}</td><td>${tick(a.adequateVentilation)}</td>
        <td>${tick(a.landlordsAppliance)}</td><td>${tick(a.inspected)}</td><td>${tick(a.applianceVisualCheck)}</td>
        <td>${tick(a.applianceServiced)}</td><td>${tick(a.applianceSafeToUse)}</td>
      </tr>`;
      }
      return `<tr class="empty"><td class="rn">${i + 1}</td>${'<td></td>'.repeat(25)}</tr>`;
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
    height: 210mm;
    margin: 0;
    padding: 0;
    overflow: hidden; /* Hard stop to prevent the empty second page */
  }
  
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 7pt;
    line-height: 1.15; 
    color: #000;

    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    /* zoom: 0.94; REMOVED to prevent cross-platform rendering bugs */
  }

  .page {
    width: 100%;
    height: 100%;
    padding: 3mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between; /* This dynamically stretches the tables to fill the page length */
    overflow: hidden;
  }

  .top-bar-cell {
    background: #212529;
    color: #fff;
  }

  /* ═══ GLOBAL TABLE STYLES ═══ */
  table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
  td, th {
    border: 0.8px solid #9CA3AF;
    padding: 2px 4px;
    vertical-align: middle;
    font-size: 6pt;
  }
  th {
    background: #194763;
    color: #fff;
    font-weight: bold;
    font-size: 6pt;
    text-transform: uppercase;
    text-align: left;
  }
  td { background: #fff; }

  .label-cell {
    background: #E8F1FE;
    font-weight: 700;
    width: 28%;
  }
  .value-cell {
    background: #fff;
    width: 72%;
  }

  /* ═══ SECTION HEADER BARS ═══ */
  .shdr {
    background: #194763;
    color: #fff;
    font-weight: bold;
    font-size: 7pt;
    text-align: center;
    text-transform: uppercase;
    padding: 2.5px 4px;
    letter-spacing: 0.3px;
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
  .at th { font-size: 4.5pt; line-height: 1.15; }
  .at .grp {
    background: #194763;
    color: #fff;
    font-size: 5.5pt;
    font-weight: bold;
  }
  .at td { font-size: 5.5pt; background: #fff; }
  .at tbody td { height: 16px; }
  .at .rn {
    background: #E8F1FE;
    font-weight: bold;
    width: 14px;
  }
  .at tr.empty td { height: 16px; }

  /* ═══ CHECKLIST TABLE ═══ */
  .cl td, .cl th { font-size: 6pt; text-align: center; }
  .cl .lbl { text-align: left; font-weight: normal; }
  .cl .cnum { width: 18px; text-align: center; background: #E8F1FE; font-weight: bold; }
  .cl .yna { width: 30px; }
  .ck { font-size: 9pt; font-weight: bold; color: #000; }

  /* ═══ FAULTS TABLE ═══ */
  .flt th { width: 18%; font-size: 5.5pt; vertical-align: top; }
  .flt td { font-size: 6pt; background: #fff; min-height: 12px; vertical-align: top; }
  .flt tr.tall-row th,
  .flt tr.tall-row td {
    height: 28px;
  }

  /* ═══ SIGNATURE FOOTER ═══ */
  .sig-img { height: 28px; max-width: 100%; display: block; margin: 0 auto; }
  .highlight {
    background: #FFFFCC !important;
    font-weight: bold;
    font-size: 9pt;
    text-align: center;
    vertical-align: middle;
    color: #900;
  }
  .highlight-label {
    font-size: 5.5pt;
    font-weight: bold;
    text-transform: uppercase;
    color: #333;
    display: block;
    margin-bottom: 2px;
  }
  .certbox {
    background: #E0ECFF !important;
    font-weight: bold;
    font-size: 8pt;
    text-align: center;
    vertical-align: middle;
  }
  .certbox-label {
    font-size: 5.5pt;
    font-weight: bold;
    text-transform: uppercase;
    color: #333;
    display: block;
    margin-bottom: 2px;
  }

  /* ═══ WARNING FOOTER ═══ */
  .warn {
    border: 1px solid #000;
    border-top: 2px solid #000;
    background: #FFF3F3;
    text-align: center;
    font-size: 5.5pt;
    font-weight: bold;
    color: #900;
    padding: 3px 6px;
    line-height: 1.3;
  }

  /* ═══ COLLAPSE ADJACENT TABLE BORDERS ═══ */
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
    <td class="top-bar-cell" style="width:22%; padding:4px 6px; vertical-align:middle;">
      ${companyLogoSrc ? `<img src="${companyLogoSrc}" style="max-height:28px;max-width:80px;display:block;margin-bottom:2px;"/>` : ''}
      <div style="font-size:10pt; font-weight:bold; color:#fff;">${esc(company.name)}</div>
    </td>
    <td class="top-bar-cell" style="text-align:center; padding:4px 6px; vertical-align:middle;">
      <div style="font-size:10pt; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px; color:#fff;">
        Homeowner / Landlord Gas Safety Record
      </div>
      <div style="font-size:5.5pt; color:#E5E7EB; line-height:1.35;">
        Gas Safety (Installation &amp; Use) Regulations 1998 &mdash; In accordance with Regulation 36.<br/>
        IMPORTANT: This record is required as evidence that a gas safety check has been carried out on the appliance(s) listed below.
        A visual inspection of the flue is included where accessible, but this alone does not guarantee flue integrity.
      </div>
    </td>
    <td class="top-bar-cell" style="width:14%; text-align:center; padding:4px 6px; vertical-align:middle;">
      ${gasSafeLogoBase64 ? `<img src="${gasSafeLogoBase64}" style="height:32px;max-width:80px;display:block;margin:0 auto 2px;"/>` : ''}
      <div style="font-size:5.5pt; color:#E5E7EB; margin-top:2px;">Gas Cert Ref</div>
      <div style="font-size:9pt; font-weight:bold; color:#fff;">${esc(data.certRef)}</div>
      <div style="font-size:5.5pt; color:#E5E7EB; margin-top:4px;">No. Appliances</div>
      <div style="font-size:8pt; font-weight:bold; color:#fff;">${apps.length}</div>
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
    <!-- Row 1: Parent headers -->
    <tr>
      <th rowspan="2" style="width:14px;">#</th>
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
      <th class="grp" colspan="5">Inspection Details</th>
    </tr>
    <!-- Row 2: Sub-headers -->
    <tr>
      <th>CO (ppm)</th>
      <th>CO&#8322; (%)</th>
      <th>Ratio</th>
      <th>CO (ppm)</th>
      <th>CO&#8322; (%)</th>
      <th>Ratio</th>
      <th>Land&shy;lord's</th>
      <th>Inspec&shy;ted</th>
      <th>Visual Check</th>
      <th>Serv&shy;iced</th>
      <th>Safe to Use</th>
    </tr>
  </thead>
  <tbody>
${appRows}
  </tbody>
</table>

<!-- ═══════════════════════════════════════════════════════════════════
     5. VISUAL INSPECTION CHECKLISTS (Yes / No / N/A columns)
     ═══════════════════════════════════════════════════════════════════ -->
<table class="cl mt">
  <tr>
    <td class="shdr" colspan="5" style="width:50%;">Visual Inspection of Gas Installation</td>
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
    <td class="ck">${checkIn(fc.visualInspection, 'Yes')}</td>
    <td class="ck">${checkIn(fc.visualInspection, 'No')}</td>
    <td class="ck">${checkIn(fc.visualInspection, 'N/A')}</td>
    <td class="cnum">5</td>
    <td class="lbl">CO Alarm Fitted</td>
    <td class="ck">${checkIn(fc.coAlarmFitted, 'Yes')}</td>
    <td class="ck">${checkIn(fc.coAlarmFitted, 'No')}</td>
    <td class="ck">${checkIn(fc.coAlarmFitted, 'N/A')}</td>
  </tr>
  <tr>
    <td class="cnum">2</td>
    <td class="lbl">Emergency Control Valve (ECV) Accessible</td>
    <td class="ck">${checkIn(fc.ecvAccessible, 'Yes')}</td>
    <td class="ck">${checkIn(fc.ecvAccessible, 'No')}</td>
    <td class="ck">${checkIn(fc.ecvAccessible, 'N/A')}</td>
    <td class="cnum">6</td>
    <td class="lbl">Testing of CO Alarm Satisfactory</td>
    <td class="ck">${checkIn(fc.coAlarmTestSatisfactory, 'Yes')}</td>
    <td class="ck">${checkIn(fc.coAlarmTestSatisfactory, 'No')}</td>
    <td class="ck">${checkIn(fc.coAlarmTestSatisfactory, 'N/A')}</td>
  </tr>
  <tr>
    <td class="cnum">3</td>
    <td class="lbl">Satisfactory Gas Tightness Test</td>
    <td class="ck">${checkIn(fc.tightnessTest, 'Yes')}</td>
    <td class="ck">${checkIn(fc.tightnessTest, 'No')}</td>
    <td class="ck">${checkIn(fc.tightnessTest, 'N/A')}</td>
    <td class="cnum">7</td>
    <td class="lbl">Smoke Alarm Fitted</td>
    <td class="ck">${checkIn(fc.smokeAlarmFitted, 'Yes')}</td>
    <td class="ck">${checkIn(fc.smokeAlarmFitted, 'No')}</td>
    <td class="ck">${checkIn(fc.smokeAlarmFitted, 'N/A')}</td>
  </tr>
  <tr>
    <td class="cnum">4</td>
    <td class="lbl">Equipotential Bonding Satisfactory</td>
    <td class="ck">${checkIn(fc.equipotentialBonding, 'Yes')}</td>
    <td class="ck">${checkIn(fc.equipotentialBonding, 'No')}</td>
    <td class="ck">${checkIn(fc.equipotentialBonding, 'N/A')}</td>
    <td class="cnum">8</td>
    <td class="lbl">Smoke Alarm Tested Satisfactory</td>
    <td class="ck">${checkIn(fc.smokeAlarmTested, 'Yes')}</td>
    <td class="ck">${checkIn(fc.smokeAlarmTested, 'No')}</td>
    <td class="ck">${checkIn(fc.smokeAlarmTested, 'N/A')}</td>
  </tr>
</table>

<!-- ═══════════════════════════════════════════════════════════════════
     6. FAULTS & WORKS BOX
     ═══════════════════════════════════════════════════════════════════ -->
<table class="flt" style="margin-top:0; border-top:none;">
  <tr><td class="shdr" colspan="2" style="border-top:0.8px solid #9CA3AF;">Faults Identified &amp; Remedial Work</td></tr>
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
     7. SIGNATURES FOOTER
     ═══════════════════════════════════════════════════════════════════ -->
<table class="mt">
  <tr>
    <th colspan="2" style="text-align:center; width:25%; background:#D0D0D0; font-size:6.5pt;">Engineer</th>
    <th colspan="2" style="text-align:center; width:25%; background:#D0D0D0; font-size:6.5pt;">Received By (Customer / Tenant)</th>
    <td class="shdr" style="width:25%;">Next Inspection Date</td>
    <td class="shdr" style="width:15%;">Cert No.</td>
  </tr>
  <tr>
    <th style="width:7%;">Sign</th>
    <td style="height:28px; text-align:center;">
      ${company.signatureBase64 ? `<img src="${company.signatureBase64}" class="sig-img"/>` : ''}
    </td>
    <th style="width:7%;">Sign</th>
    <td style="height:28px; text-align:center;">
      ${data.customerSignature ? `<img src="${data.customerSignature}" class="sig-img"/>` : ''}
    </td>
    <td rowspan="3" class="highlight">
      <span class="highlight-label">Next Inspection Due</span>
      ${esc(data.nextDueDate)}
    </td>
    <td rowspan="3" class="certbox">
      <span class="certbox-label">Certificate No.</span>
      ${esc(data.certRef)}
    </td>
  </tr>
  <tr>
    <th>Print Name</th>
    <td>${esc(engineer.name)}</td>
    <th>Print Name</th>
    <td>${data.tenantName || data.landlordName || ''}</td>
  </tr>
  <tr>
    <th>Date</th>
    <td>${esc(data.inspectionDate)}</td>
    <th>Date</th>
    <td>${esc(data.inspectionDate)}</td>
  </tr>
</table>

<!-- ═══════════════════════════════════════════════════════════════════
     WARNING FOOTER
     ═══════════════════════════════════════════════════════════════════ -->
<div class="warn">
  WARNING: In accordance with the Gas Safety (Installation and Use) Regulations 1998, the landlord must retain this record for a period of 2 years.
  A copy must be issued to each existing tenant within 28 days of the check being completed, and to new tenants before they move in.
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
