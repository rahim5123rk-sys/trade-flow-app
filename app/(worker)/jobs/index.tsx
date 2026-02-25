import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db } from './../../../src/config/firebase';
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

const StatusBadge = ({ status }: { status: string }) => {
  const colours = STATUS_COLOURS[status] || { bg: '#f3f4f6', text: '#374151' };
  return (
    <View style={[styles.badge, { backgroundColor: colours.bg }]}>
      <Text style={[styles.badgeText, { color: colours.text }]}>
        {STATUS_LABELS[status] || status.replace('_', ' ')}
      </Text>
    </View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WorkerJobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'jobs'),
      where('assignedTo', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobsData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Job)
      );
      // Sort: active jobs first, then by scheduled date descending
      jobsData.sort((a, b) => {
        const activeStatuses = ['pending', 'accepted', 'on_the_way', 'in_progress'];
        const aActive = activeStatuses.includes(a.status) ? 0 : 1;
        const bActive = activeStatuses.includes(b.status) ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return b.scheduledDate - a.scheduledDate;
      });
      setJobs(jobsData);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const renderJob = ({ item }: { item: Job }) => {
    const scheduledStr = item.scheduledDate
      ? new Date(item.scheduledDate).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : null;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push(`/(worker)/jobs/${item.id}`)}
      >
        <View style={styles.row}>
          <Text style={styles.ref}>{item.reference}</Text>
          <StatusBadge status={item.status} />
        </View>
        <Text style={styles.jobTitle}>{item.title}</Text>
        <Text style={styles.customer}>{item.customerSnapshot.name}</Text>
        <View style={styles.cardFooter}>
          <Ionicons name="location-outline" size={13} color="#9ca3af" />
          <Text style={styles.address} numberOfLines={1}>
            {item.customerSnapshot.address}
          </Text>
          {scheduledStr && (
            <>
              <Text style={styles.dot}>·</Text>
              <Ionicons name="calendar-outline" size={13} color="#9ca3af" />
              <Text style={styles.date}>{scheduledStr}</Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={jobs}
          renderItem={renderJob}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="briefcase-outline" size={48} color="#d1d5db" />
              <Text style={styles.empty}>No jobs assigned to you yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  ref: { fontWeight: 'bold', fontSize: 14, color: '#6b7280' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  jobTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  customer: { fontSize: 14, color: '#374151', marginBottom: 6 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  address: { fontSize: 13, color: '#9ca3af', flex: 1 },
  dot: { color: '#d1d5db', fontSize: 13 },
  date: { fontSize: 13, color: '#9ca3af' },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  empty: { textAlign: 'center', marginTop: 12, color: '#9ca3af', fontSize: 15 },
});
