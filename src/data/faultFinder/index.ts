import type {BrandData, CommonTest, FaultCode, Flowchart, SearchHit} from './types';

import genericData from './generic.json';
import idealData from './ideal.json';
import vaillantData from './vaillant.json';
import worcesterData from './worcester.json';
import commonTestsData from './commonTests.json';

export const BRANDS: BrandData[] = [
  worcesterData as BrandData,
  vaillantData as BrandData,
  idealData as BrandData,
  genericData as BrandData,
];

export const COMMON_TESTS: CommonTest[] = (commonTestsData as {tests: CommonTest[]}).tests;

const BRAND_INDEX = new Map<string, BrandData>(BRANDS.map((b) => [b.slug, b]));

export function getBrand(slug: string): BrandData | undefined {
  return BRAND_INDEX.get(slug);
}

export function getFaultCode(brandSlug: string, code: string): FaultCode | undefined {
  const brand = getBrand(brandSlug);
  if (!brand) return undefined;
  const normalised = code.toUpperCase();
  return brand.faultCodes.find((c) => c.code.toUpperCase() === normalised);
}

export function getFlowchart(brandSlug: string, slug: string): Flowchart | undefined {
  const brand = getBrand(brandSlug);
  if (!brand) return undefined;
  return brand.flowcharts.find((f) => f.slug === slug);
}

export function getCommonTest(slug: string): CommonTest | undefined {
  return COMMON_TESTS.find((t) => t.slug === slug);
}

export function searchCodes(query: string, limit = 40): SearchHit[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  const hits: SearchHit[] = [];
  for (const brand of BRANDS) {
    for (const code of brand.faultCodes) {
      const codeU = code.code.toUpperCase();
      const titleU = code.title.toUpperCase();
      if (codeU.includes(q) || titleU.includes(q) || brand.brand.toUpperCase().includes(q)) {
        hits.push({
          brandSlug: brand.slug,
          brandName: brand.brand,
          code: code.code,
          title: code.title,
          severity: code.severity,
        });
      }
    }
    if (hits.length >= limit * 2) break;
  }

  hits.sort((a, b) => {
    const aExact = a.code.toUpperCase() === q ? 0 : 1;
    const bExact = b.code.toUpperCase() === q ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    const aStarts = a.code.toUpperCase().startsWith(q) ? 0 : 1;
    const bStarts = b.code.toUpperCase().startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.code.localeCompare(b.code);
  });

  return hits.slice(0, limit);
}

export function filterFaultCodes(brand: BrandData, modelId: string | 'all'): FaultCode[] {
  if (modelId === 'all') return brand.faultCodes;
  return brand.faultCodes.filter((c) => c.appliesTo === 'all' || c.appliesTo.includes(modelId));
}

export function filterFlowcharts(brand: BrandData, modelId: string | 'all'): Flowchart[] {
  if (modelId === 'all') return brand.flowcharts;
  return brand.flowcharts.filter((f) => f.appliesTo === 'all' || f.appliesTo.includes(modelId));
}

export * from './types';
