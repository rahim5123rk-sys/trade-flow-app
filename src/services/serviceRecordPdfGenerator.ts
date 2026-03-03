// ============================================
// FILE: src/services/serviceRecordPdfGenerator.ts
// Gas Service Record PDF generator
// Uses same slate/charcoal A4 landscape styling as CP12
// ============================================

import { Asset } from 'expo-asset';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Image, Platform } from 'react-native';
import { supabase } from '../config/supabase';
import {
  ApplianceCategory,
  ServiceAppliance,
  ServiceFinalInfo,
} from '../types/serviceRecord';
import { escapeHtml } from '../utils/escapeHtml';
import { getSignedUrl, uploadPdfBase64AndGetUrl } from './storage';
import type { CompanyInfo, EngineerInfo } from './cp12PdfGenerator';

// ─── Data contract ──────────────────────────────────────────────

export interface ServiceRecordPdfData {
  customerName: string;
  customerCompany?: string;
  customerAddress: string;
  customerEmail: string;
  customerPhone: string;
  propertyAddress: string;
  appliances: ServiceAppliance[];
  finalInfo: ServiceFinalInfo;
  serviceDate: string;
  customerSignature: string;
  certRef: string;
}

export interface ServiceRecordLockedPayload {
  kind: 'service_record';
  version: 1;
  savedAt: string;
  pdfData: ServiceRecordPdfData;
  company: CompanyInfo;
  engineer: EngineerInfo;
}

// ─── Shared asset helpers ───────────────────────────────────────

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
    if (!asset.localUri) await asset.downloadAsync();
    const uri = asset.localUri || Image.resolveAssetSource(moduleRef).uri;
    if (!uri) return '';
    return await getImageDataUriFromUri(uri);
  } catch {
    return '';
  }
}

async function getCompanyLogoSrc(companyLogoUrl: string): Promise<string> {
  if (!companyLogoUrl) return '';
  return companyLogoUrl;
}

