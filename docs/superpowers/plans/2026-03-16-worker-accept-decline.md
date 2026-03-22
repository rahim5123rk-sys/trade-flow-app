# Worker Job Accept/Decline + Dashboard Quick Actions — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Workers receive a push notification when assigned a job, tap it to open a full-screen preview, and accept or decline — declining notifies all admins. Dashboard gets two large quick-action buttons for admins.

**Architecture:** Postgres `AFTER INSERT/UPDATE` triggers call a `pg_net.http_post` to an Edge Function (`assign-job-workers`) which creates `job_acceptance` rows and sends push notifications via Expo Push API. A second Edge Function (`notify-admin-decline`) handles the decline notification with JWT auth. Client-side reconciliation on focus catches any missed trigger calls.

**Tech Stack:** Supabase (Postgres triggers, pg_net, RLS, Edge Functions), expo-notifications, React Native, Expo Router, TypeScript.

**Spec:** `docs/superpowers/specs/2026-03-16-feature-sprint-design.md` — Feature 1 + Feature 2.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `supabase/migrations/20260316300000_job_acceptance.sql` | Table, RLS, pg_net extension, triggers |
| Create | `supabase/functions/assign-job-workers/index.ts` | Handles job assignment: creates acceptance rows + sends push |
| Create | `supabase/functions/notify-admin-decline/index.ts` | Sends push to all admins when worker declines |
| Create | `components/JobAcceptModal.tsx` | Full-screen job preview with Accept/Decline |
| Modify | `src/services/notifications.ts` | Handle `job_assigned` notification type in listener |
| Modify | `app/(app)/dashboard.tsx` | Add worker pending section + admin quick action buttons |
| Modify | `app/(app)/jobs/[id]/index.tsx` | Show per-worker acceptance status pills |

---

## Chunk 1: Database Migration + Edge Functions

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260316300000_job_acceptance.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260316300000_job_acceptance.sql

-- Enable pg_net for trigger → Edge Function HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;

-- job_acceptance table
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

-- RLS
ALTER TABLE public.job_acceptance ENABLE ROW LEVEL SECURITY;

-- Workers and admins in same company can read
CREATE POLICY "read_own_company" ON public.job_acceptance
  FOR SELECT USING (
    worker_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.company_id = (
          SELECT company_id FROM profiles WHERE id = job_acceptance.worker_id LIMIT 1
        )
    )
  );

-- Workers can only update their own rows; cannot change worker_id
CREATE POLICY "worker_update_own" ON public.job_acceptance
  FOR UPDATE
  USING (worker_id = auth.uid())
  WITH CHECK (worker_id = auth.uid());

-- No INSERT policy for authenticated users — service role only (Edge Functions)

-- Trigger function: fires Edge Function on assigned_to change
CREATE OR REPLACE FUNCTION public.notify_job_assigned()
RETURNS TRIGGER AS $$
DECLARE
  old_assigned uuid[] := COALESCE(OLD.assigned_to, '{}');
  new_assigned uuid[] := COALESCE(NEW.assigned_to, '{}');
  payload jsonb;
  edge_url text;
