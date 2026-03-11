import type {
    ApplianceCategory,
    BoilerType,
    FlueType,
    FuelType,
    PassFailNA,
    SafeUnsafe,
    YesNoNA,
} from './gasForms';

export type {
    ApplianceCategory,
    BoilerType,
    FlueType,
    FuelType,
    PassFailNA,
    SafeUnsafe,
    YesNoNA
};

export interface BreakdownReportAppliance {
  id: string;
  category: ApplianceCategory;
  location: string;
  make: string;
  model: string;
  serialNumber: string;
  gcNumber: string;
  boilerType: BoilerType;
  fuelType: FuelType;
  flueType: FlueType;
  faultSymptoms: string;
  faultCode: string;
  diagnosticChecks: string;
  gasSoundness: PassFailNA;
  electricalSupplySafe: YesNoNA;
  waterPressure: string;
  operatingPressure: string;
  burnerPressure: string;
  partsRequired: string;
  partsFitted: string;
  temporaryRepairMade: YesNoNA;
  applianceCondition: SafeUnsafe;
  remedialActionTaken: string;
  engineerNotes: string;
}

export interface BreakdownReportFinalInfo {
  faultFound: string;
  repairOutcome: string;
  furtherWorkRequired: string;
  applianceLeftOperational: YesNoNA;
  customerAdvised: YesNoNA;
}

export const EMPTY_BREAKDOWN_REPORT_APPLIANCE: Omit<BreakdownReportAppliance, 'id'> = {
  category: '',
  location: '',
  make: '',
  model: '',
  serialNumber: '',
  gcNumber: '',
  boilerType: '',
  fuelType: '',
  flueType: '',
  faultSymptoms: '',
  faultCode: '',
  diagnosticChecks: '',
  gasSoundness: '',
  electricalSupplySafe: '',
  waterPressure: '',
  operatingPressure: '',
  burnerPressure: '',
  partsRequired: '',
  partsFitted: '',
  temporaryRepairMade: '',
  applianceCondition: '',
  remedialActionTaken: '',
  engineerNotes: '',
};

export const EMPTY_BREAKDOWN_REPORT_FINAL_INFO: BreakdownReportFinalInfo = {
  faultFound: '',
  repairOutcome: '',
  furtherWorkRequired: '',
  applianceLeftOperational: '',
  customerAdvised: '',
};
