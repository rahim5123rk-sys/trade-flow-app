export function buildPriceTierMap(env) {
  return Object.fromEntries(
    [
      [env.STRIPE_PRICE_DUO_MONTHLY, 'duo'],
      [env.STRIPE_PRICE_TEAM_MONTHLY, 'team'],
      [env.STRIPE_PRICE_CREW_MONTHLY, 'crew'],
      [env.STRIPE_PRICE_FLEET_MONTHLY, 'fleet'],
    ].filter(([priceId]) => Boolean(priceId)),
  )
}

export function resolveTier(priceTierMap, priceId) {
  if (!priceId) return null
  return priceTierMap[priceId] ?? null
}