BEGIN
  -- Only fire if assigned_to actually changed
  IF old_assigned = new_assigned THEN
    RETURN NEW;
  END IF;

  edge_url := current_setting('app.supabase_edge_url', true);
  IF edge_url IS NULL THEN
    -- Fallback: read from environment (set via Supabase Dashboard → project settings)
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'jobId',        NEW.id,
    'oldAssignedTo', old_assigned,
    'newAssignedTo', new_assigned
  );

  PERFORM net.http_post(
    url     := edge_url || '/assign-job-workers',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- AFTER UPDATE trigger (assigned_to changed)
DROP TRIGGER IF EXISTS on_job_assigned ON public.jobs;
CREATE TRIGGER on_job_assigned
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_job_assigned();

-- AFTER INSERT trigger (job created with workers already assigned)
CREATE OR REPLACE FUNCTION public.notify_job_created()
RETURNS TRIGGER AS $$
DECLARE
  edge_url text;
  payload  jsonb;
BEGIN
  IF COALESCE(array_length(NEW.assigned_to, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  edge_url := current_setting('app.supabase_edge_url', true);
  IF edge_url IS NULL THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'jobId',         NEW.id,
    'oldAssignedTo', '[]'::jsonb,
    'newAssignedTo', to_jsonb(NEW.assigned_to)
  );

  PERFORM net.http_post(
    url     := edge_url || '/assign-job-workers',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_job_created ON public.jobs;
CREATE TRIGGER on_job_created
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_job_created();
```

> **Required setup — run this in Supabase Dashboard → SQL Editor before pushing migration:**
> ```sql
> ALTER DATABASE postgres SET "app.supabase_edge_url" = 'https://<your-project-ref>.supabase.co/functions/v1';
> ALTER DATABASE postgres SET "app.service_role_key" = '<service_role_key>';
> SELECT pg_reload_conf();
> ```
> Get `<project-ref>` and `<service_role_key>` from Supabase Dashboard → Settings → API. Without this, the trigger will silently no-op — verify with `SHOW "app.supabase_edge_url";` in SQL Editor after running.

- [ ] **Step 2: Push migration**

```bash
cd /Users/raheemkhan/trade-flow-app
npx supabase db push
```

Expected: `Applying migration 20260316300000_job_acceptance.sql... done`

- [ ] **Step 3: Verify table exists in Supabase Dashboard**

Go to Supabase Dashboard → Table Editor → confirm `job_acceptance` table exists with correct columns and RLS enabled.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260316300000_job_acceptance.sql
git commit -m "feat: add job_acceptance table with RLS and assignment triggers"
```

---

### Task 2: Edge Function — assign-job-workers

**Files:**
- Create: `supabase/functions/assign-job-workers/index.ts`

- [ ] **Step 1: Create the Edge Function**

```typescript
// supabase/functions/assign-job-workers/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendPush(token: string, title: string, body: string, data: Record<string, unknown>) {
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, data, sound: 'default' }),
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { jobId, oldAssignedTo, newAssignedTo } = await req.json() as {
    jobId: string;
    oldAssignedTo: string[];
    newAssignedTo: string[];
  };

  const old = oldAssignedTo ?? [];
  const next = newAssignedTo ?? [];

  // Workers removed from job — delete their acceptance rows
  const removed = old.filter((id) => !next.includes(id));
  if (removed.length > 0) {
    await supabaseAdmin
      .from('job_acceptance')
      .delete()
      .eq('job_id', jobId)
      .in('worker_id', removed);
  }

  // Workers newly added
  const added = next.filter((id) => !old.includes(id));
  if (added.length === 0) return new Response(JSON.stringify({ notified: 0, skipped: 0 }));

  // Fetch job details for notification text
  const { data: job } = await supabaseAdmin
    .from('jobs')
    .select('title, customer_snapshot')
    .eq('id', jobId)
    .single();

  const address = (job?.customer_snapshot as any)?.address ?? 'No address';
  const title = job?.title ?? 'New Job';

  let notified = 0;
  let skipped = 0;

  for (const workerId of added) {
    // Upsert acceptance row — reset to pending on re-assignment
    await supabaseAdmin.from('job_acceptance').upsert(
      { job_id: jobId, worker_id: workerId, status: 'pending', updated_at: new Date().toISOString() },
      { onConflict: 'job_id,worker_id' }
    );

    // Fetch worker push token
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('push_token')
      .eq('id', workerId)
      .single();

    if (!profile?.push_token) { skipped++; continue; }

    await sendPush(
      profile.push_token,
      'Job Assigned',
      `${title} — ${address}`,
      { type: 'job_assigned', jobId }
    );
    notified++;
  }

  return new Response(JSON.stringify({ notified, skipped }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 2: Deploy Edge Function**

```bash
npx supabase functions deploy assign-job-workers
```

Expected: `Deployed: assign-job-workers`

- [ ] **Step 3: Smoke test via curl**

```bash
# Replace <project-url> and <service-role-key> with your values from Supabase Dashboard → Settings → API
curl -X POST https://<project-url>.supabase.co/functions/v1/assign-job-workers \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{"jobId":"00000000-0000-0000-0000-000000000000","oldAssignedTo":[],"newAssignedTo":[]}'
```

Expected: `{"notified":0,"skipped":0}` (empty arrays = no-op)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/assign-job-workers/
git commit -m "feat: add assign-job-workers edge function"
```

---

### Task 3: Edge Function — notify-admin-decline

**Files:**
- Create: `supabase/functions/notify-admin-decline/index.ts`

- [ ] **Step 1: Create the Edge Function**

```typescript
// supabase/functions/notify-admin-decline/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Validate caller JWT
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return new Response('Unauthorized', { status: 401 });

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  // Fetch caller profile
  // Read body BEFORE any other awaits — req body stream can only be read once
  const { jobId } = await req.json() as { jobId: string };

  const { data: callerProfile } = await supabaseAdmin
    .from('profiles')
    .select('company_id, display_name')
    .eq('id', user.id)
    .single();
  if (!callerProfile) return new Response('Profile not found', { status: 404 });

  // Verify job belongs to caller's company
  const { data: job } = await supabaseAdmin
    .from('jobs')
    .select('title, company_id')
    .eq('id', jobId)
    .single();

  if (!job || job.company_id !== callerProfile.company_id) {
    return new Response('Forbidden', { status: 403 });
  }

  // Notify all admins in company
  const { data: admins } = await supabaseAdmin
    .from('profiles')
    .select('push_token')
    .eq('company_id', callerProfile.company_id)
    .eq('role', 'admin');

  let notified = 0;
  for (const admin of admins ?? []) {
    if (!admin.push_token) continue;
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: admin.push_token,
        title: 'Job Declined',
        body: `${callerProfile.display_name ?? 'A worker'} declined: ${job.title}`,
        data: { type: 'job_declined', jobId },
        sound: 'default',
      }),
    });
    notified++;
  }

  return new Response(JSON.stringify({ notified }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 2: Deploy**

```bash
npx supabase functions deploy notify-admin-decline
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/notify-admin-decline/
git commit -m "feat: add notify-admin-decline edge function"
```

---

## Chunk 2: Client UI

### Task 4: JobAcceptModal component

**Files:**
- Create: `components/JobAcceptModal.tsx`

- [ ] **Step 1: Create the modal**

```typescript
// components/JobAcceptModal.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../src/config/supabase';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/ThemeContext';

interface Props {
  jobId: string | null;
  visible: boolean;
  onDismiss: () => void;
}

interface JobDetail {
  id: string;
  title: string;
  scheduled_date: number;
  estimated_duration?: string;
  notes?: string;
  customer_snapshot: {
    name?: string;
    address?: string;
    address_line_1?: string;
    city?: string;
    postal_code?: string;
  };
}

export default function JobAcceptModal({ jobId, visible, onDismiss }: Props) {
  const { theme, isDark } = useAppTheme();
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<'accept' | 'decline' | null>(null);

  useEffect(() => {
    if (visible && jobId) fetchJob();
    else setJob(null);
  }, [visible, jobId]);

  const fetchJob = async () => {
    if (!jobId) return;
    setLoading(true);
    const { data } = await supabase
      .from('jobs')
      .select('id, title, scheduled_date, estimated_duration, notes, customer_snapshot')
      .eq('id', jobId)
      .single();
    setJob(data as JobDetail);
    setLoading(false);
  };

  const handleAccept = async () => {
    if (!jobId || !userProfile) return;
    setActing('accept');
    const { error } = await supabase
      .from('job_acceptance')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('job_id', jobId)
      .eq('worker_id', userProfile.id);
    setActing(null);
    if (error) { Alert.alert('Error', 'Could not accept job. Try again.'); return; }
    onDismiss();
  };

  const handleDecline = async () => {
    if (!jobId || !userProfile) return;
    Alert.alert('Decline Job', 'Are you sure? Your admin will be notified.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setActing('decline');
          // Update acceptance row
          await supabase
            .from('job_acceptance')
            .update({ status: 'declined', updated_at: new Date().toISOString() })
            .eq('job_id', jobId)
            .eq('worker_id', userProfile.id);

          // Notify admin (best-effort — don't block UI on failure)
          try {
            const { data: { session } } = await supabase.auth.getSession();
            await fetch(
              `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/notify-admin-decline`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ jobId }),
              }
            );
          } catch (_) { /* silent */ }

          setActing(null);
          onDismiss();
        },
      },
    ]);
  };

  const formatDate = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const formatTime = (ms: number) => {
    return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const address = job
    ? [job.customer_snapshot.address_line_1, job.customer_snapshot.city, job.customer_snapshot.postal_code]
        .filter(Boolean).join(', ') || job.customer_snapshot.address || 'No address'
    : '';

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop}>
        <Animated.View
          entering={FadeInDown.duration(320).springify()}
          style={[styles.sheet, { backgroundColor: isDark ? theme.surface.elevated : '#FFFFFF', paddingBottom: insets.bottom + 16 }]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: isDark ? theme.surface.border : '#F0F0F0' }]}>
            <View style={[styles.pill, { backgroundColor: '#FF9500' + '22' }]}>
              <Text style={[styles.pillText, { color: '#FF9500' }]}>JOB ASSIGNED TO YOU</Text>
            </View>
            <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={theme.text.muted} />
            </TouchableOpacity>
          </View>

          {loading || !job ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={theme.brand.primary} />
            </View>
          ) : (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              <Text style={[styles.jobTitle, { color: theme.text.title }]}>{job.title}</Text>
              <Text style={[styles.address, { color: theme.text.muted }]}>{address}</Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={16} color={theme.brand.primary} />
                  <Text style={[styles.metaText, { color: theme.text.body }]}>{formatDate(job.scheduled_date)}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={16} color={theme.brand.primary} />
                  <Text style={[styles.metaText, { color: theme.text.body }]}>{formatTime(job.scheduled_date)}</Text>
                </View>
                {job.estimated_duration ? (
                  <View style={styles.metaItem}>
                    <Ionicons name="hourglass-outline" size={16} color={theme.brand.primary} />
                    <Text style={[styles.metaText, { color: theme.text.body }]}>{job.estimated_duration}</Text>
                  </View>
                ) : null}
              </View>

              {job.notes ? (
                <View style={[styles.notesBox, { backgroundColor: isDark ? theme.surface.base : '#F8F9FA' }]}>
                  <Text style={[styles.notesLabel, { color: theme.text.muted }]}>NOTES</Text>
                  <Text style={[styles.notesText, { color: theme.text.body }]}>{job.notes}</Text>
                </View>
              ) : null}

              {/* Actions */}
              <TouchableOpacity
                style={[styles.acceptBtn, acting === 'accept' && { opacity: 0.6 }]}
                onPress={handleAccept}
                disabled={!!acting}
              >
                {acting === 'accept' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.acceptBtnText}>Accept Job</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.declineBtn, { borderColor: isDark ? theme.surface.border : '#E5E5E5' }, acting === 'decline' && { opacity: 0.6 }]}
                onPress={handleDecline}
                disabled={!!acting}
              >
                {acting === 'decline' ? (
                  <ActivityIndicator color="#E74C3C" />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={20} color="#E74C3C" />
                    <Text style={styles.declineBtnText}>Decline Job</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  pill: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  closeBtn: { padding: 4 },
  loadingWrap: { padding: 60, alignItems: 'center' },
  body: { padding: 20 },
  jobTitle: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  address: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  metaRow: { gap: 12, marginBottom: 20 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 14 },
  notesBox: { borderRadius: 10, padding: 14, marginBottom: 24 },
  notesLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  notesText: { fontSize: 14, lineHeight: 20 },
  acceptBtn: { backgroundColor: '#2ECC71', borderRadius: 14, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  acceptBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  declineBtn: { borderRadius: 14, borderWidth: 1.5, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  declineBtnText: { color: '#E74C3C', fontSize: 17, fontWeight: '700' },
});
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/raheemkhan/trade-flow-app && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `JobAcceptModal.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/JobAcceptModal.tsx
git commit -m "feat: add JobAcceptModal component"
```

---

### Task 5: Wire up notification listener in root layout

`setupNotificationListeners` is defined in `src/services/notifications.ts` but **never called anywhere**. It needs to be wired up in the app layout.

**Files:**
- Modify: `app/(app)/_layout.tsx`

- [ ] **Step 1: Read `app/(app)/_layout.tsx`** — confirm import section at the top.

- [ ] **Step 2: Add imports**

```typescript
import {useEffect} from 'react';  // already imported
import {setupNotificationListeners} from '../../src/services/notifications';
```

- [ ] **Step 3: Add listener setup inside `AppLayout` component**

Add after existing `useEffect` hooks:

```typescript
useEffect(() => {
  const cleanup = setupNotificationListeners((data) => {
    if (data.type === 'job_assigned' && data.jobId) {
      router.push(`/(app)/jobs/${data.jobId}?showAcceptModal=true` as any);
    }
    // existing job_reminder type is handled by scheduleJobReminders separately
  });
  return cleanup;
}, []);
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/_layout.tsx
git commit -m "feat: wire up notification listener for job_assigned taps"
```

---

### Task 6: Job detail screen — accept/decline modal + status pills

**Files:**
- Modify: `app/(app)/jobs/[id]/index.tsx`

- [ ] **Step 1: Add `showAcceptModal` param and state at top of component**

Add to the existing `useLocalSearchParams` call:

```typescript
const { id, from, workerId, showAcceptModal: showAcceptParam } = useLocalSearchParams<{
  id: string;
  from?: string;
  workerId?: string;
  showAcceptModal?: string;
}>();
```

Add state:

```typescript
const [acceptModalVisible, setAcceptModalVisible] = useState(showAcceptParam === 'true');
const [acceptanceStatuses, setAcceptanceStatuses] = useState<Record<string, string>>({});
```

- [ ] **Step 2: Fetch acceptance statuses when job loads (admin only)**

In the existing `useEffect` that fetches the job, after the job is loaded, add for admins:

```typescript
if (role === 'admin' && jobData?.assigned_to?.length > 0) {
  const { data: acceptances } = await supabase
    .from('job_acceptance')
    .select('worker_id, status')
    .eq('job_id', id);
  const map: Record<string, string> = {};
  for (const row of acceptances ?? []) map[row.worker_id] = row.status;
  setAcceptanceStatuses(map);
}
```

- [ ] **Step 3: Add status pill helper and render pills next to worker names**

Add helper function before the component return:

```typescript
function AcceptancePill({ status }: { status?: string }) {
  const config = {
    accepted:  { label: 'Accepted',  bg: '#1C3A2A', color: '#2ECC71' },
    declined:  { label: 'Declined',  bg: '#3A1C1C', color: '#E74C3C' },
    pending:   { label: 'Awaiting',  bg: '#3A2E1C', color: '#FF9500' },
  }[status ?? 'pending'] ?? { label: 'Awaiting', bg: '#3A2E1C', color: '#FF9500' };

  return (
    <View style={{ backgroundColor: config.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 }}>
      <Text style={{ color: config.color, fontSize: 11, fontWeight: '700' }}>{config.label}</Text>
    </View>
  );
}
```

Find where assigned workers are rendered in the job detail and add the pill next to each name:

```typescript
// Existing pattern (adapt to actual code):
<View style={{ flexDirection: 'row', alignItems: 'center' }}>
  <Text>{workerName}</Text>
  {isAdmin && <AcceptancePill status={acceptanceStatuses[workerId]} />}
</View>
```

- [ ] **Step 4: Mount JobAcceptModal at the bottom of the return**

Import `JobAcceptModal` at the top of the file:

```typescript
import JobAcceptModal from '../../../components/JobAcceptModal';
```

Add at the bottom of the JSX (before the final closing tag):

```typescript
<JobAcceptModal
  jobId={id}
  visible={acceptModalVisible}
  onDismiss={() => setAcceptModalVisible(false)}
/>
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/jobs/\[id\]/index.tsx components/JobAcceptModal.tsx
git commit -m "feat: add job acceptance status pills and modal to job detail"
```

---

### Task 7: Worker dashboard — pending jobs section + reconciliation

**Files:**
- Modify: `app/(app)/dashboard.tsx`

- [ ] **Step 1: Add pending jobs query to the existing data fetch**

Find the main `useFocusEffect` / `useCallback` data fetching block. Add a pending jobs query for workers:

```typescript
// Inside the fetch function, after existing queries:
let pendingJobs: { jobId: string; jobTitle: string; address: string }[] = [];

if (role === 'worker' && userProfile?.id) {
  // Fetch pending acceptance rows
  const { data: pendingRows } = await supabase
    .from('job_acceptance')
    .select('job_id, jobs(id, title, customer_snapshot)')
    .eq('worker_id', userProfile.id)
    .eq('status', 'pending');

  pendingJobs = (pendingRows ?? []).map((row: any) => ({
    jobId: row.job_id,
    jobTitle: row.jobs?.title ?? 'Job',
    address: (row.jobs?.customer_snapshot as any)?.address_line_1 ?? '',
  }));

  // Reconciliation: find jobs assigned to this worker with no acceptance row
  const { data: assignedJobs } = await supabase
    .from('jobs')
    .select('id, title, customer_snapshot')
    .contains('assigned_to', [userProfile.id])
    // Supabase .not('id', 'in', ...) expects bare UUID list without inner quotes
    .not('id', 'in', `(${pendingRows?.map((r: any) => r.job_id).join(',') || '00000000-0000-0000-0000-000000000000'})`);

  // Filter out jobs already accepted/declined
  const { data: allAcceptances } = await supabase
    .from('job_acceptance')
    .select('job_id')
    .eq('worker_id', userProfile.id);

  const acceptedJobIds = new Set((allAcceptances ?? []).map((r: any) => r.job_id));
  const gaps = (assignedJobs ?? []).filter((j: any) => !acceptedJobIds.has(j.id));

  // Create missing acceptance rows
  if (gaps.length > 0) {
    await supabase.from('job_acceptance').upsert(
      gaps.map((j: any) => ({ job_id: j.id, worker_id: userProfile.id, status: 'pending' })),
      { onConflict: 'job_id,worker_id', ignoreDuplicates: true }
    );
    // Add to pending list
    for (const j of gaps) {
      pendingJobs.push({
        jobId: j.id,
        jobTitle: j.title,
        address: (j.customer_snapshot as any)?.address_line_1 ?? '',
      });
    }
  }
}
```

Add `pendingJobs` to the returned stats object.

- [ ] **Step 2: Add pending jobs section to worker dashboard JSX**

Add state for the accept modal:

```typescript
const [acceptJobId, setAcceptJobId] = useState<string | null>(null);
```

In the JSX, add a section for workers above Today's Schedule:

```typescript
{role === 'worker' && stats.pendingJobs?.length > 0 && (
  <Animated.View entering={FadeInDown.delay(100).duration(400)}>
    <View style={s.sectionHeaderRow}>
      <Text style={[s.sectionLabel, { color: theme.text.title }]}>Needs Your Response</Text>
      <View style={[s.countBadge, { backgroundColor: '#FF9500' + '22' }]}>
        <Text style={[s.countText, { color: '#FF9500' }]}>{stats.pendingJobs.length}</Text>
      </View>
    </View>
    {stats.pendingJobs.map((item: any) => (
      <TouchableOpacity
        key={item.jobId}
        onPress={() => setAcceptJobId(item.jobId)}
        style={[s.pendingJobCard, { backgroundColor: isDark ? theme.glass.bg : '#FFF7ED', borderColor: '#FF9500' }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[s.pendingJobTitle, { color: theme.text.title }]}>{item.jobTitle}</Text>
          {item.address ? <Text style={[s.pendingJobAddress, { color: theme.text.muted }]}>{item.address}</Text> : null}
        </View>
        <View style={[s.pendingBadge]}>
          <Text style={s.pendingBadgeText}>Respond</Text>
        </View>
      </TouchableOpacity>
    ))}
  </Animated.View>
)}
```

Add styles:

```typescript
pendingJobCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, padding: 14, marginBottom: 8 },
pendingJobTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
pendingJobAddress: { fontSize: 12 },
pendingBadge: { backgroundColor: '#FF9500', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
pendingBadgeText: { color: '#000', fontSize: 12, fontWeight: '800' },
```

- [ ] **Step 3: Mount JobAcceptModal**

Import and add at bottom of dashboard JSX:

```typescript
import JobAcceptModal from '../../components/JobAcceptModal';

// In JSX:
<JobAcceptModal
  jobId={acceptJobId}
  visible={!!acceptJobId}
  onDismiss={() => setAcceptJobId(null)}
/>
```

- [ ] **Step 4: Add admin quick action buttons**

Find the section after Today's Schedule jobs list (around line 833). Add after the jobs list, before the renewals section:

```typescript
{isAdmin && (
  <Animated.View entering={FadeInDown.delay(420).duration(400)} style={s.quickActionsRow}>
    <TouchableOpacity
      style={[s.quickActionCard, { backgroundColor: isDark ? theme.glass.bg : '#FFFFFF', borderColor: isDark ? theme.glass.border : 'rgba(0,0,0,0.06)' }]}
      onPress={() => router.push('/(app)/cp12' as any)}
      activeOpacity={0.85}
    >
      <View style={[s.quickActionIcon, { backgroundColor: theme.brand.primary + '18' }]}>
        <Ionicons name="document-text-outline" size={26} color={theme.brand.primary} />
      </View>
      <Text style={[s.quickActionLabel, { color: theme.text.title }]}>New Gas{'\n'}Certificate</Text>
      <Text style={[s.quickActionSub, { color: theme.text.muted }]}>CP12</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[s.quickActionCard, { backgroundColor: isDark ? theme.glass.bg : '#FFFFFF', borderColor: isDark ? theme.glass.border : 'rgba(0,0,0,0.06)' }]}
      onPress={() => router.push('/(app)/jobs/create' as any)}
      activeOpacity={0.85}
    >
      <View style={[s.quickActionIcon, { backgroundColor: theme.brand.primary + '18' }]}>
        <Ionicons name="briefcase-outline" size={26} color={theme.brand.primary} />
      </View>
      <Text style={[s.quickActionLabel, { color: theme.text.title }]}>Create{'\n'}New Job</Text>
      <Text style={[s.quickActionSub, { color: theme.text.muted }]}>Track & assign</Text>
    </TouchableOpacity>
  </Animated.View>
)}
```

Add styles:

```typescript
quickActionsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
quickActionCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 16, alignItems: 'flex-start', gap: 8 },
quickActionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
quickActionLabel: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
quickActionSub: { fontSize: 11 },
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/dashboard.tsx
git commit -m "feat: add worker pending jobs section and admin quick action buttons to dashboard"
```

---

### Task 8: Manual test checklist

- [ ] **As admin:** Create a job and assign it to a worker → worker should receive push notification
- [ ] **As worker:** Tap notification → `JobAcceptModal` opens with correct job details
- [ ] **As worker:** Tap Accept → modal closes, job no longer appears in "Needs Your Response"
- [ ] **As worker:** Open a different pending job → tap Decline → confirm dialog appears → admin receives push notification
- [ ] **As admin:** Open declined job detail → worker shows "Declined" red pill
- [ ] **As admin:** Tap "New Gas Certificate" quick action button → navigates to CP12 form
- [ ] **As admin:** Tap "Create New Job" quick action button → navigates to job creation
- [ ] **Kill app + reopen as worker with pending jobs** → "Needs Your Response" section appears (reconciliation)

- [ ] **Final commit**

```bash
git add .
git commit -m "feat: complete worker accept/decline and dashboard quick actions"
```
