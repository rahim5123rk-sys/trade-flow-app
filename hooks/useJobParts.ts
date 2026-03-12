import {useCallback, useEffect, useState} from 'react';
import {supabase} from '../src/config/supabase';
import {useAuth} from '../src/context/AuthContext';

export type PartStatus = 'needed' | 'ordered' | 'collected';

export interface JobPart {
  id: string;
  job_id: string;
  company_id: string;
  name: string;
  quantity: number;
  status: PartStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

const NEXT_STATUS: Record<PartStatus, PartStatus> = {
  needed: 'ordered',
  ordered: 'collected',
  collected: 'needed',
};

export function useJobParts(jobId: string) {
  const {userProfile} = useAuth();
  const [parts, setParts] = useState<JobPart[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchParts = useCallback(async () => {
    if (!userProfile?.company_id || !jobId) return;
    try {
      const {data, error} = await supabase
        .from('job_parts')
        .select('*')
        .eq('job_id', jobId)
        .eq('company_id', userProfile.company_id)
        .order('created_at', {ascending: true});
      if (error) throw error;
      if (data) setParts(data as JobPart[]);
    } catch (e) {
      console.error('useJobParts fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [jobId, userProfile?.company_id]);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  const addPart = useCallback(
    async (name: string, quantity = 1) => {
      if (!userProfile?.company_id || !jobId) return;
      try {
        const {data, error} = await supabase
          .from('job_parts')
          .insert({
            job_id: jobId,
            company_id: userProfile.company_id,
            name: name.trim(),
            quantity,
            status: 'needed' as PartStatus,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) setParts((prev) => [...prev, data as JobPart]);
      } catch (e) {
        console.error('addPart error:', e);
      }
    },
    [jobId, userProfile?.company_id],
  );

  const cycleStatus = useCallback(async (partId: string) => {
    setParts((prev) =>
      prev.map((p) =>
        p.id === partId ? {...p, status: NEXT_STATUS[p.status]} : p,
      ),
    );
    try {
      const current = parts.find((p) => p.id === partId);
      if (!current) return;
      const {error} = await supabase
        .from('job_parts')
        .update({status: NEXT_STATUS[current.status], updated_at: new Date().toISOString()})
        .eq('id', partId);
      if (error) throw error;
    } catch (e) {
      console.error('cycleStatus error:', e);
      fetchParts();
    }
  }, [parts, fetchParts]);

  const removePart = useCallback(
    async (partId: string) => {
      setParts((prev) => prev.filter((p) => p.id !== partId));
      try {
        const {error} = await supabase.from('job_parts').delete().eq('id', partId);
        if (error) throw error;
      } catch (e) {
        console.error('removePart error:', e);
        fetchParts();
      }
    },
    [fetchParts],
  );

  return {parts, loading, fetchParts, addPart, cycleStatus, removePart};
}
