# Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate unbounded database fetches, add missing indexes, implement server-side pagination + search, and batch edge function processing so GasPilot scales to 1000+ users.

**Architecture:** Add compound indexes on all foreign-key + filter columns. Replace `select('*')` with trimmed column lists on list screens. Convert `useJobs`, `useCustomers`, and the documents screen to paginated hooks with debounced server-side search. Bound calendar fetches to the visible month. Batch the renewal-reminders edge function.

**Tech Stack:** Supabase (PostgreSQL), React Native, Expo Router, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-24-performance-optimization-design.md`

---

## Chunk 1: Database Indexes + Dashboard Hardening

### Task 1: Add compound database indexes

**Files:**
- Create: `supabase/migrations/20260324000000_add_performance_indexes.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Performance indexes for scaling to 1000+ users
-- All created CONCURRENTLY to avoid table locks during deployment

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_company_status
  ON public.jobs (company_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_company_scheduled
  ON public.jobs (company_id, scheduled_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_company_type
  ON public.documents (company_id, type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_company_created
  ON public.documents (company_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_company_expiry
  ON public.documents (company_id, expiry_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_company_name
  ON public.customers (company_id, name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notes_user_archived
  ON public.notes (user_id, is_archived);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_company_role
  ON public.profiles (company_id, role);
```

- [ ] **Step 2: Verify migration syntax**

Run: `cat supabase/migrations/20260324000000_add_performance_indexes.sql`
Expected: 8 `CREATE INDEX CONCURRENTLY` statements, no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260324000000_add_performance_indexes.sql
git commit -m "feat: add compound indexes for jobs, documents, customers, notes, profiles"
```

---

### Task 2: Harden dashboard queries with limits and trimmed selects

**Files:**
- Modify: `app/(app)/(tabs)/dashboard.tsx`

The dashboard fetches all company jobs with `select('*')` and no limit. It only displays 3 upcoming jobs, so this is wasteful. The documents query already has `.limit(24)` but still uses `select('*')`.

- [ ] **Step 1: Trim the jobs query select and add limit**

In `fetchDashboardData()`, find the jobs query (around line 563):

```typescript
// BEFORE:
let query = supabase
  .from('jobs')
  .select('*')
  .eq('company_id', userProfile.company_id)
  .neq('status', 'cancelled')
  .order('scheduled_date', {ascending: true});
```

Replace with:

```typescript
// AFTER:
let query = supabase
  .from('jobs')
  .select('id, title, reference, status, scheduled_date, customer_snapshot, assigned_to, company_id')
  .eq('company_id', userProfile.company_id)
  .neq('status', 'cancelled')
  .order('scheduled_date', {ascending: true})
  .limit(50);
```

- [ ] **Step 2: Trim the documents query select**

Find the documents query (around line 574):

```typescript
// BEFORE:
const documentsQuery = supabase
  .from('documents')
  .select('*')
  .eq('company_id', userProfile.company_id)
  .not('expiry_date', 'is', null)
  .order('expiry_date', {ascending: true})
  .limit(24);
```

Replace with:

```typescript
// AFTER:
const documentsQuery = supabase
  .from('documents')
  .select('id, type, status, reference, created_at, expiry_date, customer_snapshot, company_id, user_id')
  .eq('company_id', userProfile.company_id)
  .not('expiry_date', 'is', null)
  .order('expiry_date', {ascending: true})
  .limit(24);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | grep -v 'supabase/functions'`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/(tabs)/dashboard.tsx
git commit -m "perf: trim dashboard selects and limit jobs query to 50"
```

---

## Chunk 2: Paginated useJobs Hook + Jobs Screen

### Task 3: Rewrite useJobs with pagination and server-side search

**Files:**
- Modify: `hooks/useJobs.ts`

The current `useJobs` hook fetches ALL jobs with `select('*')`, stores them in state, and filters client-side. Rewrite to use `.range()` pagination and server-side `.or()` search.

Important: The hook also exports `useCreateJob` and `useUpdateJobStatus` — do NOT touch those. Only modify the `useJobs` function.

- [ ] **Step 1: Rewrite the useJobs function**

Replace the entire `useJobs` function (lines 8–88) with this implementation. Keep `UseJobsOptions` interface but add `search` as a controlled param:

```typescript
const PAGE_SIZE = 50;

interface UseJobsOptions {
  /** Only return jobs with these statuses */
  statusFilter?: JobStatus[];
  /** Only return jobs assigned to this user id (worker view) */
  assignedTo?: string;
  /** Auto-fetch on mount. Default true */
  autoFetch?: boolean;
}

export function useJobs(options: UseJobsOptions = {}) {
  const { userProfile, user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { statusFilter, assignedTo, autoFetch = true } = options;

  const buildQuery = useCallback((searchTerm?: string) => {
    let query = supabase
      .from('jobs')
      .select('id, title, reference, status, scheduled_date, customer_snapshot, assigned_to, company_id')
      .eq('company_id', userProfile!.company_id!)
      .order('scheduled_date', { ascending: false });

    if (statusFilter && statusFilter.length > 0) {
      query = query.in('status', statusFilter);
    }

    if (assignedTo) {
      query = query.contains('assigned_to', [assignedTo]);
    }

    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.trim();
      query = query.or(`title.ilike.%${term}%,reference.ilike.%${term}%`);
    }

    return query;
  }, [userProfile?.company_id, assignedTo, statusFilter?.join(',')]);

  const fetchPage = useCallback(async (offset: number, searchTerm?: string, append = false) => {
    if (!userProfile?.company_id) return;

    try {
      const query = buildQuery(searchTerm).range(offset, offset + PAGE_SIZE - 1);
      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as Job[];
      setJobs(prev => append ? [...prev, ...rows] : rows);
      setHasMore(rows.length === PAGE_SIZE);
      offsetRef.current = offset + rows.length;
    } catch (e) {
      console.error('useJobs fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [userProfile?.company_id, buildQuery]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    offsetRef.current = 0;
    fetchPage(0, search.trim() || undefined);
  }, [fetchPage, search]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    fetchPage(offsetRef.current, search.trim() || undefined, true);
  }, [hasMore, loadingMore, loading, fetchPage, search]);

  // Initial fetch
  useEffect(() => {
    if (autoFetch && userProfile?.company_id) {
      offsetRef.current = 0;
      fetchPage(0);
    }
  }, [autoFetch, userProfile?.company_id]);

  // Debounced server-side search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    searchTimerRef.current = setTimeout(() => {
      if (!userProfile?.company_id) return;
      setLoading(true);
      offsetRef.current = 0;
      fetchPage(0, search.trim() || undefined);
    }, 300);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  return {
    jobs,
    filteredJobs: jobs, // backward compat — consumers already use filteredJobs
    loading,
    refreshing,
    loadingMore,
    hasMore,
    search,
    setSearch,
    fetchJobs: refresh,
    onRefresh: refresh,
    loadMore,
  };
}
```

Note: Add `import { useRef } from 'react';` to the existing import line at top of file (line 1). It already imports from `'react'`, just add `useRef` to the destructure.

- [ ] **Step 2: Add useRef to imports**

Change line 1:
```typescript
// BEFORE:
import { useCallback, useEffect, useMemo, useState } from 'react';
// AFTER:
import { useCallback, useEffect, useRef, useState } from 'react';
```

(`useMemo` is no longer needed since client-side filtering is removed.)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | grep -v 'supabase/functions'`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add hooks/useJobs.ts
git commit -m "perf: paginate useJobs with server-side search (page size 50)"
```

---

### Task 4: Update jobs index screen with load-more UI

**Files:**
- Modify: `app/(app)/(tabs)/jobs/index.tsx`

The jobs screen currently has its own inline `fetchJobs` query (line 112–129) that duplicates what `useJobs` does. It doesn't use the hook. We need to:
1. Replace the inline query with the updated `useJobs` hook
2. Add a "Load more" footer to the FlatList

- [ ] **Step 1: Import useJobs and wire it up**

Add the import at the top of the file:

```typescript
import { useJobs } from '../../../../hooks/useJobs';
```

Then inside the `JobsScreen` component, replace the inline state + `fetchJobs` with the hook. Find the section where `jobs`, `loading`, and `fetchJobs` are declared (around lines 65–129). Replace the inline `const [jobs, setJobs]`, `const [loading, setLoading]`, `fetchJobs`, and the `useFocusEffect` that calls `fetchJobs` with:

```typescript
const { jobs, loading, refreshing, loadingMore, hasMore, search, setSearch, onRefresh, loadMore, fetchJobs } = useJobs({
  statusFilter: undefined, // fetch all non-cancelled (hook handles this)
  assignedTo: isAdmin ? undefined : user?.id,
  autoFetch: false, // we control fetch via useFocusEffect
});

useFocusEffect(
  useCallback(() => {
    if (userProfile?.company_id) {
      fetchJobs();
    }
  }, [userProfile?.company_id, fetchJobs])
);
```

Remove the old `const [jobs, setJobs] = useState<any[]>([]);`, `const [loading, setLoading] = useState(true);`, the old `fetchJobs` function, and the old `useFocusEffect`.

Keep `handleUpdateJobStatus` and `handleDeleteJob` but update them to call `fetchJobs()` after their mutations instead of directly mutating `setJobs`. For example, at the end of `handleUpdateJobStatus`:

```typescript
// Instead of optimistic update with setJobs, just refetch
await supabase.from('jobs').update({ status }).eq('id', jobId).eq('company_id', userProfile?.company_id);
fetchJobs(); // refetch the current page
```

- [ ] **Step 2: Add ListFooterComponent to FlatList**

Find the FlatList that renders jobs (around line 471). Add a `ListFooterComponent`:

```typescript
ListFooterComponent={
  hasMore ? (
    <TouchableOpacity
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 14, marginHorizontal: 16, marginTop: 8, marginBottom: 20,
        borderRadius: 14, backgroundColor: UI.surface.primaryLight,
        borderWidth: 1, borderColor: '#C7D2FE',
      }}
      onPress={loadMore}
      activeOpacity={0.7}
    >
      {loadingMore ? (
        <ActivityIndicator size="small" color={UI.brand.primary} />
      ) : (
        <>
          <Ionicons name="chevron-down-outline" size={18} color={UI.brand.primary} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: UI.brand.primary }}>Load more jobs</Text>
        </>
      )}
    </TouchableOpacity>
  ) : jobs.length > 0 ? (
    <Text style={{ textAlign: 'center', color: theme.text.muted, fontSize: 13, paddingVertical: 16 }}>
      All jobs loaded
    </Text>
  ) : null
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | grep -v 'supabase/functions'`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/(tabs)/jobs/index.tsx
git commit -m "perf: use paginated useJobs hook in jobs screen with load-more"
```

---

## Chunk 3: Paginated useCustomers Hook + Customers Screen

### Task 5: Rewrite useCustomers with pagination and server-side search

**Files:**
- Modify: `hooks/useCustomers.ts`

Same pattern as useJobs. Only modify the `useCustomers` function — leave `useCreateCustomer` and `useCustomerDetail` untouched.

- [ ] **Step 1: Add useRef to imports**

```typescript
// BEFORE:
import { useCallback, useEffect, useMemo, useState } from 'react';
// AFTER:
import { useCallback, useEffect, useRef, useState } from 'react';
```

- [ ] **Step 2: Rewrite the useCustomers function**

Replace the entire `useCustomers` function (lines 9–67) with:

```typescript
const PAGE_SIZE = 50;

export function useCustomers() {
  const { userProfile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(async (offset: number, searchTerm?: string, append = false) => {
    if (!userProfile?.company_id) return;

    try {
      let query = supabase
        .from('customers')
        .select('id, name, email, phone, address, address_line_1, city, postal_code, company_id, created_at')
        .eq('company_id', userProfile.company_id)
        .order('name', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.trim();
        query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as Customer[];
      setCustomers(prev => append ? [...prev, ...rows] : rows);
      setHasMore(rows.length === PAGE_SIZE);
      offsetRef.current = offset + rows.length;
    } catch (e) {
      console.error('useCustomers fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [userProfile?.company_id]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    offsetRef.current = 0;
    fetchPage(0, search.trim() || undefined);
  }, [fetchPage, search]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    fetchPage(offsetRef.current, search.trim() || undefined, true);
  }, [hasMore, loadingMore, loading, fetchPage, search]);

  // Initial fetch
  useEffect(() => {
    if (userProfile?.company_id) {
      offsetRef.current = 0;
      fetchPage(0);
    }
  }, [userProfile?.company_id]);

  // Debounced server-side search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    searchTimerRef.current = setTimeout(() => {
      if (!userProfile?.company_id) return;
      setLoading(true);
      offsetRef.current = 0;
      fetchPage(0, search.trim() || undefined);
    }, 300);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  return {
    customers,
    filteredCustomers: customers, // backward compat
    loading,
    refreshing,
    loadingMore,
    hasMore,
    search,
    setSearch,
    fetchCustomers: refresh,
    onRefresh: refresh,
    loadMore,
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | grep -v 'supabase/functions'`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add hooks/useCustomers.ts
git commit -m "perf: paginate useCustomers with server-side search (page size 50)"
```

---

### Task 6: Update customers index screen with load-more UI

**Files:**
- Modify: `app/(app)/customers/index.tsx`

The customers screen currently has its own inline `fetchCustomers` + client-side filter. Replace with the hook and add load-more footer.

- [ ] **Step 1: Import and use the hook**

Add import:

```typescript
import { useCustomers } from '../../../hooks/useCustomers';
```

Inside the component, replace the inline state (`customers`, `loading`, `search`, `refreshing`, `fetchCustomers`, `filteredCustomers`) with:

```typescript
const { customers: filteredCustomers, loading, refreshing, loadingMore, hasMore, search, setSearch, fetchCustomers, onRefresh, loadMore } = useCustomers();
```

Remove the old `useState` declarations for `customers`, `loading`, `search`, `refreshing`, the old `fetchCustomers` function, the old `filteredCustomers` computation, and the `useEffect` that calls `fetchCustomers()`.

Replace the `useEffect` with a `useFocusEffect`:

```typescript
useFocusEffect(
  useCallback(() => {
    fetchCustomers();
  }, [fetchCustomers])
);
```

Add `useFocusEffect` to the expo-router import.

- [ ] **Step 2: Add ListFooterComponent to FlatList**

Find the FlatList (around line 108). Add:

```typescript
ListFooterComponent={
  hasMore ? (
    <TouchableOpacity
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 14, marginHorizontal: 16, marginTop: 8, marginBottom: 20,
        borderRadius: 14, backgroundColor: UI.surface.primaryLight,
        borderWidth: 1, borderColor: '#C7D2FE',
      }}
      onPress={loadMore}
      activeOpacity={0.7}
    >
      {loadingMore ? (
        <ActivityIndicator size="small" color={UI.brand.primary} />
      ) : (
        <>
          <Ionicons name="chevron-down-outline" size={18} color={UI.brand.primary} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: UI.brand.primary }}>Load more customers</Text>
        </>
      )}
    </TouchableOpacity>
  ) : filteredCustomers.length > 0 ? (
    <Text style={{ textAlign: 'center', color: theme.text.muted, fontSize: 13, paddingVertical: 16 }}>
      All customers loaded
    </Text>
  ) : null
}
```

- [ ] **Step 3: Update the RefreshControl**

Replace the FlatList's `onRefresh` prop:

```typescript
refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.brand.primary} />}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | grep -v 'supabase/functions'`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add app/(app)/customers/index.tsx
git commit -m "perf: use paginated useCustomers hook in customers screen with load-more"
```

