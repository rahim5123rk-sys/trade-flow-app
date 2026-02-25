import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
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
import { db } from '../../../src/config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  reference: string;
  status: string;
  customerSnapshot: {
    name: string;
    address: string;
  };
  notes?: string;
  assignedTo: string[];
  scheduledDate: number;
  createdAt: any;
  price?: number;
  paymentStatus?: string;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_FLOW = [
  'pending',
  'accepted',
  'on_the_way',
  'in_progress',
  'complete',
  'invoiced',
  'paid',
] as const;

const STATUS_COLOURS: Record<string, { bg: string; text: string }> = {
  pending:     { bg: '#fef3c7', text: '#92400e' },
  accepted:    { bg: '#fff7ed', text: '#9a3412' },
  on_the_way:  { bg: '#fce7f3', text: '#9d174d' },
  in_progress: { bg: '#dbeafe', text: '#1e40af' },
  complete:    { bg: '#dcfce7', text: '#166534' },
  invoiced:    { bg: '#ede9fe', text: '#5b21b6' },
  paid:        { bg: '#d1fae5', text: '#065f46' },
};

const STATUS_LABELS: Record<string, string> = {
  pending:     'Pending',
  accepted:    'Accepted',
  on_the_way:  'On The Way',
  in_progress: 'In Progress',
  complete:    'Complete',
  invoiced:    'Invoiced',
  paid:        'Paid',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const colours = STATUS_COLOURS[status] || { bg: '#f3f4f6', text: '#374151' };
  return (
    <View style={[styles.badge, { backgroundColor: colours.bg }]}>
      <Text style={[styles.badgeText, { color: colours.text }]}>
        {STATUS_LABELS[status] || status}
      </Text>
    </View>
  );
};

const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon as any} size={18} color="#6b7280" style={{ marginRight: 10 }} />
    <View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    const docRef = doc(db, 'jobs', id);
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setJob({ id: snap.id, ...snap.data() } as Job);
      }
    });
    return unsub;
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    if (!id) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'jobs', id), { status: newStatus });
    } catch (e) {
      Alert.alert('Error', 'Could not update job status.');
    } finally {
      setUpdating(false);
    }
  };

  const confirmStatusChange = (newStatus: string) => {
    Alert.alert(
      'Update Status',
      `Mark job as "${STATUS_LABELS[newStatus]}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Update', onPress: () => updateStatus(newStatus) },
      ]
    );
  };

  if (!job) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const currentIndex = STATUS_FLOW.indexOf(job.status as any);
  const nextStatus = currentIndex < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIndex + 1] : null;

  const scheduledDateStr = job.scheduledDate
    ? new Date(job.scheduledDate).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Not scheduled';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* ── Header ── */}
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <Text style={styles.reference}>{job.reference}</Text>
          <StatusBadge status={job.status} />
        </View>
        <Text style={styles.scheduledDate}>{scheduledDateStr}</Text>
      </View>

      {/* ── Customer ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer</Text>
        <InfoRow icon="person-outline" label="Name" value={job.customerSnapshot.name} />
        <InfoRow icon="location-outline" label="Address" value={job.customerSnapshot.address} />
      </View>

      {/* ── Notes ── */}
      {job.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Notes</Text>
          <Text style={styles.notesText}>{job.notes}</Text>
        </View>
      ) : null}

      {/* ── Payment ── */}
      {job.price !== undefined && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <InfoRow
            icon="cash-outline"
            label="Amount"
            value={`£${job.price.toFixed(2)}`}
          />
          <InfoRow
            icon="card-outline"
            label="Payment Status"
            value={job.paymentStatus || 'Unpaid'}
          />
        </View>
      )}

      {/* ── Status Pipeline ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status Pipeline</Text>
        <View style={styles.pipelineContainer}>
          {STATUS_FLOW.map((s, i) => {
            const isComplete = i <= currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <View key={s} style={styles.pipelineStep}>
                <View
                  style={[
                    styles.pipelineDot,
                    isComplete && styles.pipelineDotDone,
                    isCurrent && styles.pipelineDotCurrent,
                  ]}
                />
                <Text
                  style={[
                    styles.pipelineLabel,
                    isComplete && styles.pipelineLabelDone,
                    isCurrent && styles.pipelineLabelCurrent,
                  ]}
                >
                  {STATUS_LABELS[s]}
                </Text>
                {i < STATUS_FLOW.length - 1 && (
                  <View style={[styles.pipelineLine, isComplete && styles.pipelineLineDone]} />
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Actions ── */}
      <View style={styles.actionsContainer}>
        {nextStatus && (
          <TouchableOpacity
            style={[styles.primaryBtn, updating && styles.disabledBtn]}
            onPress={() => confirmStatusChange(nextStatus)}
            disabled={updating}
            activeOpacity={0.8}
          >
            {updating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="arrow-forward-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>
                  Move to: {STATUS_LABELS[nextStatus]}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {job.status === 'paid' && (
          <View style={styles.paidBanner}>
            <Ionicons name="checkmark-circle" size={24} color="#065f46" />
            <Text style={styles.paidText}>Job Complete & Paid ✓</Text>
          </View>
        )}
      </View>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reference: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  scheduledDate: { marginTop: 6, fontSize: 14, color: '#6b7280' },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  infoLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 1 },
  infoValue: { fontSize: 15, color: '#111827', fontWeight: '500' },
  notesText: { fontSize: 15, color: '#374151', lineHeight: 22 },

  // Pipeline
  pipelineContainer: { flexDirection: 'row', alignItems: 'center' },
  pipelineStep: { alignItems: 'center', flex: 1, position: 'relative' },
  pipelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#d1d5db', marginBottom: 6 },
  pipelineDotDone: { backgroundColor: '#10b981' },
  pipelineDotCurrent: { backgroundColor: '#2563eb', width: 14, height: 14, borderRadius: 7 },
  pipelineLine: { position: 'absolute', top: 5, left: '50%', right: '-50%', height: 2, backgroundColor: '#d1d5db', zIndex: -1 },
  pipelineLineDone: { backgroundColor: '#10b981' },
  pipelineLabel: { fontSize: 9, color: '#9ca3af', textAlign: 'center' },
  pipelineLabelDone: { color: '#10b981' },
  pipelineLabelCurrent: { color: '#2563eb', fontWeight: '700' },

  // Actions
  actionsContainer: { marginHorizontal: 16, marginTop: 20 },
  primaryBtn: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledBtn: { backgroundColor: '#93c5fd' },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  paidBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#d1fae5', padding: 16, borderRadius: 12, gap: 10 },
  paidText: { fontSize: 16, fontWeight: 'bold', color: '#065f46' },
});
