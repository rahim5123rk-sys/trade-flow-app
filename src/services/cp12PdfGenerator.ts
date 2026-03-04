// ============================================
// FILE: src/services/cp12PdfGenerator.ts
// CP12 Gas Safety Certificate PDF generator
//
// Uses shared PDF infrastructure from ./pdf/shared.ts
// Only contains the CP12-specific HTML body layout.
// ============================================

import { CP12Appliance, CP12FinalChecks } from '../types/cp12';
import { registerFormPdf } from './pdf/registry';
import {
    type BaseLockedPayload,
    checkInH,
    type CompanyInfo,
    type EngineerInfo,
    esc,
    getBaseCss,
    parseAddress,
    tickH
} from './pdf/shared';

// Re-export for backwards compatibility
export type { CompanyInfo, EngineerInfo };

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

export interface CP12LockedPayload extends BaseLockedPayload<'cp12', CP12PdfData> {
  kind: 'cp12';
  version: 1;
}

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

  const {line1: propertyAddressLine1, line2: propertyAddressLine2, city: propertyCity, postcode: propertyPostcode} = parseAddress(data.propertyAddress);

  // tickH and checkInH are imported from shared

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
  ${getBaseCss()}

  /* CP12-specific overrides */
  html, body { max-height: 210mm; overflow: hidden; }
  .page { max-height: 210mm; overflow: hidden; page-break-after: avoid; }
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
    <th colspan="2" class="sig-hdr" style="text-align:center; width:33.33%;">Engineer</th>
    <th colspan="2" class="sig-hdr" style="text-align:center; width:33.33%;">Received By (Customer / Tenant)</th>
    <td class="shdr" style="width:33.34%;">Date &amp; Next Inspection</td>
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
      <span class="next-due-label">Inspection Date</span>
      ${esc(data.inspectionDate)}
      <br/>
      <span class="next-due-label" style="margin-top:6px;">Next Inspection Due</span>
      ${esc(data.nextDueDate)}
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

// ─── Register in the polymorphic registry ───────────────────────

registerFormPdf('cp12', {
  label: 'Gas Safety Certificate',
  shortLabel: 'Gas Safety Cert',
  icon: 'shield-checkmark-outline',
  color: '#1D4ED8',
  buildHtml: (pdfData, company, engineer, gasSafeLogo, companyLogo) =>
    buildHtml(pdfData as CP12PdfData, company, engineer, gasSafeLogo, companyLogo),
  titleFn: (payload) =>
    `CP12 - ${(payload.pdfData as CP12PdfData).landlordName || 'Gas Safety Record'}`,
});
