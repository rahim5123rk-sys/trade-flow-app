// Pure helpers for the subscription-tier rule applied in SubscriptionContext.
// Extracted so they can be unit-tested without rendering a React tree or
// initialising the RevenueCat SDK.

export type SupabaseProState = {
  tier: 'pro' | 'starter' | null;
  expiresAt: string | null;
};

export function supabaseSaysProAndNotExpired(state: SupabaseProState): boolean {
  if (state.tier !== 'pro') return false;
  if (!state.expiresAt) return true;
  return new Date(state.expiresAt).getTime() > Date.now();
}

// RC may upgrade Standard → Pro, but may never downgrade Pro → Standard.
// Downgrades happen only via webhook (subscription_tier flipped server-side)
// or genuine expiration (subscription_expires_at in the past).
export function resolveIsPro(input: {
  rcHasPro: boolean;
  supabase: SupabaseProState;
  previousIsPro: boolean;
}): boolean {
  if (input.rcHasPro) return true;
  if (supabaseSaysProAndNotExpired(input.supabase)) return true;
  return false;
}
