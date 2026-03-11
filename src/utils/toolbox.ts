export type GasRateMode = 'metric' | 'imperial';
export type FuelType = 'natural_gas' | 'lpg';
export type VentilationMode = 'general' | 'room_sealed_compartment' | 'open_flue_compartment';
export type VentilationDestination = 'room' | 'outside';

const CUBIC_FEET_TO_CUBIC_METRES = 0.028316846592;
const BTU_PER_KW = 3412.142;
const CLARK_DEGREES_DIVISOR = 14.254;
const ADVENTITIOUS_AIR_ALLOWANCE_KW = 7;

const FUEL_CALORIFIC_VALUES = {
  natural_gas: {
    label: 'Natural Gas',
    grossMjPerM3: 39.2,
    netMjPerM3: 34.9,
  },
  lpg: {
    label: 'LPG',
    grossMjPerM3: 95.8,
    netMjPerM3: 87.8,
  },
} as const;

export interface GasRateCalculationInput {
  mode: GasRateMode;
  fuel: FuelType;
  totalSeconds: number;
  initialReading?: number;
  finalReading?: number;
}

export interface GasRateCalculationResult {
  totalSeconds: number;
  measuredVolumeM3: number;
  measuredVolumeFt3: number;
  meterUnitsLabel: string;
  cubicMetresPerHour: number;
  cubicFeetPerHour: number;
  grossKw: number;
  netKw: number;
  grossBtuPerHour: number;
  netBtuPerHour: number;
  fuelLabel: string;
}

export function calculateGasRate(input: GasRateCalculationInput): GasRateCalculationResult | null {
  const totalSeconds = Math.max(0, Number(input.totalSeconds || 0));
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return null;
  }

  const measuredVolumeM3 = input.mode === 'metric'
    ? Math.max(0, Number(input.finalReading || 0) - Number(input.initialReading || 0))
    : CUBIC_FEET_TO_CUBIC_METRES;

  if (!Number.isFinite(measuredVolumeM3) || measuredVolumeM3 <= 0) {
    return null;
  }

  const measuredVolumeFt3 = measuredVolumeM3 / CUBIC_FEET_TO_CUBIC_METRES;
  const cubicMetresPerHour = (measuredVolumeM3 * 3600) / totalSeconds;
  const cubicFeetPerHour = cubicMetresPerHour / CUBIC_FEET_TO_CUBIC_METRES;
  const calorific = FUEL_CALORIFIC_VALUES[input.fuel];
  const grossKw = (cubicMetresPerHour * calorific.grossMjPerM3) / 3.6;
  const netKw = (cubicMetresPerHour * calorific.netMjPerM3) / 3.6;

  return {
    totalSeconds,
    measuredVolumeM3,
    measuredVolumeFt3,
    meterUnitsLabel: input.mode === 'metric' ? 'm³' : 'ft³',
    cubicMetresPerHour,
    cubicFeetPerHour,
    grossKw,
    netKw,
    grossBtuPerHour: grossKw * BTU_PER_KW,
    netBtuPerHour: netKw * BTU_PER_KW,
    fuelLabel: calorific.label,
  };
}

export interface GeneralVentilationResult {
  excessKw: number;
  requiredCm2: number;
}

export interface CompartmentVentilationResult {
  highLevelCm2: number;
  lowLevelCm2: number;
}

export function calculateGeneralOpenFlueVentilation(totalKw: number): GeneralVentilationResult | null {
  if (!Number.isFinite(totalKw) || totalKw <= 0) return null;
  const excessKw = Math.max(0, totalKw - ADVENTITIOUS_AIR_ALLOWANCE_KW);
  return {
    excessKw,
    requiredCm2: excessKw * 5,
  };
}

export function calculateRoomSealedCompartmentVentilation(totalKw: number): {
  toRoom: CompartmentVentilationResult;
  toOutside: CompartmentVentilationResult;
} | null {
  if (!Number.isFinite(totalKw) || totalKw <= 0) return null;

  return {
    toRoom: {
      highLevelCm2: totalKw * 10,
      lowLevelCm2: totalKw * 10,
    },
    toOutside: {
      highLevelCm2: totalKw * 5,
      lowLevelCm2: totalKw * 5,
    },
  };
}

