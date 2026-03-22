import { InstallationCertAppliance, InstallationCertFinalInfo } from '../types/installationCert';
import { registerFormPdf } from './pdf/registry';
import { type BaseLockedPayload, combineNotes, generatePdfBase64FromPayload, generatePdfFromPayload, generatePdfUrlFromPayload, getCompanyAndEngineer } from './pdf/shared';
import { buildSingleApplianceFormHtml } from './pdf/singleApplianceFormTemplate';

export interface InstallationCertPdfData {
  customerName: string;
  customerCompany?: string;
  customerAddress: string;
  customerEmail: string;
  customerPhone: string;
  propertyAddress: string;
  appliances: InstallationCertAppliance[];
  finalInfo: InstallationCertFinalInfo;
  installationDate: string;
  nextServiceDate: string;
  customerSignature: string;
  certRef: string;
}

export interface InstallationCertLockedPayload extends BaseLockedPayload<'installation_cert', InstallationCertPdfData> { kind: 'installation_cert'; version: 1; }


function buildHtml(pdfData: InstallationCertPdfData, company: any, engineer: any, gasSafeLogo = '', companyLogo = '') {
  const appliance = pdfData.appliances?.[0] || {} as Partial<InstallationCertAppliance>;
  const finalInfo = pdfData.finalInfo || {} as Partial<InstallationCertFinalInfo>;
  const installationNotes = combineNotes(
    appliance?.engineerNotes,
    appliance?.defectsFound ? `Defects Found: ${appliance.defectsFound}` : '',
    appliance?.remedialActionTaken ? `Work Completed: ${appliance.remedialActionTaken}` : '',
  );
  const outcomeNotes = combineNotes(
    finalInfo.installationOutcome,
    finalInfo.furtherWorkRequired ? `Further Work Required: ${finalInfo.furtherWorkRequired}` : '',
  );
  return buildSingleApplianceFormHtml({
    title: 'Installation Certificate',
    description: 'Record of installation checks, readings and final handover for a single appliance installation.',
    accentColor: '#0284C7',
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
    primaryDateLabel: 'Installation Date',
    primaryDate: pdfData.installationDate,
    secondaryDateLabel: 'Next Service Due',
    secondaryDate: pdfData.nextServiceDate,
    applianceHeading: 'Appliance Details',
    applianceSummary: [
      {label: 'Appliance Type', value: appliance?.category || ''},
      {label: 'Installation Type', value: appliance?.installationType || ''},
      {label: 'Location', value: appliance?.location || ''},
      {label: 'Make / Model', value: [appliance?.make || '', appliance?.model || ''].filter(Boolean).join(' ')},
      {label: 'Serial Number', value: appliance?.serialNumber || ''},
      {label: 'GC Number', value: appliance?.gcNumber || ''},
    ],
    applianceSections: [
      {title: 'Readings & Analysis', rows: [
        {label: 'Operating Pressure', value: appliance?.operatingPressure || ''},
        {label: 'Burner Pressure', value: appliance?.burnerPressure || ''},
        {label: 'Gas Rate', value: appliance?.gasRate || ''},
        {label: 'Heat Input', value: appliance?.heatInput || ''},
        {label: 'Gas Soundness', value: appliance?.gasSoundness || ''},
        {label: 'FGA Low', value: appliance ? `${appliance.fgaLow.co || '-'} / ${appliance.fgaLow.co2 || '-'} / ${appliance.fgaLow.ratio || '-'}` : ''},
        {label: 'FGA High', value: appliance ? `${appliance.fgaHigh.co || '-'} / ${appliance.fgaHigh.co2 || '-'} / ${appliance.fgaHigh.ratio || '-'}` : ''},
      ]},
      {title: 'Installation Checks', rows: [
        {label: 'Pipework Pressure Test', value: appliance?.pipeworkPressureTest || ''},
        {label: 'Ventilation Adequate', value: appliance?.ventilationAdequate || ''},
        {label: 'Flue Installed Correctly', value: appliance?.flueInstalledCorrectly || ''},
        {label: 'Condensate Installed', value: appliance?.condensateInstalled || ''},
        {label: 'Controls Installed', value: appliance?.controlsInstalled || ''},
        {label: 'Safety Device Operation', value: appliance?.safetyDeviceOperation || ''},
        {label: 'Electrical Polarity Correct', value: appliance?.electricalPolarityCorrect || ''},
        {label: 'Earth Continuity', value: appliance?.earthContinuity || ''},
        {label: 'System Flushed', value: appliance?.systemFlushed || ''},
        {label: 'Inhibitor Added', value: appliance?.inhibitorAdded || ''},
        {label: 'Benchmark Completed', value: appliance?.benchmarkCompleted || ''},
        {label: 'Building Regs Notified', value: appliance?.buildingRegsNotified || ''},
        {label: 'User Demonstration', value: appliance?.userDemonstrationCompleted || ''},
        {label: 'Instructions Left', value: appliance?.manufacturerInstructionsLeft || ''},
      ]},
      {title: 'Notes', rows: [
        {label: 'Condition', value: appliance?.applianceCondition || ''},
        {label: 'Installation Notes', value: installationNotes},
      ]},
    ],
    finalSections: [{title: 'Final Outcome', rows: [
      {label: 'Tightness Test Performed', value: finalInfo.tightnessTestPerformed},
      {label: 'Emergency Control Accessible', value: finalInfo.emergencyControlAccessible},
      {label: 'Meter Installation Satisfactory', value: finalInfo.meterInstallationSatisfactory},
      {label: 'Notification Reference', value: finalInfo.notificationReference},
      {label: 'Outcome / Further Work', value: outcomeNotes},
    ]}],
    customerSignature: pdfData.customerSignature,
    footerNote: 'This certificate records the installation and initial commissioning checks completed on the appliance listed above.',
  });
}

function title(payload: InstallationCertLockedPayload) { return `Installation Certificate - ${payload.pdfData.customerName || 'Customer'}`; }
export async function buildInstallationCertLockedPayload(data: InstallationCertPdfData, companyId: string, userId: string): Promise<InstallationCertLockedPayload> { const {company, engineer} = await getCompanyAndEngineer(companyId, userId); return {kind: 'installation_cert', version: 1, savedAt: new Date().toISOString(), pdfData: data, company, engineer}; }
export async function generateInstallationCertPdfFromPayload(payload: InstallationCertLockedPayload, mode: 'share' | 'save' | 'view' = 'share', companyId?: string) { return generatePdfFromPayload(payload, buildHtml, title, mode, companyId); }
export async function generateInstallationCertPdfBase64FromPayload(payload: InstallationCertLockedPayload, companyId?: string) { return generatePdfBase64FromPayload(payload, buildHtml, companyId); }
export async function generateInstallationCertPdfUrl(payload: InstallationCertLockedPayload, companyId: string) { return generatePdfUrlFromPayload(payload, buildHtml, companyId, payload.pdfData.certRef); }
registerFormPdf('installation_cert', {label: 'Installation Certificate', shortLabel: 'Installation', icon: 'home-outline', color: '#0284C7', buildHtml: (pdfData, company, engineer, gasSafeLogo, companyLogo) => buildHtml(pdfData as InstallationCertPdfData, company, engineer, gasSafeLogo, companyLogo), titleFn: (payload) => title(payload as InstallationCertLockedPayload)});
