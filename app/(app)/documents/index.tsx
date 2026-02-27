// ============================================
// FILE: app/(app)/documents/index.tsx
// Central Hub for Quotes, Invoices & CP12s
// ============================================

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, UI} from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';
import { Document } from '../../../src/types';

// ─── Constants ──────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  Draft: { color: UI.text.muted, bg: UI.surface.elevated },
  Sent: { color: UI.brand.accent, bg: '#eff6ff' },
  Accepted: { color: '#15803d', bg: '#f0fdf4' },
  Declined: { color: UI.brand.danger, bg: '#fef2f2' },
  Unpaid: { color: '#c2410c', bg: '#fff7ed' },
  Paid: { color: '#047857', bg: '#f0fdf4' },
  Overdue: { color: UI.brand.danger, bg: '#fef2f2' },
  Issued: { color: '#0284c7', bg: '#f0f9ff' },
};

const GLASS_BG = Platform.OS === 'ios' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.92)';
const GLASS_BORDER = 'rgba(255,255,255,0.80)';

type FilterType = 'all' | 'invoice' | 'quote' | 'cp12' | 'unpaid' | 'draft';

const FILTERS: { key: FilterType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'albums-outline' },
  { key: 'invoice', label: 'Invoices', icon: 'receipt-outline' },
  { key: 'quote', label: 'Quotes', icon: 'document-text-outline' },
  { key: 'cp12', label: 'CP12', icon: 'shield-checkmark-outline' },
  { key: 'unpaid', label: 'Unpaid', icon: 'alert-circle-outline' },
  { key: 'draft', label: 'Drafts', icon: 'create-outline' },
];

// ─── Helpers ────────────────────────────────────────────────────

const isCp12Document = (doc: Document): boolean => {
  if (doc.type === 'cp12') return true;
  if (doc.reference?.startsWith('CP12-')) return true;
  if (!doc.payment_info) return false;
  try {
    const parsed = JSON.parse(doc.payment_info);
    return parsed?.kind === 'cp12';
  } catch {
    return false;
  }
};

// ─── Screen ─────────────────────────────────────────────────────

