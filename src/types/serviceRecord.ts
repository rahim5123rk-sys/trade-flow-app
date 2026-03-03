// ============================================
// FILE: src/types/serviceRecord.ts
// Types for Gas Service Record
// Covers boilers, fires, cookers/hobs
// ============================================

export type YesNoNA = 'Yes' | 'No' | 'N/A' | '';
export type PassFailNA = 'Pass' | 'Fail' | 'N/A' | '';
export type SafeUnsafe = 'Safe' | 'Unsafe' | '';

export type ApplianceCategory = 'Boiler' | 'Fire' | 'Cooker' | 'Hob' | 'Other' | '';

export type FlueType =
  | ''
  | 'Balanced Flue'
  | 'Room Sealed'
  | 'Open Flue'
  | 'Flu-less'
  | 'Conventional Flue'
  | 'Fanned Flue';

export type BoilerType =
  | ''
  | 'Combi'
  | 'System'
  | 'Regular (Heat Only)'
  | 'Back Boiler';

export type FuelType =
  | ''
  | 'Natural Gas'
  | 'LPG';

// ─── FGA Readings (shared with CP12) ───────────────────────────

export interface FGAReadings {
  co: string;
  co2: string;
  ratio: string;
}

// ─── Service appliance fields ───────────────────────────────────

export interface ServiceAppliance {
  id: string;

  // ── Appliance identification ──
  category: ApplianceCategory;
  location: string;
  make: string;
  model: string;
  serialNumber: string;
  gcNumber: string;
  boilerType: BoilerType;
  fuelType: FuelType;
  flueType: FlueType;

  // ── Readings ──
  operatingPressure: string;       // mBar
  burnerPressure: string;          // mBar
  heatInput: string;               // kW
  gasSoundness: PassFailNA;
  standingPressure: string;        // mBar

  // ── FGA ──
  fgaLow: FGAReadings;
  fgaHigh: FGAReadings;

  // ── Components inspected/serviced ──
  burnerChecked: YesNoNA;
  electrodesChecked: YesNoNA;
  heatExchangerChecked: YesNoNA;
  condenseTrapCleaned: YesNoNA;
  fanChecked: YesNoNA;
  gasValveChecked: YesNoNA;
  sparkGeneratorChecked: YesNoNA;
  controlsChecked: YesNoNA;
  pcbChecked: YesNoNA;
  thermistorChecked: YesNoNA;
  pumpChecked: YesNoNA;
  expansionVesselChecked: YesNoNA;
  flueChecked: YesNoNA;
  sealsGasketsChecked: YesNoNA;
  ventilationAdequate: YesNoNA;

  // ── Safety tests ──
  safetyDeviceOperation: PassFailNA;
  spillageTest: PassFailNA;
  flueFlowTest: PassFailNA;

  // ── Parts replaced ──
  partsReplaced: string;

  // ── Condition & outcome ──
  applianceCondition: SafeUnsafe;
  recommendedWork: string;
  engineerNotes: string;
}

// ─── Service Record final details ───────────────────────────────

export interface ServiceFinalInfo {
  tightnessTestPerformed: YesNoNA;
  gasMeterCondition: YesNoNA;
  emergencyControlAccessible: YesNoNA;
  ventilationSatisfactory: YesNoNA;
  pipeworkCondition: YesNoNA;
  coAlarmFitted: YesNoNA;
  coAlarmTested: YesNoNA;
  coAlarmInDate: YesNoNA;
  overallFaults: string;
  additionalWork: string;
}

// ─── Empty defaults ─────────────────────────────────────────────

export const EMPTY_FGA: FGAReadings = { co: '', co2: '', ratio: '' };

export const EMPTY_SERVICE_APPLIANCE: Omit<ServiceAppliance, 'id'> = {
  category: '',
  location: '',
  make: '',
  model: '',
  serialNumber: '',
  gcNumber: '',
  boilerType: '',
  fuelType: '',
  flueType: '',
  operatingPressure: '',
  burnerPressure: '',
  heatInput: '',
  gasSoundness: '',
  standingPressure: '',
  fgaLow: { ...EMPTY_FGA },
  fgaHigh: { ...EMPTY_FGA },
  burnerChecked: '',
  electrodesChecked: '',
  heatExchangerChecked: '',
  condenseTrapCleaned: '',
  fanChecked: '',
  gasValveChecked: '',
  sparkGeneratorChecked: '',
  controlsChecked: '',
  pcbChecked: '',
  thermistorChecked: '',
  pumpChecked: '',
  expansionVesselChecked: '',
  flueChecked: '',
  sealsGasketsChecked: '',
  ventilationAdequate: '',
  safetyDeviceOperation: '',
  spillageTest: '',
  flueFlowTest: '',
  partsReplaced: '',
  applianceCondition: '',
  recommendedWork: '',
  engineerNotes: '',
};

export const EMPTY_SERVICE_FINAL_INFO: ServiceFinalInfo = {
  tightnessTestPerformed: '',
  gasMeterCondition: '',
  emergencyControlAccessible: '',
  ventilationSatisfactory: '',
  pipeworkCondition: '',
  coAlarmFitted: '',
  coAlarmTested: '',
  coAlarmInDate: '',
  overallFaults: '',
  additionalWork: '',
};
