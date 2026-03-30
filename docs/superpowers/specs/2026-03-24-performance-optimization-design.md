# Performance Optimization for 1000+ Users

**Date:** 2026-03-24
**Status:** Proposed

## Problem

As GasPilot scales to 1000+ users, several compounding issues degrade performance:

- Unbounded database fetches load thousands of records into mobile memory
- Missing indexes cause full table scans on every query and RLS check
- Client-side filtering burns CPU on large in-memory datasets
- Edge functions fetch entire tables without pagination
- Dashboard and list screens have no error recovery for slow/failed fetches

## Approach: Hybrid Pagination + Server-Side Search

Load first 50 records for immediate display. When the user types a search query (debounced 300ms), switch to a server-side `.ilike()` query. When the search term is empty or whitespace-only, revert to the first page of paginated results (offset reset to 0, hasMore recalculated). Explicit "Load more" button (not infinite scroll) appends the next page.

## 1. Database Indexes

One migration file. All indexes created `CONCURRENTLY` to avoid table locks.

| Index | Columns | Rationale |
|-------|---------|-----------|
| `idx_jobs_company_status` | `(company_id, status)` | Jobs list + calendar filter by company + exclude cancelled |
| `idx_jobs_company_scheduled` | `(company_id, scheduled_date)` | Dashboard + calendar sort by date |
| `idx_documents_company_type` | `(company_id, type)` | Documents hub filters by type |
| `idx_documents_company_created` | `(company_id, created_at DESC)` | Documents list default sort |
| `idx_documents_company_expiry` | `(company_id, expiry_date)` | Dashboard renewal reminders |
| `idx_customers_company_name` | `(company_id, name)` | Customer list sorted by name |
| `idx_notes_user_archived` | `(user_id, is_archived)` | Notes query filters on both |
| `idx_profiles_company_role` | `(company_id, role)` | Worker/team queries + edge functions |

## 2. Paginated List Hooks

### 2.1 Pattern (shared across all three hooks)

```
Page size: 50
Initial load: first 50, ordered by created_at DESC (or scheduled_date for jobs)
Load more: append next 50 via .range(offset, offset + 49)
Search: debounce 300ms, fire server-side .ilike() query, replace displayed data
Clear search (empty/whitespace): reset offset to 0, re-fetch first page of paginated results
Expose: { data, loading, refreshing, hasMore, loadMore(), refresh(), search(term) }
Refresh: hooks expose refresh(). Screens call it via useFocusEffect(useCallback(() => { refresh(); }, [refresh]))
```

### 2.2 useJobs.ts

- Add `.range()` pagination with page size 50
- Expose `loadMore()` and `hasMore`
- Search: chain `.or()` with PostgREST filter syntax: `.or(`title.ilike.%${term}%,reference.ilike.%${term}%`)`
- Trimmed select: `id, title, reference, status, scheduled_date, customer_snapshot, assigned_to, company_id`

### 2.3 useCustomers.ts

- Same pagination pattern
- Search: `.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)`
- Trimmed select: `id, name, email, phone, address_line_1, city, postal_code, company_id, created_at`

### 2.4 New useDocuments.ts hook

Extract the inline query from `documents/index.tsx` into a dedicated hook.

- Server-side filtering by `type` via `.eq('type', filter)` and `status` via `.eq('status', filter)` instead of client-side `useMemo`
- Search: `.ilike('reference', '%term%')` server-side
- Trimmed select: `id, type, status, reference, created_at, expiry_date, customer_snapshot, company_id, user_id` — explicitly skip `payment_info` (large JSON blobs). Note: customer name is accessed via `customer_snapshot.name`, not a direct column.
- Pagination: same `.range()` pattern, page size 50

### 2.5 Calendar (calendar.tsx)

Different approach — no pagination, but date-bounded:

- Fetch only jobs within the visible month range: `.gte('scheduled_date', monthStart).lte('scheduled_date', monthEnd)`
- When user swipes to a new month, fetch that month's data
- Cache fetched months in a `useRef<Record<string, Job[]>>({})` keyed by `YYYY-MM`. Populated on mount for current month and on each month navigation. Cleared on pull-to-refresh.
- Trimmed select: `id, title, status, scheduled_date, customer_snapshot, assigned_to`

