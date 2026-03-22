# Renewal Reminder UX Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify renewal reminders — settings is config-only, form last pages show email recipients with one-time additions, Edge Function sends automatically on a daily cron using per-company `reminder_days_before`.

**Architecture:** New `companies.reminder_days_before` column exposed via `AuthContext`. CP12 and service record review screens display reminder toggle + email list + one-time input. Document details gets the same. `send-renewal-reminders` Edge Function updated to use per-company days and `oneTimeReminderEmails`. Cron set via Supabase Dashboard.

**Tech Stack:** Supabase (Postgres, JSONB, Edge Functions), React Native, AuthContext, Resend email API.

**Spec:** `docs/superpowers/specs/2026-03-16-feature-sprint-design.md` — Feature 3.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `supabase/migrations/20260316400000_company_reminder_days.sql` | Add `reminder_days_before` column to `companies` |
| Modify | `src/context/AuthContext.tsx` | Expose `reminderDaysBefore` from company row |
| Modify | `app/(app)/settings/index.tsx` | Simplify reminder settings to days-only config |
| Modify | `app/(app)/cp12/review-sign.tsx` | Add reminder section with emails + one-time input |
| Modify | `app/(app)/forms/service-record/review-sign.tsx` | Same as CP12 |
| Modify | `app/(app)/documents/[id].tsx` | Update reminder section with email display + one-time input |
| Modify | `supabase/functions/send-renewal-reminders/index.ts` | Use `reminder_days_before`, `<=` check, `oneTimeReminderEmails` |

---

## Chunk 1: Database + AuthContext

### Task 1: Migration — reminder_days_before

**Files:**
- Create: `supabase/migrations/20260316400000_company_reminder_days.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260316400000_company_reminder_days.sql
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS reminder_days_before integer NOT NULL DEFAULT 30;
```

- [ ] **Step 2: Push**

```bash
npx supabase db push
```

Expected: migration applied.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260316400000_company_reminder_days.sql
git commit -m "feat: add reminder_days_before column to companies"
```

---

### Task 2: Expose reminderDaysBefore in AuthContext

**Files:**
- Modify: `src/context/AuthContext.tsx`

- [ ] **Step 1: Read the file** — understand the `fetchProfile` function and what `UserProfile` currently exposes (lines 24-107).

- [ ] **Step 2: Add `reminderDaysBefore` to context**

In the `AuthContext` value type, add:
```typescript
reminderDaysBefore: number;
```

In the state declarations inside the provider, add:
```typescript
const [reminderDaysBefore, setReminderDaysBefore] = useState<number>(30);
```

- [ ] **Step 3: Fetch it alongside the profile**

In `fetchProfile()`, after the profiles fetch succeeds and `company_id` is available, add:

```typescript
// Fetch company reminder days
if (profileData.company_id) {
  const { data: companyData } = await supabase
    .from('companies')
    .select('reminder_days_before')
    .eq('id', profileData.company_id)
    .single();
  setReminderDaysBefore(companyData?.reminder_days_before ?? 30);
}
```

- [ ] **Step 4: Expose in context value**

Find the context value object (where `session`, `userProfile`, etc. are spread) and add:

```typescript
reminderDaysBefore,
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add src/context/AuthContext.tsx
git commit -m "feat: expose reminderDaysBefore from company in AuthContext"
```

---

## Chunk 2: Settings + Form Review Screens

### Task 3: Simplify settings renewal section

**Files:**
- Modify: `app/(app)/settings/index.tsx`

- [ ] **Step 1: Read the renewal reminders section** — find the `isPro` block containing `cp12ReminderEnabled`, `cp12ReminderDays`, `handleSendDueReminders`, and the recipient picker.

- [ ] **Step 2: Add `reminderDaysBefore` to auth context destructure**

```typescript
const { userProfile, reminderDaysBefore } = useAuth();
```

- [ ] **Step 3: Add save handler for days**

Find or add a save function. When the user changes the days input, save to Supabase:

```typescript
const handleSaveDays = async (days: string) => {
  const val = parseInt(days, 10);
  if (isNaN(val) || val < 1) return;
  if (!userProfile?.company_id) return;
  await supabase
    .from('companies')
    .update({ reminder_days_before: val })
    .eq('id', userProfile.company_id);
};
```

- [ ] **Step 4: Replace the reminder section JSX**

Remove: toggle for enabling reminders, recipient picker (landlord/tenant/both), "Send Due Reminders Now" button, and `handleSendDueReminders` function.

Replace the entire Pro-gated reminder block with:

```typescript
{isPro ? (
  <View style={/* existing card style */}>
    <Text style={/* existing section title style */}>Renewal Reminders</Text>
    <Text style={/* existing subtitle style */}>
      Set how many days before expiry customers receive a reminder email.
    </Text>
    <View style={/* existing input row style */}>
      <Text style={/* label style */}>Days before expiry</Text>
      <TextInput
        style={/* existing input style */}
        value={reminderDaysInput}
        onChangeText={setReminderDaysInput}
        onBlur={() => handleSaveDays(reminderDaysInput)}
        keyboardType="numeric"
        placeholder="30"
        maxLength={3}
      />
    </View>
    <Text style={/* hint style, color: theme.text.muted */}>
      Reminders are sent automatically each day. Toggle per-document from the form or document details.
    </Text>
  </View>
) : (
  /* existing Pro paywall component */
)}
```

Add local state:

```typescript
const [reminderDaysInput, setReminderDaysInput] = useState(String(reminderDaysBefore));
```

Keep `useEffect` to sync when `reminderDaysBefore` changes:

```typescript
useEffect(() => {
  setReminderDaysInput(String(reminderDaysBefore));
}, [reminderDaysBefore]);
```

- [ ] **Step 5: Remove dead state and the `handleSendDueReminders` function**

Delete: `cp12ReminderEnabled`, `cp12ReminderRecipients`, `sendingReminders`, `handleSendDueReminders`.

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/settings/index.tsx
git commit -m "feat: simplify renewal settings to days-only config"
```

