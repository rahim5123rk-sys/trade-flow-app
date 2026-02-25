import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  reference: string;
  title: string;
  status: string;
  customerSnapshot: { name: string; address: string };
  assignedTo: string[];
  scheduledDate: number;
  price?: number;
  paymentStatus?: string;
  createdAt: any;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#fef3c7', text: '#92400e' },
  accepted: { bg: '#fff7ed', text: '#9a3412' },
  on_the_way: { bg: '#fce7f3', text: '#9d174d' },
  in_progress: { bg: '#dbeafe', text: '#1e40af' },
  complete: { bg: '#dcfce7', text: '#166534' },
  invoiced: { bg: '#ede9fe', text: '#5b21b6' },
  paid: { bg: '#d1fae5', text: '#065f46' },
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  on_the_way: 'On The Way',
  in_progress: 'In Progress',
  complete: 'Complete',
  invoiced: 'Invoiced',
  paid: 'Paid',
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

const StatCard = ({
  title,
  value,
  colour,
  icon,
}: {
  title: string;
  value: number | string;
  colour: string;
  icon: string;
}) => (
  <View style={[styles.statCard, { borderLeftColor: colour, borderLeftWidth: 4 }]}>
    <View style={styles.statCardTop}>
      <Text style={styles.statCardTitle}>{title}</Text>
      <View style={[styles.iconWrap, { backgroundColor: colour + '20' }]}>
        <Ionicons name={icon as any} size={18} color={colour} />
      </View>
    </View>
    <Text style={[styles.statCardValue, { color: colour }]}>{value}</Text>
  </View>
);

const getWeekStart = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getWeekEnd = () => {
  const monday = getWeekStart();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
};

