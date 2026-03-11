import { WarningNoticeAppliance, WarningNoticeFinalInfo } from '../types/warningNotice';
import { registerFormPdf } from './pdf/registry';
import { type BaseLockedPayload, generatePdfBase64FromPayload, generatePdfFromPayload, generatePdfUrlFromPayload, getCompanyAndEngineer } from './pdf/shared';
import { buildSingleApplianceFormHtml } from './pdf/singleApplianceFormTemplate';

export interface WarningNoticePdfData {
  customerName: string;
  customerCompany?: string;
  customerAddress: string;
  customerEmail: string;
  customerPhone: string;
  propertyAddress: string;
  appliances: WarningNoticeAppliance[];
  finalInfo: WarningNoticeFinalInfo;
  issueDate: string;
  customerSignature: string;
  certRef: string;
}

export interface WarningNoticeLockedPayload extends BaseLockedPayload<'warning_notice', WarningNoticePdfData> { kind: 'warning_notice'; version: 1; }

const combineNotes = (...parts: Array<string | null | undefined>) => parts.map((part) => part?.trim()).filter(Boolean).join('\n\n');

function buildHtml(pdfData: WarningNoticePdfData, company: any, engineer: any, gasSafeLogo = '', companyLogo = '') {
  const appliance = pdfData.appliances[0];
  const finalInfo = pdfData.finalInfo;
  const outcomeNotes = combineNotes(
    finalInfo.engineerOpinion,
    finalInfo.furtherActionRequired ? `Further Action Required: ${finalInfo.furtherActionRequired}` : '',
    appliance?.engineerNotes ? `Engineer Notes: ${appliance.engineerNotes}` : '',
  );
  return buildSingleApplianceFormHtml({
    title: 'Warning Notice',
    description: 'Record of unsafe appliance conditions, classification and actions taken for a single gas appliance.',
    accentColor: '#DC2626',
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
    primaryDateLabel: 'Issue Date',
    primaryDate: pdfData.issueDate,
    applianceHeading: 'Appliance Details',
    applianceSummary: [
      {label: 'Appliance Type', value: appliance?.category || ''},
      {label: 'Location', value: appliance?.location || ''},
      {label: 'Make / Model', value: [appliance?.make || '', appliance?.model || ''].filter(Boolean).join(' ')},
      {label: 'Serial Number', value: appliance?.serialNumber || ''},
      {label: 'GC Number', value: appliance?.gcNumber || ''},
      {label: 'Classification', value: appliance?.warningClassification || ''},
    ],
    applianceSections: [
      {title: 'Hazard Details', rows: [
        {label: 'Condition', value: appliance?.applianceCondition || ''},
        {label: 'Unsafe Situation', value: appliance?.unsafeSituation || ''},
        {label: 'Risk Details', value: appliance?.riskDetails || ''},
        {label: 'Actions Taken', value: appliance?.actionsTaken || ''},
      ]},
      {title: 'Immediate Actions', rows: [
        {label: 'Appliance Disconnected', value: appliance?.applianceDisconnected || ''},
        {label: 'Gas Supply Disconnected', value: appliance?.gasSupplyDisconnected || ''},
        {label: 'Warning Label Attached', value: appliance?.warningLabelAttached || ''},
        {label: 'Responsible Person Informed', value: appliance?.responsiblePersonInformed || ''},
        {label: 'Warning Notice Issued', value: appliance?.warningNoticeIssued || ''},
      ]},
      {title: 'Notes', rows: [{label: 'Outcome / Advice Notes', value: outcomeNotes}]},
    ],
    finalSections: [{title: 'Engineer Outcome', rows: [
      {label: 'Customer Refused Permission', value: finalInfo.customerRefusedPermission},
      {label: 'Emergency Service Contacted', value: finalInfo.emergencyServiceContacted},
      {label: 'Summary', value: outcomeNotes},
    ]}],
    customerSignature: pdfData.customerSignature,
    footerNote: 'This warning notice records the unsafe condition found at the appliance listed above and the actions taken during the visit.',
  });
}

function title(payload: WarningNoticeLockedPayload) { return `Warning Notice - ${payload.pdfData.customerName || 'Customer'}`; }
export async function buildWarningNoticeLockedPayload(data: WarningNoticePdfData, companyId: string, userId: string): Promise<WarningNoticeLockedPayload> { const {company, engineer} = await getCompanyAndEngineer(companyId, userId); return {kind: 'warning_notice', version: 1, savedAt: new Date().toISOString(), pdfData: data, company, engineer}; }
export async function generateWarningNoticePdfFromPayload(payload: WarningNoticeLockedPayload, mode: 'share' | 'save' | 'view' = 'share', companyId?: string) { return generatePdfFromPayload(payload, buildHtml, title, mode, companyId); }
export async function generateWarningNoticePdfBase64FromPayload(payload: WarningNoticeLockedPayload, companyId?: string) { return generatePdfBase64FromPayload(payload, buildHtml, companyId); }
export async function generateWarningNoticePdfUrl(payload: WarningNoticeLockedPayload, companyId: string) { return generatePdfUrlFromPayload(payload, buildHtml, companyId, payload.pdfData.certRef); }
registerFormPdf('warning_notice', {label: 'Warning Notice', shortLabel: 'Warning Notice', icon: 'warning-outline', color: '#DC2626', buildHtml: (pdfData, company, engineer, gasSafeLogo, companyLogo) => buildHtml(pdfData as WarningNoticePdfData, company, engineer, gasSafeLogo, companyLogo), titleFn: (payload) => title(payload as WarningNoticeLockedPayload)});