---

### Task 4: Shared reminder section component

Rather than duplicating the reminder section in both CP12 and service record review screens, extract a small reusable component.

**Files:**
- Create: `components/ReminderSection.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/ReminderSection.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/ThemeContext';

interface Props {
  enabled: boolean;
  onToggle: (val: boolean) => void;
  /** Emails already on the form (customer, landlord, tenant — filtered for non-empty) */
  savedEmails: string[];
  /** Called whenever the one-time email list changes */
  onOneTimeEmailsChange: (emails: string[]) => void;
  /**
   * Pre-fill the one-time email list (document details use case — existing
   * `payment_info.oneTimeReminderEmails` from a previous save).
   * Omit or pass undefined for form screens (always starts empty).
   */
  initialOneTimeEmails?: string[];
}

export default function ReminderSection({ enabled, onToggle, savedEmails, onOneTimeEmailsChange, initialOneTimeEmails }: Props) {
  const { theme, isDark } = useAppTheme();
  const { reminderDaysBefore } = useAuth();
  const [oneTimeEmails, setOneTimeEmails] = useState<string[]>(initialOneTimeEmails ?? []);
  const [inputValue, setInputValue] = useState('');

  const addEmail = () => {
    const trimmed = inputValue.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return;
    if (oneTimeEmails.includes(trimmed)) { setInputValue(''); return; }
    const updated = [...oneTimeEmails, trimmed];
    setOneTimeEmails(updated);
    onOneTimeEmailsChange(updated);
    setInputValue('');
  };

  const removeOneTime = (email: string) => {
    const updated = oneTimeEmails.filter((e) => e !== email);
    setOneTimeEmails(updated);
    onOneTimeEmailsChange(updated);
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? theme.surface.elevated : '#F8F9FA', borderColor: isDark ? theme.surface.border : '#E5E7EB' }]}>
      {/* Toggle row */}
      <TouchableOpacity style={styles.toggleRow} onPress={() => onToggle(!enabled)} activeOpacity={0.8}>
        <View style={styles.toggleLeft}>
          <Ionicons name="notifications-outline" size={18} color={enabled ? theme.brand.primary : theme.text.muted} />
          <View style={{ marginLeft: 10 }}>
            <Text style={[styles.toggleLabel, { color: theme.text.title }]}>Renewal Reminder</Text>
            <Text style={[styles.toggleSub, { color: theme.text.muted }]}>
              Email {reminderDaysBefore} days before expiry
            </Text>
          </View>
        </View>
        {/* Simple toggle indicator */}
        <View style={[styles.toggle, { backgroundColor: enabled ? theme.brand.primary : (isDark ? theme.surface.border : '#D1D5DB') }]}>
          <View style={[styles.toggleThumb, { transform: [{ translateX: enabled ? 18 : 2 }] }]} />
        </View>
      </TouchableOpacity>

      {enabled && (
        <>
          <View style={[styles.divider, { backgroundColor: isDark ? theme.surface.border : '#E5E7EB' }]} />

          {/* Saved emails */}
          {savedEmails.map((email) => (
            <View key={email} style={styles.emailRow}>
              <Ionicons name="mail-outline" size={14} color={theme.text.muted} />
              <Text style={[styles.emailText, { color: theme.text.body }]}>{email}</Text>
            </View>
          ))}

          {/* One-time emails */}
          {oneTimeEmails.map((email) => (
            <View key={email} style={styles.emailRow}>
              <Ionicons name="mail-outline" size={14} color={theme.brand.primary} />
              <Text style={[styles.emailText, { color: theme.text.body }]}>{email}</Text>
              <TouchableOpacity onPress={() => removeOneTime(email)} style={{ marginLeft: 'auto' }}>
                <Ionicons name="close-circle" size={16} color={theme.text.muted} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add one-time email input */}
          <View style={[styles.addRow, { borderColor: isDark ? theme.surface.border : '#D1D5DB' }]}>
            <TextInput
              style={[styles.emailInput, { color: theme.text.body }]}
              placeholder="+ Add one-time email address"
              placeholderTextColor={theme.text.muted}
              value={inputValue}
              onChangeText={setInputValue}
              onSubmitEditing={addEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="done"
            />
            {inputValue.length > 0 && (
              <TouchableOpacity onPress={addEmail}>
                <Ionicons name="add-circle" size={22} color={theme.brand.primary} />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 20 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: '700' },
  toggleSub: { fontSize: 12, marginTop: 1 },
  toggle: { width: 42, height: 24, borderRadius: 12, justifyContent: 'center' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  divider: { height: 1, marginVertical: 12 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  emailText: { fontSize: 13, flex: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4 },
  emailInput: { flex: 1, fontSize: 13 },
});
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add components/ReminderSection.tsx
git commit -m "feat: add reusable ReminderSection component"
```

