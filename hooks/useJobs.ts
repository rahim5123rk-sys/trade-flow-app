import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../src/config/supabase';
import { useAuth } from '../src/context/AuthContext';
import { Job, JobStatus } from '../src/types';

// ─── Fetch & Filter Hook ────────────────────────────────────────────

interface UseJobsOptions {
  /** Only return jobs with these statuses */
  statusFilter?: JobStatus[];
  /** Only return jobs assigned to this user id (worker view) */
  assignedTo?: string;
  /** Auto-fetch on mount. Default true */
  autoFetch?: boolean;
}

const PAGE_SIZE = 50;

export function useJobs(options: UseJobsOptions = {}) {
  const { userProfile, user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(Boolean(userProfile?.company_id));
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRef = useRef<number | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

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

  const fetchPage = useCallback(async (cursor: number | null, searchTerm?: string, append = false) => {
    if (!userProfile?.company_id) return;

    try {
      let query = buildQuery(searchTerm).limit(PAGE_SIZE);

      if (cursor) {
        query = query.lt('scheduled_date', cursor);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as Job[];
      setJobs(prev => append ? [...prev, ...rows] : rows);
      setHasMore(rows.length === PAGE_SIZE);

      if (rows.length > 0) {
        cursorRef.current = rows[rows.length - 1].scheduled_date;
      }
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
    cursorRef.current = null;
    fetchPage(null, search.trim() || undefined);
  }, [fetchPage, search]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    fetchPage(cursorRef.current, search.trim() || undefined, true);
  }, [hasMore, loadingMore, loading, fetchPage, search]);

  // Initial fetch
  useEffect(() => {
    if (autoFetch && userProfile?.company_id) {
      setLoading(true);
      cursorRef.current = null;
      fetchPage(null);
    }
  }, [autoFetch, userProfile?.company_id]);

  // Debounced server-side search
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    searchTimerRef.current = setTimeout(() => {
      if (!userProfile?.company_id) return;
      setLoading(true);
      cursorRef.current = null;
      fetchPage(null, search.trim() || undefined);
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

// ─── Create Job Hook ────────────────────────────────────────────────

interface CreateJobParams {
  title: string;
  customerId: string;
  customerSnapshot: Record<string, any>;
  scheduledDate: Date;
  assignedTo: string[];
  price?: number;
  notes?: string;
  estimatedDuration?: string;
}

export function useCreateJob() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const createJob = async (params: CreateJobParams): Promise<Job | null> => {
    if (!userProfile?.company_id) {
      Alert.alert('Error', 'Company profile not loaded yet.');
      return null;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('create_job_with_activity', {
        p_company_id: userProfile.company_id,
        p_title: params.title.trim(),
        p_customer_id: params.customerId,
        p_customer_snapshot: params.customerSnapshot,
        p_assigned_to: params.assignedTo,
        p_scheduled_date: params.scheduledDate.getTime(),
        p_actor_id: userProfile.id,
        p_estimated_duration: params.estimatedDuration || null,
        p_price: params.price || null,
        p_notes: params.notes?.trim() || null,
      });

      if (error) throw error;
      return data as Job;
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create job.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createJob, loading };
}

// ─── Update Job Status Hook ─────────────────────────────────────────

export function useUpdateJobStatus() {
  const { userProfile } = useAuth();
  const [updating, setUpdating] = useState(false);

  const updateStatus = async (
    jobId: string,
    newStatus: JobStatus
  ): Promise<boolean> => {
    if (!userProfile?.company_id) return false;

    setUpdating(true);
    try {
      const { error } = await supabase.rpc('update_job_status_with_activity', {
        p_job_id: jobId,
        p_company_id: userProfile.company_id,
        p_actor_id: userProfile.id,
        p_new_status: newStatus,
        p_payment_status: newStatus === 'paid' ? 'paid' : null,
      });

      if (error) throw error;
      return true;
    } catch (e) {
      Alert.alert('Error', 'Could not update status.');
      return false;
    } finally {
      setUpdating(false);
    }
  };

  return { updateStatus, updating };
}