export function calculateOpenFlueCompartmentVentilation(totalKw: number, destination: VentilationDestination): CompartmentVentilationResult | null {
  if (!Number.isFinite(totalKw) || totalKw <= 0) return null;

  if (destination === 'room') {
    return {
      highLevelCm2: totalKw * 10,
      lowLevelCm2: totalKw * 20,
    };
  }

  return {
    highLevelCm2: totalKw * 5,
    lowLevelCm2: totalKw * 10,
  };
}

export interface WaterHardnessEntry {
  id: string;
  label: string;
  supplier: string;
  supplierUrl: string;
  areas: string[];
  ppmRange: [number, number];
  note: string;
}

const WATER_HARDNESS_DATABASE: WaterHardnessEntry[] = [
  {
    id: 'scotland',
    label: 'Scotland',
    supplier: 'Scottish Water',
    supplierUrl: 'https://www.scottishwater.co.uk/',
    areas: ['AB', 'DD', 'DG', 'EH', 'FK', 'G', 'HS', 'IV', 'KA', 'KW', 'KY', 'ML', 'PA', 'PH', 'TD', 'ZE'],
    ppmRange: [10, 60],
    note: 'Generally soft water across most Scottish supply areas.',
  },
  {
    id: 'northern-ireland',
    label: 'Northern Ireland',
    supplier: 'NI Water',
    supplierUrl: 'https://www.niwater.com/',
    areas: ['BT'],
    ppmRange: [20, 90],
    note: 'Usually soft to moderately soft depending on local source blending.',
  },
  {
    id: 'wales',
    label: 'Wales',
    supplier: 'Dŵr Cymru Welsh Water',
    supplierUrl: 'https://www.dwrcymru.com/',
    areas: ['CF', 'LD', 'LL', 'NP', 'SA', 'SY'],
    ppmRange: [20, 120],
    note: 'Large parts of Wales are soft, with some moderate areas.',
  },
  {
    id: 'south-west',
    label: 'South West',
    supplier: 'South West Water',
    supplierUrl: 'https://www.southwestwater.co.uk/',
    areas: ['EX', 'PL', 'TQ', 'TR'],
    ppmRange: [20, 130],
    note: 'Many supplies are soft to moderately soft across Devon and Cornwall.',
  },
  {
    id: 'north-west',
    label: 'North West',
    supplier: 'United Utilities',
    supplierUrl: 'https://www.unitedutilities.com/',
    areas: ['BB', 'BL', 'CA', 'CH', 'CW', 'FY', 'L', 'LA', 'M', 'OL', 'PR', 'SK', 'WA', 'WN'],
    ppmRange: [25, 140],
    note: 'Typically soft to moderate in the North West.',
  },
  {
    id: 'north-east',
    label: 'North East',
    supplier: 'Northumbrian Water',
    supplierUrl: 'https://www.nwl.co.uk/',
    areas: ['DH', 'DL', 'NE', 'SR', 'TS'],
    ppmRange: [30, 120],
    note: 'Usually soft to moderate hardness.',
  },
  {
    id: 'yorkshire',
    label: 'Yorkshire',
    supplier: 'Yorkshire Water',
    supplierUrl: 'https://www.yorkshirewater.com/',
    areas: ['BD', 'DN', 'HD', 'HG', 'HU', 'HX', 'LS', 'S', 'WF', 'YO'],
    ppmRange: [60, 180],
    note: 'Mixed region with moderate hardness common.',
  },
  {
    id: 'midlands',
    label: 'Midlands',
    supplier: 'Severn Trent Water',
    supplierUrl: 'https://www.stwater.co.uk/',
    areas: ['B', 'CV', 'DE', 'DY', 'GL', 'HR', 'LE', 'NG', 'NN', 'ST', 'TF', 'WR', 'WS', 'WV'],
    ppmRange: [120, 220],
    note: 'Moderately hard to hard in many Midlands supply areas.',
  },
  {
    id: 'east-england',
    label: 'East of England',
    supplier: 'Anglian Water',
    supplierUrl: 'https://www.anglianwater.co.uk/',
    areas: ['CB', 'CM', 'CO', 'IP', 'LN', 'MK', 'NR', 'PE'],
    ppmRange: [180, 320],
    note: 'Hard to very hard water is common in the East.',
  },
  {
    id: 'london-south-east',
    label: 'London & South East',
    supplier: 'Thames Water / Affinity / SES / South East Water',
    supplierUrl: 'https://www.thameswater.co.uk/help/water-quality/hard-water',
    areas: ['AL', 'BN', 'BR', 'CR', 'CT', 'DA', 'E', 'EC', 'EN', 'GU', 'HA', 'HP', 'IG', 'KT', 'LU', 'ME', 'N', 'NW', 'OX', 'RG', 'RH', 'RM', 'SE', 'SG', 'SL', 'SM', 'SN', 'SO', 'SS', 'SW', 'TN', 'TW', 'UB', 'W', 'WC', 'WD'],
    ppmRange: [200, 330],
    note: 'Generally hard to very hard across London and the South East.',
  },
  {
    id: 'southern',
    label: 'South Coast',
    supplier: 'Southern Water / Portsmouth Water / Wessex Water',
    supplierUrl: 'https://www.southernwater.co.uk/help-advice/water-hardness',
    areas: ['BA', 'BH', 'DT', 'PO', 'SP'],
    ppmRange: [170, 300],
    note: 'Mostly hard water along the South Coast and nearby areas.',
  },
];

