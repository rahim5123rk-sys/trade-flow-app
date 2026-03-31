import {useCallback, useEffect, useRef, useState} from 'react';
import {supabase} from '../src/config/supabase';
import {useAuth} from '../src/context/AuthContext';
import {withQueryTimeout} from '../src/utils/withTimeout';

export interface Note {
  id: string;
  company_id: string;
  user_id: string;
  content: string;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

const NOTES_PAGE_SIZE = 50;

export function useNotes() {
  const {userProfile, user, session} = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(Boolean(session && userProfile?.company_id));
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const fetchPage = useCallback(async (offset: number, searchTerm?: string, append = false) => {
    if (!userProfile?.company_id || !user?.id) return;
    try {
      let query = supabase
        .from('notes')
        .select('*')
        .eq('company_id', userProfile.company_id)
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('is_pinned', {ascending: false})
        .order('updated_at', {ascending: false})
        .range(offset, offset + NOTES_PAGE_SIZE - 1);

      if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.trim();
        query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
      }

      const result = await withQueryTimeout(query, 10000);
      if (!result) throw new Error('Query timed out');
      const {data, error} = result;
      if (error) throw error;

      const rows = (data || []) as Note[];
      setNotes((prev) => append ? [...prev, ...rows] : rows);
      setHasMore(rows.length === NOTES_PAGE_SIZE);
      offsetRef.current = offset + rows.length;
    } catch (e) {
      console.error('useNotes fetch error:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userProfile?.company_id, user?.id]);

  const fetchNotes = useCallback(() => {
    setLoading(true);
    offsetRef.current = 0;
    fetchPage(0, search.trim() || undefined);
  }, [fetchPage, search]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    fetchPage(offsetRef.current, search.trim() || undefined, true);
  }, [hasMore, loadingMore, loading, fetchPage, search]);

  // Initial fetch — only when session AND profile are ready
  useEffect(() => {
    if (session && userProfile?.company_id && user?.id) {
      setLoading(true);
      offsetRef.current = 0;
      fetchPage(0);
    }
  }, [session, userProfile?.company_id, user?.id]);

  // Debounced server-side search
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    searchTimerRef.current = setTimeout(() => {
      if (!userProfile?.company_id || !user?.id) return;
      setLoading(true);
      offsetRef.current = 0;
      fetchPage(0, search.trim() || undefined);
    }, 300);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  const filteredNotes = notes;

  const createNote = useCallback(
    async (content: string) => {
      if (!userProfile?.company_id || !user?.id) return null;
      try {
        const {data, error} = await supabase
          .from('notes')
          .insert({
            company_id: userProfile.company_id,
            user_id: user.id,
            content: content.trim(),
          })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setNotes((prev) => [data as Note, ...prev]);
          return data as Note;
        }
      } catch (e) {
        console.error('createNote error:', e);
      }
      return null;
    },
    [userProfile?.company_id, user?.id],
  );

  const updateNote = useCallback(
    async (noteId: string, content: string) => {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId ? {...n, content, updated_at: new Date().toISOString()} : n,
        ),
      );
      try {
        const {error} = await supabase
          .from('notes')
          .update({content: content.trim(), updated_at: new Date().toISOString()})
          .eq('id', noteId);
        if (error) throw error;
      } catch (e) {
        console.error('updateNote error:', e);
        fetchNotes();
      }
    },
    [fetchNotes],
  );

  const togglePin = useCallback(
    async (noteId: string) => {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;
      const newPinned = !note.is_pinned;
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? {...n, is_pinned: newPinned} : n)),
      );
      try {
        const {error} = await supabase
          .from('notes')
          .update({is_pinned: newPinned})
          .eq('id', noteId);
        if (error) throw error;
      } catch (e) {
        console.error('togglePin error:', e);
        fetchNotes();
      }
    },
    [notes, fetchNotes],
  );

  const archiveNote = useCallback(
    async (noteId: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      try {
        const {error} = await supabase
          .from('notes')
          .update({is_archived: true})
          .eq('id', noteId);
        if (error) throw error;
      } catch (e) {
        console.error('archiveNote error:', e);
        fetchNotes();
      }
    },
    [fetchNotes],
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      try {
        const {error} = await supabase.from('notes').delete().eq('id', noteId);
        if (error) throw error;
      } catch (e) {
        console.error('deleteNote error:', e);
        fetchNotes();
      }
    },
    [fetchNotes],
  );

  return {
    notes,
    filteredNotes,
    loading,
    search,
    setSearch,
    hasMore,
    loadingMore,
    loadMore,
    fetchNotes,
    createNote,
    updateNote,
    togglePin,
    archiveNote,
    deleteNote,
  };
}