---

### Task 5: CP12 review-sign — add ReminderSection

**Files:**
- Modify: `app/(app)/cp12/review-sign.tsx`

- [ ] **Step 1: Read the current reminder section** — lines 552-596. Note that `renewalReminderEnabled` already exists in the CP12 context. The existing toggle UI will be replaced.

- [ ] **Step 2: Import ReminderSection**

```typescript
import ReminderSection from '../../../components/ReminderSection';
```

- [ ] **Step 3: Add one-time emails state**

```typescript
const [oneTimeEmails, setOneTimeEmails] = useState<string[]>([]);
```

- [ ] **Step 4: Build the saved emails array from form context values**

CP12Context exposes `tenantEmail` (and no other email fields). Build the array:

```typescript
// CP12 only has tenantEmail in context — collect and filter empty
const savedEmails = [tenantEmail].filter(Boolean) as string[];
```

Destructure `tenantEmail` from the CP12 context at the top of the component alongside the other context values.

- [ ] **Step 5: Replace the existing reminder section with ReminderSection**

Find the existing reminder toggle block (around line 552) and replace it with:

```typescript
<View style={{ marginTop: 20 }}>
  <ReminderSection
    enabled={renewalReminderEnabled}
    onToggle={setRenewalReminderEnabled}
    savedEmails={savedEmails}
    onOneTimeEmailsChange={setOneTimeEmails}
  />
</View>
```

- [ ] **Step 6: Pass one-time emails to `handleComplete`**

Find `handleComplete` (around line 306). The function builds the document payload. Add `oneTimeReminderEmails` to the top-level `payment_info` object (outside `pdfData`):

```typescript
// When building the final payload to save to Supabase, add at the top level:
const documentPayload = {
  kind: 'cp12',
  pdfData: { ...allTheExistingPdfData },
  ...(oneTimeEmails.length > 0 ? { oneTimeReminderEmails: oneTimeEmails } : {}),
};
```

Ensure this replaces wherever the document is currently saved with `payment_info`.

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 8: Commit**

```bash
git add app/\(app\)/cp12/review-sign.tsx
git commit -m "feat: add ReminderSection to CP12 review screen"
```

---

### Task 6: Service record review-sign — add ReminderSection

**Files:**
- Modify: `app/(app)/forms/service-record/review-sign.tsx`

- [ ] **Step 1: Read the current reminder section** — lines 463-481.

- [ ] **Step 2: Apply the same changes as Task 5** — same imports, same `oneTimeEmails` state, same `ReminderSection` usage, same payload update in the save function.

ServiceRecordContext has **no email fields**. Use an empty saved emails array:

```typescript
const savedEmails: string[] = [];
```

