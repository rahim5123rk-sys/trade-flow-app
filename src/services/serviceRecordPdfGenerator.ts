// ============================================
// FILE: src/services/serviceRecordPdfGenerator.ts
// Gas Service Record PDF generator
//
// Uses shared PDF infrastructure from ./pdf/shared.ts
// Only contains the service-record-specific HTML body layout.
// ============================================

import {
    ApplianceCategory,
    ServiceAppliance,
    ServiceFinalInfo,
} from '../types/serviceRecord';
import { registerFormPdf } from './pdf/registry';
import {
    type BaseLockedPayload,
    checkInH,
    type CompanyInfo,
    type EngineerInfo,
    esc,
    generatePdfBase64FromPayload,
    generatePdfFromPayload,
    generatePdfUrlFromPayload,
    getBaseCss,
    getCompanyAndEngineer,
    tickH,
} from './pdf/shared';

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
  nextInspectionDate: string;
  customerSignature: string;
  certRef: string;
}

export interface ServiceRecordLockedPayload extends BaseLockedPayload<'service_record', ServiceRecordPdfData> {
  kind: 'service_record';
  version: 1;
}

// ─── Service-record-specific helpers ────────────────────────────

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
      { label: 'Expansion Vessel Recharged', val: a.expansionVesselRecharged },
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
  const appliance = data.appliances[0];
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

  // ── Build appliance detail block (single appliance) ──
  const applianceBlocks = appliance ? (() => {
    const a = appliance;
    const idx = 0;
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
        <th style="width:15%;">Defects Found</th>
        <td style="width:35%;">${esc(a.defectsFound)}</td>
      </tr>
      <tr>
        <th>Remedial Action Taken</th>
        <td>${esc(a.remedialActionTaken)}</td>
        <th>Recommended Work</th>
        <td>${esc(a.recommendedWork)}</td>
      </tr>
      ${a.engineerNotes ? `<tr><th>Engineer Notes</th><td colspan="3">${esc(a.engineerNotes)}</td></tr>` : ''}
    </table>
    `;
  })() : `
    <table class="mt">
      <tr><td class="shdr" colspan="8">Appliance Details</td></tr>
      <tr><td style="padding:8px;text-align:center;">No appliance details recorded.</td></tr>
    </table>
  `;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  ${getBaseCss()}

  /* Service-record-specific styles */
  .date-box {
    background: #ecfdf5 !important;
    font-weight: 800;
    font-size: 9pt;
    text-align: center;
    color: #065f46;
    vertical-align: middle;
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
      <div style="font-size:9pt;font-weight:800;color:#fff;">${appliance ? 1 : 0}</div>
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
    <th colspan="2" class="sig-hdr" style="text-align:center;width:33.33%;">Engineer</th>
    <th colspan="2" class="sig-hdr" style="text-align:center;width:33.33%;">Customer</th>
    <td class="shdr" style="width:33.34%;">Date &amp; Next Inspection</td>
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
    <td rowspan="3" class="next-due">
      <span class="date-box-label">Service Date</span>
      ${esc(data.serviceDate)}
      <br/>
      <span class="next-due-label" style="margin-top:6px;">Next Inspection Due</span>
      ${esc(data.nextInspectionDate || '')}
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

// ─── Title helper ───────────────────────────────────────────────

function srTitle(payload: ServiceRecordLockedPayload): string {
  return `Service Record - ${payload.pdfData.customerName || 'Gas Service'}`;
}

// ─── Public API (thin wrappers around shared infrastructure) ────

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
  return generatePdfFromPayload(payload, buildHtml, srTitle, mode, companyId);
}

export async function generateServiceRecordPdfBase64FromPayload(
  payload: ServiceRecordLockedPayload,
  companyId?: string,
): Promise<string> {
  return generatePdfBase64FromPayload(payload, buildHtml, companyId);
}

export async function generateServiceRecordPdfUrl(
  payload: ServiceRecordLockedPayload,
  companyId: string,
): Promise<string> {
  return generatePdfUrlFromPayload(payload, buildHtml, companyId, payload.pdfData.certRef);
}

// ─── Register in the polymorphic registry ───────────────────────

registerFormPdf('service_record', {
  label: 'Gas Service Record',
  shortLabel: 'Service Record',
  icon: 'construct-outline',
  color: '#059669',
  buildHtml: (pdfData, company, engineer, gasSafeLogo, companyLogo) =>
    buildHtml(pdfData as ServiceRecordPdfData, company, engineer, gasSafeLogo, companyLogo),
  titleFn: (payload) =>
    `Service Record - ${(payload.pdfData as ServiceRecordPdfData).customerName || 'Gas Service'}`,
});
