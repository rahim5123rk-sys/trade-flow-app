import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
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
import { db } from './../../../src/config/firebase';
import { Job } from './../../../src/types';

// ─── Status config ─────────────────────────────────────────────────────────────

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

// Workers progress through these statuses; invoiced/paid are handled by admin
const WORKER_STATUS_FLOW = [
  'pending',
  'accepted',
  'on_the_way',
  'in_progress',
  'complete',
] as const;

// Action button label for each status transition
const WORKER_NEXT_LABEL: Record<string, string> = {
  pending:     'Accept Job',
  accepted:    "I'm On My Way",
  on_the_way:  'Start Job',
  in_progress: 'Mark as Complete',
};

const WORKER_NEXT_ICON: Record<string, string> = {
  pending:     'checkmark-circle-outline',
  accepted:    'navigate-outline',
  on_the_way:  'play-circle-outline',
  in_progress: 'flag-outline',
};

// ─── Sub-components ────────────────────────────────────────────────────────────

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

const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon as any} size={18} color="#6b7280" style={{ marginRight: 10 }} />
    <View style={{ flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WorkerJobDetailScreen() {
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
      Alert.alert('Error', 'Could not update job status. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const confirmStatusChange = (newStatus: string, label: string) => {
    Alert.alert(
      'Update Job Status',
      `Confirm: "${label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => updateStatus(newStatus) },
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

  const currentWorkerIndex = WORKER_STATUS_FLOW.indexOf(job.status as any);
  const nextStatus =
    currentWorkerIndex >= 0 && currentWorkerIndex < WORKER_STATUS_FLOW.length - 1
      ? WORKER_STATUS_FLOW[currentWorkerIndex + 1]
      : null;

  const isComplete =
    job.status === 'complete' || job.status === 'invoiced' || job.status === 'paid';

  const scheduledDateStr = job.scheduledDate
    ? new Date(job.scheduledDate).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Not scheduled';

  const scheduledTimeStr = job.scheduledDate
    ? new Date(job.scheduledDate).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* ── Header ── */}
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <Text style={styles.reference}>{job.reference}</Text>
          <StatusBadge status={job.status} />
        </View>
        <Text style={styles.jobTitle}>{job.title}</Text>
        <Text style={styles.scheduledDate}>
          {scheduledDateStr}
          {scheduledTimeStr ? ` at ${scheduledTimeStr}` : ''}
        </Text>
      </View>

      {/* ── Job Details ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Job Details</Text>
        <InfoRow icon="build-outline" label="Category" value={job.category || 'Other'} />
        {job.estimatedDuration ? (
          <InfoRow icon="time-outline" label="Estimated Duration" value={job.estimatedDuration} />
        ) : null}
      </View>

      {/* ── Customer ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer</Text>
        <InfoRow icon="person-outline" label="Name" value={job.customerSnapshot.name} />
        <InfoRow icon="location-outline" label="Address" value={job.customerSnapshot.address} />
        {job.customerSnapshot.phone ? (
          <InfoRow icon="call-outline" label="Phone" value={job.customerSnapshot.phone} />
        ) : null}
      </View>

      {/* ── Notes ── */}
      {job.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notesText}>{job.notes}</Text>
        </View>
      ) : null}

      {/* ── Action ── */}
      <View style={styles.actionsContainer}>
        {isComplete ? (
          <View style={styles.completeBanner}>
            <Ionicons name="checkmark-circle" size={28} color="#065f46" />
            <Text style={styles.completeText}>Job Complete</Text>
          </View>
        ) : nextStatus ? (
          <TouchableOpacity
            style={[styles.actionBtn, updating && styles.actionBtnDisabled]}
            onPress={() =>
              confirmStatusChange(nextStatus, WORKER_NEXT_LABEL[job.status])
            }
            disabled={updating}
            activeOpacity={0.8}
          >
            {updating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={WORKER_NEXT_ICON[job.status] as any}
                  size={22}
                  color="#fff"
                  style={{ marginRight: 10 }}
                />
                <Text style={styles.actionBtnText}>
                  {WORKER_NEXT_LABEL[job.status]}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reference: { fontSize: 14, fontWeight: 'bold', color: '#6b7280' },
  jobTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  scheduledDate: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  infoLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  infoValue: { fontSize: 15, color: '#111827', fontWeight: '500' },
  notesText: { fontSize: 15, color: '#374151', lineHeight: 22 },

  actionsContainer: { marginHorizontal: 16, marginTop: 24 },
  actionBtn: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 14,
    shadowColor: '#2563eb',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  actionBtnDisabled: { backgroundColor: '#93c5fd' },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
  completeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1fae5',
    padding: 20,
    borderRadius: 14,
    gap: 12,
  },
  completeText: { fontSize: 18, fontWeight: 'bold', color: '#065f46' },
});
