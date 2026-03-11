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
import { EMPTY_FGA } from './gasForms';

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

    export { EMPTY_FGA } from './gasForms';

export interface CommissioningAppliance {
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
  inletWorkingPressure: string;
  burnerPressure: string;
  gasRate: string;
  heatInput: string;
  operatingPressure: string;
  standingPressure: string;
  gasSoundness: PassFailNA;
  fgaLow: FGAReadings;
  fgaHigh: FGAReadings;
  ventilationAdequate: YesNoNA;
  controlsOperational: YesNoNA;
  safetyDeviceOperation: PassFailNA;
  electricalPolarityCorrect: YesNoNA;
  earthContinuity: YesNoNA;
  flueIntegrity: YesNoNA;
  condensateInstalled: YesNoNA;
  systemFlushed: YesNoNA;
  inhibitorAdded: YesNoNA;
  systemBalanced: YesNoNA;
  benchmarkCompleted: YesNoNA;
  manufacturerInstructionsLeft: YesNoNA;
  userDemonstrationCompleted: YesNoNA;
  applianceCondition: SafeUnsafe;
  defectsFound: string;
  remedialActionTaken: string;
  engineerNotes: string;
}

export interface CommissioningFinalInfo {
  tightnessTestPerformed: YesNoNA;
  emergencyControlAccessible: YesNoNA;
  pipeworkCondition: YesNoNA;
  meterInstallationSatisfactory: YesNoNA;
  coAlarmFitted: YesNoNA;
  commissioningOutcome: string;
  additionalWorkRequired: string;
}

export const EMPTY_COMMISSIONING_APPLIANCE: Omit<CommissioningAppliance, 'id'> = {
  category: '',
  location: '',
  make: '',
  model: '',
  serialNumber: '',
  gcNumber: '',
  boilerType: '',
  fuelType: '',
  flueType: '',
  inletWorkingPressure: '',
  burnerPressure: '',
  gasRate: '',
  heatInput: '',
  operatingPressure: '',
  standingPressure: '',
  gasSoundness: '',
  fgaLow: {...EMPTY_FGA},
  fgaHigh: {...EMPTY_FGA},
  ventilationAdequate: '',
  controlsOperational: '',
  safetyDeviceOperation: '',
  electricalPolarityCorrect: '',
  earthContinuity: '',
  flueIntegrity: '',
  condensateInstalled: '',
  systemFlushed: '',
  inhibitorAdded: '',
  systemBalanced: '',
  benchmarkCompleted: '',
  manufacturerInstructionsLeft: '',
  userDemonstrationCompleted: '',
  applianceCondition: '',
  defectsFound: '',
  remedialActionTaken: '',
  engineerNotes: '',
};

export const EMPTY_COMMISSIONING_FINAL_INFO: CommissioningFinalInfo = {
  tightnessTestPerformed: '',
  emergencyControlAccessible: '',
  pipeworkCondition: '',
  meterInstallationSatisfactory: '',
  coAlarmFitted: '',
  commissioningOutcome: '',
  additionalWorkRequired: '',
};
