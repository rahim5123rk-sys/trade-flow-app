import {useEffect, useRef} from 'react';
import {supabase} from '../src/config/supabase';
import {useAuth} from '../src/context/AuthContext';
import {
  isCalendarSyncEnabled,
  removeJobFromCalendar,
  syncJobToCalendar,
} from '../src/services/calendarSync';
import type {Job} from '../src/types';

/**
 * Listens to Supabase realtime job changes and syncs to iOS Calendar
 * when calendar sync is enabled. Mount once in app layout.
 */
export function useCalendarSync() {
  const {userProfile} = useAuth();
  const companyId = userProfile?.company_id;
  const enabledRef = useRef(false);

  // Check sync state on mount and when profile changes
  useEffect(() => {
    isCalendarSyncEnabled().then((enabled) => {
      enabledRef.current = enabled;
    });
  }, [companyId]);

  // Subscribe to job changes
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('calendar-sync-jobs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `company_id=eq.${companyId}`,
        },
        async (payload) => {
          // Re-check in case user toggled it
          const enabled = await isCalendarSyncEnabled();
          enabledRef.current = enabled;
          if (!enabled) return;

          if (payload.eventType === 'DELETE') {
            const oldJob = payload.old as {id?: string};
            if (oldJob?.id) {
              await removeJobFromCalendar(oldJob.id);
            }
          } else {
            // INSERT or UPDATE
            const job = payload.new as Job;
            if (job?.scheduled_date) {
              await syncJobToCalendar(job);
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);
}
