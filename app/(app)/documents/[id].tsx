// ============================================
// FILE: app/(app)/documents/[id].tsx
// View/manage a single quote or invoice
// ============================================

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';
import { generateDocument } from '../../../src/services/DocumentGenerator';
import {
    CP12LockedPayload,
    generateCP12PdfFromPayload,
} from '../../../src/services/cp12PdfGenerator';
import { Document } from '../../../src/types';

const INVOICE_STATUSES = ['Draft', 'Sent', 'Unpaid', 'Paid', 'Overdue'];
const QUOTE_STATUSES = ['Draft', 'Sent', 'Accepted', 'Declined'];

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  Draft: { color: '#64748b', bg: '#f1f5f9' },
  Sent: { color: '#2563eb', bg: '#eff6ff' },
  Accepted: { color: '#15803d', bg: '#f0fdf4' },
  Declined: { color: '#dc2626', bg: '#fef2f2' },
  Unpaid: { color: '#c2410c', bg: '#fff7ed' },
  Paid: { color: '#047857', bg: '#f0fdf4' },
  Overdue: { color: '#dc2626', bg: '#fef2f2' },
};

const parseCp12Payload = (doc: Document | null): CP12LockedPayload | null => {
  if (!doc?.payment_info) return null;
  try {
    const parsed = JSON.parse(doc.payment_info);
    return parsed?.kind === 'cp12' ? (parsed as CP12LockedPayload) : null;
  } catch {
    return null;
  }
};

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (id) fetchDocument();
  }, [id]);

  const fetchDocument = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();
    if (data) setDoc(data as Document);
    if (error) Alert.alert('Error', 'Could not load document.');
    setLoading(false);
  };

  const updateStatus = async (newStatus: string) => {
    if (!doc) return;
    setUpdating(true);
    const { error } = await supabase
      .from('documents')
      .update({ status: newStatus })
      .eq('id', doc.id);
    if (!error) setDoc({ ...doc, status: newStatus as any });
    else Alert.alert('Error', 'Could not update status.');
    setUpdating(false);
  };

  const handleRegeneratePdf = async () => {
    if (!doc || !userProfile?.company_id) return;
    setUpdating(true);
    try {
      const cp12Payload = parseCp12Payload(doc);
      if (cp12Payload) {
        await generateCP12PdfFromPayload(cp12Payload);
        return;
      }

      const regenType: 'invoice' | 'quote' =
        doc.type === 'invoice' ? 'invoice' : 'quote';

      const docData = {
        type: regenType,
        number: doc.number,
        reference: doc.reference,
        date: new Date(doc.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        expiryDate: doc.expiry_date || '',
        status: doc.status,
        customerName: doc.customer_snapshot?.name || '',
        customerCompany: doc.customer_snapshot?.company_name,
        customerAddress1: doc.customer_snapshot?.address_line_1 || '',
        customerAddress2: doc.customer_snapshot?.address_line_2 || undefined,
        customerCity: doc.customer_snapshot?.city || '',
        customerPostcode: doc.customer_snapshot?.postal_code || '',
        customerEmail: doc.customer_snapshot?.email || undefined,
        customerPhone: doc.customer_snapshot?.phone || undefined,
        jobAddress1: doc.job_address?.address_line_1 || doc.customer_snapshot?.address_line_1 || '',
        jobAddress2: doc.job_address?.address_line_2 || doc.customer_snapshot?.address_line_2 || undefined,
        jobCity: doc.job_address?.city || doc.customer_snapshot?.city || '',
        jobPostcode: doc.job_address?.postcode || doc.customer_snapshot?.postal_code || '',
        items: doc.items || [],
        discountPercent: doc.discount_percent || 0,
        partialPayment: 0,
        notes: doc.notes,
        paymentInfo: doc.payment_info,
      };
      await generateDocument(docData, userProfile.company_id);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to generate PDF.');
    }
    setUpdating(false);
  };

  const handleDelete = () => {
    if (!doc) return;
    Alert.alert(
      `Delete ${doc.type === 'invoice' ? 'Invoice' : 'Quote'}`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('documents').delete().eq('id', doc.id);
            if (!error) router.back();
            else Alert.alert('Error', 'Could not delete.');
          },
        },
      ]
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!doc) return <View style={styles.center}><Text>Document not found.</Text></View>;

  const cp12Payload = parseCp12Payload(doc);
  const isCp12 = !!cp12Payload || doc.type === 'cp12' || doc.reference?.startsWith('CP12-');
  const isInvoice = doc.type === 'invoice' && !isCp12;
  const statuses = isInvoice ? INVOICE_STATUSES : QUOTE_STATUSES;
  const statusStyle = STATUS_COLORS[doc.status] || STATUS_COLORS.Draft;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={[styles.typeIcon, { backgroundColor: isInvoice ? '#FFF7ED' : '#EFF6FF' }]}>
            <Ionicons
              name={isCp12 ? 'shield-checkmark-outline' : isInvoice ? 'receipt-outline' : 'document-text-outline'}
              size={28}
              color={isCp12 ? '#1D4ED8' : isInvoice ? '#C2410C' : '#2563EB'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.docType}>{isCp12 ? 'CP12' : isInvoice ? 'INVOICE' : 'QUOTE'}</Text>
            <Text style={styles.docNumber}>{isCp12 ? doc.reference || `CP12-${String(doc.number).padStart(4, '0')}` : `#${String(doc.number).padStart(4, '0')}`}</Text>
          </View>
          <View style={[styles.statusBadgeLg, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusTextLg, { color: statusStyle.color }]}>{isCp12 ? 'Locked' : doc.status}</Text>
          </View>
        </View>

        <View style={styles.headerMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={Colors.textLight} />
            <Text style={styles.metaText}>
              {new Date(doc.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
          {doc.expiry_date ? (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={Colors.textLight} />
              <Text style={styles.metaText}>{isCp12 ? 'Next inspection' : isInvoice ? 'Due' : 'Valid until'}: {doc.expiry_date}</Text>
            </View>
          ) : null}
          {doc.reference ? (
            <View style={styles.metaItem}>
              <Ionicons name="bookmark-outline" size={14} color={Colors.textLight} />
              <Text style={styles.metaText}>Ref: {doc.reference}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Customer */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{isCp12 ? 'Saved Snapshot' : 'Customer'}</Text>
        <View style={styles.card}>
          <Text style={styles.customerName}>{cp12Payload?.pdfData.landlordName || doc.customer_snapshot?.name || 'Unknown'}</Text>
          {doc.customer_snapshot?.company_name ? (
            <Text style={styles.customerDetail}>{doc.customer_snapshot.company_name}</Text>
          ) : null}
          <Text style={styles.customerDetail}>
            {cp12Payload?.pdfData.propertyAddress || doc.customer_snapshot?.address || 'No address'}
          </Text>
          {isCp12 ? (
            <>
              <Text style={styles.customerDetail}>Tenant: {cp12Payload?.pdfData.tenantName || '—'}</Text>
              <Text style={styles.customerDetail}>Landlord: {cp12Payload?.pdfData.landlordName || '—'}</Text>
            </>
          ) : null}
        </View>
      </View>

      {/* Line Items */}
      {!isCp12 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Items</Text>
          <View style={styles.card}>
            {doc.items?.map((item: any, idx: number) => (
              <View key={idx} style={[styles.itemRow, idx > 0 && { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 }]}> 
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemDesc}>{item.description || 'Item'}</Text>
                  <Text style={styles.itemMeta}>{item.quantity} x £{item.unitPrice?.toFixed(2)}</Text>
                </View>
                <Text style={styles.itemTotal}>£{(item.quantity * item.unitPrice).toFixed(2)}</Text>
              </View>
            ))}

            <View style={styles.totalsDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>£{doc.total?.toFixed(2) || '0.00'}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Notes */}
      {doc.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notes</Text>
          <View style={styles.card}>
            <Text style={styles.notesText}>{doc.notes}</Text>
          </View>
        </View>
      ) : null}

      {/* Status Actions */}
      {!isCp12 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Update Status</Text>
          <View style={styles.statusGrid}>
            {statuses.map((s) => {
              const sc = STATUS_COLORS[s] || STATUS_COLORS.Draft;
              const isActive = doc.status === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusChip, isActive && { backgroundColor: sc.bg, borderColor: sc.color, borderWidth: 2 }]}
                  onPress={() => updateStatus(s)}
                  disabled={updating}
                >
                  {isActive && <Ionicons name="checkmark-circle" size={14} color={sc.color} />}
                  <Text style={[styles.statusChipText, isActive && { color: sc.color, fontWeight: '700' }]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actionsSection}>
        <TouchableOpacity style={styles.primaryAction} onPress={handleRegeneratePdf} disabled={updating}>
          {updating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.primaryActionText}>{isCp12 ? 'Download Locked CP12 PDF' : 'Download PDF'}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteAction} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
          <Text style={styles.deleteActionText}>Delete {isCp12 ? 'CP12' : isInvoice ? 'Invoice' : 'Quote'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, ...Colors.shadow },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  typeIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  docType: { fontSize: 11, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 1 },
  docNumber: { fontSize: 22, fontWeight: '800', color: Colors.text },
  statusBadgeLg: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statusTextLg: { fontSize: 12, fontWeight: '700' },
  headerMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: Colors.textLight },

  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, ...Colors.shadow },

  customerName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  customerDetail: { fontSize: 14, color: '#64748b', marginTop: 2 },

  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  itemDesc: { fontSize: 14, fontWeight: '600', color: Colors.text },
  itemMeta: { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '700', color: Colors.text },
  totalsDivider: { height: 2, backgroundColor: '#0f172a', marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: Colors.text },
  totalValue: { fontSize: 20, fontWeight: '800', color: Colors.primary },

  notesText: { fontSize: 14, color: '#334155', lineHeight: 20 },

  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusChipText: { fontSize: 13, fontWeight: '500', color: '#64748b' },

  actionsSection: { gap: 12, marginTop: 8, marginBottom: 20 },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
  },
  primaryActionText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  deleteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteActionText: { color: Colors.danger, fontWeight: '600', fontSize: 15 },
});