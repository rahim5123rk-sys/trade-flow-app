import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPriceTierMap, resolveTier } from '../supabase/functions/stripe-webhook/priceTierMap.js';

test('buildPriceTierMap only uses monthly Stripe seat price env vars', () => {
  const map = buildPriceTierMap({
    STRIPE_PRICE_DUO_MONTHLY: 'price_single',
    STRIPE_PRICE_TEAM_MONTHLY: 'price_team',
    STRIPE_PRICE_CREW_MONTHLY: 'price_crew',
    STRIPE_PRICE_FLEET_MONTHLY: 'price_fleet',
    STRIPE_PRICE_DUO_ANNUAL: 'should_be_ignored',
    STRIPE_PRICE_TEAM_ANNUAL: 'should_be_ignored',
  });

  assert.deepEqual(map, {
    price_single: 'duo',
    price_team: 'team',
    price_crew: 'crew',
    price_fleet: 'fleet',
  });
});

test('resolveTier returns null for unknown or missing prices', () => {
  const map = buildPriceTierMap({
    STRIPE_PRICE_DUO_MONTHLY: 'price_single',
    STRIPE_PRICE_TEAM_MONTHLY: 'price_team',
    STRIPE_PRICE_CREW_MONTHLY: 'price_crew',
    STRIPE_PRICE_FLEET_MONTHLY: 'price_fleet',
  });

  assert.equal(resolveTier(map, 'price_single'), 'duo');
  assert.equal(resolveTier(map, 'price_team'), 'team');
  assert.equal(resolveTier(map, null), null);
  assert.equal(resolveTier(map, 'price_other'), null);
});
