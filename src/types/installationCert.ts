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

export type InstallationType = '' | 'New Installation' | 'Replacement';

export interface InstallationCertAppliance {
  id: string;
  category: ApplianceCategory;
  installationType: InstallationType;
  location: string;
  make: string;
  model: string;
  serialNumber: string;
  gcNumber: string;
  boilerType: BoilerType;
  fuelType: FuelType;
  flueType: FlueType;
  operatingPressure: string;
  burnerPressure: string;
  gasRate: string;
  heatInput: string;
  gasSoundness: PassFailNA;
  fgaLow: FGAReadings;
  fgaHigh: FGAReadings;
  pipeworkPressureTest: YesNoNA;
  ventilationAdequate: YesNoNA;
  flueInstalledCorrectly: YesNoNA;
  condensateInstalled: YesNoNA;
  controlsInstalled: YesNoNA;
  safetyDeviceOperation: PassFailNA;
  electricalPolarityCorrect: YesNoNA;
  earthContinuity: YesNoNA;
  systemFlushed: YesNoNA;
  inhibitorAdded: YesNoNA;
  benchmarkCompleted: YesNoNA;
  buildingRegsNotified: YesNoNA;
  userDemonstrationCompleted: YesNoNA;
  manufacturerInstructionsLeft: YesNoNA;
  applianceCondition: SafeUnsafe;
  defectsFound: string;
  remedialActionTaken: string;
  engineerNotes: string;
}

export interface InstallationCertFinalInfo {
  tightnessTestPerformed: YesNoNA;
  emergencyControlAccessible: YesNoNA;
  meterInstallationSatisfactory: YesNoNA;
  notificationReference: string;
  installationOutcome: string;
  furtherWorkRequired: string;
}

export const EMPTY_INSTALLATION_CERT_APPLIANCE: Omit<InstallationCertAppliance, 'id'> = {
  category: '',
  installationType: '',
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
  gasRate: '',
  heatInput: '',
  gasSoundness: '',
  fgaLow: {...EMPTY_FGA},
  fgaHigh: {...EMPTY_FGA},
  pipeworkPressureTest: '',
  ventilationAdequate: '',
  flueInstalledCorrectly: '',
  condensateInstalled: '',
  controlsInstalled: '',
  safetyDeviceOperation: '',
  electricalPolarityCorrect: '',
  earthContinuity: '',
  systemFlushed: '',
  inhibitorAdded: '',
  benchmarkCompleted: '',
  buildingRegsNotified: '',
  userDemonstrationCompleted: '',
  manufacturerInstructionsLeft: '',
  applianceCondition: '',
  defectsFound: '',
  remedialActionTaken: '',
  engineerNotes: '',
};

export const EMPTY_INSTALLATION_CERT_FINAL_INFO: InstallationCertFinalInfo = {
  tightnessTestPerformed: '',
  emergencyControlAccessible: '',
  meterInstallationSatisfactory: '',
  notificationReference: '',
  installationOutcome: '',
  furtherWorkRequired: '',
};
