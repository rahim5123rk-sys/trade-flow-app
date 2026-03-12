import {Ionicons} from '@expo/vector-icons';
import {router, useFocusEffect} from 'expo-router';
import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {UI} from '../../../constants/theme';
import {useNotes, Note} from '../../../hooks/useNotes';
import {useAppTheme} from '../../../src/context/ThemeContext';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'});
}

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const {theme, isDark} = useAppTheme();
  const {filteredNotes, loading, search, setSearch, fetchNotes, createNote, updateNote, togglePin, archiveNote, deleteNote} = useNotes();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteText, setNoteText] = useState('');

  useFocusEffect(useCallback(() => { fetchNotes(); }, [fetchNotes]));

  const openNew = () => {
    setEditingNote(null);
    setNoteText('');
    setModalVisible(true);
  };

  const openEdit = (note: Note) => {
    setEditingNote(note);
    setNoteText(note.content);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!noteText.trim()) return;
    if (editingNote) {
      await updateNote(editingNote.id, noteText);
    } else {
      await createNote(noteText);
    }
    setModalVisible(false);
  };

  const handleLongPress = (note: Note) => {
    Alert.alert(note.is_pinned ? 'Unpin Note' : 'Pin Note', undefined, [
      {text: 'Cancel', style: 'cancel'},
      {text: note.is_pinned ? 'Unpin' : 'Pin', onPress: () => togglePin(note.id)},
      {text: 'Archive', onPress: () => archiveNote(note.id)},
      {text: 'Delete', style: 'destructive', onPress: () => deleteNote(note.id)},
    ]);
  };

  const renderNote = ({item, index}: {item: Note; index: number}) => {
    const firstLine = item.content.split('\n')[0].slice(0, 80);
    const hasMore = item.content.length > 80 || item.content.includes('\n');

    return (
      <Animated.View entering={FadeInDown.delay(50 * Math.min(index, 8)).springify()}>
        <TouchableOpacity
          onPress={() => openEdit(item)}
          onLongPress={() => handleLongPress(item)}
          activeOpacity={0.7}
          style={[s.noteCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
        >
          <View style={s.noteHeader}>
            {item.is_pinned && <Ionicons name="pin" size={12} color={theme.brand.primary} style={{marginRight: 4}} />}
            <Text style={[s.noteTime, isDark && {color: theme.text.muted}]}>{timeAgo(item.updated_at)}</Text>
          </View>
          <Text style={[s.noteTitle, isDark && {color: theme.text.title}]} numberOfLines={1}>{firstLine}</Text>
          {hasMore && (
            <Text style={[s.notePreview, isDark && {color: theme.text.muted}]} numberOfLines={2}>
              {item.content.slice(firstLine.length).trim()}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[s.container, {paddingTop: insets.top, backgroundColor: theme.surface.base}]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={theme.text.title} />
        </TouchableOpacity>
        <Text style={[s.screenTitle, {color: theme.text.title}]}>Notes</Text>
        <View style={{width: 36}} />
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={isDark ? theme.text.muted : UI.text.muted} style={{marginRight: 8}} />
        <TextInput
          style={[s.searchInput, isDark && {color: theme.text.title}]}
          placeholder="Search notes..."
          placeholderTextColor={isDark ? theme.text.placeholder : UI.text.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator style={{marginTop: 40}} color={theme.brand.primary} />
      ) : (
        <FlatList
          data={filteredNotes}
          keyExtractor={(item) => item.id}
          renderItem={renderNote}
          contentContainerStyle={[s.list, {paddingBottom: insets.bottom + 120}]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="document-text-outline" size={48} color={isDark ? theme.text.muted : UI.text.muted} />
              <Text style={[s.emptyText, isDark && {color: theme.text.muted}]}>No notes yet</Text>
              <Text style={[s.emptySubtext, isDark && {color: theme.text.muted}]}>Tap + to create one</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={openNew}
        activeOpacity={0.85}
        style={[
          s.fab,
          {bottom: insets.bottom + 100, zIndex: 20, elevation: 12},
        ]}
        accessibilityLabel="Add note"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Editor Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={s.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[s.modalCard, isDark && {backgroundColor: theme.surface.card}, {paddingBottom: insets.bottom + 16}]}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={[s.modalCancel, {color: theme.text.muted}]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[s.modalTitle, {color: theme.text.title}]}>{editingNote ? 'Edit Note' : 'New Note'}</Text>
              <TouchableOpacity onPress={handleSave} disabled={!noteText.trim()}>
                <Text style={[s.modalSave, {color: theme.brand.primary}, !noteText.trim() && {opacity: 0.4}]}>Save</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[s.modalInput, isDark && {color: theme.text.title}]}
              placeholder="Write your note..."
              placeholderTextColor={isDark ? theme.text.placeholder : UI.text.muted}
              multiline
              autoFocus
              value={noteText}
              onChangeText={setNoteText}
              textAlignVertical="top"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {flex: 1},
  header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12},
  backBtn: {width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center'},
  screenTitle: {flex: 1, fontSize: 20, fontWeight: '800', textAlign: 'center'},
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: UI.surface.base,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  searchInput: {flex: 1, fontSize: 14, color: UI.text.title, padding: 0},
  list: {paddingHorizontal: 16},
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  noteHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 4},
  noteTime: {fontSize: 11, color: UI.text.muted, fontWeight: '500'},
  noteTitle: {fontSize: 15, fontWeight: '700', color: UI.text.title, marginBottom: 2},
  notePreview: {fontSize: 13, color: UI.text.muted, lineHeight: 18},
  emptyWrap: {alignItems: 'center', marginTop: 80},
  emptyText: {fontSize: 16, fontWeight: '600', color: UI.text.muted, marginTop: 12},
  emptySubtext: {fontSize: 13, color: UI.text.muted, marginTop: 4},
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1D4ED8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modalBackdrop: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)'},
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    minHeight: 320,
  },
  modalHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16},
  modalCancel: {fontSize: 15, fontWeight: '500'},
  modalTitle: {fontSize: 16, fontWeight: '700'},
  modalSave: {fontSize: 15, fontWeight: '700'},
  modalInput: {flex: 1, fontSize: 16, lineHeight: 24, color: UI.text.title},
});
