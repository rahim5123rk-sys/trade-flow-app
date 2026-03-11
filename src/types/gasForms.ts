// ============================================
// FILE: src/types/gasForms.ts
// Shared base types used across all gas forms
//
// Eliminates duplication of YesNoNA, PassFailNA,
// FGAReadings, FlueType etc. that were previously
// copy-pasted in cp12.ts, serviceRecord.ts, etc.
// ============================================

// ─── Common enums ───────────────────────────────────────────────

export type YesNoNA = 'Yes' | 'No' | 'N/A' | '';
export type PassFailNA = 'Pass' | 'Fail' | 'N/A' | '';
export type SafeUnsafe = 'Safe' | 'Unsafe' | '';

export type FlueType =
  | ''
  | 'Balanced Flue'
  | 'Room Sealed'
  | 'Open Flue'
  | 'Flu-less'
  | 'Conventional Flue'
  | 'Fanned Flue';

export type FuelType = '' | 'Natural Gas' | 'LPG';

export type BoilerType = '' | 'Combi' | 'System' | 'Regular (Heat Only)' | 'Back Boiler';

export type HeatInputUnit = 'kW/h' | 'Btu/h';

export type ApplianceCategory = 'Boiler' | 'Fire' | 'Cooker' | 'Hob' | 'Other' | '';

// ─── Shared data structures ─────────────────────────────────────

export interface FGAReadings {
  co: string;
  co2: string;
  ratio: string;
}

export const EMPTY_FGA: FGAReadings = { co: '', co2: '', ratio: '' };
