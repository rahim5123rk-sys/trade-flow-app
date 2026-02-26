// ============================================
// FILE: app/(app)/documents/index.tsx
// Dedicated screen for Quotes & Invoices
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
    TouchableOpacity,
    View,
} from 'react-native';
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

export default function DocumentsListScreen() {
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'invoice' | 'quote'>('all');

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

    if (filter !== 'all') {
      query = query.eq('type', filter);
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
            const { error } = await supabase
              .from('documents')
              .delete()
              .eq('id', doc.id);
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

  const renderDocument = ({ item }: { item: Document }) => {
    const statusStyle = getStatusStyle(item.status);
    const isInvoice = item.type === 'invoice';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push(`/(app)/documents/${item.id}` as any)}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <View style={[styles.typeIcon, { backgroundColor: isInvoice ? '#FFF7ED' : '#EFF6FF' }]}>
              <Ionicons
                name={isInvoice ? 'receipt-outline' : 'document-text-outline'}
                size={20}
                color={isInvoice ? '#C2410C' : '#2563EB'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardRef}>
                {isInvoice ? 'INV' : 'QTE'}-{String(item.number).padStart(4, '0')}
              </Text>
              <Text style={styles.cardCustomer} numberOfLines={1}>
                {item.customer_snapshot?.name || 'Unknown Customer'}
              </Text>
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
              {new Date(item.created_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const invoiceCount = documents.filter((d) => d.type === 'invoice').length;
  const quoteCount = documents.filter((d) => d.type === 'quote').length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Documents</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => router.push('/(app)/jobs/[id]/quote' as any)}
          >
            <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
            <Text style={styles.newBtnText}>Quote</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => router.push('/(app)/jobs/[id]/invoice' as any)}
          >
            <Ionicons name="receipt-outline" size={16} color="#C2410C" />
            <Text style={[styles.newBtnText, { color: '#C2410C' }]}>Invoice</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: '#C2410C' }]}>
          <Text style={styles.summaryNumber}>{invoiceCount}</Text>
          <Text style={styles.summaryLabel}>Invoices</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: '#2563EB' }]}>
          <Text style={styles.summaryNumber}>{quoteCount}</Text>
          <Text style={styles.summaryLabel}>Quotes</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'invoice', 'quote'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterActiveText]}>
              {f === 'all' ? 'All' : f === 'invoice' ? 'Invoices' : 'Quotes'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => item.id}
          renderItem={renderDocument}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
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
            <View style={styles.emptyState}>
              <Ionicons name="documents-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyTitle}>No documents yet</Text>
              <Text style={styles.emptySub}>
                Create a quote or invoice to get started.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  screenTitle: { fontSize: 24, fontWeight: '800', color: Colors.text },
  headerRight: { flexDirection: 'row', gap: 8 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    ...Colors.shadow,
  },
  newBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  summaryRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 16 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    ...Colors.shadow,
  },
  summaryNumber: { fontSize: 24, fontWeight: '800', color: Colors.text },
  summaryLabel: { fontSize: 12, color: Colors.textLight, fontWeight: '600', marginTop: 2 },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  filterActiveText: { color: '#fff' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...Colors.shadow,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardRef: { fontSize: 12, fontWeight: '700', color: Colors.textLight },
  cardCustomer: { fontSize: 15, fontWeight: '700', color: Colors.text, marginTop: 2 },
  cardTotal: { fontSize: 18, fontWeight: '800', color: Colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardDate: { fontSize: 12, color: Colors.textLight },
  deleteBtn: { padding: 6 },

  emptyState: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptySub: { color: Colors.textLight, fontSize: 14 },
});