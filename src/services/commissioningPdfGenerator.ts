import {
    CommissioningAppliance,
    CommissioningFinalInfo,
} from '../types/commissioning';
import { registerFormPdf } from './pdf/registry';
import {
    type BaseLockedPayload,
    generatePdfBase64FromPayload,
    generatePdfFromPayload,
    generatePdfUrlFromPayload,
    getCompanyAndEngineer,
} from './pdf/shared';
import { buildSingleApplianceFormHtml } from './pdf/singleApplianceFormTemplate';

export interface CommissioningPdfData {
  customerName: string;
  customerCompany?: string;
  customerAddress: string;
  customerEmail: string;
  customerPhone: string;
  propertyAddress: string;
  appliances: CommissioningAppliance[];
  finalInfo: CommissioningFinalInfo;
  commissioningDate: string;
  nextServiceDate: string;
  customerSignature: string;
  certRef: string;
}

export interface CommissioningLockedPayload extends BaseLockedPayload<'commissioning', CommissioningPdfData> {
  kind: 'commissioning';
  version: 1;
}

const combineNotes = (...parts: Array<string | null | undefined>) => parts.map((part) => part?.trim()).filter(Boolean).join('\n\n');

function buildHtml(pdfData: CommissioningPdfData, company: any, engineer: any, gasSafeLogo = '', companyLogo = '') {
  const appliance = pdfData.appliances[0];
  const finalInfo = pdfData.finalInfo;
  const workNotes = combineNotes(
    appliance?.engineerNotes,
    appliance?.defectsFound ? `Defects Found: ${appliance.defectsFound}` : '',
    appliance?.remedialActionTaken ? `Remedial Action Taken: ${appliance.remedialActionTaken}` : '',
  );
  const outcomeNotes = combineNotes(
    finalInfo.commissioningOutcome,
    finalInfo.additionalWorkRequired ? `Further Work Required: ${finalInfo.additionalWorkRequired}` : '',
  );

  return buildSingleApplianceFormHtml({
    title: 'Commissioning Certificate',
    description: 'Record of appliance commissioning, set-up checks, readings and handover for a single gas appliance.',
    accentColor: '#7C3AED',
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
    primaryDateLabel: 'Commissioned On',
    primaryDate: pdfData.commissioningDate,
    secondaryDateLabel: 'Next Service Due',
    secondaryDate: pdfData.nextServiceDate,
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
        title: 'Readings & Analysis',
        rows: [
          {label: 'Inlet Working Pressure', value: appliance?.inletWorkingPressure || ''},
          {label: 'Burner Pressure', value: appliance?.burnerPressure || ''},
          {label: 'Gas Rate', value: appliance?.gasRate || ''},
          {label: 'Heat Input', value: appliance?.heatInput || ''},
          {label: 'Operating Pressure', value: appliance?.operatingPressure || ''},
          {label: 'Standing Pressure', value: appliance?.standingPressure || ''},
          {label: 'FGA Low', value: appliance ? `${appliance.fgaLow.co || '-'} / ${appliance.fgaLow.co2 || '-'} / ${appliance.fgaLow.ratio || '-'}` : ''},
          {label: 'FGA High', value: appliance ? `${appliance.fgaHigh.co || '-'} / ${appliance.fgaHigh.co2 || '-'} / ${appliance.fgaHigh.ratio || '-'}` : ''},
        ],
      },
      {
        title: 'Commissioning Checks',
        rows: [
          {label: 'Gas Soundness', value: appliance?.gasSoundness || ''},
          {label: 'Ventilation Adequate', value: appliance?.ventilationAdequate || ''},
          {label: 'Controls Operational', value: appliance?.controlsOperational || ''},
          {label: 'Safety Device Operation', value: appliance?.safetyDeviceOperation || ''},
          {label: 'Electrical Polarity Correct', value: appliance?.electricalPolarityCorrect || ''},
          {label: 'Earth Continuity', value: appliance?.earthContinuity || ''},
          {label: 'Flue Integrity', value: appliance?.flueIntegrity || ''},
          {label: 'Condensate Installed', value: appliance?.condensateInstalled || ''},
          {label: 'System Flushed', value: appliance?.systemFlushed || ''},
          {label: 'Inhibitor Added', value: appliance?.inhibitorAdded || ''},
          {label: 'System Balanced', value: appliance?.systemBalanced || ''},
          {label: 'Benchmark Completed', value: appliance?.benchmarkCompleted || ''},
          {label: 'Instructions Left', value: appliance?.manufacturerInstructionsLeft || ''},
          {label: 'User Demonstration', value: appliance?.userDemonstrationCompleted || ''},
        ],
      },
      {
        title: 'Outcome & Notes',
        rows: [
          {label: 'Appliance Condition', value: appliance?.applianceCondition || ''},
          {label: 'Work Notes', value: workNotes},
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
          {label: 'Meter Installation Satisfactory', value: finalInfo.meterInstallationSatisfactory},
          {label: 'CO Alarm Fitted', value: finalInfo.coAlarmFitted},
          {label: 'Outcome / Further Work', value: outcomeNotes},
        ],
      },
    ],
    customerSignature: pdfData.customerSignature,
    footerNote: 'This certificate records the commissioning checks completed on the appliance listed above. Revisit manufacturer instructions and appliance settings before any future servicing or adjustment.',
  });
}

function title(payload: CommissioningLockedPayload) {
  return `Commissioning - ${payload.pdfData.customerName || 'Customer'}`;
}

export async function buildCommissioningLockedPayload(
  data: CommissioningPdfData,
  companyId: string,
  userId: string,
): Promise<CommissioningLockedPayload> {
  const {company, engineer} = await getCompanyAndEngineer(companyId, userId);
  return {
    kind: 'commissioning',
    version: 1,
    savedAt: new Date().toISOString(),
    pdfData: data,
    company,
    engineer,
  };
}

export async function generateCommissioningPdfFromPayload(payload: CommissioningLockedPayload, mode: 'share' | 'save' | 'view' = 'share', companyId?: string) {
  return generatePdfFromPayload(payload, buildHtml, title, mode, companyId);
}

export async function generateCommissioningPdfBase64FromPayload(payload: CommissioningLockedPayload, companyId?: string) {
  return generatePdfBase64FromPayload(payload, buildHtml, companyId);
}

export async function generateCommissioningPdfUrl(payload: CommissioningLockedPayload, companyId: string) {
  return generatePdfUrlFromPayload(payload, buildHtml, companyId, payload.pdfData.certRef);
}

registerFormPdf('commissioning', {
  label: 'Commissioning Certificate',
  shortLabel: 'Commissioning',
  icon: 'checkmark-circle-outline',
  color: '#7C3AED',
  buildHtml: (pdfData, company, engineer, gasSafeLogo, companyLogo) =>
    buildHtml(pdfData as CommissioningPdfData, company, engineer, gasSafeLogo, companyLogo),
  titleFn: (payload) => title(payload as CommissioningLockedPayload),
});