export interface WaterHardnessResult extends WaterHardnessEntry {
  outwardCode: string;
  typicalPpm: number;
  ppmLabel: string;
  clarkRange: [number, number];
  typicalClark: number;
}

export function toClarkDegrees(ppm: number): number {
  return ppm / CLARK_DEGREES_DIVISOR;
}

export function normalizePostcodeArea(value: string): string {
  return (value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[0-9].*$/, '');
}

export function lookupWaterHardness(postcode: string): WaterHardnessResult | null {
  const area = normalizePostcodeArea(postcode);
  if (!area) return null;

  const match = WATER_HARDNESS_DATABASE.find((entry) => entry.areas.includes(area));
  if (!match) return null;

  const typicalPpm = (match.ppmRange[0] + match.ppmRange[1]) / 2;
  const clarkRange: [number, number] = [
    toClarkDegrees(match.ppmRange[0]),
    toClarkDegrees(match.ppmRange[1]),
  ];

  return {
    ...match,
    outwardCode: area,
    typicalPpm,
    ppmLabel: `${match.ppmRange[0]}–${match.ppmRange[1]} ppm`,
    clarkRange,
    typicalClark: toClarkDegrees(typicalPpm),
  };
}

export const WATER_AUTHORITY_LINKS = [
  {label: 'Thames Water', url: 'https://www.thameswater.co.uk/help/water-quality/hard-water'},
  {label: 'Anglian Water', url: 'https://www.anglianwater.co.uk/help-and-advice/water-quality-and-testing/hardness-of-water/'},
  {label: 'Severn Trent', url: 'https://www.stwater.co.uk/my-supply/water-quality/water-hardness/'},
  {label: 'United Utilities', url: 'https://www.unitedutilities.com/help-and-support/your-water-supply/water-quality/'},
  {label: 'Yorkshire Water', url: 'https://www.yorkshirewater.com/bill-account/help/water-quality/'},
  {label: 'Scottish Water', url: 'https://www.scottishwater.co.uk/your-home/your-water/water-quality'},
  {label: 'Welsh Water', url: 'https://www.dwrcymru.com/en/help-advice/water/water-quality'},
  {label: 'Southern Water', url: 'https://www.southernwater.co.uk/help-advice/water-hardness'},
];
