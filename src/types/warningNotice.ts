import type {
    ApplianceCategory,
    BoilerType,
    FlueType,
    FuelType,
    SafeUnsafe,
    YesNoNA,
} from './gasForms';

export type {
    ApplianceCategory,
    BoilerType,
    FlueType,
    FuelType,
    SafeUnsafe,
    YesNoNA
};

export type WarningClassification = '' | 'Not to Current Standards' | 'At Risk' | 'Immediately Dangerous';

export interface WarningNoticeAppliance {
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
  warningClassification: WarningClassification;
  applianceCondition: SafeUnsafe;
  unsafeSituation: string;
  riskDetails: string;
  actionsTaken: string;
  applianceDisconnected: YesNoNA;
  gasSupplyDisconnected: YesNoNA;
  warningLabelAttached: YesNoNA;
  responsiblePersonInformed: YesNoNA;
  warningNoticeIssued: YesNoNA;
  engineerNotes: string;
}

export interface WarningNoticeFinalInfo {
  customerRefusedPermission: YesNoNA;
  emergencyServiceContacted: YesNoNA;
  furtherActionRequired: string;
  engineerOpinion: string;
}

export const EMPTY_WARNING_NOTICE_APPLIANCE: Omit<WarningNoticeAppliance, 'id'> = {
  category: '',
  location: '',
  make: '',
  model: '',
  serialNumber: '',
  gcNumber: '',
  boilerType: '',
  fuelType: '',
  flueType: '',
  warningClassification: '',
  applianceCondition: '',
  unsafeSituation: '',
  riskDetails: '',
  actionsTaken: '',
  applianceDisconnected: '',
  gasSupplyDisconnected: '',
  warningLabelAttached: '',
  responsiblePersonInformed: '',
  warningNoticeIssued: '',
  engineerNotes: '',
};

export const EMPTY_WARNING_NOTICE_FINAL_INFO: WarningNoticeFinalInfo = {
  customerRefusedPermission: '',
  emergencyServiceContacted: '',
  furtherActionRequired: '',
  engineerOpinion: '',
};