async function getLatestCompanyLogoUrl(
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

const esc = (v: unknown): string => escapeHtml(v);

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

const conditionBadge = (val: string): string => {
  if (val === 'Safe') return '<span style="background:#dcfce7;color:#15803d;padding:1px 6px;border-radius:3px;font-weight:700;font-size:6pt;">SAFE</span>';
  if (val === 'Unsafe') return '<span style="background:#fee2e2;color:#b91c1c;padding:1px 6px;border-radius:3px;font-weight:700;font-size:6pt;">UNSAFE</span>';
  return '';
};

/** Category label for PDF */
const catLabel = (c: ApplianceCategory): string => {
  if (!c) return '–';
  return c;
};

/** Return relevant component checks for an appliance based on its category */
function getComponentCheckRows(a: ServiceAppliance): Array<{ label: string; val: string }> {
  const base = [
    { label: 'Burner', val: a.burnerChecked },
    { label: 'Electrodes', val: a.electrodesChecked },
    { label: 'Gas Valve', val: a.gasValveChecked },
    { label: 'Controls', val: a.controlsChecked },
    { label: 'Flue', val: a.flueChecked },
    { label: 'Seals / Gaskets', val: a.sealsGasketsChecked },
    { label: 'Ventilation', val: a.ventilationAdequate },
  ];

  if (a.category === 'Boiler') {
    return [
      ...base.slice(0, 2),
      { label: 'Heat Exchanger', val: a.heatExchangerChecked },
      { label: 'Condense Trap', val: a.condenseTrapCleaned },
      { label: 'Fan', val: a.fanChecked },
      ...base.slice(2, 4),
      { label: 'Spark Generator', val: a.sparkGeneratorChecked },
      { label: 'PCB', val: a.pcbChecked },
      { label: 'Thermistor', val: a.thermistorChecked },
      { label: 'Pump', val: a.pumpChecked },
      { label: 'Expansion Vessel', val: a.expansionVesselChecked },
      ...base.slice(4),
    ];
  }

  if (a.category === 'Fire') {
    return [
      ...base.slice(0, 2),
      { label: 'Spark Generator', val: a.sparkGeneratorChecked },
      ...base.slice(2),
    ];
  }

  return base;
}

// ─── Build HTML ─────────────────────────────────────────────────

function buildHtml(
  data: ServiceRecordPdfData,
  company: CompanyInfo,
  engineer: EngineerInfo,
  gasSafeLogoBase64 = '',
  companyLogoSrc = '',
): string {
  const apps = data.appliances;
  const fi = data.finalInfo;

  // Parse property address parts
  const propParts = (data.propertyAddress || '').split(',').map(s => s.trim()).filter(Boolean);
  const propLine1 = propParts[0] || data.propertyAddress || '';
  let propLine2 = '', propCity = '', propPostcode = '';
  if (propParts.length >= 4) {
    propLine2 = propParts.slice(1, -2).join(', ');
    propCity = propParts[propParts.length - 2] || '';
    propPostcode = propParts[propParts.length - 1] || '';
  } else if (propParts.length === 3) {
    propLine2 = propParts[1] || '';
    propPostcode = propParts[2] || '';
  } else if (propParts.length === 2) {
    propLine2 = propParts[1] || '';
  }

  // Parse customer address parts
  const custParts = (data.customerAddress || '').split(',').map(s => s.trim()).filter(Boolean);
  const custLine1 = custParts[0] || data.customerAddress || '';
  const custLine2 = custParts.length > 1 ? custParts.slice(1).join(', ') : '';

  // ── Build per-appliance detail blocks ──
  const applianceBlocks = apps.map((a, idx) => {
    const checks = getComponentCheckRows(a);
    // Build pairs for 2-column layout
    const checkPairs: Array<[{ label: string; val: string }, { label: string; val: string } | null]> = [];
    for (let i = 0; i < checks.length; i += 2) {
      checkPairs.push([checks[i], checks[i + 1] || null]);
    }

    const fgaLowCo = parseFloat(a.fgaLow.co || '');
    const fgaLowCo2 = parseFloat(a.fgaLow.co2 || '');
    const fgaHighCo = parseFloat(a.fgaHigh.co || '');
    const fgaHighCo2 = parseFloat(a.fgaHigh.co2 || '');
    const lowRatio = isFinite(fgaLowCo) && isFinite(fgaLowCo2) && fgaLowCo2 > 0 ? (fgaLowCo / fgaLowCo2).toFixed(4) : (a.fgaLow.ratio || '');
    const highRatio = isFinite(fgaHighCo) && isFinite(fgaHighCo2) && fgaHighCo2 > 0 ? (fgaHighCo / fgaHighCo2).toFixed(4) : (a.fgaHigh.ratio || '');

    return `
    <!-- Appliance ${idx + 1} -->
    <table class="mt">
      <tr><td class="shdr" colspan="8">Appliance ${idx + 1}: ${esc(catLabel(a.category))} — ${esc(a.make || '–')} ${esc(a.model || '')} ${conditionBadge(a.applianceCondition)}</td></tr>
    </table>
    <table class="mt">
      <tr>
        <!-- Left: Identity -->
        <td style="width:33.33%;padding:0;vertical-align:top;">
          <table>
            <tr><td class="label-cell">Location</td><td class="value-cell">${esc(a.location)}</td></tr>
            <tr><td class="label-cell">Make</td><td class="value-cell">${esc(a.make)}</td></tr>
            <tr><td class="label-cell">Model</td><td class="value-cell">${esc(a.model)}</td></tr>
            <tr><td class="label-cell">Serial No.</td><td class="value-cell">${esc(a.serialNumber)}</td></tr>
            <tr><td class="label-cell">GC No.</td><td class="value-cell">${esc(a.gcNumber)}</td></tr>
            ${a.category === 'Boiler' ? `<tr><td class="label-cell">Boiler Type</td><td class="value-cell">${esc(a.boilerType)}</td></tr>` : ''}
            <tr><td class="label-cell">Fuel Type</td><td class="value-cell">${esc(a.fuelType)}</td></tr>
            <tr><td class="label-cell">Flue Type</td><td class="value-cell">${esc(a.flueType)}</td></tr>
          </table>
        </td>
        <!-- Centre: Readings & FGA -->
        <td style="width:33.34%;padding:0 2px;vertical-align:top;">
          <table>
            <tr><th colspan="2" style="background:#475569;color:#fff;font-size:5.5pt;text-align:center;text-transform:uppercase;">Pressure & Readings</th></tr>
            <tr><td class="label-cell">Operating Pressure</td><td class="value-cell">${esc(a.operatingPressure)} ${a.operatingPressure ? 'mBar' : ''}</td></tr>
            ${a.category === 'Boiler' ? `<tr><td class="label-cell">Burner Pressure</td><td class="value-cell">${esc(a.burnerPressure)} ${a.burnerPressure ? 'mBar' : ''}</td></tr>` : ''}
            <tr><td class="label-cell">Standing Pressure</td><td class="value-cell">${esc(a.standingPressure)} ${a.standingPressure ? 'mBar' : ''}</td></tr>
            <tr><td class="label-cell">Heat Input</td><td class="value-cell">${esc(a.heatInput)} ${a.heatInput ? 'kW' : ''}</td></tr>
            <tr><td class="label-cell">Gas Soundness</td><td class="value-cell">${tickH(a.gasSoundness)}</td></tr>
          </table>
          <table class="mt">
            <tr>
              <th colspan="4" style="background:#475569;color:#fff;font-size:5.5pt;text-align:center;text-transform:uppercase;">Flue Gas Analysis</th>
            </tr>
            <tr>
              <th style="background:#334155;color:#fff;font-size:5pt;width:25%;">&nbsp;</th>
              <th style="background:#334155;color:#fff;font-size:5pt;width:25%;">CO (ppm)</th>
              <th style="background:#334155;color:#fff;font-size:5pt;width:25%;">CO₂ (%)</th>
              <th style="background:#334155;color:#fff;font-size:5pt;width:25%;">Ratio</th>
            </tr>
            <tr>
              <td class="label-cell" style="font-size:5.5pt;">Low Fire</td>
              <td class="value-cell" style="text-align:center;">${esc(a.fgaLow.co)}</td>
              <td class="value-cell" style="text-align:center;">${esc(a.fgaLow.co2)}</td>
              <td class="value-cell" style="text-align:center;">${esc(lowRatio)}</td>
            </tr>
            <tr>
              <td class="label-cell" style="font-size:5.5pt;">High Fire</td>
              <td class="value-cell" style="text-align:center;">${esc(a.fgaHigh.co)}</td>
              <td class="value-cell" style="text-align:center;">${esc(a.fgaHigh.co2)}</td>
              <td class="value-cell" style="text-align:center;">${esc(highRatio)}</td>
            </tr>
          </table>
        </td>
        <!-- Right: Safety tests & components -->
        <td style="width:33.33%;padding:0;vertical-align:top;">
          <table>
            <tr><th colspan="2" style="background:#475569;color:#fff;font-size:5.5pt;text-align:center;text-transform:uppercase;">Safety Tests</th></tr>
            <tr><td class="label-cell">Safety Device Op.</td><td class="value-cell" style="text-align:center;">${tickH(a.safetyDeviceOperation)}</td></tr>
            <tr><td class="label-cell">Spillage Test</td><td class="value-cell" style="text-align:center;">${tickH(a.spillageTest)}</td></tr>
            <tr><td class="label-cell">Flue Flow Test</td><td class="value-cell" style="text-align:center;">${tickH(a.flueFlowTest)}</td></tr>
          </table>
          <table class="mt">
            <tr><th colspan="4" style="background:#475569;color:#fff;font-size:5.5pt;text-align:center;text-transform:uppercase;">Components Inspected</th></tr>
            ${checkPairs.map(([left, right]) => `<tr>
              <td class="label-cell" style="width:28%;font-size:5.5pt;">${esc(left.label)}</td>
              <td class="value-cell" style="width:22%;text-align:center;">${tickH(left.val)}</td>
              ${right ? `<td class="label-cell" style="width:28%;font-size:5.5pt;">${esc(right.label)}</td><td class="value-cell" style="width:22%;text-align:center;">${tickH(right.val)}</td>` : '<td colspan="2"></td>'}
            </tr>`).join('\n')}
          </table>
        </td>
      </tr>
    </table>

    <!-- Parts / Notes row -->
    <table class="flt mt">
      <tr>
        <th style="width:15%;">Parts Replaced</th>
        <td style="width:35%;">${esc(a.partsReplaced)}</td>
        <th style="width:15%;">Recommended Work</th>
        <td style="width:35%;">${esc(a.recommendedWork)}</td>
      </tr>
      ${a.engineerNotes ? `<tr><th>Engineer Notes</th><td colspan="3">${esc(a.engineerNotes)}</td></tr>` : ''}
    </table>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
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

  .cl td, .cl th { font-size: 6pt; text-align: center; }
  .cl .lbl { text-align: left; font-weight: 400; color: #374151; }
  .cl .cnum { width: 16px; text-align: center; background: #e2e8f0; font-weight: 700; color: #334155; font-size: 5.5pt; }
  .cl .yna { width: 26px; }

  .flt th { font-size: 5.5pt; font-weight: 600; background: #f1f5f9; color: #1e293b; vertical-align: top; width: 18%; }
  .flt td { font-size: 6pt; background: #fff; min-height: 12px; vertical-align: top; }
  .flt tr.tall-row th,
  .flt tr.tall-row td { height: 22px; }

  .sig-img { height: 38px; max-width: 100%; display: block; margin: 0 auto; }
  .sig-hdr { background: #f1f5f9; color: #1e293b; font-size: 6pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }

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

  .mt { margin-top: -1px; }

  .date-box {
    background: #ecfdf5 !important;
    font-weight: 800;
    font-size: 9pt;
    text-align: center;
    color: #065f46;
    vertical-align: middle;
  }
  .date-box-label {
    font-size: 5pt;
    font-weight: 700;
    text-transform: uppercase;
    color: #064e3b;
    display: block;
    margin-bottom: 2px;
  }
</style>
</head>
<body>
<div class="page">

<!-- ═══════════════════════════════════════════════════════════════
     1. HEADER
     ═══════════════════════════════════════════════════════════════ -->
<table>
  <tr>
    <td style="width:13%;padding:5px 8px;vertical-align:middle;background:linear-gradient(135deg,#1e293b 0%,#334155 100%);">
      ${companyLogoSrc ? `<img src="${companyLogoSrc}" style="max-height:42px;max-width:124px;display:block;"/>` : '<div style="height:42px;"></div>'}
    </td>
    <td style="text-align:center;padding:5px 8px;vertical-align:middle;background:linear-gradient(135deg,#334155 0%,#475569 100%);">
      <div style="font-size:11pt;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;color:#fff;">
        Gas Service Record
      </div>
      <div style="font-size:5.5pt;color:#cbd5e1;line-height:1.5;">
        Record of gas appliance service &amp; inspection carried out by a Gas Safe registered engineer.
        This document records the service work performed and confirms the condition of each appliance at time of service.
      </div>
    </td>
    <td style="width:13%;text-align:center;padding:5px 8px;vertical-align:middle;background:linear-gradient(135deg,#334155 0%,#1e293b 100%);">
      ${gasSafeLogoBase64 ? `<img src="${gasSafeLogoBase64}" style="height:46px;max-width:116px;display:block;margin:0 auto 3px;"/>` : ''}
      <div style="font-size:5pt;color:#cbd5e1;margin-top:2px;text-transform:uppercase;letter-spacing:0.3px;">Record Ref</div>
      <div style="font-size:9pt;font-weight:800;color:#fff;">${esc(data.certRef)}</div>
      <div style="font-size:5pt;color:#cbd5e1;margin-top:3px;text-transform:uppercase;letter-spacing:0.3px;">Appliances</div>
      <div style="font-size:9pt;font-weight:800;color:#fff;">${apps.length}</div>
    </td>
  </tr>
</table>

<!-- ═══════════════════════════════════════════════════════════════
     2. TOP DETAILS (Engineer / Property / Customer)
     ═══════════════════════════════════════════════════════════════ -->
<table class="mt">
  <tr>
    <!-- LEFT: Engineer & Company -->
    <td style="width:33.33%;padding:0;vertical-align:top;">
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
    <!-- CENTRE: Property -->
    <td style="width:33.34%;padding:0 2px;vertical-align:top;">
      <table>
        <tr><td class="shdr" colspan="2">Property Details</td></tr>
        <tr>
          <td class="label-cell" rowspan="2" style="vertical-align:top;border-bottom:none;">Address</td>
          <td class="value-cell" style="border-bottom:none;">${esc(propLine1)}</td>
        </tr>
        <tr><td class="value-cell" style="border-top:none;min-height:14px;">${esc(propLine2)}&nbsp;</td></tr>
        <tr><td class="label-cell">City</td><td class="value-cell">${esc(propCity)}</td></tr>
        <tr><td class="label-cell">Postcode</td><td class="value-cell">${esc(propPostcode)}</td></tr>
        <tr><td class="label-cell">Service Date</td><td class="value-cell" style="font-weight:700;">${esc(data.serviceDate)}</td></tr>
        <tr><td class="label-cell">&nbsp;</td><td class="value-cell">&nbsp;</td></tr>
        <tr><td class="label-cell">&nbsp;</td><td class="value-cell">&nbsp;</td></tr>
      </table>
    </td>
    <!-- RIGHT: Customer -->
    <td style="width:33.33%;padding:0;vertical-align:top;">
      <table>
        <tr><td class="shdr" colspan="2">Customer Details</td></tr>
        <tr><td class="label-cell">Name</td><td class="value-cell">${esc(data.customerName)}</td></tr>
        <tr><td class="label-cell">Company</td><td class="value-cell">${esc(data.customerCompany || '')}</td></tr>
        <tr>
          <td class="label-cell" rowspan="2" style="vertical-align:top;border-bottom:none;">Address</td>
          <td class="value-cell" style="border-bottom:none;">${esc(custLine1)}</td>
        </tr>
        <tr><td class="value-cell" style="border-top:none;">${esc(custLine2)}</td></tr>
        <tr><td class="label-cell">Email</td><td class="value-cell">${esc(data.customerEmail)}</td></tr>
        <tr><td class="label-cell">Phone</td><td class="value-cell">${esc(data.customerPhone)}</td></tr>
      </table>
    </td>
  </tr>
</table>

<!-- ═══════════════════════════════════════════════════════════════
     3. APPLIANCE SERVICE DETAILS
     ═══════════════════════════════════════════════════════════════ -->
${applianceBlocks}

<!-- ═══════════════════════════════════════════════════════════════
     4. GENERAL INSTALLATION CHECKS
     ═══════════════════════════════════════════════════════════════ -->
<table class="cl mt">
  <tr>
    <td class="shdr" colspan="5" style="width:50%;">Installation &amp; Pipework</td>
    <td class="shdr" colspan="5" style="width:50%;">CO Alarm Checks</td>
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
    <td class="lbl">Tightness Test Performed</td>
    <td style="text-align:center;">${checkInH(fi.tightnessTestPerformed, 'Yes')}</td>
    <td style="text-align:center;">${checkInH(fi.tightnessTestPerformed, 'No')}</td>
    <td style="text-align:center;">${checkInH(fi.tightnessTestPerformed, 'N/A')}</td>
    <td class="cnum">6</td>
    <td class="lbl">CO Alarm Fitted</td>
    <td style="text-align:center;">${checkInH(fi.coAlarmFitted, 'Yes')}</td>
    <td style="text-align:center;">${checkInH(fi.coAlarmFitted, 'No')}</td>
    <td style="text-align:center;">${checkInH(fi.coAlarmFitted, 'N/A')}</td>
  </tr>
  <tr>
    <td class="cnum">2</td>
    <td class="lbl">Gas Meter Condition Satisfactory</td>
    <td style="text-align:center;">${checkInH(fi.gasMeterCondition, 'Yes')}</td>
    <td style="text-align:center;">${checkInH(fi.gasMeterCondition, 'No')}</td>
    <td style="text-align:center;">${checkInH(fi.gasMeterCondition, 'N/A')}</td>
    <td class="cnum">7</td>
    <td class="lbl">CO Alarm Tested Satisfactory</td>
    <td style="text-align:center;">${checkInH(fi.coAlarmTested, 'Yes')}</td>
    <td style="text-align:center;">${checkInH(fi.coAlarmTested, 'No')}</td>
    <td style="text-align:center;">${checkInH(fi.coAlarmTested, 'N/A')}</td>
  </tr>
  <tr>
    <td class="cnum">3</td>
    <td class="lbl">Emergency Control Valve Accessible</td>
    <td style="text-align:center;">${checkInH(fi.emergencyControlAccessible, 'Yes')}</td>
    <td style="text-align:center;">${checkInH(fi.emergencyControlAccessible, 'No')}</td>
    <td style="text-align:center;">${checkInH(fi.emergencyControlAccessible, 'N/A')}</td>
    <td class="cnum">8</td>
    <td class="lbl">CO Alarm Within Date</td>
    <td style="text-align:center;">${checkInH(fi.coAlarmInDate, 'Yes')}</td>
    <td style="text-align:center;">${checkInH(fi.coAlarmInDate, 'No')}</td>
    <td style="text-align:center;">${checkInH(fi.coAlarmInDate, 'N/A')}</td>
  </tr>
  <tr>
    <td class="cnum">4</td>
    <td class="lbl">Ventilation Satisfactory</td>
    <td style="text-align:center;">${checkInH(fi.ventilationSatisfactory, 'Yes')}</td>
    <td style="text-align:center;">${checkInH(fi.ventilationSatisfactory, 'No')}</td>
    <td style="text-align:center;">${checkInH(fi.ventilationSatisfactory, 'N/A')}</td>
    <td class="cnum" rowspan="1">–</td>
    <td class="lbl" rowspan="1">&nbsp;</td>
    <td colspan="3">&nbsp;</td>
  </tr>
  <tr>
    <td class="cnum">5</td>
    <td class="lbl">Pipework Condition Satisfactory</td>
    <td style="text-align:center;">${checkInH(fi.pipeworkCondition, 'Yes')}</td>
    <td style="text-align:center;">${checkInH(fi.pipeworkCondition, 'No')}</td>
    <td style="text-align:center;">${checkInH(fi.pipeworkCondition, 'N/A')}</td>
    <td class="cnum">–</td>
    <td class="lbl">&nbsp;</td>
    <td colspan="3">&nbsp;</td>
  </tr>
</table>

<!-- 5. FAULTS & ADDITIONAL WORK -->
<table class="flt mt">
  <tr><td class="shdr" colspan="2">Faults &amp; Additional Work</td></tr>
  <tr class="tall-row">
    <th>Overall Faults Identified</th>
    <td>${esc(fi.overallFaults)}</td>
  </tr>
  <tr class="tall-row">
    <th>Additional Work Recommended</th>
    <td>${esc(fi.additionalWork)}</td>
  </tr>
</table>

<!-- ═══════════════════════════════════════════════════════════════
     6. SIGNATURES FOOTER
     ═══════════════════════════════════════════════════════════════ -->
<table class="mt">
  <tr>
    <th colspan="2" class="sig-hdr" style="text-align:center;width:30%;">Engineer</th>
    <th colspan="2" class="sig-hdr" style="text-align:center;width:30%;">Customer</th>
    <td class="shdr" style="width:22%;">Service Date</td>
    <td class="shdr" style="width:18%;">Record Ref.</td>
  </tr>
  <tr>
    <th class="sig-hdr" style="width:7%;">Signature</th>
    <td style="height:38px;text-align:center;">
      ${company.signatureBase64 ? `<img src="${company.signatureBase64}" class="sig-img"/>` : ''}
    </td>
    <th class="sig-hdr" style="width:7%;">Signature</th>
    <td style="height:38px;text-align:center;">
      ${data.customerSignature ? `<img src="${data.customerSignature}" class="sig-img"/>` : ''}
    </td>
    <td rowspan="3" class="date-box">
      <span class="date-box-label">Service Date</span>
      ${esc(data.serviceDate)}
    </td>
    <td rowspan="3" class="certbox">
      <span class="certbox-label">Record Ref.</span>
      ${esc(data.certRef)}
    </td>
  </tr>
  <tr>
    <th class="sig-hdr">Print Name</th>
    <td>${esc(engineer.name)}</td>
    <th class="sig-hdr">Print Name</th>
    <td>${esc(data.customerName)}</td>
  </tr>
  <tr>
    <th class="sig-hdr">Date</th>
    <td>${esc(data.serviceDate)}</td>
    <th class="sig-hdr">Date</th>
    <td>${esc(data.serviceDate)}</td>
  </tr>
</table>

<!-- WARNING FOOTER -->
<div class="warn">
  IMPORTANT: This service record confirms the work carried out on the date shown. It does not constitute a Gas Safety Certificate (CP12).
  Gas appliances should be serviced annually in accordance with manufacturer guidelines. If any appliance is marked as unsafe, it must not be used until repaired by a Gas Safe registered engineer.
</div>

</div>
</body>
</html>`;
}

// ─── Print / share helpers ──────────────────────────────────────

async function printHtmlToPdf(html: string): Promise<string> {
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
    width: 842,
    height: 595,
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
  if (!base64) throw new Error('Failed to create Service Record PDF base64 output');
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
      console.warn('Service Record share dismissed/failed on iOS:', err);
    });
    return;
  }
  await Sharing.shareAsync(uri, shareOptions);
}

