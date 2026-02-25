import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../../src/config/firebase';
import { useAuth } from '../../../src/context/AuthContext';

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
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, { bg: string; text: string }> = {
  pending:     { bg: '#fef3c7', text: '#92400e' },
  in_progress: { bg: '#dbeafe', text: '#1e40af' },
  complete:    { bg: '#dcfce7', text: '#166534' },
  invoiced:    { bg: '#ede9fe', text: '#5b21b6' },
  paid:        { bg: '#d1fae5', text: '#065f46' },
};

const StatusBadge = ({ status }: { status: string }) => {
  const colours = STATUS_COLOURS[status] || { bg: '#f3f4f6', text: '#374151' };
  return (
    <View style={[styles.badge, { backgroundColor: colours.bg }]}>
      <Text style={[styles.badgeText, { color: colours.text }]}>
        {status.replace('_', ' ').toUpperCase()}
      </Text>
    </View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function JobsListScreen() {
  const { userProfile } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.companyId) return;

    // NOTE: This query requires a composite index in Firestore.
    // When you first run it, Firebase will print a link in the console
    // to create the index automatically — just click it.
    const q = query(
      collection(db, 'jobs'),
      where('companyId', '==', userProfile.companyId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobsData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Job)
      );
      setJobs(jobsData);
      setLoading(false);
    });

    return unsubscribe;
  }, [userProfile]);

  const renderJob = ({ item }: { item: Job }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/(admin)/jobs/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.reference}>{item.reference}</Text>
        <StatusBadge status={item.status} />
      </View>
      <Text style={styles.customer}>{item.customerSnapshot.name}</Text>
      <Text style={styles.address}>{item.customerSnapshot.address}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={jobs}
          renderItem={renderJob}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="briefcase-outline" size={48} color="#d1d5db" />
              <Text style={styles.empty}>No jobs yet. Tap + to create one.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push('/(admin)/jobs/create')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reference: { fontWeight: 'bold', fontSize: 16, color: '#111827' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  customer: { fontSize: 14, color: '#374151', marginBottom: 4 },
  address: { fontSize: 13, color: '#6b7280' },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  empty: { textAlign: 'center', marginTop: 12, color: '#9ca3af', fontSize: 15 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    backgroundColor: '#2563eb',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#2563eb',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
