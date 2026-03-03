// ============================================
// FILE: src/types/serviceRecord.ts
// Types for Gas Service Record
// Covers boilers, fires, cookers/hobs
// ============================================

import type {
    ApplianceCategory,
    BoilerType,
    FGAReadings,
    FlueType,
    FuelType,
    PassFailNA,
    SafeUnsafe,
    YesNoNA,
} from './gasForms';

export type {
    ApplianceCategory,
    BoilerType,
    FGAReadings,
    FlueType,
    FuelType,
    PassFailNA,
    SafeUnsafe,
    YesNoNA
};

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
  expansionVesselRecharged: YesNoNA;
  flueChecked: YesNoNA;
  sealsGasketsChecked: YesNoNA;
  ventilationAdequate: YesNoNA;

  // ── Safety tests ──
  safetyDeviceOperation: PassFailNA;
  spillageTest: PassFailNA;
  flueFlowTest: PassFailNA;

  // ── Parts replaced ──
  partsReplaced: string;
  defectsFound: string;
  remedialActionTaken: string;

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

export { EMPTY_FGA } from './gasForms';
import { EMPTY_FGA } from './gasForms';

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
  expansionVesselRecharged: '',
  flueChecked: '',
  sealsGasketsChecked: '',
  ventilationAdequate: '',
  safetyDeviceOperation: '',
  spillageTest: '',
  flueFlowTest: '',
  partsReplaced: '',
  defectsFound: '',
  remedialActionTaken: '',
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
