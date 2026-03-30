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
- `src/context/ThemeContext.tsx` — dark/light mode via `useAppTheme()` → `{ theme, isDark }`
- `src/context/OfflineContext.tsx` — offline mode flag
- `src/context/SubscriptionContext.tsx` — RevenueCat state, `isPro`, `purchasePackage`, `restorePurchases`

### Routing
- `app/(auth)/` — login, register, reset-password, privacy-policy, terms-of-service
- `app/(app)/` — main app (tab-based)
- `app/(app)/_layout.tsx` — tab config, FAB menu, auth guard
- `app/(app)/settings/` — user details, company details, privacy, terms, subscription
- `app/(app)/invoice.tsx` — create/edit invoices
- `app/(app)/quote.tsx` — create/edit quotes
- `app/(app)/cp12/` — CP12 gas safety certificate flow
- `app/(app)/forms/` — other gas form flows (service-record, commissioning, decommissioning, warning-notice, breakdown, installation)
- `app/(app)/workers/` — team management (add workers via invite code)

### Database (Supabase)
Key tables: `profiles`, `companies`, `jobs`, `customers`, `documents`, `notes`, `job_parts`, `global_counters`

`profiles` subscription columns:
- `subscription_tier` — `'starter'` | `'pro'` (default: `'starter'`)
- `subscription_type` — `'monthly'` | `'annual'` | null
- `subscription_expires_at` — timestamptz
- `revenuecat_user_id` — text

Role access: `admin` sees everything; `worker` sees assigned jobs only.

---

## Document & PDF System

### Document Types
7 gas form types + invoices + quotes. All stored in the `documents` table.

| Type | Kind (locked payload) | Reference Format | PDF Generator |
|------|----------------------|-----------------|---------------|
| Gas Safety Cert (CP12) | `cp12` | `REF-0001` | `cp12PdfGenerator.ts` |
| Service Record | `service_record` | `REF-0001` | `serviceRecordPdfGenerator.ts` |
| Commissioning | `commissioning` | `REF-0001` | `commissioningPdfGenerator.ts` |
| Decommissioning | `decommissioning` | `REF-0001` | `decommissioningPdfGenerator.ts` |
| Warning Notice | `warning_notice` | `REF-0001` | `warningNoticePdfGenerator.ts` |
| Breakdown Report | `breakdown_report` | `REF-0001` | `breakdownReportPdfGenerator.ts` |
| Installation Cert | `installation_cert` | `REF-0001` | `installationCertPdfGenerator.ts` |
| Invoice | n/a (no locked payload) | `INV-0001` | `DocumentGenerator.ts` |
| Quote | n/a (no locked payload) | `QTE-0001` | `DocumentGenerator.ts` |

### Per-Company Counters
- Each company has independent auto-incrementing counters for references
- Supabase RPC functions: `get_next_gas_cert_reference(reserve, p_company_id)`, `get_next_invoice_reference(...)`, `get_next_quote_reference(...)`
- Atomic via `ON CONFLICT DO UPDATE` on `global_counters` table with compound keys like `gas_cert_ref:{company_id}`
- Client-side wrappers in `src/services/formDocumentService.ts`: `getNextCertReference()`, `getNextInvoiceReference()`, `getNextQuoteReference()`

### PDF Pipeline
Gas forms use a **locked payload** system:
1. Form data → `build*LockedPayload()` → JSON stored in `documents.payment_info`
2. Payload → `buildHtml()` → HTML → `expo-print` → PDF
3. PDF → share/email/view/upload

Invoices/quotes use `DocumentGenerator.ts` directly (no locked payload).

### PDF Registry (`src/services/pdf/`)
- `registry.ts` — polymorphic registry mapping `kind` → PDF generator. `registerFormPdf()` called at module scope.
- `shared.ts` — shared CSS, HTML helpers, `shareHtmlAsPdf()`, `generatePdfFromPayload()`, `generatePdfBase64FromPayload()`
- `index.ts` — barrel export + side-effect imports that register all generators
- `singleApplianceFormTemplate.ts` — shared template for single-appliance forms (breakdown, warning notice, installation)