---

## Chunk 4: Paginated useDocuments Hook + Documents Screen

### Task 7: Create useDocuments hook

**Files:**
- Create: `hooks/useDocuments.ts`

Extract the query from `documents/index.tsx` into a dedicated paginated hook. Server-side filtering by `type` and search by `reference`.

- [ ] **Step 1: Create the hook file**

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../src/config/supabase';
import { useAuth } from '../src/context/AuthContext';
import { Document } from '../src/types';

const PAGE_SIZE = 50;

const DOCUMENTS_SELECT = 'id, type, status, reference, created_at, expiry_date, customer_snapshot, company_id, user_id, number, date, total, payment_info';

type DocumentFilterKey =
  | 'invoice'
  | 'quote'
  | 'cp12'
  | 'service_record'
  | 'commissioning'
  | 'decommissioning'
  | 'warning_notice'
  | 'breakdown_report'
  | 'installation_cert';

interface UseDocumentsOptions {
  typeFilters?: DocumentFilterKey[];
}

export function useDocuments(options: UseDocumentsOptions = {}) {
  const { userProfile, role } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filtersRef = useRef(options.typeFilters);
  filtersRef.current = options.typeFilters;

  const fetchPage = useCallback(async (offset: number, searchTerm?: string, append = false) => {
    if (!userProfile?.company_id) return;

    try {
      let query = supabase
        .from('documents')
        .select(DOCUMENTS_SELECT)
        .eq('company_id', userProfile.company_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (role !== 'admin' && userProfile.id) {
        query = query.eq('user_id', userProfile.id);
      }

      const filters = filtersRef.current;
      if (filters && filters.length > 0) {
        // Map filter keys to document types
        const types = new Set<string>();
        for (const f of filters) {
          if (f === 'invoice' || f === 'quote') {
            types.add(f);
          } else {
            // Gas forms are stored as type='invoice' with payment_info.kind
            // We need to filter by type column for these
            types.add(f);
          }
        }
        query = query.in('type', Array.from(types));
      }

      if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.trim();
        query = query.or(`reference.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as Document[];
      setDocuments(prev => append ? [...prev, ...rows] : rows);
      setHasMore(rows.length === PAGE_SIZE);
      offsetRef.current = offset + rows.length;
    } catch (e) {
      console.error('useDocuments fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [userProfile?.company_id, userProfile?.id, role]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    offsetRef.current = 0;
    fetchPage(0, search.trim() || undefined);
  }, [fetchPage, search]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    fetchPage(offsetRef.current, search.trim() || undefined, true);
  }, [hasMore, loadingMore, loading, fetchPage, search]);

  // Debounced server-side search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    searchTimerRef.current = setTimeout(() => {
      if (!userProfile?.company_id) return;
      setLoading(true);
      offsetRef.current = 0;
      fetchPage(0, search.trim() || undefined);
    }, 300);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search, options.typeFilters?.join(',')]);

  // Refetch when filters change
  useEffect(() => {
    if (!userProfile?.company_id) return;
    setLoading(true);
    offsetRef.current = 0;
    fetchPage(0, search.trim() || undefined);
  }, [userProfile?.company_id]);

  const removeDocument = useCallback((docId: string) => {
    setDocuments(prev => prev.filter(d => d.id !== docId));
  }, []);

  return {
    documents,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    search,
    setSearch,
    refresh,
    onRefresh: refresh,
    loadMore,
    removeDocument,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | grep -v 'supabase/functions'`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/useDocuments.ts
git commit -m "feat: create paginated useDocuments hook with server-side search"
```

---

### Task 8: Update documents screen to use the hook

**Files:**
- Modify: `app/(app)/(tabs)/documents/index.tsx`

Replace the inline `fetchDocuments` + client-side filtering with the `useDocuments` hook. The screen has a landing page, filter tabs, search, and delete — all must continue working.

- [ ] **Step 1: Import useDocuments**

Add at top of file:

```typescript
import { useDocuments } from '../../../../hooks/useDocuments';
```

- [ ] **Step 2: Replace state and fetchDocuments with hook**

Inside `DocumentsHubScreen`, find lines ~269-298 where `documents`, `loading`, `refreshing`, `searchQuery`, `fetchDocuments` are declared. Replace them with:

```typescript
const { documents, loading, refreshing, loadingMore, hasMore, search: searchQuery, setSearch: setSearchQuery, refresh: fetchDocuments, onRefresh, loadMore, removeDocument } = useDocuments({ typeFilters: selectedFilters.length > 0 ? selectedFilters : undefined });
```

Remove the old `useState` for `documents`, `loading`, `refreshing`, `searchQuery`. Remove the old `fetchDocuments` function. Remove the `useEffect` that calls `fetchDocuments`.

- [ ] **Step 3: Refetch when filters change**

Add a `useEffect` that refetches when `selectedFilters` change:

```typescript
useEffect(() => {
  fetchDocuments();
}, [selectedFilters]);
```

- [ ] **Step 4: Update handleDelete to use removeDocument**

In the `handleDelete` function, replace `setDocuments((prev) => prev.filter((d) => d.id !== doc.id));` with `removeDocument(doc.id);`.

- [ ] **Step 5: Replace client-side filteredDocuments**

Remove the `filteredDocuments` computation (lines ~384-398). The hook now handles filtering server-side. Where `filteredDocuments` is used in the FlatList `data` prop, replace with `documents`.

Note: The `searchQuery` filter within `filteredDocuments` is now handled by the hook's debounced search. The `selectedFilters` filter is handled by passing `typeFilters` to the hook.

- [ ] **Step 6: Add ListFooterComponent to FlatList**

Find the FlatList that renders documents. Add:

```typescript
ListFooterComponent={
  hasMore ? (
    <TouchableOpacity
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 14, marginHorizontal: 16, marginTop: 8, marginBottom: 20,
        borderRadius: 14, backgroundColor: UI.surface.primaryLight,
        borderWidth: 1, borderColor: '#C7D2FE',
      }}
      onPress={loadMore}
      activeOpacity={0.7}
    >
      {loadingMore ? (
        <ActivityIndicator size="small" color={UI.brand.primary} />
      ) : (
        <>
          <Ionicons name="chevron-down-outline" size={18} color={UI.brand.primary} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: UI.brand.primary }}>Load more</Text>
        </>
      )}
    </TouchableOpacity>
  ) : documents.length > 0 ? (
    <Text style={{ textAlign: 'center', color: theme.text.muted, fontSize: 13, paddingVertical: 16 }}>
      All documents loaded
    </Text>
  ) : null
}
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | grep -v 'supabase/functions'`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add app/(app)/(tabs)/documents/index.tsx hooks/useDocuments.ts
git commit -m "perf: use paginated useDocuments hook in documents screen"
```

---

## Chunk 5: Calendar Date-Bounded Fetching

### Task 9: Bound calendar fetches to visible month

**Files:**
- Modify: `app/(app)/(tabs)/calendar.tsx`

The calendar fetches ALL jobs for the company. Replace with month-bounded queries and a month cache.

- [ ] **Step 1: Add month cache ref and rewrite fetchJobs**

Find the existing `fetchJobs` function (around line 108). Replace it with a month-bounded version:

```typescript
const monthCacheRef = useRef<Record<string, Job[]>>({});

const fetchJobsForMonth = useCallback(async (year: number, month: number, force = false) => {
  if (!userProfile?.company_id) return;

  const key = `${year}-${String(month + 1).padStart(2, '0')}`;
  if (!force && monthCacheRef.current[key]) {
    setJobs(monthCacheRef.current[key]);
    setLoading(false);
    setRefreshing(false);
    return;
  }

  try {
    const monthStart = new Date(year, month, 1).getTime();
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

    let query = supabase
      .from('jobs')
      .select('id, title, status, scheduled_date, customer_snapshot, assigned_to')
      .eq('company_id', userProfile.company_id)
      .neq('status', 'cancelled')
      .gte('scheduled_date', monthStart)
      .lte('scheduled_date', monthEnd)
      .order('scheduled_date', { ascending: true });

    if (!isAdmin && user) {
      query = query.contains('assigned_to', [user.id]);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []) as Job[];
    monthCacheRef.current[key] = rows;
    setJobs(rows);
  } catch (e) {
    console.error('Calendar fetch error:', e);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
}, [userProfile?.company_id, isAdmin, user?.id]);
```

- [ ] **Step 2: Update useEffect and realtime callback**

Replace the existing `useEffect` that calls `fetchJobs()` (around line 133-135) with:

```typescript
useEffect(() => {
  const d = new Date(selectedDate + 'T00:00:00');
  fetchJobsForMonth(d.getFullYear(), d.getMonth());
}, [selectedDate, fetchJobsForMonth]);
```

Update the `useRealtimeJobs` callback to refetch current month:

```typescript
useRealtimeJobs(userProfile?.company_id, () => {
  const d = new Date(selectedDate + 'T00:00:00');
  fetchJobsForMonth(d.getFullYear(), d.getMonth(), true); // force refresh
});
```

- [ ] **Step 3: Update pull-to-refresh**

The refresh handler should clear the cache and refetch:

Find the `RefreshControl` in the render (search for `onRefresh`). Update the refresh logic:

```typescript
const handleRefresh = useCallback(() => {
  setRefreshing(true);
  monthCacheRef.current = {}; // clear cache
  const d = new Date(selectedDate + 'T00:00:00');
  fetchJobsForMonth(d.getFullYear(), d.getMonth(), true);
}, [selectedDate, fetchJobsForMonth]);
```

Use `handleRefresh` in the RefreshControl's `onRefresh` prop.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | grep -v 'supabase/functions'`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add app/(app)/(tabs)/calendar.tsx
git commit -m "perf: bound calendar fetches to visible month with cache"
```

---

## Chunk 6: Edge Function Batching

### Task 10: Batch the send-renewal-reminders edge function

**Files:**
- Modify: `supabase/functions/send-renewal-reminders/index.ts`

The function fetches ALL documents with expiry dates in a single query. Replace with a batched loop.

- [ ] **Step 1: Replace the unbounded query with a batch loop**

Find the document fetch query (around line 64-69):

```typescript
// BEFORE:
const {data: docs, error} = await supabase
  .from('documents')
  .select('id,type,reference,expiry_date,company_id,customer_snapshot,payment_info')
  .in('type', ['cp12', 'service_record'])
  .not('expiry_date', 'is', null)
```

Replace it and the processing loop with a batched approach. Replace everything from line 64 to line 183 with:

```typescript
  const BATCH_SIZE = 500
  let offset = 0
  let sent = 0
  let skipped = 0
  const failures: Array<{id: string; reason: string}> = []

  // Fetch all companies' reminder-days config once
  const { data: allCompanies } = await supabase
    .from('companies')
    .select('id, reminder_days_before')

  const reminderDaysMap: Record<string, number> = {}
  for (const c of allCompanies ?? []) {
    reminderDaysMap[c.id] = c.reminder_days_before ?? 30
  }

  while (true) {
    const {data: docs, error} = await supabase
      .from('documents')
      .select('id,type,reference,expiry_date,company_id,customer_snapshot,payment_info')
      .in('type', ['cp12', 'service_record'])
      .not('expiry_date', 'is', null)
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) {
      return new Response(JSON.stringify({error: error.message}), {
        status: 500,
        headers: jsonHeaders,
      })
    }

    if (!docs || docs.length === 0) break

    for (const doc of docs) {
      try {
        const dueDate = parseDdMmYyyy(doc.expiry_date)
        if (!dueDate) {
          skipped += 1
          continue
        }
        const reminderDays = reminderDaysMap[doc.company_id] ?? 30
        const days = dayDiff(today, dueDate)
        if (days > reminderDays || days < 0) {
          skipped += 1
          continue
        }

        const payload = JSON.parse(doc.payment_info || '{}') as any
        const pdfData = payload?.pdfData || {}
        const reminderEnabled = !!pdfData.renewalReminderEnabled
        const reminderSentForDate = payload?.reminderMeta?.lastSentForDate || ''

        if (!reminderEnabled || reminderSentForDate === doc.expiry_date) {
          skipped += 1
          continue
        }

        const customerName = pdfData.customerName || pdfData.landlordName || pdfData.tenantName || doc.customer_snapshot?.name || 'Customer'
        const propertyAddress = pdfData.propertyAddress || doc.customer_snapshot?.address || 'Not provided'
        const fallbackEmail = pdfData.customerEmail || pdfData.landlordEmail || pdfData.tenantEmail || ''
        const baseRecipients = [doc.customer_snapshot?.email || fallbackEmail]
        const oneTimeEmails: string[] = Array.isArray(payload?.oneTimeReminderEmails) ? payload.oneTimeReminderEmails : []
        const recipients = sanitizeRecipients([...baseRecipients, ...oneTimeEmails])

        if (!recipients.length) {
          skipped += 1
          continue
        }

        const docLabel = doc.type === 'service_record' ? 'Service Record' : 'Gas Safety Certificate'
        const subject = `${docLabel} Reminder: ${doc.reference || 'Document'} expires on ${doc.expiry_date}`
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#0f172a;line-height:1.5;">
            <h2 style="margin:0 0 12px;">Renewal Reminder</h2>
            <p style="margin:0 0 12px;">Hi ${customerName}, your ${docLabel.toLowerCase()} is due to expire in ${days} days.</p>
            <table style="width:100%;border-collapse:collapse;margin:12px 0 20px;">
              <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Document</td><td style="padding:8px;border:1px solid #e2e8f0;">${docLabel}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Reference</td><td style="padding:8px;border:1px solid #e2e8f0;">${doc.reference || 'N/A'}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Property</td><td style="padding:8px;border:1px solid #e2e8f0;">${propertyAddress}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;">Renewal Date</td><td style="padding:8px;border:1px solid #e2e8f0;">${doc.expiry_date || 'N/A'}</td></tr>
            </table>
            <p style="margin:0;color:#475569;font-size:14px;">Please get in touch to arrange your renewal before the due date.</p>
          </div>
        `

        await resend.emails.send({
          from: Deno.env.get('RESEND_FROM_EMAIL') || 'GasPilot <info@gaspilotapp.com>',
          to: recipients,
          subject,
          html,
        })

        const { oneTimeReminderEmails: _removed, ...payloadWithoutOneTime } = payload
        const nextPayload = {
          ...payloadWithoutOneTime,
          reminderMeta: {
            ...(payload?.reminderMeta || {}),
            lastSentAt: new Date().toISOString(),
            lastSentForDate: doc.expiry_date || '',
          },
        }

        const {error: updateError} = await supabase
          .from('documents')
          .update({payment_info: JSON.stringify(nextPayload)})
          .eq('id', doc.id)

        if (updateError) {
          failures.push({id: doc.id, reason: updateError.message})
          continue
        }

        sent += 1
      } catch (error) {
        failures.push({
          id: doc.id,
          reason: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    if (docs.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }
```

- [ ] **Step 2: Remove the old company-fetch block**

The old code (lines 77-91) fetched company data after the document query. This is now done before the loop (included in the new code above). Make sure the old block is removed.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-renewal-reminders/index.ts
git commit -m "perf: batch send-renewal-reminders in chunks of 500"
```
