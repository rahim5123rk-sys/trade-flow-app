import { BreakdownReportAppliance, BreakdownReportFinalInfo } from '../types/breakdownReport';
import { registerFormPdf } from './pdf/registry';
import { type BaseLockedPayload, combineNotes, generatePdfBase64FromPayload, generatePdfFromPayload, generatePdfUrlFromPayload, getCompanyAndEngineer } from './pdf/shared';
import { buildSingleApplianceFormHtml } from './pdf/singleApplianceFormTemplate';

export interface BreakdownReportPdfData {
  customerName: string;
  customerCompany?: string;
  customerAddress: string;
  customerEmail: string;
  customerPhone: string;
  propertyAddress: string;
  appliances: BreakdownReportAppliance[];
  finalInfo: BreakdownReportFinalInfo;
  reportDate: string;
  customerSignature: string;
  certRef: string;
}

export interface BreakdownReportLockedPayload extends BaseLockedPayload<'breakdown_report', BreakdownReportPdfData> { kind: 'breakdown_report'; version: 1; }


function buildHtml(pdfData: BreakdownReportPdfData, company: any, engineer: any, gasSafeLogo = '', companyLogo = '') {
  const appliance = pdfData.appliances?.[0] || {} as Partial<BreakdownReportAppliance>;
  const finalInfo = pdfData.finalInfo || {} as Partial<BreakdownReportFinalInfo>;
  const repairNotes = combineNotes(
    appliance?.engineerNotes,
    appliance?.remedialActionTaken ? `Work Carried Out: ${appliance.remedialActionTaken}` : '',
  );
  const diagnosisOutcome = combineNotes(
    finalInfo.repairOutcome,
    finalInfo.faultFound ? `Fault Found: ${finalInfo.faultFound}` : '',
    finalInfo.furtherWorkRequired ? `Further Work Required: ${finalInfo.furtherWorkRequired}` : '',
  );
  return buildSingleApplianceFormHtml({
    title: 'Breakdown / Repair Report',
    description: 'Record of diagnostic work, repair actions and final outcome for a single appliance visit.',
    accentColor: '#D97706',
    ref: pdfData.certRef,
    company,
    engineer,
    gasSafeLogoBase64: gasSafeLogo,
    companyLogoSrc: companyLogo,
    customerName: pdfData.customerName,
    customerCompany: pdfData.customerCompany,
    customerAddress: pdfData.customerAddress,
    customerEmail: pdfData.customerEmail,
    customerPhone: pdfData.customerPhone,
    propertyAddress: pdfData.propertyAddress,
    primaryDateLabel: 'Report Date',
    primaryDate: pdfData.reportDate,
    applianceHeading: 'Appliance Details',
    applianceSummary: [
      {label: 'Appliance Type', value: appliance?.category || ''},
      {label: 'Location', value: appliance?.location || ''},
      {label: 'Make / Model', value: [appliance?.make || '', appliance?.model || ''].filter(Boolean).join(' ')},
      {label: 'Serial Number', value: appliance?.serialNumber || ''},
      {label: 'GC Number', value: appliance?.gcNumber || ''},
      {label: 'Condition', value: appliance?.applianceCondition || ''},
    ],
    applianceSections: [
      {title: 'Fault Details', rows: [
        {label: 'Fault Symptoms', value: appliance?.faultSymptoms || ''},
        {label: 'Fault Code', value: appliance?.faultCode || ''},
        {label: 'Diagnostic Checks', value: appliance?.diagnosticChecks || ''},
        {label: 'Gas Soundness', value: appliance?.gasSoundness || ''},
        {label: 'Electrical Supply Safe', value: appliance?.electricalSupplySafe || ''},
        {label: 'Water Pressure', value: appliance?.waterPressure || ''},
        {label: 'Operating Pressure', value: appliance?.operatingPressure || ''},
        {label: 'Burner Pressure', value: appliance?.burnerPressure || ''},
      ]},
      {title: 'Repair Actions', rows: [
        {label: 'Parts Required', value: appliance?.partsRequired || ''},
        {label: 'Parts Fitted', value: appliance?.partsFitted || ''},
        {label: 'Temporary Repair Made', value: appliance?.temporaryRepairMade || ''},
        {label: 'Repair Notes', value: repairNotes},
      ]},
    ],
    finalSections: [{title: 'Final Outcome', rows: [
      {label: 'Diagnosis / Outcome', value: diagnosisOutcome},
      {label: 'Appliance Left Operational', value: finalInfo.applianceLeftOperational},
      {label: 'Customer Advised', value: finalInfo.customerAdvised},
    ]}],
    customerSignature: pdfData.customerSignature,
    footerNote: 'This report records the breakdown diagnostics and repair outcome for the appliance listed above.',
  });
}

function title(payload: BreakdownReportLockedPayload) { return `Breakdown Report - ${payload.pdfData.customerName || 'Customer'}`; }
export async function buildBreakdownReportLockedPayload(data: BreakdownReportPdfData, companyId: string, userId: string): Promise<BreakdownReportLockedPayload> { const {company, engineer} = await getCompanyAndEngineer(companyId, userId); return {kind: 'breakdown_report', version: 1, savedAt: new Date().toISOString(), pdfData: data, company, engineer}; }
export async function generateBreakdownReportPdfFromPayload(payload: BreakdownReportLockedPayload, mode: 'share' | 'save' | 'view' = 'share', companyId?: string) { return generatePdfFromPayload(payload, buildHtml, title, mode, companyId); }
export async function generateBreakdownReportPdfBase64FromPayload(payload: BreakdownReportLockedPayload, companyId?: string) { return generatePdfBase64FromPayload(payload, buildHtml, companyId); }
export async function generateBreakdownReportPdfUrl(payload: BreakdownReportLockedPayload, companyId: string) { return generatePdfUrlFromPayload(payload, buildHtml, companyId, payload.pdfData.certRef); }
registerFormPdf('breakdown_report', {label: 'Breakdown / Repair Report', shortLabel: 'Breakdown', icon: 'build-outline', color: '#D97706', buildHtml: (pdfData, company, engineer, gasSafeLogo, companyLogo) => buildHtml(pdfData as BreakdownReportPdfData, company, engineer, gasSafeLogo, companyLogo), titleFn: (payload) => title(payload as BreakdownReportLockedPayload)});