No context destructuring for emails needed in this screen.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/forms/service-record/review-sign.tsx
git commit -m "feat: add ReminderSection to service record review screen"
```

---

### Task 7: Document details — update reminder section

**Files:**
- Modify: `app/(app)/documents/[id].tsx`

- [ ] **Step 1: Read the reminder section** — around lines 1140-1160 (CP12) and 1265-1280 (service record).

- [ ] **Step 2: Import ReminderSection**

```typescript
import ReminderSection from '../../../components/ReminderSection';
```

(`documents/[id].tsx` lives at `app/(app)/documents/[id].tsx` — three levels up to reach the project root where `components/` lives.)

- [ ] **Step 3: Add one-time emails state + save handler**

`doc.payment_info` is returned by Supabase's JS client as a native JS object (JSONB columns are automatically deserialized — **do not call `JSON.parse`**). Reference it directly:

```typescript
const [oneTimeEmails, setOneTimeEmails] = useState<string[]>([]);
const [hasUnsavedEmails, setHasUnsavedEmails] = useState(false);

// Pre-fill from existing payment_info.oneTimeReminderEmails on load (if present from a previous save)
useEffect(() => {
  const payInfo = doc?.payment_info as any;
  const existing = payInfo?.oneTimeReminderEmails;
  if (Array.isArray(existing) && existing.length > 0) {
    setOneTimeEmails(existing);
  } else {
    setOneTimeEmails([]);
  }
}, [doc?.id]);

const handleSaveOneTimeEmails = async () => {
  if (!doc) return;
  // payment_info is already a JS object — no JSON.parse needed
  const currentPayInfo = (doc.payment_info ?? {}) as Record<string, unknown>;

  const updated = oneTimeEmails.length > 0
    ? { ...currentPayInfo, oneTimeReminderEmails: oneTimeEmails }
    : (() => { const p = { ...currentPayInfo }; delete p.oneTimeReminderEmails; return p; })();

  await supabase
    .from('documents')
    .update({ payment_info: updated })
    .eq('id', doc.id);
  setHasUnsavedEmails(false);
};
```

Pass `initialOneTimeEmails` to `ReminderSection` so it pre-fills on mount (Step 5 below uses this — no need for the `useEffect` above to call `setOneTimeEmails` again after the component mounts):

> **Note:** The `useEffect` above initialises local state when the `doc` loads. `ReminderSection` receives `initialOneTimeEmails` derived from the same `doc.payment_info` value so both stay in sync on first render.

- [ ] **Step 4: Build saved emails from pdfData**

```typescript
const savedEmails = [
  (payload as any)?.pdfData?.customerEmail,
  (payload as any)?.pdfData?.tenantEmail,
  (payload as any)?.pdfData?.landlordEmail,
].filter(Boolean) as string[];
```

- [ ] **Step 5: Replace the existing reminder toggle with ReminderSection + Save button**

Find the reminder toggle in both the CP12 and service record branches. Replace with:

```typescript
<ReminderSection
  enabled={!!cp12Payload?.pdfData?.renewalReminderEnabled}  // adjust for SR: !!srPayload?.pdfData?.renewalReminderEnabled
  onToggle={handleReminderToggle}
  savedEmails={savedEmails}
  initialOneTimeEmails={(doc?.payment_info as any)?.oneTimeReminderEmails ?? []}
  onOneTimeEmailsChange={(emails) => {
    setOneTimeEmails(emails);
    setHasUnsavedEmails(true);
  }}
