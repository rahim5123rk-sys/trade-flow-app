# Worker Seats, Form Limits & Registration Integration

## Summary

Extend the subscription model with per-seat worker billing (£15/mo), gate gas forms by tier (Starter: CP12 only, 10/month; Pro: all forms, unlimited), and ensure workers inherit their company admin's subscription status.

## 1. Worker Seats

**Product:** `com.reezy95.gaspilot.worker.seat.monthly` (non-renewing subscription in App Store Connect)

**Database:** Add `worker_seat_limit INTEGER DEFAULT 0` to `companies` table.

**Flow:**
- Admin goes to workers/add → check `current_worker_count < worker_seat_limit`
- If at limit → show seat purchase paywall (£15/mo per seat)
- On purchase → increment `companies.worker_seat_limit`
- Workers inherit company Pro status, don't manage their own subscriptions

## 2. Starter Form Limits

**Starter:**
- CP12 (Gas Safety Certificate) only — max 10 per month
- No access to: Warning Notice, Service Record, Commissioning, Decommissioning, Breakdown Report, Installation Certificate

**Pro:**
- All 7 form types, unlimited

**Gate locations:**
- `app/(app)/forms/index.tsx` — lock 6 non-CP12 forms with PRO badge
- CP12 flow entry — count check: `documents` where `type='cp12'`, `company_id=X`, `created_at >= first of month`

## 3. Company-Wide Subscription

Workers inherit admin's subscription. When admin subscribes/cancels, RC webhook updates ALL profiles in the company. SubscriptionContext checks company-level status.

## Files to Create

None — extend existing files.

## Files to Modify

1. `app/(app)/forms/index.tsx` — lock non-CP12 forms for Starter
2. `app/(app)/cp12/index.tsx` (or wherever CP12 creation starts) — monthly count check
3. `app/(app)/workers/add.tsx` — seat limit check + seat purchase flow
4. `src/context/SubscriptionContext.tsx` — company-wide Pro detection
5. `supabase/functions/revenuecat-webhook/index.ts` — update all company profiles on admin sub change
6. Supabase migration — add `worker_seat_limit` to companies
