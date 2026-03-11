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

export interface DecommissioningAppliance {
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
  gasSoundness: PassFailNA;
  gasSupplyIsolated: YesNoNA;
  gasSupplyCapped: YesNoNA;
  electricalSupplyIsolated: YesNoNA;
  waterSupplyIsolated: YesNoNA;
  flueSealed: YesNoNA;
  ventilationMadeSafe: YesNoNA;
  applianceRemoved: YesNoNA;
  leftInSituLabelled: YesNoNA;
  warningNoticeIssued: YesNoNA;
  applianceCondition: SafeUnsafe;
  decommissionReason: string;
  defectsFound: string;
  remedialActionTaken: string;
  engineerNotes: string;
}

export interface DecommissioningFinalInfo {
  tightnessTestPerformed: YesNoNA;
  emergencyControlAccessible: YesNoNA;
  pipeworkCondition: YesNoNA;
  siteLeftSafe: YesNoNA;
  customerAdvised: YesNoNA;
  furtherWorkRequired: string;
  certificateNotes: string;
}

export const EMPTY_DECOMMISSIONING_APPLIANCE: Omit<DecommissioningAppliance, 'id'> = {
  category: '',
  location: '',
  make: '',
  model: '',
  serialNumber: '',
  gcNumber: '',
  boilerType: '',
  fuelType: '',
  flueType: '',
  gasSoundness: '',
  gasSupplyIsolated: '',
  gasSupplyCapped: '',
  electricalSupplyIsolated: '',
  waterSupplyIsolated: '',
  flueSealed: '',
  ventilationMadeSafe: '',
  applianceRemoved: '',
  leftInSituLabelled: '',
  warningNoticeIssued: '',
  applianceCondition: '',
  decommissionReason: '',
  defectsFound: '',
  remedialActionTaken: '',
  engineerNotes: '',
};

export const EMPTY_DECOMMISSIONING_FINAL_INFO: DecommissioningFinalInfo = {
  tightnessTestPerformed: '',
  emergencyControlAccessible: '',
  pipeworkCondition: '',
  siteLeftSafe: '',
  customerAdvised: '',
  furtherWorkRequired: '',
  certificateNotes: '',
};
