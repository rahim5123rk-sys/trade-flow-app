import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../src/config/supabase';
import { useAuth } from '../src/context/AuthContext';
import { Customer } from '../src/types';

// ─── Fetch & Filter Hook ────────────────────────────────────────────

const PAGE_SIZE = 50;

export function useCustomers() {
  const { userProfile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(Boolean(userProfile?.company_id));
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const fetchPage = useCallback(async (cursor: string | null, searchTerm?: string, append = false) => {
    if (!userProfile?.company_id) return;

    try {
      let query = supabase
        .from('customers')
        .select('id, name, email, phone, address, address_line_1, city, postal_code, company_id, created_at')
        .eq('company_id', userProfile.company_id)
        .order('name', { ascending: true })
        .limit(PAGE_SIZE);

      if (cursor) {
        query = query.gt('name', cursor);
      }

      if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.trim();
        query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as Customer[];
      setCustomers(prev => append ? [...prev, ...rows] : rows);
      setHasMore(rows.length === PAGE_SIZE);

      if (rows.length > 0) {
        cursorRef.current = rows[rows.length - 1].name;
      }
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
    if (userProfile?.company_id) {
      setLoading(true);
      cursorRef.current = null;
      fetchPage(null);
    }
  }, [userProfile?.company_id]);

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

// ─── Create Customer Hook ───────────────────────────────────────────

interface CreateCustomerParams {
  name: string;
  companyName?: string;
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
}

export function useCreateCustomer() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const createCustomer = async (
    params: CreateCustomerParams
  ): Promise<Customer | null> => {
    if (!userProfile?.company_id) {
      Alert.alert('Error', 'Company profile not loaded.');
      return null;
    }

    if (!params.name.trim() || !params.addressLine1.trim()) {
      Alert.alert('Missing Info', 'Name and Address Line 1 are required.');
      return null;
    }

    setLoading(true);

    try {
      const combinedAddress = [
        params.addressLine1,
        params.addressLine2,
        params.city,
        params.region,
        params.postalCode,
      ]
        .filter(Boolean)
        .join(', ');

      const { data, error } = await supabase
        .from('customers')
        .insert({
          company_id: userProfile.company_id,
          name: params.name.trim(),
          company_name: params.companyName?.trim() || null,
          address_line_1: params.addressLine1.trim(),
          address_line_2: params.addressLine2?.trim() || null,
          city: params.city?.trim() || null,
          region: params.region?.trim() || null,
          postal_code: params.postalCode?.trim().toUpperCase() || null,
          address: combinedAddress,
          phone: params.phone?.trim() || null,
          email: params.email?.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Customer;
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not add customer.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createCustomer, loading };
}

// ─── Single Customer + Jobs Hook ────────────────────────────────────

const CUSTOMER_JOBS_PAGE_SIZE = 50;

export function useCustomerDetail(customerId: string | undefined) {
  const { userProfile } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMoreJobs, setHasMoreJobs] = useState(false);
  const [loadingMoreJobs, setLoadingMoreJobs] = useState(false);
  const jobsCursorRef = useRef<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!customerId || !userProfile?.company_id) return;
    setLoading(true);
    jobsCursorRef.current = null;

    try {
      const [custResult, jobsResult] = await Promise.all([
        supabase
          .from('customers')
          .select('id, name, email, phone, address, address_line_1, city, postal_code, company_id, created_at')
          .eq('id', customerId)
          .eq('company_id', userProfile.company_id)
          .single(),
        supabase
          .from('jobs')
          .select('id, title, reference, status, scheduled_date, customer_snapshot, assigned_to, company_id')
          .eq('customer_id', customerId)
          .eq('company_id', userProfile.company_id)
          .order('scheduled_date', { ascending: false })
          .limit(CUSTOMER_JOBS_PAGE_SIZE),
      ]);

      if (custResult.data) setCustomer(custResult.data as Customer);
      if (jobsResult.data) {
        const rows = jobsResult.data;
        setJobs(rows);
        setHasMoreJobs(rows.length === CUSTOMER_JOBS_PAGE_SIZE);
        if (rows.length > 0) {
          jobsCursorRef.current = rows[rows.length - 1].scheduled_date;
        }
      }
    } catch (e) {
      console.error('useCustomerDetail error:', e);
    } finally {
      setLoading(false);
    }
  }, [customerId, userProfile?.company_id]);

  const loadMoreJobs = useCallback(async () => {
    if (!customerId || !userProfile?.company_id || !hasMoreJobs || loadingMoreJobs) return;
    setLoadingMoreJobs(true);

    try {
      let query = supabase
        .from('jobs')
        .select('id, title, reference, status, scheduled_date, customer_snapshot, assigned_to, company_id')
        .eq('customer_id', customerId)
        .eq('company_id', userProfile.company_id)
        .order('scheduled_date', { ascending: false })
        .limit(CUSTOMER_JOBS_PAGE_SIZE);

      if (jobsCursorRef.current) {
        query = query.lt('scheduled_date', jobsCursorRef.current);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = data || [];
      setJobs(prev => [...prev, ...rows]);
      setHasMoreJobs(rows.length === CUSTOMER_JOBS_PAGE_SIZE);
      if (rows.length > 0) {
        jobsCursorRef.current = rows[rows.length - 1].scheduled_date;
      }
    } catch (e) {
      console.error('useCustomerDetail loadMoreJobs error:', e);
    } finally {
      setLoadingMoreJobs(false);
    }
  }, [customerId, userProfile?.company_id, hasMoreJobs, loadingMoreJobs]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { customer, jobs, loading, hasMoreJobs, loadingMoreJobs, loadMoreJobs, refetch: fetchData };
}