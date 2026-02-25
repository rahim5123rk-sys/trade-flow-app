import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../../src/config/firebase';
import { useAuth } from '../../../src/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  reference: string;
  title: string;
  status: string;
  category: string;
  customerSnapshot: {
    name: string;
    address: string;
  };
  notes?: string;
  assignedTo: string[];
  scheduledDate: number;
  createdAt: any;
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, { bg: string; text: string }> = {
  pending:     { bg: '#fef3c7', text: '#92400e' },
  accepted:    { bg: '#fff7ed', text: '#9a3412' },
  on_the_way:  { bg: '#fce7f3', text: '#9d174d' },
  in_progress: { bg: '#dbeafe', text: '#1e40af' },
  complete:    { bg: '#dcfce7', text: '#166534' },
  invoiced:    { bg: '#ede9fe', text: '#5b21b6' },
  paid:        { bg: '#d1fae5', text: '#065f46' },
  cancelled:   { bg: '#fee2e2', text: '#991b1b' },
};

const STATUS_LABELS: Record<string, string> = {
  pending:     'Pending',
  accepted:    'Accepted',
  on_the_way:  'On The Way',
  in_progress: 'In Progress',
  complete:    'Complete',
  invoiced:    'Invoiced',
  paid:        'Paid',
  cancelled:   'Cancelled',
};

const StatusBadge = ({ status }: { status: string }) => {
  const colours = STATUS_COLOURS[status] || { bg: '#f3f4f6', text: '#374151' };
  return (
    <View style={[styles.badge, { backgroundColor: colours.bg }]}>
      <Text style={[styles.badgeText, { color: colours.text }]}>
        {STATUS_LABELS[status] || status.replace('_', ' ').toUpperCase()}
      </Text>
    </View>
  );
};

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTERS = ['All', 'Pending', 'In Progress', 'Complete', 'Invoiced'];
const FILTER_STATUS_MAP: Record<string, string[]> = {
  'All':        [],
  'Pending':    ['pending'],
  'In Progress': ['accepted', 'on_the_way', 'in_progress'],
  'Complete':   ['complete'],
  'Invoiced':   ['invoiced', 'paid'],
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function JobsListScreen() {
  const { userProfile } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

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

  // Apply filter + search client-side
  const filteredJobs = jobs.filter((job) => {
    const statusMatch =
      FILTER_STATUS_MAP[activeFilter].length === 0 ||
      FILTER_STATUS_MAP[activeFilter].includes(job.status);

    if (!statusMatch) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      job.reference?.toLowerCase().includes(q) ||
      job.title?.toLowerCase().includes(q) ||
      job.customerSnapshot?.name?.toLowerCase().includes(q) ||
      job.customerSnapshot?.address?.toLowerCase().includes(q)
    );
  });

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
        onPress={() => router.push(`/(admin)/jobs/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.reference}>{item.reference}</Text>
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
      {/* ── Search bar ── */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#9ca3af" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search jobs, customers..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {/* ── Filter tabs ── */}
      <FlatList
        data={FILTERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(f) => f}
        contentContainerStyle={styles.filtersContainer}
        renderItem={({ item: filter }) => (
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === filter && styles.filterTabActive]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text
              style={[styles.filterTabText, activeFilter === filter && styles.filterTabTextActive]}
            >
              {filter}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ── Job list ── */}
      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredJobs}
          renderItem={renderJob}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="briefcase-outline" size={48} color="#d1d5db" />
              <Text style={styles.empty}>
                {search || activeFilter !== 'All'
                  ? 'No jobs match your filter.'
                  : 'No jobs yet. Tap + to create one.'}
              </Text>
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

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },

  // Filter tabs
  filtersContainer: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterTabActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterTabText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  filterTabTextActive: { color: '#fff', fontWeight: '600' },

  // Cards
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reference: { fontWeight: 'bold', fontSize: 14, color: '#6b7280' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  jobTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  customer: { fontSize: 14, color: '#374151', marginBottom: 6 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  address: { fontSize: 13, color: '#9ca3af', flex: 1 },
  dot: { color: '#d1d5db', fontSize: 13 },
  date: { fontSize: 13, color: '#9ca3af' },

  // Empty
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  empty: { textAlign: 'center', marginTop: 12, color: '#9ca3af', fontSize: 15 },

  // FAB
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