export default function DocumentsHubScreen() {
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (userProfile?.company_id) fetchDocuments();
  }, [userProfile, filter]);

  const fetchDocuments = useCallback(async () => {
    if (!userProfile?.company_id) return;

    let query = supabase
      .from('documents')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .order('created_at', { ascending: false });

    if (filter === 'invoice') {
      query = query.eq('type', 'invoice');
    } else if (filter === 'quote') {
      query = query.eq('type', 'quote');
    } else if (filter === 'cp12') {
      query = query.eq('type', 'cp12');
    } else if (filter === 'unpaid') {
      query = query.in('status', ['Unpaid', 'Overdue']);
    } else if (filter === 'draft') {
      query = query.eq('status', 'Draft');
    }

    const { data, error } = await query;
    if (error) console.error('Error fetching documents:', error);

    if (data) {
      // For the cp12 filter, also include legacy quote-type CP12s
      if (filter === 'cp12') {
        const legacyCp12Query = await supabase
          .from('documents')
          .select('*')
          .eq('company_id', userProfile.company_id)
          .neq('type', 'cp12')
          .ilike('reference', 'CP12-%')
          .order('created_at', { ascending: false });
        const merged = [...data, ...(legacyCp12Query.data || [])];
        const unique = merged.filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i);
        setDocuments(unique as Document[]);
      } else {
        setDocuments(data as Document[]);
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, [userProfile?.company_id, filter]);

  const handleDelete = (doc: Document) => {
    const isCp12 = isCp12Document(doc);
    const label = isCp12 ? 'CP12 Certificate' : doc.type === 'invoice' ? 'Invoice' : 'Quote';
    Alert.alert(
      `Delete ${label}`,
      `Are you sure you want to delete ${isCp12 ? `${doc.reference || `CP12 #${doc.number}`}` : `${doc.type === 'invoice' ? 'Invoice' : 'Quote'} #${doc.number}`}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('documents').delete().eq('id', doc.id);
            if (error) {
              Alert.alert('Error', 'Could not delete document.');
            } else {
              setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
            }
          },
        },
      ]
    );
  };

  // ─── Stats ──────────────────────────────────────────────────

  const stats = {
    invoices: documents.filter((d) => d.type === 'invoice' && !isCp12Document(d)).length,
    quotes: documents.filter((d) => d.type === 'quote' && !isCp12Document(d)).length,
    cp12s: documents.filter((d) => isCp12Document(d)).length,
  };

  // ─── Filtered list ────────────────────────────────────────────

  const filteredDocuments = documents.filter((doc) => {
    // CP12 filter: also catch legacy ones stored as 'quote' type
    if (filter === 'cp12' && !isCp12Document(doc)) return false;
    // For non-CP12 filters, exclude CP12 docs from invoice/quote views
    if (filter === 'invoice' && isCp12Document(doc)) return false;
    if (filter === 'quote' && isCp12Document(doc)) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      doc.customer_snapshot?.name?.toLowerCase().includes(q) ||
      doc.reference?.toLowerCase().includes(q) ||
      String(doc.number).includes(q)
    );
  });

  // ─── Render card ──────────────────────────────────────────────

  const renderDocument = ({ item, index }: { item: Document; index: number }) => {
    const isCp12 = isCp12Document(item);
    const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.Draft;
    const isInvoice = item.type === 'invoice' && !isCp12;

    const renderRightActions = () => (
      <TouchableOpacity style={st.deleteSwipeBtn} onPress={() => handleDelete(item)}>
        <Ionicons name="trash-outline" size={24} color={UI.text.white} />
        <Text style={st.deleteSwipeText}>Delete</Text>
      </TouchableOpacity>
    );

    // Card gradient & icon config
    const cardConfig = isCp12
      ? { gradient: UI.gradients.cp12, icon: 'shield-checkmark-outline' as const, iconBg: UI.surface.base, iconColor: UI.brand.primary }
      : isInvoice
        ? { gradient: UI.gradients.amberLight, icon: 'receipt-outline' as const, iconBg: '#FFF7ED', iconColor: '#C2410C' }
        : { gradient: UI.gradients.primary, icon: 'document-text-outline' as const, iconBg: UI.surface.primaryLight, iconColor: UI.brand.primary };

    return (
      <Animated.View entering={FadeInRight.delay(Math.min(index * 50, 300)).springify()}>
        <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
          <TouchableOpacity
            style={st.card}
            activeOpacity={0.7}
            onPress={() => router.push(`/(app)/documents/${item.id}` as any)}
          >
            <LinearGradient colors={[...cardConfig.gradient]} style={st.cardStrip} />

            <View style={st.cardBody}>
              {/* Top row */}
              <View style={st.cardTopRow}>
                <View style={[st.typeIcon, { backgroundColor: cardConfig.iconBg }]}>
                  <Ionicons name={cardConfig.icon} size={18} color={cardConfig.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.cardRef}>
                    {isCp12
                      ? item.reference || `CP12-${String(item.number).padStart(4, '0')}`
                      : `${isInvoice ? 'INV' : 'QTE'}-${String(item.number).padStart(4, '0')}`}
                  </Text>
                  <Text style={st.cardCustomer} numberOfLines={1}>
                    {item.customer_snapshot?.name || 'Unknown Customer'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {isCp12 ? (
                    <View style={st.cp12Badge}>
                      <Ionicons name="shield-checkmark" size={12} color={UI.text.white} />
                      <Text style={st.cp12BadgeText}>CP12</Text>
                    </View>
                  ) : (
                    <Text style={st.cardTotal}>£{item.total?.toFixed(2) || '0.00'}</Text>
                  )}
                  <View style={[st.statusBadge, { backgroundColor: isCp12 ? UI.surface.base : statusStyle.bg }]}>
                    <View style={[st.statusDot, { backgroundColor: isCp12 ? '#0284c7' : statusStyle.color }]} />
                    <Text style={[st.statusText, { color: isCp12 ? '#0284c7' : statusStyle.color }]}>
                      {isCp12 ? 'Issued' : item.status}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Bottom meta */}
              <View style={st.cardBottomRow}>
                <View style={st.cardMeta}>
                  <Ionicons name="calendar-outline" size={12} color={UI.text.muted} />
                  <Text style={st.cardDate}>
                    {new Date(item.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                {isCp12 && item.expiry_date && (
                  <View style={st.cardMeta}>
                    <Ionicons name="time-outline" size={12} color={UI.status.pending} />
                    <Text style={[st.cardDate, { color: UI.status.pending }]}>Due: {item.expiry_date}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={UI.surface.border} />
              </View>
            </View>
          </TouchableOpacity>
        </Swipeable>
      </Animated.View>
    );
  };

  // ─── Screen ───────────────────────────────────────────────────

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={st.root}>
        <LinearGradient
          colors={UI.gradients.appBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={{ flex: 1, paddingTop: insets.top }}>
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(50).springify()} style={st.header}>
            <View>
              <Text style={st.screenTitle}>Documents</Text>
              <Text style={st.screenSubtitle}>Invoices, Quotes & CP12s</Text>
            </View>
            <View style={st.headerBadges}>
              <View style={[st.countBadge, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="receipt-outline" size={12} color="#C2410C" />
                <Text style={[st.countText, { color: '#C2410C' }]}>{stats.invoices}</Text>
              </View>
              <View style={[st.countBadge, { backgroundColor: UI.surface.primaryLight }]}>
                <Ionicons name="document-text-outline" size={12} color={UI.brand.primary} />
                <Text style={[st.countText, { color: UI.brand.primary }]}>{stats.quotes}</Text>
              </View>
              <View style={[st.countBadge, { backgroundColor: UI.surface.base }]}>
                <Ionicons name="shield-checkmark-outline" size={12} color={UI.brand.primary} />
                <Text style={[st.countText, { color: UI.brand.primary }]}>{stats.cp12s}</Text>
              </View>
            </View>
          </Animated.View>

          {/* Quick Create */}
          <Animated.View entering={FadeInDown.delay(100).springify()} style={st.createRow}>
            <TouchableOpacity
              style={st.createBtn}
              activeOpacity={0.75}
              onPress={() => router.push('/(app)/invoice' as any)}
            >
              <LinearGradient colors={UI.gradients.amberLight} style={st.createGradient}>
                <Ionicons name="receipt" size={18} color={UI.text.white} />
              </LinearGradient>
              <Text style={st.createBtnText}>Invoice</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={st.createBtn}
              activeOpacity={0.75}
              onPress={() => router.push('/(app)/quote' as any)}
            >
              <LinearGradient colors={UI.gradients.violet} style={st.createGradient}>
                <Ionicons name="document-text" size={18} color={UI.text.white} />
              </LinearGradient>
              <Text style={st.createBtnText}>Quote</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={st.createBtn}
              activeOpacity={0.75}
              onPress={() => router.push('/(app)/cp12' as any)}
            >
              <LinearGradient colors={UI.gradients.cp12} style={st.createGradient}>
                <Ionicons name="shield-checkmark" size={18} color={UI.text.white} />
              </LinearGradient>
              <Text style={st.createBtnText}>CP12</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Search */}
          <Animated.View entering={FadeInDown.delay(150).springify()} style={st.searchWrap}>
            <View style={st.searchBar}>
              <Ionicons name="search" size={18} color={UI.text.muted} />
              <TextInput
                style={st.searchInput}
                placeholder="Search by name, ref or number..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={UI.text.muted} />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>

          {/* Filter Chips */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={FILTERS}
              keyExtractor={(item) => item.key}
              contentContainerStyle={st.filterRow}
              renderItem={({ item }) => {
                const active = filter === item.key;
                return (
                  <TouchableOpacity
                    style={[st.filterChip, active && st.filterChipActive]}
                    onPress={() => setFilter(item.key)}
                  >
                    {active ? (
                      <LinearGradient
                        colors={
                          item.key === 'cp12'
                            ? (UI.gradients.cp12)
                            : (UI.gradients.primary)
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={st.filterChipGradient}
                      >
                        <Ionicons name={item.icon} size={13} color={UI.text.white} style={{ marginRight: 4 }} />
                        <Text style={st.filterTextActive}>{item.label}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={st.filterChipInner}>
                        <Ionicons name={item.icon} size={13} color={UI.text.muted} style={{ marginRight: 4 }} />
                        <Text style={st.filterText}>{item.label}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </Animated.View>

          {/* Document List */}
          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={filteredDocuments}
              keyExtractor={(item) => item.id}
              renderItem={renderDocument}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, paddingTop: 8 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    fetchDocuments();
                  }}
                  tintColor={Colors.primary}
                />
              }
              ListEmptyComponent={
                <View style={st.emptyCard}>
                  <View style={st.emptyIconWrap}>
                    <Ionicons
                      name={filter === 'cp12' ? 'shield-checkmark-outline' : 'documents-outline'}
                      size={28}
                      color={UI.text.muted}                     />
                  </View>
                  <Text style={st.emptyTitle}>
                    {filter === 'cp12'
                      ? 'No CP12 certificates yet'
                      : filter === 'invoice'
                        ? 'No invoices found'
                        : filter === 'quote'
                          ? 'No quotes found'
                          : 'No documents found'}
                  </Text>
                  <Text style={st.emptySubtitle}>
                    {filter === 'cp12'
                      ? 'Create your first gas safety certificate above.'
                      : 'Try adjusting your filters or create one above.'}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4FF' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  screenTitle: { fontSize: 28, fontWeight: '800', color: UI.text.title, letterSpacing: -0.5 },
  screenSubtitle: { fontSize: 13, color: UI.text.muted, fontWeight: '500', marginTop: 2 },
  headerBadges: { flexDirection: 'row', gap: 6 },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  countText: { fontSize: 12, fontWeight: '700' },

  // Quick Create
  createRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  createBtn: {
    flex: 1,
    backgroundColor: GLASS_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    alignItems: 'center',
    shadowColor: UI.text.muted,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  createGradient: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: UI.text.title,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  createBtnText: { fontSize: 12, fontWeight: '700', color: UI.text.bodyLight },

  // Search
  searchWrap: { paddingHorizontal: 20, marginBottom: 14 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 14,
    shadowColor: UI.text.muted,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: UI.text.title, height: '100%' },

  // Filters
  filterRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  filterChip: {
    borderRadius: 20,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
  },
  filterChipActive: { borderColor: 'transparent' },
  filterChipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterText: { fontSize: 13, fontWeight: '600', color: UI.text.muted },
  filterTextActive: { fontSize: 13, fontWeight: '700', color: UI.text.white },

  // Cards
  card: {
    flexDirection: 'row',
    backgroundColor: GLASS_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: UI.text.muted,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardStrip: { width: 4, alignSelf: 'stretch' },
  cardBody: { flex: 1, padding: 16 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardRef: { fontSize: 11, fontWeight: '700', color: UI.text.muted, letterSpacing: 0.3 },
  cardCustomer: { fontSize: 15, fontWeight: '700', color: UI.text.title, marginTop: 2 },
  cardTotal: { fontSize: 17, fontWeight: '800', color: UI.text.title },
  cp12Badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: UI.brand.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cp12BadgeText: { fontSize: 11, fontWeight: '800', color: UI.text.white, letterSpacing: 0.5 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(241,245,249,0.8)',
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardDate: { fontSize: 12, color: UI.text.muted },

  // Swipe to Delete
  deleteSwipeBtn: {
    backgroundColor: UI.brand.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginBottom: 10,
    marginLeft: 10,
  },
  deleteSwipeText: { color: UI.text.white, fontSize: 11, fontWeight: '700', marginTop: 4 },

  // Empty state
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: GLASS_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginTop: 40,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: UI.surface.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: UI.text.bodyLight, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: UI.text.muted, textAlign: 'center' },
});
