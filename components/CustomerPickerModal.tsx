// ─── CustomerPickerModal ─────────────────────────────────────────────
// Slide-up modal for searching and selecting an existing customer.

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { UI } from '../constants/theme';
import { useAppTheme } from '../src/context/ThemeContext';
import { Customer } from '../src/types';
import { Avatar } from './Avatar';

interface CustomerPickerModalProps {
  visible: boolean;
  onClose: () => void;
  customers: Customer[];
  search: string;
  onSearch: (text: string) => void;
  onSelect: (customer: Customer) => void;
}

export function CustomerPickerModal({
  visible,
  onClose,
  customers,
  search,
  onSearch,
  onSelect,
}: CustomerPickerModalProps) {
  const { theme, isDark } = useAppTheme();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

          <Animated.View entering={FadeInDown.duration(350).springify()} style={[s.modal, isDark && { backgroundColor: theme.surface.card }]}>
            {/* Header */}
            <View style={s.header}>
              <View style={s.titleRow}>
                <LinearGradient colors={isDark ? [theme.brand.primary, theme.brand.primaryDark] as [string, string] : UI.gradients.primary} style={s.titleIcon}>
                  <Ionicons name="people" size={18} color={isDark ? theme.text.inverse : UI.text.white} />
                </LinearGradient>
                <Text style={[s.title, isDark && { color: theme.text.title }]}>Select Customer</Text>
              </View>
              <TouchableOpacity style={[s.closeBtn, isDark && { backgroundColor: theme.surface.elevated }]} onPress={onClose}>
                <Ionicons name="close" size={20} color={isDark ? theme.text.muted : UI.text.muted} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[s.searchRow, isDark && { backgroundColor: theme.surface.elevated, borderColor: theme.surface.border }]}>
              <Ionicons name="search" size={18} color={isDark ? theme.text.muted : UI.text.muted} />
              <TextInput
                style={[s.searchInput, isDark && { color: theme.text.title }]}
                placeholder="Search by name, address, email…"
                placeholderTextColor={isDark ? theme.text.placeholder : '#94a3b8'}
                value={search}
                onChangeText={onSearch}
                autoFocus
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => onSearch('')}>
                  <Ionicons name="close-circle" size={18} color={isDark ? theme.text.muted : UI.surface.border} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={[s.count, isDark && { color: theme.text.muted }]}>
              {customers.length} customer{customers.length !== 1 ? 's' : ''}
              {search ? ' found' : ''}
            </Text>

            {/* List */}
            <FlatList
              data={customers}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingBottom: 20 }}
              ListEmptyComponent={
                <View style={s.empty}>
                  <Ionicons name="search-outline" size={40} color={isDark ? theme.text.muted : UI.surface.border} />
                  <Text style={[s.emptyText, isDark && { color: theme.text.muted }]}>No customers found</Text>
                  <Text style={[s.emptySub, isDark && { color: theme.text.placeholder }]}>Try a different search term</Text>
                </View>
              }
              renderItem={({ item, index }) => (
                <Animated.View entering={FadeInDown.delay(index * 40).duration(250)}>
                  <TouchableOpacity
                    style={[s.row, isDark && { borderBottomColor: theme.surface.border }]}
                    activeOpacity={0.6}
                    onPress={() => onSelect(item)}
                  >
                    <Avatar name={item.name} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.name, isDark && { color: theme.text.title }]}>{item.name}</Text>
                      {item.company_name ? (
                        <Text style={[s.company, isDark && { color: theme.brand.primary }]}>{item.company_name}</Text>
                      ) : null}
                      <Text style={[s.addr, isDark && { color: theme.text.muted }]} numberOfLines={1}>{item.address}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={isDark ? theme.text.muted : UI.surface.border} />
                  </TouchableOpacity>
                </Animated.View>
              )}
            />
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: UI.text.title },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: UI.surface.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.surface.base,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: UI.surface.divider,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: UI.text.title,
  },
  count: {
    fontSize: 12,
    color: UI.text.muted,
    fontWeight: '600',
    marginBottom: 8,
    paddingLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: UI.surface.elevated,
  },
  name: { fontSize: 16, fontWeight: '700', color: UI.text.title },
  company: { fontSize: 12, color: UI.brand.primary, fontWeight: '500', marginTop: 1 },
  addr: { fontSize: 13, color: UI.text.muted, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: UI.text.muted },
  emptySub: { fontSize: 13, color: UI.surface.border },
});
