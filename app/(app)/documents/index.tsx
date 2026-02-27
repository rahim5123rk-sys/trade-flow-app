// ============================================
// FILE: app/(app)/documents/index.tsx
// Central Hub for Quotes & Invoices – Modern UI
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
import { Colors } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';
import { Document } from '../../../src/types';

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  Draft: { color: '#64748b', bg: '#f1f5f9' },
  Sent: { color: '#2563eb', bg: '#eff6ff' },
  Accepted: { color: '#15803d', bg: '#f0fdf4' },
  Declined: { color: '#dc2626', bg: '#fef2f2' },
  Unpaid: { color: '#c2410c', bg: '#fff7ed' },
  Paid: { color: '#047857', bg: '#f0fdf4' },
  Overdue: { color: '#dc2626', bg: '#fef2f2' },
};

const GLASS_BG = Platform.OS === 'ios' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.88)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

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

export default function DocumentsHubScreen() {
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState<'all' | 'invoice' | 'quote' | 'unpaid' | 'draft'>('all');
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

    if (filter === 'invoice' || filter === 'quote') {
      query = query.eq('type', filter);
    } else if (filter === 'unpaid') {
      query = query.in('status', ['Unpaid', 'Overdue']);
    } else if (filter === 'draft') {
      query = query.eq('status', 'Draft');
    }

    const { data, error } = await query;
    if (error) console.error('Error fetching documents:', error);
    if (data) setDocuments(data as Document[]);
    setLoading(false);
    setRefreshing(false);
  }, [userProfile?.company_id, filter]);

  const handleDelete = (doc: Document) => {
    const isCp12 = isCp12Document(doc);
    Alert.alert(
      `Delete ${isCp12 ? 'CP12' : doc.type === 'invoice' ? 'Invoice' : 'Quote'}`,
      `Are you sure you want to delete ${isCp12 ? `CP12 ${doc.reference || `#${doc.number}`}` : `${doc.type === 'invoice' ? 'Invoice' : 'Quote'} #${doc.number}`}? This cannot be undone.`,
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

  const getStatusStyle = (status: string) => STATUS_COLORS[status] || STATUS_COLORS.Draft;

  const filteredDocuments = documents.filter((doc) => {
    if (!searchQuery) return true;
    return doc.customer_snapshot?.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const renderDocument = ({ item, index }: { item: Document; index: number }) => {
    const isCp12 = isCp12Document(item);
    const statusStyle = getStatusStyle(item.status);
    const isInvoice = item.type === 'invoice' && !isCp12;

    const renderRightActions = () => (
      <TouchableOpacity style={s.deleteSwipeBtn} onPress={() => handleDelete(item)}>
        <Ionicons name="trash-outline" size={24} color="#fff" />
        <Text style={s.deleteSwipeText}>Delete</Text>
      </TouchableOpacity>
    );

    return (
      <Animated.View entering={FadeInRight.delay(Math.min(index * 50, 300)).springify()}>
        <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
          <TouchableOpacity
            style={s.card}
            activeOpacity={0.7}
            onPress={() => router.push(`/(app)/documents/${item.id}` as any)}
          >
            {/* Left accent strip */}
            <LinearGradient
              colors={
                isCp12
                  ? ['#0EA5E9', '#2563EB'] as readonly [string, string]
                  : isInvoice
                  ? ['#F59E0B', '#FBBF24'] as readonly [string, string]
                  : ['#6366F1', '#818CF8'] as readonly [string, string]
              }
              style={s.cardStrip}
            />

            <View style={s.cardBody}>
              {/* Top row: type icon + ref + amount */}
              <View style={s.cardTopRow}>
                <View style={[s.typeIcon, { backgroundColor: isInvoice ? '#FFF7ED' : '#EEF2FF' }]}>
                  <Ionicons
                    name={isCp12 ? 'shield-checkmark-outline' : isInvoice ? 'receipt-outline' : 'document-text-outline'}
                    size={18}
                    color={isCp12 ? '#1D4ED8' : isInvoice ? '#C2410C' : '#6366F1'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardRef}>
                    {isCp12
                      ? item.reference || `CP12-${String(item.number).padStart(4, '0')}`
                      : `${isInvoice ? 'INV' : 'QTE'}-${String(item.number).padStart(4, '0')}`}
                  </Text>
                  <Text style={s.cardCustomer} numberOfLines={1}>
                    {item.customer_snapshot?.name || 'Unknown Customer'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.cardTotal}>{isCp12 ? 'CP12' : `£${item.total?.toFixed(2) || '0.00'}`}</Text>
                  <View style={[s.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <View style={[s.statusDot, { backgroundColor: statusStyle.color }]} />
                    <Text style={[s.statusText, { color: statusStyle.color }]}>{isCp12 ? 'Locked' : item.status}</Text>
                  </View>
                </View>
              </View>

              {/* Bottom meta row */}
              <View style={s.cardBottomRow}>
                <View style={s.cardMeta}>
                  <Ionicons name="calendar-outline" size={12} color="#94A3B8" />
                  <Text style={s.cardDate}>
                    {new Date(item.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </View>
            </View>
          </TouchableOpacity>
        </Swipeable>
      </Animated.View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={s.root}>
        {/* Background gradient */}
        <LinearGradient
          colors={['#EEF2FF', '#E0F2FE', '#F0FDFA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={{ flex: 1, paddingTop: insets.top }}>
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(50).springify()} style={s.header}>
            <View>
              <Text style={s.screenTitle}>Documents</Text>
              <Text style={s.screenSubtitle}>Quotes & Invoices</Text>
            </View>
            <View style={s.countBadge}>
              <Text style={s.countText}>{documents.length}</Text>
            </View>
          </Animated.View>

          {/* Quick Create Actions */}
          <Animated.View entering={FadeInDown.delay(100).springify()} style={s.createRow}>
            <TouchableOpacity
              style={s.createBtn}
              activeOpacity={0.75}
              onPress={() => router.push('/(app)/invoice' as any)}
            >
              <LinearGradient
                colors={['#F59E0B', '#FBBF24'] as readonly [string, string]}
                style={s.createGradient}
              >
                <Ionicons name="receipt" size={20} color="#fff" />
              </LinearGradient>
              <Text style={s.createBtnText}>New Invoice</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.createBtn}
              activeOpacity={0.75}
              onPress={() => router.push('/(app)/quote' as any)}
            >
              <LinearGradient
                colors={['#8B5CF6', '#A78BFA'] as readonly [string, string]}
                style={s.createGradient}
              >
                <Ionicons name="document-text" size={20} color="#fff" />
              </LinearGradient>
              <Text style={s.createBtnText}>New Quote</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Search Bar */}
          <Animated.View entering={FadeInDown.delay(150).springify()} style={s.searchWrap}>
            <View style={s.searchBar}>
              <Ionicons name="search" size={18} color="#94A3B8" />
              <TextInput
                style={s.searchInput}
                placeholder="Search by customer name..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>

          {/* Filter Chips */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={['all', 'invoice', 'quote', 'unpaid', 'draft'] as const}
              keyExtractor={(item) => item}
              contentContainerStyle={s.filterRow}
              renderItem={({ item }) => {
                const active = filter === item;
                return (
                  <TouchableOpacity
                    style={[s.filterChip, active && s.filterChipActive]}
                    onPress={() => setFilter(item)}
                  >
                    {active ? (
                      <LinearGradient
                        colors={['#6366F1', '#3B82F6'] as readonly [string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={s.filterChipGradient}
                      >
                        <Text style={s.filterTextActive}>
                          {item.charAt(0).toUpperCase() + item.slice(1)}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <Text style={s.filterText}>
                        {item.charAt(0).toUpperCase() + item.slice(1)}
                      </Text>
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
                <View style={s.emptyCard}>
                  <View style={s.emptyIconWrap}>
                    <Ionicons name="documents-outline" size={28} color="#94A3B8" />
                  </View>
                  <Text style={s.emptyTitle}>No documents found</Text>
                  <Text style={s.emptySubtitle}>Try adjusting your filters or search.</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
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
  screenTitle: { fontSize: 28, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  screenSubtitle: { fontSize: 13, color: '#94A3B8', fontWeight: '500', marginTop: 2 },
  countBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  countText: { fontSize: 14, fontWeight: '700', color: '#6366F1' },

  // Quick Create
  createRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 16 },
  createBtn: {
    flex: 1,
    backgroundColor: GLASS_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  createGradient: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  createBtnText: { fontSize: 13, fontWeight: '700', color: '#334155' },

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
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#0F172A', height: '100%' },

  // Filters
  filterRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  filterChip: {
    borderRadius: 20,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
  },
  filterChipActive: {
    borderColor: 'transparent',
  },
  filterChipGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterText: { fontSize: 13, fontWeight: '600', color: '#64748B', paddingHorizontal: 16, paddingVertical: 8 },
  filterTextActive: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Cards
  card: {
    flexDirection: 'row',
    backgroundColor: GLASS_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#94A3B8',
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
  cardRef: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.3 },
  cardCustomer: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  cardTotal: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
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
  cardDate: { fontSize: 12, color: '#94A3B8' },

  // Swipe to Delete
  deleteSwipeBtn: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginBottom: 10,
    marginLeft: 10,
  },
  deleteSwipeText: { color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 4 },

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
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: '#94A3B8' },
});
