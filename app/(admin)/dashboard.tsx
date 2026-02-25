import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  total: number;
  pending: number;
  inProgress: number;
  complete: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
  <View style={[styles.card, { borderLeftColor: colour, borderLeftWidth: 4 }]}>
    <View style={styles.cardTop}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={[styles.iconWrap, { backgroundColor: colour + '20' }]}>
        <Ionicons name={icon as any} size={18} color={colour} />
      </View>
    </View>
    <Text style={[styles.cardValue, { color: colour }]}>{value}</Text>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    complete: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.companyId) return;

    // Single snapshot listener — count statuses client-side to avoid
    // needing multiple composite indexes in Firestore.
    const q = query(
      collection(db, 'jobs'),
      where('companyId', '==', userProfile.companyId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const jobs = snap.docs.map((d) => d.data());
      setStats({
        total: jobs.length,
        pending: jobs.filter((j) => j.status === 'pending').length,
        inProgress: jobs.filter((j) =>
          ['accepted', 'on_the_way', 'in_progress'].includes(j.status)
        ).length,
        complete: jobs.filter((j) => j.status === 'complete').length,
      });
      setLoading(false);
    });

    return unsub;
  }, [userProfile]);

  const firstName = userProfile?.displayName?.split(' ')[0] ?? 'there';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>

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
        <StatCard
          title="Total Jobs"
          value={loading ? '—' : stats.total}
          colour="#2563eb"
          icon="briefcase-outline"
        />
        <StatCard
          title="Pending"
          value={loading ? '—' : stats.pending}
          colour="#d97706"
          icon="hourglass-outline"
        />
      </View>
      <View style={[styles.grid, { marginTop: 12 }]}>
        <StatCard
          title="In Progress"
          value={loading ? '—' : stats.inProgress}
          colour="#7c3aed"
          icon="flash-outline"
        />
        <StatCard
          title="Complete"
          value={loading ? '—' : stats.complete}
          colour="#059669"
          icon="checkmark-circle-outline"
        />
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
          onPress={() => router.push('/(admin)/jobs')}
        >
          <Ionicons name="list-outline" size={22} color="#2563eb" />
          <Text style={styles.actionBtnText}>View Jobs</Text>
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
  grid: { flexDirection: 'row', gap: 12 },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  iconWrap: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  cardValue: { fontSize: 34, fontWeight: 'bold' },
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
});