// ─── Build locked payload from resolved company data ────────────

async function buildRenderedHtml(
  payload: ServiceRecordLockedPayload,
  companyId?: string,
): Promise<{ html: string; title: string }> {
  const gasSafeLogoBase64 = await getGasSafeLogoBase64();
  const liveCompanyLogoUrl = await getLatestCompanyLogoUrl(
    companyId,
    payload.company.logoUrl,
  );
  const companyLogoSrc = await getCompanyLogoSrc(liveCompanyLogoUrl);
  const companyForRender: CompanyInfo = { ...payload.company, logoUrl: liveCompanyLogoUrl };
  const html = buildHtml(
    payload.pdfData,
    companyForRender,
    payload.engineer,
    gasSafeLogoBase64,
    companyLogoSrc,
  );
  const title = `Service Record - ${payload.pdfData.customerName || 'Gas Service'}`;
  return { html, title };
}

// ─── Public API ─────────────────────────────────────────────────

export async function buildServiceRecordLockedPayload(
  data: ServiceRecordPdfData,
  companyId: string,
  userId: string,
): Promise<ServiceRecordLockedPayload> {
  const { company, engineer } = await getCompanyAndEngineer(companyId, userId);
  return {
    kind: 'service_record',
    version: 1,
    savedAt: new Date().toISOString(),
    pdfData: data,
    company,
    engineer,
  };
}

export async function generateServiceRecordPdfFromPayload(
  payload: ServiceRecordLockedPayload,
  mode: 'share' | 'save' | 'view' = 'share',
  companyId?: string,
): Promise<void> {
  const { html, title } = await buildRenderedHtml(payload, companyId);
  if (mode === 'view') {
    await Print.printAsync({ html });
    return;
  }
  await shareHtmlAsPdf(html, mode === 'save' ? `${title} (Save)` : title);
}

export async function generateServiceRecordPdfBase64FromPayload(
  payload: ServiceRecordLockedPayload,
  companyId?: string,
): Promise<string> {
  const { html } = await buildRenderedHtml(payload, companyId);
  return printHtmlToPdfBase64(html);
}

export async function generateServiceRecordPdfUrl(
  payload: ServiceRecordLockedPayload,
  companyId: string,
): Promise<string> {
  const base64 = await generateServiceRecordPdfBase64FromPayload(payload, companyId);
  return uploadPdfBase64AndGetUrl(base64, companyId, payload.pdfData.certRef);
}