### 2.6 Not changing

- `useWorkers.ts` — teams are typically < 20 people
- `useNotes.ts` — notes per user typically < 100
- Job detail / document detail screens — single-record fetches, already bounded

## 3. Select Column Optimization

Replace `select('*')` with explicit columns on list screens:

| Screen | Current | Optimized |
|--------|---------|-----------|
| Jobs list | `select('*')` | `select('id, title, reference, status, scheduled_date, customer_snapshot, assigned_to, company_id')` |
| Documents list | `select('*')` | `select('id, type, status, reference, created_at, expiry_date, customer_snapshot, company_id, user_id')` |
| Dashboard jobs | `select('*')` | Same as jobs list |
| Dashboard docs | `select('*')` | Same as documents list, keep `.limit(24)` |
| Customers list | `select('*')` | `select('id, name, email, phone, address_line_1, city, postal_code, company_id, created_at')` |

Detail screens keep `select('*')` — they display all fields.

## 4. Edge Function Batching

### send-renewal-reminders

Currently fetches ALL documents with expiry dates globally. Change to batch processing:

```
let offset = 0;
const BATCH_SIZE = 500;
while (true) {
  const { data } = await supabase.from('documents')
    .select(...)
    .range(offset, offset + BATCH_SIZE - 1);
  if (!data || data.length === 0) break;
  // process batch (check dates, send emails)
  if (data.length < BATCH_SIZE) break;
  offset += BATCH_SIZE;
}
```

### notify-admin-decline

No change needed — fetching admin push tokens per company is naturally bounded (few admins per company).

## 5. Dashboard Fetch Hardening

Already partially done (try-catch-finally + 10s safety timeout). Dashboard uses direct inline queries (not the paginated hooks) since it's a summary view with fixed limits.

Additional changes:

- Jobs query: add `.limit(50)` — dashboard only shows next 3 upcoming jobs, 50 is enough headroom for filtering
- Jobs query: use trimmed select columns
- Documents query: use trimmed select columns (already has `.limit(24)`)

## 6. UI Changes

### Load More Button

At the bottom of Jobs, Documents, and Customers FlatLists:

```
When hasMore is true:
  Show TouchableOpacity: "Load more" with down-arrow icon
  On press: call loadMore(), show ActivityIndicator while loading
When hasMore is false and data.length > 0:
  Show subtle "All records loaded" text
```

Style: matches existing app design — `UI.surface.primaryLight` background, `UI.brand.primary` text, rounded corners.

### Search Behavior Change

Current: instant client-side filter
New: 300ms debounce, then server query with loading indicator

The user sees results appear slightly later (~300ms + network) but search is accurate across ALL data, not just loaded records. A small inline ActivityIndicator appears next to the search field while the query is in flight.

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/2026032400000_add_performance_indexes.sql` | New: compound indexes |
| `hooks/useJobs.ts` | Pagination, server-side search, trimmed select |
| `hooks/useCustomers.ts` | Pagination, server-side search, trimmed select |
| `hooks/useDocuments.ts` | New: extracted from documents/index.tsx |
| `app/(app)/(tabs)/documents/index.tsx` | Use new useDocuments hook, remove client-side filtering |
| `app/(app)/(tabs)/jobs/index.tsx` | Use updated useJobs, add load-more UI |
| `app/(app)/customers/index.tsx` | Use updated useCustomers, add load-more UI |
| `app/(app)/(tabs)/calendar.tsx` | Date-bounded fetching per visible month |
| `app/(app)/(tabs)/dashboard.tsx` | Trimmed select, limit on jobs query |
| `supabase/functions/send-renewal-reminders/index.ts` | Batch processing loop |

## Out of Scope

- Full-text search (pg_trgm / tsvector) — `.ilike()` is sufficient at 1000-user scale
- Infinite scroll — explicit "Load more" is simpler and more predictable
- Offline-first / local caching — separate initiative
- Real-time subscriptions — already properly implemented and filtered
