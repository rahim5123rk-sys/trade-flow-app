// ============================================
// FILE: src/types/cp12.ts
// Types for CP12 Gas Safety Certificate
// ============================================

export type YesNoNA = 'Yes' | 'No' | 'N/A' | '';
export type PassFailNA = 'Pass' | 'Fail' | 'N/A' | '';

export type FlueType =
  | ''
  | 'Balanced Flue'
  | 'Room Sealed'
  | 'Open Flue'
  | 'Flu-less'
  | 'Conventional Flue'
  | 'Fanned Flue';

export type HeatInputUnit = 'kW/h' | 'Btu/h';

export interface FGAReadings {
  co: string;
  co2: string;
  ratio: string;
}

export interface CP12Appliance {
  id: string;
  location: string;
  make: string;
  model: string;
  type: string;
  serialNumber: string;
  gcNumber: string;
  flueType: FlueType;
  operatingPressure: string;
  heatInput: string;
  heatInputUnit: HeatInputUnit;
  safetyDevices: YesNoNA;
  spillageTest: PassFailNA;
  smokePelletFlueTest: PassFailNA;
  fgaLow: FGAReadings;
  fgaHigh: FGAReadings;
  satisfactoryTermination: YesNoNA;
  flueVisualCondition: YesNoNA;
  adequateVentilation: YesNoNA;
  landlordsAppliance: YesNoNA;
  inspected: YesNoNA;
  applianceVisualCheck: YesNoNA;
  applianceServiced: YesNoNA;
  applianceSafeToUse: YesNoNA;
}

export interface CP12FinalChecks {
  visualInspection: YesNoNA;
  ecvAccessible: YesNoNA;
  tightnessTest: YesNoNA;
  equipotentialBonding: YesNoNA;
  coAlarmFitted: YesNoNA;
  coAlarmTestSatisfactory: YesNoNA;
  coAlarmTestDate: string;
  coAlarmExpiryDate: string;
  coAlarmInDate: YesNoNA;
  smokeAlarmFitted: YesNoNA;
  smokeAlarmTested: YesNoNA;
  faults: string;
  rectificationWork: string;
  workCarriedOut: string;
}

export interface CP12LandlordDetails {
  name: string;
  address: string;
  email: string;
  phone: string;
}

export interface CP12TenantDetails {
  name: string;
  email: string;
  phone: string;
}

export interface CP12Certificate {
  id?: string;
  companyId: string;
  landlord: CP12LandlordDetails;
  tenant: CP12TenantDetails;
  propertyAddress: string;
  appliances: CP12Appliance[];
  finalChecks: CP12FinalChecks;
  engineerName: string;
  gasSafeNumber: string;
  createdAt?: string;
}

// ─── Empty defaults ─────────────────────────────────────────────

export const EMPTY_FGA: FGAReadings = { co: '', co2: '', ratio: '' };

export const EMPTY_APPLIANCE: Omit<CP12Appliance, 'id'> = {
  location: '',
  make: '',
  model: '',
  type: '',
  serialNumber: '',
  gcNumber: '',
  flueType: '',
  operatingPressure: '',
  heatInput: '',
  heatInputUnit: 'kW/h',
  safetyDevices: '',
  spillageTest: '',
  smokePelletFlueTest: '',
  fgaLow: { ...EMPTY_FGA },
  fgaHigh: { ...EMPTY_FGA },
  satisfactoryTermination: '',
  flueVisualCondition: '',
  adequateVentilation: '',
  landlordsAppliance: '',
  inspected: '',
  applianceVisualCheck: '',
  applianceServiced: '',
  applianceSafeToUse: '',
};

export const EMPTY_FINAL_CHECKS: CP12FinalChecks = {
  visualInspection: '',
  ecvAccessible: '',
  tightnessTest: '',
  equipotentialBonding: '',
  coAlarmFitted: '',
  coAlarmTestSatisfactory: '',
  coAlarmTestDate: '',
  coAlarmExpiryDate: '',
  coAlarmInDate: '',
  smokeAlarmFitted: '',
  smokeAlarmTested: '',
  faults: '',
  rectificationWork: '',
  workCarriedOut: '',
};
