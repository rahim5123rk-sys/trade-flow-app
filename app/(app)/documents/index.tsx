// ============================================
// FILE: app/(app)/documents/index.tsx
// Central Hub for Quotes & Invoices
// ============================================

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
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

    // Apply exact status/type filters
    if (filter === 'invoice' || filter === 'quote') {
      query = query.eq('type', filter);
    } else if (filter === 'unpaid') {
      // For 'unpaid', we want both Unpaid and Overdue (using Supabase 'in' filter)
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
    Alert.alert(
      `Delete ${doc.type === 'invoice' ? 'Invoice' : 'Quote'}`,
      `Are you sure you want to delete ${doc.type === 'invoice' ? 'Invoice' : 'Quote'} #${doc.number}? This cannot be undone.`,
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

  // Apply real-time search filtering on the downloaded data
  const filteredDocuments = documents.filter((doc) => {
    if (!searchQuery) return true;
    return doc.customer_snapshot?.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const renderDocument = ({ item }: { item: Document }) => {
    const statusStyle = getStatusStyle(item.status);
    const isInvoice = item.type === 'invoice';

    // The Red Trash button that appears when you swipe left
    const renderRightActions = () => (
      <TouchableOpacity style={styles.deleteSwipeBtn} onPress={() => handleDelete(item)}>
        <Ionicons name="trash-outline" size={24} color="#fff" />
        <Text style={styles.deleteSwipeText}>Delete</Text>
      </TouchableOpacity>
    );

    return (
      <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => router.push(`/(app)/documents/${item.id}` as any)}>
          <View style={styles.cardTop}>
            <View style={styles.cardLeft}>
              <View style={[styles.typeIcon, { backgroundColor: isInvoice ? '#FFF7ED' : '#EFF6FF' }]}>
                <Ionicons name={isInvoice ? 'receipt-outline' : 'document-text-outline'} size={20} color={isInvoice ? '#C2410C' : '#2563EB'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardRef}>{isInvoice ? 'INV' : 'QTE'}-{String(item.number).padStart(4, '0')}</Text>
                <Text style={styles.cardCustomer} numberOfLines={1}>{item.customer_snapshot?.name || 'Unknown Customer'}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.cardTotal}>£{item.total?.toFixed(2) || '0.00'}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.statusText, { color: statusStyle.color }]}>{item.status}</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardBottom}>
            <View style={styles.cardMeta}>
              <Ionicons name="calendar-outline" size={13} color={Colors.textLight} />
              <Text style={styles.cardDate}>
                {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    // GestureHandlerRootView is required for Swipeable to work properly
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        
        {/* ─── HEADER ─── */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Document Hub</Text>
        </View>

        {/* ─── QUICK CREATE ACTIONS ─── */}
        <View style={styles.createRow}>
          <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/(app)/jobs/new/invoice' as any)}>
            <View style={[styles.createIconBox, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="receipt" size={24} color="#C2410C" />
            </View>
            <Text style={styles.createBtnText}>Create Invoice</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/(app)/jobs/new/quote' as any)}>
            <View style={[styles.createIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="document-text" size={24} color="#2563EB" />
            </View>
            <Text style={styles.createBtnText}>Create Quote</Text>
          </TouchableOpacity>
        </View>

        {/* ─── SEARCH BAR ─── */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={Colors.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by customer name..."
            placeholderTextColor={Colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textLight} />
            </TouchableOpacity>
          )}
        </View>

        {/* ─── FILTER CHIPS ─── */}
        <View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={['all', 'invoice', 'quote', 'unpaid', 'draft'] as const}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.filterContainer}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.filterBtn, filter === item && styles.filterActive]}
                onPress={() => setFilter(item)}
              >
                <Text style={[styles.filterText, filter === item && styles.filterActiveText]}>
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* ─── DOCUMENT LIST ─── */}
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={filteredDocuments}
            keyExtractor={(item) => item.id}
            renderItem={renderDocument}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, paddingTop: 10 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDocuments(); }} tintColor={Colors.primary} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color={Colors.textLight} />
                <Text style={styles.emptyTitle}>No documents found</Text>
                <Text style={styles.emptySub}>Try adjusting your filters or search.</Text>
              </View>
            }
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
  screenTitle: { fontSize: 28, fontWeight: '800', color: Colors.text },

  // Quick Create Grid
  createRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 16 },
  createBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', ...Colors.shadow },
  createIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  createBtnText: { fontSize: 14, fontWeight: '700', color: Colors.text },

  // Search Bar
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 16, paddingHorizontal: 14, height: 46, borderRadius: 12, ...Colors.shadow },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: Colors.text, height: '100%' },

  // Filters
  filterContainer: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e8f0' },
  filterActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  filterActiveText: { color: '#fff' },

  // Cards
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, ...Colors.shadow },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  typeIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardRef: { fontSize: 12, fontWeight: '700', color: Colors.textLight },
  cardCustomer: { fontSize: 15, fontWeight: '700', color: Colors.text, marginTop: 2 },
  cardTotal: { fontSize: 18, fontWeight: '800', color: Colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardDate: { fontSize: 12, color: Colors.textLight },
  
  // Swipe to Delete
  deleteSwipeBtn: { backgroundColor: Colors.danger, justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: 14, marginBottom: 12, marginLeft: 10 },
  deleteSwipeText: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 4 },

  emptyState: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptySub: { color: Colors.textLight, fontSize: 14 },
});