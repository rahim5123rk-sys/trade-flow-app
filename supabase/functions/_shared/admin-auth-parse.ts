// Pure parsing/membership helpers extracted so they can be unit-tested
// from Node (`tsx --test`) without pulling in Deno-only imports.

export function parseAllowlist(input: string | null | undefined): string[] {
  if (!input) return [];
  return input.split(',').map(s => s.trim()).filter(Boolean);
}

export function isAllowed(list: string[], userId: string): boolean {
  if (!userId) return false;
  return list.includes(userId);
}
