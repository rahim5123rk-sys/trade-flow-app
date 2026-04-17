// ============================================
// FILE: src/utils/combustion.ts
// Combustion gas calculations
//
// TPI gas analysers publish O2 and CO directly.
// CO2 and CO/CO2 ratio must be calculated by the app.
//
// Standard combustion formulas for UK gas engineering:
//   CO2% = CO2max × (1 − O2% / 20.9)
//   Ratio = CO_ppm ÷ (CO2% × 10,000)
//
// CO2max values (theoretical max CO2 at 0% excess O2):
//   Natural Gas: 11.7%       Butane: 14.1%
//   LPG (Propane): 14.0%     Light Oil: 15.4%
//   Heavy Oil: 16.0%         Bituminous Coal: 18.2%
//   Anthracite Coal: 19.2%   Coke: 20.5%
//   Wood: 20.3%              Bagasse: 20.0%
//   Wood Pellet: 20.3%
// ============================================

import type { FuelType } from '../types/gasForms';

// ─── Constants ──────────────────────────────────────────────────

/** O2 percentage in fresh air */
const O2_IN_AIR = 20.9;

/**
 * Maximum CO2 at 0% excess O2, by fuel type.
 * Source: BS 7967 / IGEM standards / manufacturer datasheets
 */
const CO2_MAX: Record<string, number> = {
  'Natural Gas':    11.7,
  'LPG':            14.0,
  'Butane':         14.1,
  'Light Oil':      15.4,
  'Heavy Oil':      16.0,
  'Bituminous Coal': 18.2,
  'Anthracite Coal': 19.2,
  'Coke':           20.5,
  'Wood':           20.3,
  'Bagasse':        20.0,
  'Wood Pellet':    20.3,
  default:          11.7,
};

/**
 * Siegert K factor by fuel type.
 * Used in simplified combustion efficiency formula:
 *   η ≈ 100 − (K × ΔT / CO2%)
 *
 * Source: BS 7967 / Siegert equation reference tables
 */
const SIEGERT_K: Record<string, number> = {
  'Natural Gas':    0.56,
  'LPG':            0.63,
  'Butane':         0.63,
  'Light Oil':      0.68,
  'Heavy Oil':      0.68,
  'Bituminous Coal': 0.63,
  'Anthracite Coal': 0.63,
  'Coke':           0.63,
  'Wood':           0.68,
  'Bagasse':        0.68,
  'Wood Pellet':    0.68,
  default:          0.56,
};

// ─── Exported Functions ─────────────────────────────────────────

/**
 * Calculate CO2 percentage from an O2 reading.
 *
 * Formula: CO2% = CO2max × (1 − O2% / 20.9)
 *
 * @param o2 - Measured O2 percentage (e.g. 5.2)
 * @param fuelType - Fuel type for CO2max lookup
 * @returns CO2 percentage, or null if inputs invalid
 */
export function calculateCO2FromO2(
  o2: number | null | undefined,
  fuelType: FuelType | string = 'Natural Gas',
): number | null {
  if (o2 == null || !isFinite(o2) || o2 < 0 || o2 > O2_IN_AIR) {
    return null;
  }

  const co2max = CO2_MAX[fuelType] ?? CO2_MAX.default;
  const co2 = co2max * (1 - o2 / O2_IN_AIR);

  return Math.round(co2 * 100) / 100; // 2 decimal places
}

/**
 * Calculate CO/CO2 ratio.
 *
 * @param coPpm - CO in parts per million
 * @param co2Percent - CO2 as a percentage
 * @returns Ratio as a decimal (e.g. 0.0042), or null if invalid
 */
export function calculateCOCO2Ratio(
  coPpm: number | null | undefined,
  co2Percent: number | null | undefined,
): number | null {
  if (coPpm == null || co2Percent == null) return null;
  if (!isFinite(coPpm) || !isFinite(co2Percent)) return null;
  if (co2Percent <= 0) return null;

  // CO2% → CO2 ppm: multiply by 10,000
  const co2Ppm = co2Percent * 10_000;
  const ratio = coPpm / co2Ppm;

  return Math.round(ratio * 10_000) / 10_000; // 4 decimal places
}

/**
 * Convert raw TPI readings (O2, CO) into values suitable for
 * FGAReadings form fields (co, co2, ratio — all as strings).
 *
 * @param o2 - O2 reading from TPI analyser
 * @param coPpm - CO reading from TPI analyser (in ppm)
 * @param fuelType - Fuel type for CO2max calculation
 * @returns Object with string values ready for FGAReadings fields
 */
export function tpiReadingsToFGA(
  o2: number | null | undefined,
  coPpm: number | null | undefined,
  fuelType: FuelType | string = 'Natural Gas',
): { co: string; co2: string; ratio: string } {
  const co2 = calculateCO2FromO2(o2, fuelType);
  const ratio = calculateCOCO2Ratio(coPpm, co2);

  return {
    co: coPpm != null && isFinite(coPpm) ? String(coPpm) : '',
    co2: co2 != null ? String(co2) : '',
    ratio: ratio != null ? String(ratio) : '',
  };
}

/**
 * Estimates excess air percentage from O2 reading.
 * Useful for combustion efficiency assessment.
 *
 * Formula: Excess Air % = (O2% / (20.9 − O2%)) × 100
 */
export function calculateExcessAir(o2: number | null | undefined): number | null {
  if (o2 == null || !isFinite(o2) || o2 < 0 || o2 >= O2_IN_AIR) return null;

  const excessAir = (o2 / (O2_IN_AIR - o2)) * 100;
  return Math.round(excessAir * 10) / 10; // 1 decimal place
}

/**
 * Simple combustion efficiency estimate (Siegert formula).
 * This is approximate — proper combustion analysers calculate
 * efficiency more precisely.
 *
 * Formula: η ≈ 100 − (K × ΔT / CO2%)
 * where K ≈ 0.56 for Natural Gas, 0.63 for LPG
 * and ΔT = flue temp − ambient temp
 */
export function estimateCombustionEfficiency(
  co2Percent: number | null | undefined,
  flueTempC: number | null | undefined,
  ambientTempC: number | null | undefined,
  fuelType: FuelType | string = 'Natural Gas',
): number | null {
  if (co2Percent == null || flueTempC == null || ambientTempC == null) return null;
  if (!isFinite(co2Percent) || !isFinite(flueTempC) || !isFinite(ambientTempC)) return null;
  if (co2Percent <= 0) return null;

  const K = SIEGERT_K[fuelType] ?? SIEGERT_K.default;
  const deltaT = flueTempC - ambientTempC;

  if (deltaT <= 0) return null;

  const efficiency = 100 - (K * deltaT) / co2Percent;
  return Math.round(efficiency * 10) / 10; // 1 decimal place
}
