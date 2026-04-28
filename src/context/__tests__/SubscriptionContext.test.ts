import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveIsPro,
  supabaseSaysProAndNotExpired,
} from '../subscriptionRules';

test('Supabase Pro + RC empty → stays Pro', () => {
  const next = resolveIsPro({
    rcHasPro: false,
    supabase: { tier: 'pro', expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
    previousIsPro: true,
  });
  assert.equal(next, true);
});

test('Supabase Pro + RC Pro → stays Pro', () => {
  const next = resolveIsPro({
    rcHasPro: true,
    supabase: { tier: 'pro', expiresAt: null },
    previousIsPro: true,
  });
  assert.equal(next, true);
});

test('Supabase Standard + RC Pro → flips to Pro', () => {
  const next = resolveIsPro({
    rcHasPro: true,
    supabase: { tier: 'starter', expiresAt: null },
    previousIsPro: false,
  });
  assert.equal(next, true);
});

test('Supabase Pro + expires_at in past → drops to Standard', () => {
  const next = resolveIsPro({
    rcHasPro: false,
    supabase: { tier: 'pro', expiresAt: new Date(Date.now() - 60_000).toISOString() },
    previousIsPro: true,
  });
  assert.equal(next, false);
});

test('Supabase Standard + RC empty → stays Standard', () => {
  const next = resolveIsPro({
    rcHasPro: false,
    supabase: { tier: 'starter', expiresAt: null },
    previousIsPro: false,
  });
  assert.equal(next, false);
});

test('Listener fires later with empty entitlements → stays Pro (closure freshness)', () => {
  const next = resolveIsPro({
    rcHasPro: false,
    supabase: { tier: 'pro', expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
    previousIsPro: true,
  });
  assert.equal(next, true);
});

test('supabaseSaysProAndNotExpired: null expiresAt is treated as never-expiring', () => {
  assert.equal(
    supabaseSaysProAndNotExpired({ tier: 'pro', expiresAt: null }),
    true,
  );
});
