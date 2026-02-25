import { useCallback, useEffect, useMemo, useState } from 'react';
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

export function useJobs(options: UseJobsOptions = {}) {
  const { userProfile, user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const { statusFilter, assignedTo, autoFetch = true } = options;

  const fetchJobs = useCallback(async () => {
    if (!userProfile?.company_id) return;

    try {
      let query = supabase
        .from('jobs')
        .select('*')
        .eq('company_id', userProfile.company_id)
        .order('scheduled_date', { ascending: false });

      if (statusFilter && statusFilter.length > 0) {
        query = query.in('status', statusFilter);
      }

      if (assignedTo) {
        query = query.contains('assigned_to', [assignedTo]);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data) setJobs(data as Job[]);
    } catch (e) {
      console.error('useJobs fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userProfile?.company_id, assignedTo, statusFilter?.join(',')]);

  useEffect(() => {
    if (autoFetch) fetchJobs();
  }, [fetchJobs, autoFetch]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs();
  }, [fetchJobs]);

  // Client-side search filter
  const filteredJobs = useMemo(() => {
    if (!search.trim()) return jobs;
    const q = search.toLowerCase();
    return jobs.filter(
      (j) =>
        j.reference?.toLowerCase().includes(q) ||
        j.title?.toLowerCase().includes(q) ||
        j.customer_snapshot?.name?.toLowerCase().includes(q) ||
        j.customer_snapshot?.address?.toLowerCase().includes(q)
    );
  }, [jobs, search]);

  return {
    jobs,
    filteredJobs,
    loading,
    refreshing,
    search,
    setSearch,
    fetchJobs,
    onRefresh,
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
      // 1. Get next reference number
      const { data: companyData, error: companyErr } = await supabase
        .from('companies')
        .select('settings')
        .eq('id', userProfile.company_id)
        .single();

      if (companyErr) throw companyErr;

      const currentCount = companyData?.settings?.nextJobNumber || 1;
      const reference = `TF-${new Date().getFullYear()}-${String(currentCount).padStart(4, '0')}`;

      // 2. Insert job
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          company_id: userProfile.company_id,
          reference,
          title: params.title.trim(),
          customer_id: params.customerId,
          customer_snapshot: params.customerSnapshot,
          assigned_to: params.assignedTo,
          status: 'pending',
          scheduled_date: params.scheduledDate.getTime(),
          estimated_duration: params.estimatedDuration || null,
          price: params.price || null,
          notes: params.notes?.trim() || null,
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // 3. Increment counter
      await supabase
        .from('companies')
        .update({
          settings: { ...companyData?.settings, nextJobNumber: currentCount + 1 },
        })
        .eq('id', userProfile.company_id);

      // 4. Log activity
      await supabase.from('job_activity').insert({
        job_id: job.id,
        company_id: userProfile.company_id,
        actor_id: userProfile.id,
        action: 'created',
        details: {
          title: params.title,
          assigned_to: params.assignedTo,
        },
      });

      return job as Job;
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
      const updateData: Record<string, any> = { status: newStatus };

      if (newStatus === 'paid') {
        updateData.payment_status = 'paid';
      }

      const { error } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', jobId);

      if (error) throw error;

      // Log activity
      await supabase.from('job_activity').insert({
        job_id: jobId,
        company_id: userProfile.company_id,
        actor_id: userProfile.id,
        action: 'status_change',
        details: { new_status: newStatus },
      });

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