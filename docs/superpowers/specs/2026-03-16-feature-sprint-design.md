# Feature Sprint Design — 2026-03-16

## Features in Scope

1. Worker Job Accept/Decline + Push Notifications
2. Dashboard Quick Action Buttons
3. Renewal Reminder UX Overhaul

---

## 1. Worker Job Accept/Decline + Push Notifications

### Overview
When an admin assigns a job to a worker, the worker receives a push notification. Tapping it opens a full-screen job preview modal where they can accept or decline. Each worker responds independently. Declining notifies the admin. All side-effects are server-side to ensure reliability.

### `jobs.assigned_to`
`assigned_to` is a `uuid[]` (Postgres array) column on the `jobs` table. Already exists in the codebase.

### Database — `job_acceptance` table

```sql
CREATE TABLE public.job_acceptance (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id, worker_id)
);
```

### RLS Policies for `job_acceptance`

```sql
ALTER TABLE public.job_acceptance ENABLE ROW LEVEL SECURITY;

-- No INSERT policy for authenticated users — inserts are done exclusively
-- by the assign-job-workers Edge Function using the service role key,
-- which bypasses RLS. Direct client inserts are blocked.

-- Workers can read their own rows; admins in the same company can read all rows
CREATE POLICY "worker_read_own" ON public.job_acceptance
  FOR SELECT USING (
    worker_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
        AND company_id = (SELECT company_id FROM profiles WHERE id = job_acceptance.worker_id)
    )
  );

-- Workers can update only their own rows (accept/decline)
-- WITH CHECK prevents a worker from changing worker_id to another user's UUID
CREATE POLICY "worker_update_own" ON public.job_acceptance
  FOR UPDATE
  USING (worker_id = auth.uid())
  WITH CHECK (worker_id = auth.uid());

-- Note on accept/decline security: RLS USING filters which rows are visible for
-- UPDATE. A worker can only UPDATE a row where worker_id = their uid — so they
-- cannot update a job_acceptance row for a job they were never assigned to.
-- The INSERT is done server-side (service role), so the row only exists if
-- the worker was genuinely assigned. This is the intended guard.
```

### Server-Side Trigger — Job Assigned Edge Function

**Why server-side:** Client-side detection of `assigned_to` changes is unreliable (app offline, crash, no guarantee of atomicity). A Postgres trigger fires on every `jobs` UPDATE reliably.

**pg_net must be enabled** (add to migration):
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

**Delivery guarantee and fallback:** `pg_net.http_post` is best-effort — if the Edge Function call is dropped (transient network, project paused), `job_acceptance` rows may not be created and push may not fire. Compensating fallback: on app foreground and on jobs screen focus, the client runs a reconciliation query:
```sql
SELECT id FROM jobs
WHERE assigned_to @> ARRAY[auth.uid()]
  AND id NOT IN (SELECT job_id FROM job_acceptance WHERE worker_id = auth.uid())
```
For any gap rows found, the client creates the missing `job_acceptance` rows client-side (status: `pending`) and renders them in the pending section. Push notification is not retried (missed push is acceptable; the pending section surfacing the job on next app open is the fallback UX).

**Postgres triggers:**
- `on_job_assigned` — `AFTER UPDATE` on `jobs` when `assigned_to` changes, calls `assign-job-workers` via `pg_net.http_post` with `{ jobId, oldAssignedTo, newAssignedTo }`
- `on_job_created` — `AFTER INSERT` on `jobs`, calls same function with `{ jobId, oldAssignedTo: [], newAssignedTo: NEW.assigned_to }` (empty array for old, so all assigned workers are treated as newly added)

