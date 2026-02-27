// ============================================
// FILE: app/(app)/documents/[id].tsx
// View/manage a single quote, invoice or CP12
// ============================================

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, UI} from '../../../constants/theme';
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
  Draft: { color: UI.text.muted, bg: UI.surface.elevated },
  Sent: { color: UI.brand.accent, bg: '#eff6ff' },
  Accepted: { color: '#15803d', bg: '#f0fdf4' },
  Declined: { color: UI.brand.danger, bg: '#fef2f2' },
  Unpaid: { color: '#c2410c', bg: '#fff7ed' },
  Paid: { color: '#047857', bg: '#f0fdf4' },
  Overdue: { color: UI.brand.danger, bg: '#fef2f2' },
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
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
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

  // ─── Build doc data for PDF generation ──────────────────────

  const buildDocData = () => {
    if (!doc) return null;
    const regenType: 'invoice' | 'quote' =
      doc.type === 'invoice' ? 'invoice' : 'quote';
    return {
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
  };

  // ─── Save PDF to device ─────────────────────────────────────

  const handleSave = async () => {
    if (!doc || !userProfile?.company_id) return;
    setSaving(true);
    try {
      const cp12Payload = parseCp12Payload(doc);
      if (cp12Payload) {
        await generateCP12PdfFromPayload(cp12Payload, 'save');
      } else {
        const docData = buildDocData();
        if (docData) await generateDocument(docData, userProfile.company_id, 'save');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save PDF.');
    }
    setSaving(false);
  };

  // ─── Share PDF ──────────────────────────────────────────────

  const handleShare = async () => {
    if (!doc || !userProfile?.company_id) return;
    setSharing(true);
    try {
      const cp12Payload = parseCp12Payload(doc);
      if (cp12Payload) {
        await generateCP12PdfFromPayload(cp12Payload, 'share');
      } else {
        const docData = buildDocData();
        if (docData) await generateDocument(docData, userProfile.company_id, 'share');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to share PDF.');
    }
    setSharing(false);
  };

  // ─── Delete ─────────────────────────────────────────────────

  const handleDelete = () => {
    if (!doc) return;
    const cp12Payload = parseCp12Payload(doc);
    const isCp12 = !!cp12Payload || doc.type === 'cp12' || doc.reference?.startsWith('CP12-');
    const label = isCp12 ? 'CP12 Certificate' : doc.type === 'invoice' ? 'Invoice' : 'Quote';
    Alert.alert(
      `Delete ${label}`,
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

  // ─── Render ─────────────────────────────────────────────────

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!doc) return <View style={styles.center}><Text>Document not found.</Text></View>;

  const cp12Payload = parseCp12Payload(doc);
  const isCp12 = !!cp12Payload || doc.type === 'cp12' || doc.reference?.startsWith('CP12-');
  const isInvoice = doc.type === 'invoice' && !isCp12;
  const statuses = isInvoice ? INVOICE_STATUSES : QUOTE_STATUSES;
  const statusStyle = STATUS_COLORS[doc.status] || STATUS_COLORS.Draft;

  // Document type config
  const typeConfig = isCp12
    ? { label: 'CP12 CERTIFICATE', icon: 'shield-checkmark-outline' as const, color: UI.brand.primary, bg: UI.surface.base, gradient: UI.gradients.cp12 }
    : isInvoice
      ? { label: 'INVOICE', icon: 'receipt-outline' as const, color: '#C2410C', bg: '#FFF7ED', gradient: UI.gradients.amberLight }
      : { label: 'QUOTE', icon: 'document-text-outline' as const, color: UI.brand.primary, bg: UI.surface.primaryLight, gradient: UI.gradients.primary };

  const isBusy = saving || sharing || updating;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
      {/* Header Card */}
      <Animated.View entering={FadeInDown.delay(50).springify()}>
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={[styles.typeIcon, { backgroundColor: typeConfig.bg }]}>
              <Ionicons name={typeConfig.icon} size={28} color={typeConfig.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docType}>{typeConfig.label}</Text>
              <Text style={styles.docNumber}>
                {isCp12
                  ? doc.reference || `CP12-${String(doc.number).padStart(4, '0')}`
                  : `#${String(doc.number).padStart(4, '0')}`}
              </Text>
            </View>
            <View style={[styles.statusBadgeLg, { backgroundColor: isCp12 ? UI.surface.base : statusStyle.bg }]}>
              <Text style={[styles.statusTextLg, { color: isCp12 ? '#0284c7' : statusStyle.color }]}>
                {isCp12 ? 'Issued' : doc.status}
              </Text>
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
                <Ionicons name="time-outline" size={14} color={isCp12 ? UI.status.pending : Colors.textLight} />
                <Text style={[styles.metaText, isCp12 && { color: UI.status.pending, fontWeight: '600' }]}>
                  {isCp12 ? 'Next due' : isInvoice ? 'Due' : 'Valid until'}: {doc.expiry_date}
                </Text>
              </View>
            ) : null}
            {doc.reference && !isCp12 ? (
              <View style={styles.metaItem}>
                <Ionicons name="bookmark-outline" size={14} color={Colors.textLight} />
                <Text style={styles.metaText}>Ref: {doc.reference}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Animated.View>

      {/* CP12 Details */}
      {isCp12 && cp12Payload ? (
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          {/* Engineer info */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Engineer</Text>
            <View style={styles.card}>
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={16} color={UI.brand.primary} />
                <Text style={styles.detailText}>{cp12Payload.engineer.name || 'Not specified'}</Text>
              </View>
              {cp12Payload.engineer.gasSafeNumber ? (
                <View style={styles.detailRow}>
                  <Ionicons name="shield-outline" size={16} color={UI.status.complete} />
                  <Text style={styles.detailText}>Gas Safe: {cp12Payload.engineer.gasSafeNumber}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Property & People */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Property & People</Text>
            <View style={styles.card}>
              <View style={styles.detailRow}>
                <Ionicons name="home-outline" size={16} color={UI.status.inProgress} />
                <Text style={styles.detailText}>{cp12Payload.pdfData.propertyAddress || 'No address'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Ionicons name="business-outline" size={16} color={UI.status.pending} />
                <View>
                  <Text style={styles.detailLabel}>Landlord</Text>
                  <Text style={styles.detailText}>{cp12Payload.pdfData.landlordName || '—'}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="people-outline" size={16} color={UI.status.paid} />
                <View>
                  <Text style={styles.detailLabel}>Tenant</Text>
                  <Text style={styles.detailText}>{cp12Payload.pdfData.tenantName || '—'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Appliances summary */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Appliances ({cp12Payload.pdfData.appliances.length})</Text>
            <View style={styles.card}>
              {cp12Payload.pdfData.appliances.map((app, i) => (
                <View key={i} style={[styles.applianceRow, i > 0 && { borderTopWidth: 1, borderTopColor: UI.surface.elevated, paddingTop: 10 }]}>
                  <View style={styles.applianceNum}>
                    <Text style={styles.applianceNumText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.applianceName}>{app.make} {app.model}</Text>
                    <Text style={styles.applianceLocation}>{app.location} • {app.type}</Text>
                  </View>
                  <View style={[
                    styles.safetyBadge,
                    { backgroundColor: app.applianceSafeToUse === 'Yes' ? '#F0FDF4' : app.applianceSafeToUse === 'No' ? '#FEF2F2' : UI.surface.elevated }
                  ]}>
                    <Ionicons
                      name={app.applianceSafeToUse === 'Yes' ? 'checkmark-circle' : app.applianceSafeToUse === 'No' ? 'close-circle' : 'help-circle'}
                      size={14}
                      color={app.applianceSafeToUse === 'Yes' ? '#15803d' : app.applianceSafeToUse === 'No' ? UI.brand.danger : UI.text.muted}
                    />
                    <Text style={[
                      styles.safetyText,
                      { color: app.applianceSafeToUse === 'Yes' ? '#15803d' : app.applianceSafeToUse === 'No' ? UI.brand.danger : UI.text.muted }
                    ]}>
                      {app.applianceSafeToUse === 'Yes' ? 'Safe' : app.applianceSafeToUse === 'No' ? 'Unsafe' : 'N/A'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Inspection dates */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Inspection</Text>
            <View style={styles.card}>
              <View style={styles.dateRow}>
                <View style={styles.dateItem}>
                  <Ionicons name="calendar" size={18} color={UI.brand.primary} />
                  <View>
                    <Text style={styles.dateLabel}>Inspected</Text>
                    <Text style={styles.dateValue}>{cp12Payload.pdfData.inspectionDate}</Text>
                  </View>
                </View>
                <View style={styles.dateItem}>
                  <Ionicons name="alarm" size={18} color={UI.status.pending} />
                  <View>
                    <Text style={styles.dateLabel}>Next Due</Text>
                    <Text style={[styles.dateValue, { color: UI.status.pending }]}>{cp12Payload.pdfData.nextDueDate}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>
      ) : (
        /* Non-CP12 document sections */
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          {/* Customer */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Customer</Text>
            <View style={styles.card}>
              <Text style={styles.customerName}>{doc.customer_snapshot?.name || 'Unknown'}</Text>
              {doc.customer_snapshot?.company_name ? (
                <Text style={styles.customerDetail}>{doc.customer_snapshot.company_name}</Text>
              ) : null}
              <Text style={styles.customerDetail}>
                {doc.customer_snapshot?.address || 'No address'}
              </Text>
            </View>
          </View>

          {/* Line Items */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Items</Text>
            <View style={styles.card}>
              {doc.items?.map((item: any, idx: number) => (
                <View key={idx} style={[styles.itemRow, idx > 0 && { borderTopWidth: 1, borderTopColor: UI.surface.elevated, paddingTop: 10 }]}>
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

          {/* Notes */}
          {doc.notes && !doc.notes.includes('CP12') ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Notes</Text>
              <View style={styles.card}>
                <Text style={styles.notesText}>{doc.notes}</Text>
              </View>
            </View>
          ) : null}

          {/* Status Actions */}
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
                    disabled={isBusy}
                  >
                    {isActive && <Ionicons name="checkmark-circle" size={14} color={sc.color} />}
                    <Text style={[styles.statusChipText, isActive && { color: sc.color, fontWeight: '700' }]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>
      )}

      {/* ─── Action Buttons: Save & Share ──────────────────── */}
      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.actionsSection}>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.saveAction}
            onPress={handleSave}
            disabled={isBusy}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={UI.brand.primary} size="small" />
            ) : (
              <>
                <Ionicons name="download-outline" size={20} color={UI.brand.primary} />
                <Text style={styles.saveActionText}>Save PDF</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareAction}
            onPress={handleShare}
            disabled={isBusy}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={isCp12 ? UI.gradients.cp12 : typeConfig.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shareGradient}
            >
              {sharing ? (
                <ActivityIndicator color={UI.text.white} size="small" />
              ) : (
                <>
                  <Ionicons name="share-outline" size={20} color={UI.text.white} />
                  <Text style={styles.shareActionText}>Share</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.deleteAction} onPress={handleDelete} disabled={isBusy}>
          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          <Text style={styles.deleteActionText}>Delete {isCp12 ? 'CP12' : isInvoice ? 'Invoice' : 'Quote'}</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header card
  headerCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, ...Colors.shadow },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  typeIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  docType: { fontSize: 11, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 1 },
  docNumber: { fontSize: 22, fontWeight: '800', color: Colors.text },
  statusBadgeLg: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statusTextLg: { fontSize: 12, fontWeight: '700' },
  headerMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: UI.surface.elevated },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: Colors.textLight },

  // Sections
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, ...Colors.shadow },

  // Detail rows (CP12)
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  detailLabel: { fontSize: 11, fontWeight: '600', color: UI.text.muted, textTransform: 'uppercase' },
  detailText: { fontSize: 14, fontWeight: '500', color: Colors.text },
  divider: { height: 1, backgroundColor: UI.surface.elevated, marginVertical: 8 },

  // Appliance rows (CP12)
  applianceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  applianceNum: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: UI.surface.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  applianceNumText: { fontSize: 12, fontWeight: '700', color: UI.brand.primary },
  applianceName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  applianceLocation: { fontSize: 12, color: UI.text.muted, marginTop: 1 },
  safetyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  safetyText: { fontSize: 11, fontWeight: '700' },

  // Date row (CP12)
  dateRow: { flexDirection: 'row', gap: 16 },
  dateItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateLabel: { fontSize: 11, fontWeight: '600', color: UI.text.muted, textTransform: 'uppercase' },
  dateValue: { fontSize: 15, fontWeight: '700', color: Colors.text },

  // Customer
  customerName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  customerDetail: { fontSize: 14, color: UI.text.muted, marginTop: 2 },

  // Line items
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  itemDesc: { fontSize: 14, fontWeight: '600', color: Colors.text },
  itemMeta: { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '700', color: Colors.text },
  totalsDivider: { height: 2, backgroundColor: UI.text.title, marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: Colors.text },
  totalValue: { fontSize: 20, fontWeight: '800', color: Colors.primary },

  notesText: { fontSize: 14, color: UI.text.bodyLight, lineHeight: 20 },

  // Status
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: UI.surface.elevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusChipText: { fontSize: 13, fontWeight: '500', color: UI.text.muted },

  // Actions
  actionsSection: { gap: 12, marginTop: 8, marginBottom: 20 },
  actionRow: { flexDirection: 'row', gap: 12 },
  saveAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 14,
    backgroundColor: UI.surface.primaryLight,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
  },
  saveActionText: { color: UI.brand.primary, fontWeight: '700', fontSize: 15 },
  shareAction: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  shareGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  shareActionText: { color: UI.text.white, fontWeight: '700', fontSize: 15 },
  deleteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteActionText: { color: Colors.danger, fontWeight: '600', fontSize: 14 },
});