const formatCurrency = (amount: number) =>
  `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { userProfile } = useAuth();
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!userProfile?.companyId) return;

    const q = query(
      collection(db, 'jobs'),
      where('companyId', '==', userProfile.companyId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const jobs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Job));
      setAllJobs(jobs);
      setLoading(false);
      setRefreshing(false);
    });

    return unsub;
  }, [userProfile]);

  // ── Computed stats ────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const now = Date.now();
    const weekStart = getWeekStart().getTime();
    const weekEnd = getWeekEnd().getTime();

    const thisWeekJobs = allJobs.filter(
      (j) => j.scheduledDate >= weekStart && j.scheduledDate <= weekEnd
    );

    const pendingCount = allJobs.filter((j) => j.status === 'pending').length;

    const inProgressCount = allJobs.filter((j) =>
      ['accepted', 'on_the_way', 'in_progress'].includes(j.status)
    ).length;

    const completeCount = allJobs.filter((j) => j.status === 'complete').length;

    // Upcoming (scheduled in the future, not completed/paid/cancelled)
    const upcomingJobs = allJobs
      .filter(
        (j) =>
          j.scheduledDate >= now &&
          !['complete', 'invoiced', 'paid', 'cancelled'].includes(j.status)
      )
      .sort((a, b) => a.scheduledDate - b.scheduledDate)
      .slice(0, 5);

    // Revenue
    const totalRevenue = allJobs
      .filter((j) => j.status === 'paid' && j.price)
      .reduce((sum, j) => sum + (j.price || 0), 0);

    const weekRevenue = thisWeekJobs
      .filter((j) => j.status === 'paid' && j.price)
      .reduce((sum, j) => sum + (j.price || 0), 0);

    // Outstanding = complete or invoiced but not paid
    const outstandingJobs = allJobs.filter(
      (j) =>
        ['complete', 'invoiced'].includes(j.status) &&
        j.paymentStatus !== 'paid'
    );
    const outstandingAmount = outstandingJobs.reduce(
      (sum, j) => sum + (j.price || 0),
      0
    );

    return {
      total: allJobs.length,
      pendingCount,
      inProgressCount,
      completeCount,
      upcomingJobs,
      totalRevenue,
      weekRevenue,
      outstandingJobs,
      outstandingAmount,
    };
  }, [allJobs]);

  const firstName = userProfile?.displayName?.split(' ')[0] ?? 'there';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => setRefreshing(true)}
          tintColor="#2563eb"
        />
      }
    >
      {/* ── Greeting ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {firstName}</Text>
          <Text style={styles.subtext}>Here's what's happening today.</Text>
        </View>
        <Ionicons name="sunny-outline" size={28} color="#f59e0b" />
      </View>

      {/* ── Stats Grid ── */}
      <Text style={styles.sectionLabel}>Overview</Text>
      <View style={styles.grid}>
        <StatCard title="Total Jobs" value={stats.total} colour="#2563eb" icon="briefcase-outline" />
        <StatCard title="Pending" value={stats.pendingCount} colour="#d97706" icon="hourglass-outline" />
      </View>
      <View style={[styles.grid, { marginTop: 12 }]}>
        <StatCard title="In Progress" value={stats.inProgressCount} colour="#7c3aed" icon="flash-outline" />
        <StatCard title="Complete" value={stats.completeCount} colour="#059669" icon="checkmark-circle-outline" />
      </View>

      {/* ── Revenue Card ── */}
      <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Revenue</Text>
      <View style={styles.revenueCard}>
        <View style={styles.revenueRow}>
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>This Week</Text>
            <Text style={styles.revenueValue}>{formatCurrency(stats.weekRevenue)}</Text>
          </View>
          <View style={styles.revenueDivider} />
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>All Time</Text>
            <Text style={styles.revenueValue}>{formatCurrency(stats.totalRevenue)}</Text>
          </View>
        </View>
      </View>

      {/* ── Outstanding Payments ── */}
      {stats.outstandingJobs.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Outstanding Payments</Text>
          <View style={styles.card}>
            <View style={styles.outstandingHeader}>
              <Text style={styles.outstandingTotal}>
                {formatCurrency(stats.outstandingAmount)}
              </Text>
              <Text style={styles.outstandingCount}>
                {stats.outstandingJobs.length} job{stats.outstandingJobs.length !== 1 ? 's' : ''}
              </Text>
            </View>
            {stats.outstandingJobs.slice(0, 4).map((job) => (
              <TouchableOpacity
                key={job.id}
                style={styles.outstandingRow}
                onPress={() => router.push(`/(admin)/jobs/${job.id}`)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.outstandingRef}>{job.reference}</Text>
                  <Text style={styles.outstandingCustomer}>{job.customerSnapshot.name}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.outstandingPrice}>
                    {job.price ? formatCurrency(job.price) : '—'}
                  </Text>
                  <StatusBadge status={job.status} />
                </View>
              </TouchableOpacity>
            ))}
            {stats.outstandingJobs.length > 4 && (
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() => router.push('/(admin)/jobs')}
              >
                <Text style={styles.viewAllText}>
                  View all {stats.outstandingJobs.length} outstanding
                </Text>
                <Ionicons name="arrow-forward" size={14} color="#2563eb" />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {/* ── Upcoming Jobs ── */}
      <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Upcoming Jobs</Text>
      <View style={styles.card}>
        {stats.upcomingJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={36} color="#d1d5db" />
            <Text style={styles.emptyText}>No upcoming jobs scheduled</Text>
          </View>
        ) : (
          stats.upcomingJobs.map((job) => (
            <TouchableOpacity
              key={job.id}
              style={styles.upcomingRow}
              onPress={() => router.push(`/(admin)/jobs/${job.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.upcomingDateCol}>
                <Text style={styles.upcomingDay}>
                  {new Date(job.scheduledDate).toLocaleDateString('en-GB', { weekday: 'short' })}
                </Text>
                <Text style={styles.upcomingDateNum}>
                  {new Date(job.scheduledDate).getDate()}
                </Text>
                <Text style={styles.upcomingTime}>{formatTime(job.scheduledDate)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.upcomingTopRow}>
                  <Text style={styles.upcomingRef}>{job.reference}</Text>
                  <StatusBadge status={job.status} />
                </View>
                <Text style={styles.upcomingTitle} numberOfLines={1}>
                  {job.title || job.customerSnapshot.name}
                </Text>
                <Text style={styles.upcomingAddress} numberOfLines={1}>
                  {job.customerSnapshot.address}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* ── Quick Actions ── */}
      <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.8}
          onPress={() => router.push('/(admin)/jobs/create')}
        >
          <Ionicons name="add-circle-outline" size={22} color="#2563eb" />
          <Text style={styles.actionBtnText}>New Job</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.8}
          onPress={() => router.push('/(admin)/customers')}
        >
          <Ionicons name="people-circle-outline" size={22} color="#2563eb" />
          <Text style={styles.actionBtnText}>Customers</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.8}
          onPress={() => router.push('/(admin)/workers')}
        >
          <Ionicons name="people-outline" size={22} color="#2563eb" />
          <Text style={styles.actionBtnText}>Workers</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  subtext: { fontSize: 14, color: '#6b7280', marginTop: 2 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  // Stat cards
  grid: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statCardTitle: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  iconWrap: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  statCardValue: { fontSize: 34, fontWeight: 'bold' },

  // Revenue
  revenueCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  revenueRow: { flexDirection: 'row', alignItems: 'center' },
  revenueItem: { flex: 1, alignItems: 'center' },
  revenueLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: '500' },
  revenueValue: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  revenueDivider: { width: 1, height: 40, backgroundColor: '#e5e7eb' },

  // Card (reusable)
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  // Outstanding
  outstandingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  outstandingTotal: { fontSize: 22, fontWeight: 'bold', color: '#dc2626' },
  outstandingCount: { fontSize: 13, color: '#6b7280' },
  outstandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  outstandingRef: { fontSize: 14, fontWeight: '600', color: '#111827' },
  outstandingCustomer: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  outstandingPrice: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    gap: 6,
  },
  viewAllText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },

  // Upcoming
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  upcomingDateCol: { width: 50, alignItems: 'center', marginRight: 12 },
  upcomingDay: { fontSize: 10, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase' },
  upcomingDateNum: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  upcomingTime: { fontSize: 10, color: '#6b7280' },
  upcomingTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  upcomingRef: { fontSize: 13, fontWeight: '600', color: '#111827' },
  upcomingTitle: { fontSize: 14, color: '#374151', marginBottom: 2 },
  upcomingAddress: { fontSize: 12, color: '#9ca3af' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { color: '#9ca3af', marginTop: 10, fontSize: 14 },

  // Quick actions
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },

  // Status badge
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700' },
});