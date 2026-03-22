# Pro Feature Gating Design

## Summary

Gate Pro-only features behind a dismissible full-screen paywall modal. Starter users can see that features exist but cannot access them without upgrading. The paywall modal is a single reusable component used across the entire app.

## ProPaywallModal Component

**File:** `components/ProPaywallModal.tsx`

A full-screen modal overlay that slides up when a Starter user attempts a Pro-only action.

**Props:**
- `visible: boolean` — controls modal visibility
- `onDismiss: () => void` — called when user taps "Not now"
- `featureTitle: string` — e.g. "Invoices & Quotes"
- `featureDescription: string` — short explanation of what the feature does

**Layout:**
- Semi-transparent dark backdrop
- Centered/bottom-aligned card with rounded corners
- GasPilot Pro diamond icon + branding at top
- Feature title: "Unlock {featureTitle}"
- Feature description text
- Bullet list of Pro benefits (reuse PRO_FEATURES from subscription.tsx)
- "Upgrade to Pro" primary button → navigates to settings/subscription
- "Not now" dismiss link below

**Styling:** Matches existing app theme (uses `useAppTheme()` for dark/light mode). Animated entrance via `react-native-reanimated` FadeInUp.

## Gating Points

### Invoices (`app/(app)/invoice.tsx`)
- Check `isPro` at top of component
- If not Pro: render ProPaywallModal with featureTitle="Invoices & Quotes"
- Don't render the invoice form at all behind the modal

### Quotes (`app/(app)/quote.tsx`)
- Same pattern as invoices
- featureTitle="Invoices & Quotes"

### Calendar (`app/(app)/calendar.tsx`)
- Tab remains visible in navigation for all users
- Check `isPro` at top of component
- If not Pro: render a simple view with the paywall modal auto-shown
- featureTitle="Smart Scheduling"

### Workers (`app/(app)/workers/index.tsx`, `workers/add.tsx`)
- Check `isPro` at top of each screen
- featureTitle="Team Management"

### Customers 10+ Limit (`app/(app)/customers/add.tsx`)
- Before saving a new customer, query customer count for the company
- If count >= 10 and not Pro: show paywall modal instead of saving
- featureTitle="Unlimited Customers"
- featureDescription="Starter plan allows up to 10 customers. Upgrade to Pro for unlimited."

### Renewal Reminders (`app/(app)/settings/index.tsx`)
- In the CP12 renewal reminders section
- If not Pro: show a locked card with "Pro" badge overlay instead of the settings controls
- Tapping the locked card shows ProPaywallModal
- featureTitle="Renewal Reminders"

### Custom Logo (`app/(app)/settings/index.tsx`)
- In the company logo section
- If not Pro: show a locked card with "Pro" badge overlay instead of upload button
- Tapping the locked card shows ProPaywallModal
- featureTitle="Custom Logo"

## Tab & Navigation Visibility

- All tabs remain visible (Dashboard, Calendar, Docs, Jobs)
- Calendar shows paywall on access for Starter users
- Docs tab remains fully accessible (gas certs are free; only invoice/quote creation is gated)
- FAB menu unchanged (New Job, New Form, New Customer, Tools all remain)

## No Changes Required

- Dashboard — free for all
- Jobs — free for all
- Gas safety forms (CP12, service records, etc.) — free for all
- Customer list/view — free (only creation past 10 is gated)
- Documents list — free (viewing existing docs is fine; creating invoices/quotes is gated)
- FAB menu — no changes needed

## Files to Create

1. `components/ProPaywallModal.tsx` — the reusable modal component

## Files to Modify

1. `app/(app)/invoice.tsx` — add gate at top
2. `app/(app)/quote.tsx` — add gate at top
3. `app/(app)/calendar.tsx` — add gate at top
4. `app/(app)/workers/index.tsx` — add gate at top
5. `app/(app)/workers/add.tsx` — add gate at top
6. `app/(app)/customers/add.tsx` — add count check before save
7. `app/(app)/settings/index.tsx` — lock logo + reminder sections
