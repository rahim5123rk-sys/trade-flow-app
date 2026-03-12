import {useCallback, useEffect, useMemo, useState} from 'react';
import {supabase} from '../src/config/supabase';
import {useAuth} from '../src/context/AuthContext';

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

export function useNotes() {
  const {userProfile, user} = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchNotes = useCallback(async () => {
    if (!userProfile?.company_id || !user?.id) return;
    try {
      const {data, error} = await supabase
        .from('notes')
        .select('*')
        .eq('company_id', userProfile.company_id)
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('is_pinned', {ascending: false})
        .order('updated_at', {ascending: false});
      if (error) throw error;
      if (data) setNotes(data as Note[]);
    } catch (e) {
      console.error('useNotes fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.company_id, user?.id]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const filteredNotes = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter((n) => n.content.toLowerCase().includes(q));
  }, [notes, search]);

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
    fetchNotes,
    createNote,
    updateNote,
    togglePin,
    archiveNote,
    deleteNote,
  };
}