**Edge Function** `supabase/functions/assign-job-workers/index.ts`:
1. Receives `{ jobId: string, oldAssignedTo: string[], newAssignedTo: string[] }`. `oldAssignedTo` defaults to `[]` if absent/null — handles the INSERT case safely.
2. Computes newly added: `newAssignedTo.filter(id => !(oldAssignedTo ?? []).includes(id))`
3. Deletes `job_acceptance` rows for workers in `oldAssignedTo` but not in `newAssignedTo`. **Stale row window** of <1s is acceptable; ghost rows in admin UI if Edge Function fails are harmless (de-assigned workers won't see the job in their pending list since `assigned_to` no longer includes them). No retry needed.
4. For each newly added worker:
   - Upserts `job_acceptance`: `INSERT ... ON CONFLICT (job_id, worker_id) DO UPDATE SET status = 'pending', updated_at = now()` — re-assignment resets prior response
   - Fetches worker's `push_token` from `profiles`; if null → skips silently
   - If non-null: sends push with payload `{ type: 'job_assigned', jobId, title, address, scheduledDate }`
5. Returns `{ notified: number, skipped: number }`

**Edge Function** `supabase/functions/notify-admin-decline/index.ts`:
- **Request payload:** `{ jobId: string }` with worker's JWT in `Authorization: Bearer <token>` header
- **Step 1:** Call `supabase.auth.getUser(token)` — reject with 401 if invalid
- **Step 2:** Fetch caller's `profiles` row to get `company_id` and `full_name`
- **Step 3:** Fetch `jobs` row for `jobId` — reject with 403 if `company_id` doesn't match caller's
- **Step 4:** Fetch all `profiles WHERE company_id = X AND role = 'admin'`; for each, if `push_token` non-null → send push `"{full_name} declined: {job.title}"`; if null → skip
- **Step 5:** Return `{ notified: number }`
- **Client behaviour on failure:** modal still dismisses (the decline row has already been written); push failure is non-blocking and logged client-side

### Full-Screen Job Preview Modal — `components/JobAcceptModal.tsx`

Props: `{ jobId: string; visible: boolean; onDismiss: () => void }`

- Fetches job details + `job_acceptance` row for current user on mount
- Shows: job title, customer address, date/time, estimated duration, notes
- Two buttons: **Accept** (green) / **Decline** (red)
- **Accept**: UPDATEs `job_acceptance.status = 'accepted'`, dismisses modal
- **Decline**: UPDATEs `job_acceptance.status = 'declined'`, then calls Edge Function `notify-admin-decline` with the worker's JWT in the `Authorization` header. The Edge Function:
  - Validates the JWT via `supabase.auth.getUser()` — rejects if invalid or if caller's `company_id` doesn't match the job's company (prevents cross-company token enumeration)
  - Fetches **all** admin profiles in the same company (`WHERE company_id = X AND role = 'admin'`) — notifies every admin (loop)
  - For each admin: if `push_token` non-null → sends push `"{worker name} declined: {job title}"`; if null → skips silently
- Modal opened from notification tap via `setupNotificationListeners` (data payload contains `jobId`)
- Also openable from worker dashboard pending section

### Notification Listener — existing `src/services/notifications.ts`
Update `setupNotificationListeners` to handle `type: 'job_assigned'` — navigate to `/(app)/jobs/[id]` with a param that triggers `JobAcceptModal` to open automatically.

### Admin Job Detail View
- Fetch `job_acceptance` rows for the job joined with worker `profiles`
- Render a status pill next to each worker name:
  - `pending` → amber "Awaiting"
  - `accepted` → green "Accepted"
  - `declined` → red "Declined"

### Worker Dashboard — Pending Section
- New section at top of worker dashboard when `job_acceptance` has `pending` rows for current user
- Query: `SELECT * FROM job_acceptance WHERE worker_id = auth.uid() AND status = 'pending'`
- Tapping a row opens `JobAcceptModal` for that job
- Section hidden when count = 0

---

## 2. Dashboard Quick Action Buttons

### Overview
Two large side-by-side action buttons added to the admin dashboard, below Today's Schedule and above Upcoming Renewals.

### Buttons
| Button | Icon | Route |
|--------|------|-------|
| New Gas Certificate | `document-text-outline` | `/(app)/cp12` |
| Create New Job | `briefcase-outline` | `/(app)/jobs/create` |

### Design
- Two equal-width cards in a row, matching existing `GlassCard` styling
- Large icon (28px) + bold label below
- Gradient tones using `theme.brand.primary`
- Admin-only (workers have different quick actions already)

---

## 3. Renewal Reminder UX Overhaul

### Overview
Settings becomes config-only. Forms and document details handle per-document reminder setup with email visibility and one-time additions.

### `payment_info` field
Already a JSONB column on `documents`. Its structure is:

```json
{
  "kind": "cp12",
  "pdfData": { "renewalReminderEnabled": true, "customerEmail": "...", ... },
  "reminderMeta": { "lastSentAt": "...", "lastSentForDate": "dd/MM/yyyy" },
  "oneTimeReminderEmails": ["extra@example.com"]
}
```

`oneTimeReminderEmails` lives at the **top level** of `payment_info`, outside `pdfData`. This is how the form submission code must write it (add it to the `payment_info` object before saving, not inside `pdfData`). The Edge Function reads it directly from the already-deserialised `payment_info` object returned by Supabase's JS client — it is already a native JS array, no `JSON.parse` needed. Access as `paymentInfo.oneTimeReminderEmails ?? []`. It removes it after sending with a Postgres JSONB update: `payment_info - 'oneTimeReminderEmails'`.

`reminderMeta.lastSentForDate` is the existing deduplication key (stored at `payment_info -> 'reminderMeta' ->> 'lastSentForDate'`, format `dd/MM/yyyy`). The Edge Function updates both `oneTimeReminderEmails` removal and `reminderMeta` in a single `UPDATE documents SET payment_info = ...` call to keep them atomic.

### `companies` table — new column
```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS reminder_days_before integer NOT NULL DEFAULT 30;
```

**RLS for this column:** The `companies` table already has RLS. The existing policy allows admins to UPDATE their own company row (`WHERE id = auth.uid()'s company_id AND role = 'admin'`). No new policy is needed — workers cannot update `companies` rows under existing RLS, so `reminder_days_before` is automatically admin-write-only. The Settings screen is already Pro-gated; all admins of the same company share one value.

### Settings (Pro only) — simplified
**Remove:** "Send Due Reminders Now" button, recipient picker
**Keep:** Single numeric input "Send reminders X days before expiry" → saves to `companies.reminder_days_before`

### Form Last Page — CP12 & Service Record Only
Both review/sign screens get a **Reminder** section above the sign button:

```
┌──────────────────────────────────────────┐
│ 🔔 Renewal Reminder               [ON ●] │
│ We'll email 30 days before expiry        │
│                                          │
│ 📧 john@tenant.com                       │
│ 📧 landlord@property.co.uk               │
│ + Add one-time email address             │
└──────────────────────────────────────────┘
```

- Toggle defaults to **ON** (reads from existing `renewalReminderEnabled` in form context)
- "30 days" text comes from `reminder_days_before`. This value is fetched once in `AuthContext` alongside the existing `userProfile` load: after fetching `profiles`, also fetch `companies WHERE id = userProfile.company_id` and expose `companyProfile` (or at minimum `reminderDaysBefore`) on the auth context. This avoids per-screen fetches and keeps it in sync.
- Emails shown: all non-empty email fields in the current form (customerEmail, landlordEmail, tenantEmail)
- "+ Add one-time email": inline `TextInput`, supports adding multiple. Stored in local component state only — **never written to Supabase directly from this input**
- On form submission: one-time emails are included in the document's `payment_info.oneTimeReminderEmails` array alongside the rest of the form data

### Document Details — Reminder Section
Same visual layout as form. Behaviour differences:

- Toggle reads/writes `payment_info -> 'pdfData' ->> 'renewalReminderEnabled'` via Supabase UPDATE (existing behaviour, unchanged). This is consistent with how the form context serialises the toggle — it lives inside `pdfData`, not at the top level of `payment_info`.
- Emails displayed from `pdfData` (read-only, reflects what was saved at form time)
- "+ Add one-time email": adds to local state. A **"Save"** button appears when one-time emails are present. Pressing Save writes `payment_info.oneTimeReminderEmails` to Supabase. Without pressing Save, nothing is persisted — this prevents accidental phantom sends.
- If `oneTimeReminderEmails` already exists in the document (from a previous save), it is shown pre-filled so the user can edit/clear before the next cron run

### Automated Sending — Edge Function Update
`send-renewal-reminders` needs two changes:

1. **Read `reminder_days_before` per company** instead of hardcoded 7:
   - Join documents → companies to get `reminder_days_before`
   - Send when `daysUntilExpiry <= company.reminder_days_before` (less-than-or-equal, not strict equality)
   - The existing `lastSentForDate` deduplication guard prevents re-sending on subsequent days — `<=` ensures a missed cron day is recovered on the next run

2. **Include + clear `oneTimeReminderEmails`** atomically:
   - Merge `oneTimeReminderEmails` into the recipient list for that send
   - After successful send: UPDATE document SET `payment_info = payment_info - 'oneTimeReminderEmails'` (removes the key)
   - If the send fails: do not clear — emails remain for the next run (idempotency via existing `lastSentForDate` check prevents double-send on success)

### Cron Job — Supabase Dashboard Schedule (mandatory approach)

Use Supabase Dashboard → Edge Functions → `send-renewal-reminders` → **Schedule** tab. Set cron expression `0 8 * * *` (8am UTC daily). No migration required, no secrets in SQL.

This is the only approach used. pg_cron SQL alternatives are explicitly excluded — they require service role keys embedded in migration files which is a security risk.

---

## Out of Scope (This Sprint)
- Revenue analytics screen
- Customer-facing certificate portal
- Recurring jobs
- Worker seat consumable IAP fix
