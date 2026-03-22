import {
    DecommissioningAppliance,
    DecommissioningFinalInfo,
} from '../types/decommissioning';
import { registerFormPdf } from './pdf/registry';
import {
    type BaseLockedPayload,
    generatePdfBase64FromPayload,
    generatePdfFromPayload,
    generatePdfUrlFromPayload,
    combineNotes,
    getCompanyAndEngineer,
} from './pdf/shared';
import { buildSingleApplianceFormHtml } from './pdf/singleApplianceFormTemplate';

export interface DecommissioningPdfData {
  customerName: string;
  customerCompany?: string;
  customerAddress: string;
  customerEmail: string;
  customerPhone: string;
  propertyAddress: string;
  appliances: DecommissioningAppliance[];
  finalInfo: DecommissioningFinalInfo;
  decommissionDate: string;
  customerSignature: string;
  certRef: string;
}

export interface DecommissioningLockedPayload extends BaseLockedPayload<'decommissioning', DecommissioningPdfData> {
  kind: 'decommissioning';
  version: 1;
}

function buildHtml(pdfData: DecommissioningPdfData, company: any, engineer: any, gasSafeLogo = '', companyLogo = '') {
  const appliance = pdfData.appliances?.[0] || {} as Partial<DecommissioningAppliance>;
  const finalInfo = pdfData.finalInfo || {} as Partial<DecommissioningFinalInfo>;
  const siteNotes = combineNotes(
    appliance?.engineerNotes,
    appliance?.defectsFound ? `Defects Found: ${appliance.defectsFound}` : '',
    appliance?.remedialActionTaken ? `Remedial Action Taken: ${appliance.remedialActionTaken}` : '',
  );
  const completionNotes = combineNotes(
    finalInfo.certificateNotes,
    finalInfo.furtherWorkRequired ? `Further Work Required: ${finalInfo.furtherWorkRequired}` : '',
  );

  return buildSingleApplianceFormHtml({
    title: 'Decommissioning Certificate',
    description: 'Record of safe disconnection, isolation and making safe of a single gas appliance.',
    accentColor: '#64748B',
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
    primaryDateLabel: 'Decommissioned On',
    primaryDate: pdfData.decommissionDate,
    applianceHeading: 'Appliance Details',
    applianceSummary: [
      {label: 'Appliance Type', value: appliance?.category || ''},
      {label: 'Location', value: appliance?.location || ''},
      {label: 'Make / Model', value: [appliance?.make || '', appliance?.model || ''].filter(Boolean).join(' ')},
      {label: 'Serial Number', value: appliance?.serialNumber || ''},
      {label: 'GC Number', value: appliance?.gcNumber || ''},
      {label: 'Fuel / Flue', value: [appliance?.fuelType || '', appliance?.flueType || ''].filter(Boolean).join(' / ')},
    ],
    applianceSections: [
      {
        title: 'Isolation & Disconnection',
        rows: [
          {label: 'Gas Soundness', value: appliance?.gasSoundness || ''},
          {label: 'Gas Supply Isolated', value: appliance?.gasSupplyIsolated || ''},
          {label: 'Gas Supply Capped', value: appliance?.gasSupplyCapped || ''},
          {label: 'Electrical Supply Isolated', value: appliance?.electricalSupplyIsolated || ''},
          {label: 'Water Supply Isolated', value: appliance?.waterSupplyIsolated || ''},
          {label: 'Flue Sealed', value: appliance?.flueSealed || ''},
          {label: 'Ventilation Made Safe', value: appliance?.ventilationMadeSafe || ''},
          {label: 'Appliance Removed', value: appliance?.applianceRemoved || ''},
          {label: 'Left In Situ & Labelled', value: appliance?.leftInSituLabelled || ''},
          {label: 'Warning Notice Issued', value: appliance?.warningNoticeIssued || ''},
        ],
      },
      {
        title: 'Outcome & Notes',
        rows: [
          {label: 'Reason for Decommissioning', value: appliance?.decommissionReason || ''},
          {label: 'Appliance Condition', value: appliance?.applianceCondition || ''},
          {label: 'Site Notes', value: siteNotes},
        ],
      },
    ],
    finalSections: [
      {
        title: 'Final Checks',
        rows: [
          {label: 'Tightness Test Performed', value: finalInfo.tightnessTestPerformed},
          {label: 'Emergency Control Accessible', value: finalInfo.emergencyControlAccessible},
          {label: 'Pipework Condition', value: finalInfo.pipeworkCondition},
          {label: 'Site Left Safe', value: finalInfo.siteLeftSafe},
          {label: 'Customer Advised', value: finalInfo.customerAdvised},
          {label: 'Completion Notes', value: completionNotes},
        ],
      },
    ],
    customerSignature: pdfData.customerSignature,
    footerNote: 'This certificate records the decommissioning status of the appliance listed above. Any future reconnection or replacement work should be carried out by a competent Gas Safe registered engineer.',
  });
}

function title(payload: DecommissioningLockedPayload) {
  return `Decommissioning - ${payload.pdfData.customerName || 'Customer'}`;
}

export async function buildDecommissioningLockedPayload(
  data: DecommissioningPdfData,
  companyId: string,
  userId: string,
): Promise<DecommissioningLockedPayload> {
  const {company, engineer} = await getCompanyAndEngineer(companyId, userId);
  return {
    kind: 'decommissioning',
    version: 1,
    savedAt: new Date().toISOString(),
    pdfData: data,
    company,
    engineer,
  };
}

export async function generateDecommissioningPdfFromPayload(payload: DecommissioningLockedPayload, mode: 'share' | 'save' | 'view' = 'share', companyId?: string) {
  return generatePdfFromPayload(payload, buildHtml, title, mode, companyId);
}

export async function generateDecommissioningPdfBase64FromPayload(payload: DecommissioningLockedPayload, companyId?: string) {
  return generatePdfBase64FromPayload(payload, buildHtml, companyId);
}

export async function generateDecommissioningPdfUrl(payload: DecommissioningLockedPayload, companyId: string) {
  return generatePdfUrlFromPayload(payload, buildHtml, companyId, payload.pdfData.certRef);
}

registerFormPdf('decommissioning', {
  label: 'Decommissioning Certificate',
  shortLabel: 'Decommissioning',
  icon: 'close-circle-outline',
  color: '#64748B',
  buildHtml: (pdfData, company, engineer, gasSafeLogo, companyLogo) =>
    buildHtml(pdfData as DecommissioningPdfData, company, engineer, gasSafeLogo, companyLogo),
  titleFn: (payload) => title(payload as DecommissioningLockedPayload),
});
