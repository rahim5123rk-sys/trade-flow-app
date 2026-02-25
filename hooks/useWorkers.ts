import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../src/config/supabase';
import { useAuth } from '../src/context/AuthContext';

interface Worker {
  id: string;
  display_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  push_token?: string;
  is_test_user?: boolean;
  created_at?: string;
}

// ─── Fetch Workers Hook ─────────────────────────────────────────────

export function useWorkers() {
  const { userProfile } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWorkers = useCallback(async () => {
    if (!userProfile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', userProfile.company_id)
        .eq('role', 'worker')
        .order('display_name', { ascending: true });

      if (error) throw error;
      if (data) setWorkers(data as Worker[]);
    } catch (e) {
      console.error('useWorkers fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userProfile?.company_id]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWorkers();
  }, [fetchWorkers]);

  return {
    workers,
    loading,
    refreshing,
    fetchWorkers,
    onRefresh,
  };
}

// ─── Notify Workers Utility ─────────────────────────────────────────

/**
 * Send push notifications to assigned workers.
 * Call after job creation or reassignment.
 *
 * Usage:
 *   await notifyWorkers(workerIds, 'Boiler Repair', 'Mon 3 Feb');
 */
export async function notifyWorkers(
  workerIds: string[],
  jobTitle: string,
  jobDate: string,
  type: 'job_assigned' | 'job_updated' | 'status_change' = 'job_assigned'
) {
  if (!workerIds.length) return;

  try {
    const { data: workers } = await supabase
      .from('profiles')
      .select('push_token, display_name')
      .in('id', workerIds)
      .not('push_token', 'is', null);

    if (!workers?.length) return;

    const titleMap = {
      job_assigned: 'New Job Assigned',
      job_updated: 'Job Updated',
      status_change: 'Job Status Changed',
    };

    const bodyMap = {
      job_assigned: `You've been assigned: ${jobTitle} on ${jobDate}`,
      job_updated: `"${jobTitle}" has been updated`,
      status_change: `"${jobTitle}" status has changed`,
    };

    const messages = workers
      .filter((w) => w.push_token)
      .map((w) => ({
        to: w.push_token,
        sound: 'default' as const,
        title: titleMap[type],
        body: bodyMap[type],
        data: { type, jobTitle },
      }));

    if (messages.length === 0) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch (e) {
    console.warn('Push notification failed:', e);
  }
}