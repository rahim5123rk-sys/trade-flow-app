// ============================================
// Static lists of popular UK gas appliance brands
// Used for autocomplete suggestions on form Make fields
// ============================================

export const BOILER_BRANDS = [
  'Worcester Bosch',
  'Vaillant',
  'Baxi',
  'Ideal',
  'Viessmann',
  'Glow-worm',
  'Alpha',
  'Potterton',
  'Navien',
  'Remeha',
  'Ferroli',
  'Intergas',
  'Atag',
  'Hamworthy',
  'Main',
] as const;

export const FIRE_BRANDS = [
  'Valor',
  'Gazco',
  'Flavel',
  'Robinson Willey',
  'Kinder',
  'Legend',
  'Crystal',
  'Eko',
  'Burley',
  'Gallery',
] as const;

export const COOKER_BRANDS = [
  'Rangemaster',
  'Stoves',
  'Belling',
  'Cannon',
  'New World',
  'Leisure',
  'Smeg',
  'Falcon',
  'Britannia',
  'Lacanche',
] as const;

export const HOB_BRANDS = [
  'Bosch',
  'Neff',
  'Smeg',
  'Stoves',
  'Belling',
  'Hotpoint',
  'Zanussi',
  'AEG',
  'Rangemaster',
  'CDA',
] as const;

export const WATER_HEATER_BRANDS = [
  'Heatrae Sadia',
  'Ariston',
  'Baxi',
  'Vaillant',
  'Andrews',
  'Rinnai',
  'Zip',
  'Redring',
] as const;

/** All brands combined and deduplicated, for when appliance type isn't known yet */
export const ALL_BRANDS = [
  ...new Set([
    ...BOILER_BRANDS,
    ...FIRE_BRANDS,
    ...COOKER_BRANDS,
    ...HOB_BRANDS,
    ...WATER_HEATER_BRANDS,
  ]),
] as string[];

/** Appliance type categories for the CP12 Type field */
export const APPLIANCE_TYPES = [
  'Boiler',
  'Fire',
  'Cooker',
  'Hob',
  'Water Heater',
  'Warm Air Unit',
  'Other',
] as const;

/**
 * Returns brand suggestions for a given appliance category.
 * Falls back to ALL_BRANDS if the category doesn't match a specific list.
 */
export function getBrandsForCategory(category: string): string[] {
  switch (category) {
    case 'Boiler':
      return [...BOILER_BRANDS];
    case 'Fire':
      return [...FIRE_BRANDS];
    case 'Cooker':
      return [...COOKER_BRANDS];
    case 'Hob':
      return [...HOB_BRANDS];
    case 'Water Heater':
      return [...WATER_HEATER_BRANDS];
    default:
      return ALL_BRANDS;
  }
}
