import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
import { Colors } from '../../constants/theme';
import { supabase } from '../../src/config/supabase';
import { useAuth } from '../../src/context/AuthContext';

const StatCard = ({
  title,
  value,
  color,
  icon,
}: {
  title: string;
  value: number | string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <View style={styles.statContent}>
      <View>
        <Text style={styles.statLabel}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <View style={[styles.iconBox, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
    </View>
  </View>
);

const StatusBadge = ({ status }: { status: string }) => {
  const getStyle = (s: string) => {
    switch(s) {
      case 'pending': return { bg: '#FFF7ED', text: '#C2410C' };
      case 'in_progress': return { bg: '#EFF6FF', text: '#1D4ED8' };
      case 'complete': return { bg: '#F0FDF4', text: '#15803D' };
      case 'paid': return { bg: '#ECFDF5', text: '#047857' };
      default: return { bg: '#F1F5F9', text: '#475569' };
    }
  };
  const style = getStyle(status);
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={[styles.badgeText, { color: style.text }]}>
        {status.replace('_', ' ')}
      </Text>
    </View>
  );
};

const formatCurrency = (amount: number) =>
  `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DashboardScreen() {
  const { userProfile, role } = useAuth();
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [userProfile]);

  const fetchDashboardData = async () => {
    if (!userProfile?.company_id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('company_id', userProfile.company_id);

    if (data) setAllJobs(data);
    setLoading(false);
    setRefreshing(false);
  };

  const stats = useMemo(() => {
    const now = Date.now();
    
    // Revenue (Completed/Paid)
    const totalRevenue = allJobs
      .filter((j) => (j.status === 'paid' || j.payment_status === 'paid') && j.price)
      .reduce((sum, j) => sum + (j.price || 0), 0);

    // Outstanding (Complete but not paid)
    const outstandingJobs = allJobs.filter(
      (j) => j.status === 'complete' && j.status !== 'paid'
    );

    // Upcoming
    const upcomingJobs = allJobs
      .filter(
        (j) =>
          j.scheduled_date >= now &&
          !['complete', 'paid', 'cancelled'].includes(j.status)
      )
      .sort((a, b) => a.scheduled_date - b.scheduled_date)
      .slice(0, 5);

    return {
      pending: allJobs.filter((j) => j.status === 'pending').length,
      active: allJobs.filter((j) => j.status === 'in_progress').length,
      completed: allJobs.filter((j) => j.status === 'complete').length,
      totalRevenue,
      upcomingJobs,
      outstandingAmount: outstandingJobs.reduce((sum, j) => sum + (j.price || 0), 0),
    };
  }, [allJobs]);

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={fetchDashboardData} tintColor={Colors.primary} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {userProfile?.display_name?.split(' ')[0]}</Text>
          <Text style={styles.subtext}>
             {role === 'worker' ? 'Viewing as Worker (Test Mode)' : 'Here is your business overview.'}
          </Text>
        </View>
      </View>

      {/* Grid */}
      <View style={styles.gridContainer}>
        <View style={styles.row}>
            <StatCard title="In Progress" value={stats.active} color={Colors.primary} icon="briefcase" />
            <StatCard title="Pending" value={stats.pending} color={Colors.warning} icon="time" />
        </View>
        <View style={styles.row}>
            <StatCard title="Revenue" value={formatCurrency(stats.totalRevenue)} color={Colors.success} icon="cash" />
            <StatCard title="Outstanding" value={formatCurrency(stats.outstandingAmount)} color={Colors.danger} icon="alert-circle" />
        </View>
      </View>

      {/* Upcoming */}
      <Text style={styles.sectionTitle}>Upcoming Schedule</Text>
      <View style={styles.cardContainer}>
        {stats.upcomingJobs.length === 0 ? (
            <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No upcoming jobs.</Text>
            </View>
        ) : (
            stats.upcomingJobs.map((job) => (
                <TouchableOpacity 
                    key={job.id} 
                    style={styles.jobRow} 
                    onPress={() => router.push(`/(admin)/jobs/${job.id}`)}
                >
                    <View style={styles.dateBox}>
                        <Text style={styles.dateDay}>{new Date(job.scheduled_date).getDate()}</Text>
                        <Text style={styles.dateMonth}>
                            {new Date(job.scheduled_date).toLocaleDateString('en-GB', { month: 'short' })}
                        </Text>
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 12 }}>
                        <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                        <Text style={styles.jobCustomer}>{job.customer_snapshot?.name}</Text>
                    </View>
                    <StatusBadge status={job.status} />
                </TouchableOpacity>
            ))
        )}
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(admin)/jobs/create')}>
            <Ionicons name="add-circle" size={24} color={Colors.primary} />
            <Text style={styles.actionText}>New Job</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(admin)/customers/add')}>
            <Ionicons name="person-add" size={24} color={Colors.primary} />
            <Text style={styles.actionText}>Add Customer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(admin)/workers/add')}>
            <Ionicons name="mail" size={24} color={Colors.primary} />
            <Text style={styles.actionText}>Invite Worker</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 10 },
  greeting: { fontSize: 24, fontWeight: '800', color: Colors.text },
  subtext: { fontSize: 14, color: Colors.textLight, marginTop: 2 },
  gridContainer: { gap: 16, marginBottom: 30 },
  row: { flexDirection: 'row', gap: 16 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, ...Colors.shadow, borderLeftWidth: 4,
  },
  statContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.text },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  cardContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 8, ...Colors.shadow, marginBottom: 30 },
  emptyState: { padding: 20, alignItems: 'center' },
  emptyText: { color: Colors.textLight },
  jobRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dateBox: { alignItems: 'center', backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, minWidth: 45 },
  dateDay: { fontWeight: '800', fontSize: 16, color: Colors.text },
  dateMonth: { fontSize: 10, color: Colors.textLight, textTransform: 'uppercase' },
  jobTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  jobCustomer: { fontSize: 12, color: Colors.textLight },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', gap: 8, ...Colors.shadow },
  actionText: { fontSize: 12, fontWeight: '600', color: Colors.text },
});