### PDF Filenames
PDFs are named descriptively when shared or emailed:
- Gas forms: `Gas-Safety-Record-REF-0042.pdf`, `Service-Record-REF-0003.pdf`, etc.
- Invoices: `Invoice-INV-0001.pdf`
- Quotes: `Quote-QTE-0001.pdf`
- Mapping in `registry.ts` → `getDocumentFileName(kind, ref)`
- Share sheet: temp file renamed via `expo-file-system` `moveAsync` before `Sharing.shareAsync`
- Email attachment: filename derived from `formLabel` in `sendCp12CertificateEmail()`

### Email System (`src/services/email.ts`)
- `sendCp12CertificateEmail()` — generic branded email sender (name is legacy, works for all doc types)
- Accepts `formLabel` to customize the email content (e.g. "Invoice", "Gas Safety Certificate")
- Sends via Supabase Edge Function `send-email` (Resend)
- Auto-BCC engineer if company setting `ccEngineerOnEmails` is enabled
- Branded HTML template with company logo, reference details, and GasPilot footer

### Email from Create Screens
- Invoice (`invoice.tsx`) and Quote (`quote.tsx`) have "Save & Send Email" buttons
- Saves document → generates PDF base64 → sends branded email to customer
- Sets status to "Sent" automatically

### Email from Document Details
- `app/(app)/(tabs)/documents/[id].tsx` — unified detail screen for all document types
- Email modal with editable subject line and recipient list (`EmailRecipientsList` component)
- Works for gas forms (via locked payload registry) AND invoices/quotes (via `generateDocumentBase64`)
- Additional recipients can be added in the modal

### Document Detail Screen (`[id].tsx`)
- Refactored from 2106 → ~1000 lines
- Extracted: `components/documents/GasFormDetails.tsx`, `components/documents/DocumentDetailStyles.ts`, `src/services/documentActions.ts`
- Actions: Share, View PDF, Send Email, Edit, Duplicate, Delete, Update Status
- Gas forms show renewal reminder toggle + one-time reminder emails

---

## Theming / Dark Mode

- `useAppTheme()` hook → `{ theme, isDark }`
- Pattern: `style={[styles.foo, isDark && { color: theme.text.title }]}`
- Theme tokens: `theme.text.{title,body,muted,inverse,placeholder}`, `theme.surface.{base,card,elevated,border,divider}`, `theme.brand.{primary,danger,success}`, `theme.glass.{bg,border}`, `theme.gradients.*`
- Light-mode constants in `constants/theme.ts` → `UI.*` and `Colors.*`
- DateTimePicker dark mode: `themeVariant={isDark ? 'dark' : 'light'}` + `textColor`

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

## OTA Updates

- `expo-updates` plugin added to `app.json` plugins array (required for native module)
- Runtime version policy: `appVersion` — OTA updates only reach builds with matching app version
- Update URL: `https://u.expo.dev/74768981-1aad-48b8-9f3b-01da345a72ab`
- Push OTA: `eas update --branch production --message "description"`
- **Important**: Adding/removing `expo-updates` from plugins requires a new native build before OTA works
- Debug build identifier in settings screen (temporary) — remove once OTA confirmed working

---

## Current Tech Debt / Known Issues
- Worker seat IAP product (`com.reezy95.gaspilot.worker.seat.monthly`) not yet created in App Store Connect / RevenueCat
- Apple Paid Apps agreement pending review — IAP sandbox testing blocked until approved
- `sendCp12CertificateEmail` function name is misleading — it's used for ALL document types (invoices, quotes, gas forms). Don't rename without updating all callers.
- Debug build identifier in settings screen should be removed once OTA updates are confirmed working with TestFlight

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

# Push OTA update to production
eas update --branch production --message "description"

# Run local Supabase
supabase start
supabase db push
```
