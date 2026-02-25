import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../src/config/supabase';
import { useAuth } from '../src/context/AuthContext';
import { Customer } from '../src/types';

// ─── Fetch & Filter Hook ────────────────────────────────────────────

export function useCustomers() {
  const { userProfile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchCustomers = useCallback(async () => {
    if (!userProfile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', userProfile.company_id)
        .order('name', { ascending: true });

      if (error) throw error;
      if (data) setCustomers(data as Customer[]);
    } catch (e) {
      console.error('useCustomers fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userProfile?.company_id]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
    );
  }, [customers, search]);

  return {
    customers,
    filteredCustomers,
    loading,
    refreshing,
    search,
    setSearch,
    fetchCustomers,
    onRefresh,
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

export function useCustomerDetail(customerId: string | undefined) {
  const { userProfile } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!customerId || !userProfile?.company_id) return;
    setLoading(true);

    try {
      const [custResult, jobsResult] = await Promise.all([
        supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .eq('company_id', userProfile.company_id)
          .single(),
        supabase
          .from('jobs')
          .select('*')
          .eq('customer_id', customerId)
          .eq('company_id', userProfile.company_id)
          .order('scheduled_date', { ascending: false }),
      ]);

      if (custResult.data) setCustomer(custResult.data as Customer);
      if (jobsResult.data) setJobs(jobsResult.data);
    } catch (e) {
      console.error('useCustomerDetail error:', e);
    } finally {
      setLoading(false);
    }
  }, [customerId, userProfile?.company_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { customer, jobs, loading, refetch: fetchData };
}