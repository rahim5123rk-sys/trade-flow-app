# GasPilot — Trade Flow App

## Project Overview

**GasPilot** is a React Native / Expo app for gas engineers in the UK. It handles gas safety certificates, invoices, quotes, job tracking, scheduling, team management, and digital signatures.

- **Framework**: React Native 0.81.5 + Expo SDK 54
- **Router**: Expo Router v6 (file-based)
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions)
- **Build**: EAS (Expo Application Services)
- **Bundle ID**: `com.reezy95.gaspilot`
- **EAS Project ID**: `74768981-1aad-48b8-9f3b-01da345a72ab`

---

## Key Architecture

### Contexts
- `src/context/AuthContext.tsx` — session, userProfile, role (`admin` | `worker`)
- `src/context/ThemeContext.tsx` — dark/light mode
- `src/context/OfflineContext.tsx` — offline mode flag
- `src/context/SubscriptionContext.tsx` — RevenueCat state, `isPro`, `purchasePackage`, `restorePurchases`

### Routing
- `app/(auth)/` — login, register, reset-password, privacy-policy, terms-of-service
- `app/(app)/` — main app (tab-based with LiquidGlassNav)
- `app/(app)/_layout.tsx` — tab config, FAB menu, auth guard
- `app/(app)/settings/` — user details, company details, privacy, terms, subscription

### Database (Supabase)
Key tables: `profiles`, `companies`, `jobs`, `customers`, `documents`, `notes`, `job_parts`

`profiles` subscription columns:
- `subscription_tier` — `'starter'` | `'pro'` (default: `'starter'`)
- `subscription_type` — `'monthly'` | `'annual'` | null
- `subscription_expires_at` — timestamptz
- `revenuecat_user_id` — text

Role access: `admin` sees everything; `worker` sees assigned jobs only.

---

## Subscription / Billing — RevenueCat

> **Status**: Fully implemented in code. Pending RevenueCat dashboard product configuration.

### What's built
- `src/context/SubscriptionContext.tsx` — initialises RC on login, exposes `isPro`, syncs to Supabase
- `app/(app)/settings/subscription.tsx` — paywall screen with plan selector (monthly / annual)
- `supabase/functions/revenuecat-webhook/index.ts` — handles RC events, updates `profiles`
- DB migrations in `supabase/migrations/` for subscription columns

### Pricing Model

| Tier | Price | Access |
|------|-------|--------|
| **Starter** (free) | Free | CP12 only (10/month), up to 10 customers, no team/invoices/calendar |
| **Pro Monthly** | £20/month | All 7 form types unlimited, invoices, calendar, team, reminders + 30-day free trial |
| **Pro Annual** | £179.99/year | Save ~25% vs monthly |
| **Worker Seat** | £15/month per seat | Add-on: each purchase adds 1 worker slot to company |

### Product IDs

| Plan | App Store Connect ID | RC Package Identifier |
|------|---------------------|----------------------|
| Monthly | `com.reezy95.gaspilot.pro.monthly` | `$rc_monthly` |
| Annual | `com.reezy95.gaspilot.pro.annual` | `$rc_annual` |

**Entitlement ID in RevenueCat**: `pro`
**RevenueCat Project ID**: `32e52ae9`

### RevenueCat Dashboard Setup (remaining)
1. Create 2 products in App Store Connect (monthly + annual = auto-renewable subscriptions)
2. In RevenueCat → Products, import both product IDs
3. In RevenueCat → Offerings → `default` offering → add 2 packages using the identifiers above
4. Webhook URL: register `https://<project>.supabase.co/functions/v1/revenuecat-webhook` in RC dashboard

### Sandbox Testing
- Build dev client: `eas build --profile development --platform ios`
- Test on real device with sandbox Apple ID (App Store Connect → Users → Sandbox Testers)
- IAP does **not** work in Expo Go or simulator

### Usage in code
```typescript
const { isPro, isLoading, currentOffering, purchasePackage, restorePurchases } = useSubscription();
```

### Feature Gating Reference

| Feature | Starter | Pro |
|---------|---------|-----|
| Gas Safety Certificate (CP12) | ✅ 10/month | ✅ Unlimited |
| Other gas forms (6 types) | ❌ | ✅ Unlimited |
| Customers | ✅ Up to 10 | ✅ Unlimited |
| Job tracking | ✅ Basic | ✅ Full |
| Invoices & quotes | ❌ | ✅ |
| Smart scheduling / calendar | ❌ | ✅ |
| Team / workers management | ❌ | ✅ (seats at £15/mo each) |
| Renewal reminders | ❌ | ✅ |
| Custom logo on documents | ❌ | ✅ |
| Offline sync | ✅ | ✅ |
| Digital signatures | ✅ | ✅ |

### Company-Wide Subscription
- Admin purchases Pro → all workers in the company get Pro access
- Workers check `profiles.subscription_tier` from Supabase (no RevenueCat on worker devices)
- RC webhook syncs all company members on admin sub change
- Worker seats tracked via `companies.worker_seat_limit`

### Invite Code & Worker Seat Security
- Invite codes are reusable (format: `ABC-123`) — one code per company
- Worker registration validates: (1) code exists, (2) company is Pro, (3) seats available
- Server-side trigger `enforce_worker_seat_limit` on `profiles` INSERT rejects workers if seat limit reached
- Migration: `20260316000000_enforce_worker_seat_limit.sql`
- Admin can regenerate code to invalidate old one (workers/add screen)
- Seat purchase (£15/mo) increments `companies.worker_seat_limit` by 1

### Important Notes
- **Must use `expo-dev-client`** — in-app purchases do not work in Expo Go
- RevenueCat is **free up to $10K/month** tracked revenue
- Apple takes **30% year 1**, then **15% from year 2** for retained subscribers
- Do **not** use `expo-in-app-purchases` — deprecated since Aug 2023

---

## Navigation

- **Tab bar**: Uses iOS 26 `NativeTabs` from `expo-router/unstable-native-tabs` (`app/(app)/(tabs)/_layout.tsx`). Do NOT replace with standard `Tabs` — the user wants the native iOS 26 look.
- **LiquidGlassNav**: Custom glass-morphism tab bar at `components/LiquidGlassNav.tsx` — kept as a backup. Not currently active but do not delete.

---

## Current Tech Debt / Known Issues
- `font-500`/`font-600`/`font-700` pattern used in pilotlight website — not valid Tailwind v4 (use `font-medium`/`font-semibold`/`font-bold`)
- Worker seat IAP product (`com.reezy95.gaspilot.worker.seat.monthly`) not yet created in App Store Connect / RevenueCat
- Apple Paid Apps agreement pending review — IAP sandbox testing blocked until approved

---

## Commands

```bash
# Start dev server
npx expo start

# Build dev client for iOS (needed for IAP testing)
eas build --profile dev --platform ios

# Build production
eas build --profile production --platform ios

# Submit to App Store
eas submit --platform ios

# Run local Supabase
supabase start
supabase db push
```