/>
{hasUnsavedEmails && (
  <TouchableOpacity
    style={[/* existing button style */, { marginTop: -12, marginBottom: 16 }]}
    onPress={handleSaveOneTimeEmails}
  >
    <Text style={/* button text style */}>Save One-Time Emails</Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/documents/\[id\].tsx
git commit -m "feat: update document details reminder section with email display and one-time input"
```

---

## Chunk 3: Edge Function Update + Cron

### Task 8: Update send-renewal-reminders Edge Function

**Files:**
- Modify: `supabase/functions/send-renewal-reminders/index.ts`

- [ ] **Step 1: Read the full current function** to understand the query and email send loop.

- [ ] **Step 2: Update the document query to join companies**

Change the existing documents query to also fetch `company_id`, then fetch `reminder_days_before` per company:

```typescript
// After fetching documents, build a map of company_id → reminder_days_before
const companyIds = [...new Set(documents.map((d: any) => d.company_id).filter(Boolean))];
const { data: companies } = await supabaseAdmin
  .from('companies')
  .select('id, reminder_days_before')
  .in('id', companyIds);

const reminderDaysMap: Record<string, number> = {};
for (const c of companies ?? []) {
  reminderDaysMap[c.id] = c.reminder_days_before ?? 30;
}
```

- [ ] **Step 3: Change the day check from `=== 7` to `<=`**

Find the line: `if (dayDiff(today, dueDate) === REMINDER_DAYS_BEFORE)` (or similar).

Replace with:

```typescript
const reminderDays = reminderDaysMap[doc.company_id] ?? 30;
const days = dayDiff(today, dueDate);
if (days > reminderDays || days < 0) continue;  // not yet due or already past
// lastSentForDate check already handles deduplication for days < reminderDays
```

- [ ] **Step 4: Include oneTimeReminderEmails in recipients**

After building the recipient list from `pdfData`, add:

```typescript
const oneTimeEmails: string[] = Array.isArray(paymentInfo?.oneTimeReminderEmails)
  ? paymentInfo.oneTimeReminderEmails
  : [];

// Merge with existing recipients (deduplicate)
const allRecipients = [...new Set([...existingRecipients, ...oneTimeEmails])];
```

Use `allRecipients` for sending instead of `existingRecipients`.

- [ ] **Step 5: Clear oneTimeReminderEmails after successful send**

After the email send succeeds and before updating `reminderMeta`, remove the key.

`lastSentForDate` is the deduplication key and **must be `dd/MM/yyyy`** (e.g. `"31/03/2026"`) — the existing check compares against this format. If `doc.expiry_date` is stored as ISO (`2026-03-31`), reformat it:

```typescript
// Format expiry date as dd/MM/yyyy for the deduplication key
const [year, month, day] = doc.expiry_date.split('-'); // ISO: YYYY-MM-DD
const lastSentForDate = `${day}/${month}/${year}`;

// Build updated payment_info — remove oneTimeReminderEmails and update reminderMeta
const updatedPaymentInfo = {
  ...paymentInfo,
  reminderMeta: {
    lastSentAt: new Date().toISOString(),
    lastSentForDate,
  },
};
delete updatedPaymentInfo.oneTimeReminderEmails;

await supabaseAdmin
  .from('documents')
  .update({ payment_info: updatedPaymentInfo })
  .eq('id', doc.id);
```

- [ ] **Step 6: Deploy**

```bash
npx supabase functions deploy send-renewal-reminders
```

- [ ] **Step 7: Smoke test**

```bash
curl -X POST https://<project-url>.supabase.co/functions/v1/send-renewal-reminders \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `{"sent":0,"skipped":<n>,"failures":[]}` (no documents due today is fine)

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/send-renewal-reminders/
git commit -m "feat: update renewal reminders to use per-company days, oneTimeReminderEmails, and <= day check"
```

---

### Task 9: Configure daily cron in Supabase Dashboard

- [ ] **Step 1:** Open Supabase Dashboard → Edge Functions → `send-renewal-reminders`
- [ ] **Step 2:** Click the **Schedule** tab
- [ ] **Step 3:** Add cron schedule: `0 8 * * *` (8am UTC daily)
- [ ] **Step 4:** Save — the function will now run automatically every day

> No code change needed. Document this in `CLAUDE.md` under "Commands".

- [ ] **Step 5: Update CLAUDE.md**

Add under the Commands section:

```markdown
# Cron Jobs
- `send-renewal-reminders` runs daily at 8am UTC via Supabase Dashboard → Edge Functions → Schedule
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document renewal reminder cron schedule"
```

---

### Task 10: Manual test checklist

- [ ] **Settings:** Open Settings as Pro admin → only "Days before expiry" input visible, no send button, no recipient picker
- [ ] **Settings:** Change days to 14 → blur/save → reopen settings → value persists at 14
- [ ] **CP12 form:** Complete a CP12 → on last page, reminder toggle is ON by default
- [ ] **CP12 form:** Toggle shows email from the form. Add a one-time email → appears in list → can remove it
- [ ] **CP12 form:** Submit form → check document in Supabase dashboard → `payment_info.oneTimeReminderEmails` contains the added email, not inside `pdfData`
- [ ] **Document details:** Open a CP12 document → reminder section shows saved emails, toggle works, can add one-time email → "Save One-Time Emails" button appears → tap it → check Supabase, key saved
- [ ] **Edge function:** Manually invoke via curl → confirm it reads `reminder_days_before` from companies and uses `<=` logic

- [ ] **Final commit**

```bash
git add .
git commit -m "feat: complete renewal reminder UX overhaul"
```
