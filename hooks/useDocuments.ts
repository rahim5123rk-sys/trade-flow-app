import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../src/config/supabase';
import { useAuth } from '../src/context/AuthContext';
import { Document } from '../src/types';
import { buildDocumentTypeQueryFilters, DocumentFilterKey, matchesDocumentFilters } from '../src/utils/documentFilters';
import { withQueryTimeout } from '../src/utils/withTimeout';

const PAGE_SIZE = 50;

const DOCUMENTS_SELECT = 'id, type, status, reference, created_at, expiry_date, customer_snapshot, company_id, user_id, number, date, total, payment_info';

interface UseDocumentsOptions {
  typeFilters?: DocumentFilterKey[];
}

export function useDocuments(options: UseDocumentsOptions = {}) {
  const { userProfile, role, session } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(Boolean(session && userProfile?.company_id));
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filtersRef = useRef(options.typeFilters);
  filtersRef.current = options.typeFilters;

  const fetchPage = useCallback(async (cursor: string | null, searchTerm?: string, append = false) => {
    if (!userProfile?.company_id) return;

    try {
      let query = supabase
        .from('documents')
        .select(DOCUMENTS_SELECT)
        .eq('company_id', userProfile.company_id)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      if (role !== 'admin' && userProfile.id) {
        query = query.eq('user_id', userProfile.id);
      }

      const filters = filtersRef.current;
      const queryFilters = buildDocumentTypeQueryFilters(filters);
      if (queryFilters && queryFilters.length > 0) {
        query = query.in('type', queryFilters);
      }

      if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.trim();
        query = query.or(`reference.ilike.%${term}%`);
      }

      const result = await withQueryTimeout(query, 10000);
      if (!result) throw new Error('Query timed out');
      const { data, error } = result;
      if (error) throw error;

      const rows = ((data || []) as Document[]).filter((doc) => matchesDocumentFilters(doc, filters));
      setDocuments(prev => append ? [...prev, ...rows] : rows);
      setHasMore((data || []).length === PAGE_SIZE);

      if (rows.length > 0) {
        cursorRef.current = rows[rows.length - 1].created_at;
      }
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
    cursorRef.current = null;
    fetchPage(null, search.trim() || undefined);
  }, [fetchPage, search]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    fetchPage(cursorRef.current, search.trim() || undefined, true);
  }, [hasMore, loadingMore, loading, fetchPage, search]);

  // Debounced server-side search
  useEffect(() => {
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
  }, [search, options.typeFilters?.join(',')]);

  // Initial fetch on mount — only when session AND profile are ready
  useEffect(() => {
    if (!session || !userProfile?.company_id) return;
    setLoading(true);
    cursorRef.current = null;
    fetchPage(null, search.trim() || undefined);
  }, [session, userProfile?.company_id]);

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
