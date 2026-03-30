import { useEffect, useRef } from 'react';
import { supabase } from '../src/config/supabase';

/**
 * Subscribe to real-time changes on the jobs table for a given company.
 * Calls `onUpdate` whenever a row is inserted, updated, or deleted.
 *
 * Usage:
 *   useRealtimeJobs(userProfile?.company_id, fetchJobs);
 */
export function useRealtimeJobs(
  companyId: string | undefined,
  onUpdate: () => void
) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`jobs-company-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `company_id=eq.${companyId}`,
        },
        (_payload) => {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => {
            callbackRef.current();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [companyId]);
}

/**
 * Subscribe to real-time changes on the job_activity table for a specific job.
 * Useful on the job detail screen to show live activity feed.
 *
 * Usage:
 *   useRealtimeJobActivity(job.id, fetchActivity);
 */
export function useRealtimeJobActivity(
  jobId: string | undefined,
  onUpdate: () => void
) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`activity-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_activity',
          filter: `job_id=eq.${jobId}`,
        },
        (_payload) => {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => {
            callbackRef.current();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [jobId]);
}

/**
 * Generic realtime subscription for any table.
 *
 * Usage:
 *   useRealtimeTable('customers', `company_id=eq.${companyId}`, refetch);
 */
export function useRealtimeTable(
  table: string,
  filter: string | undefined,
  onUpdate: () => void
) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!filter) return;

    const channel = supabase
      .channel(`rt-${table}-${filter}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter,
        },
        (_payload) => {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => {
            callbackRef.current();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [table, filter]);
}