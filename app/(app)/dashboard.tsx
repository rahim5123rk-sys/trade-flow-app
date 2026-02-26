// ============================================
// FILE: app/(app)/dashboard.tsx
// ============================================

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { supabase } from '../../src/config/supabase';
import { useAuth } from '../../src/context/AuthContext';

interface DashboardJob {
  id: string;
  company_id: string;
  title: string;
  status: string;
  payment_status?: string;
  scheduled_date: number;
  price?: number;
  assigned_to?: string[];
  customer_snapshot?: {
    name: string;
    address: string;
  };
}

const ActionButton = ({ 
  icon, 
  label, 
  onPress, 
  color = Colors.primary 
}: { 
  icon: keyof typeof Ionicons.glyphMap; 
  label: string; 
  onPress: () => void; 
  color?: string; 
}) => (
  <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.actionIconBox, { backgroundColor: `${color}10` }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

const StatPill = ({ 
  label, 
  value, 
  icon, 
  color 
}: { 
  label: string; 
  value: string | number; 
  icon: keyof typeof Ionicons.glyphMap; 
  color: string; 
}) => (
  <View style={styles.statPill}>
    <View style={[styles.pillIcon, { backgroundColor: `${color}15` }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <View>
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  </View>
);

const JobCard = ({ job, isToday }: { job: DashboardJob; isToday?: boolean }) => {
  const statusColor = 
    job.status === 'in_progress' ? Colors.primary :
    job.status === 'pending' ? Colors.warning :
    job.status === 'complete' ? Colors.success : Colors.secondary;

  return (
    <TouchableOpacity 
      style={styles.jobCard} 
      activeOpacity={0.7}
      onPress={() => router.push(`/(app)/jobs/${job.id}` as any)}
    >
      <View style={[styles.jobIndicator, { backgroundColor: statusColor }]} />
      <View style={styles.jobContent}>
        <View style={styles.jobHeader}>
          <Text style={styles.jobTime}>
            {new Date(job.scheduled_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isToday && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayText}>TODAY</Text>
            </View>
          )}
        </View>
        <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
        <Text style={styles.jobAddress} numberOfLines={1}>
          {job.customer_snapshot?.name || 'Unknown Client'} • {job.customer_snapshot?.address || 'No Address'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.border} />
    </TouchableOpacity>
  );
};

export default function DashboardScreen() {
  const { userProfile, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [allJobs, setAllJobs] = useState<DashboardJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = userProfile?.role === 'admin';

  useFocusEffect(
    useCallback(() => {
      if (userProfile?.company_id) {
        fetchDashboardData();
      }
    }, [userProfile])
  );

  const fetchDashboardData = async () => {
    if (!userProfile?.company_id) return;

    let query = supabase
      .from('jobs')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .neq('status', 'cancelled')
      .order('scheduled_date', { ascending: true });

    if (!isAdmin && user?.id) {
       query = query.contains('assigned_to', [user.id]);
    }

    const { data } = await query;
    if (data) setAllJobs(data as any);
    setLoading(false);
    setRefreshing(false);
  };

  const stats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();

    const active = allJobs.filter(j => j.status === 'in_progress').length;
    const pending = allJobs.filter(j => j.status === 'pending').length;
    
    const revenue = isAdmin 
      ? allJobs
          .filter(j => j.status === 'paid' || j.payment_status === 'paid')
          .reduce((sum, j) => sum + (j.price || 0), 0)
      : 0;

    const todaysJobs = allJobs.filter(j => 
      j.scheduled_date >= startOfDay && 
      j.scheduled_date < endOfDay
    );

    const upcomingJobs = allJobs.filter(j => 
      j.scheduled_date >= endOfDay &&
      !['complete', 'paid'].includes(j.status)
    ).slice(0, 5);

    return { active, pending, revenue, todaysJobs, upcomingJobs };
  }, [allJobs, isAdmin]);

  const formatCurrency = (amount: number) => 
    `£${amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

  if (loading && allJobs.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const firstName = userProfile?.display_name?.split(' ')[0] || 'There';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => { setRefreshing(true); fetchDashboardData(); }} 
            tintColor={Colors.primary} 
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <View>
            <Text style={styles.headerDate}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <Text style={styles.headerTitle}>Hello, {firstName}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(app)/settings')} style={styles.profileBtn}>
             <Text style={styles.profileText}>{firstName.charAt(0)}</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200)} style={styles.statsRow}>
          <StatPill label="Active Jobs" value={stats.active} icon="briefcase" color={Colors.primary} />
          <StatPill label="Pending" value={stats.pending} icon="time" color={Colors.warning} />
          {isAdmin ? (
            <StatPill label="Revenue" value={formatCurrency(stats.revenue)} icon="card" color={Colors.success} />
          ) : (
            <StatPill label="Completed" value={allJobs.filter(j => j.status === 'complete').length} icon="checkmark-circle" color={Colors.success} />
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300)} style={styles.actionGrid}>
          {isAdmin ? (
            <>
              {/* Job Management */}
              <ActionButton label="New Job" icon="add" onPress={() => router.push('/(app)/jobs/create' as any)} />
              
              {/* Standalone Quote - Points to dedicated route */}
              <ActionButton 
                label="New Quote" 
                icon="document-text-outline" 
                color="#8b5cf6" 
                onPress={() => router.push('/(app)/jobs/[id]/quote' as any)} 
              />
              
              {/* Standalone Invoice - Points to dedicated route */}
              <ActionButton 
                label="New Invoice" 
                icon="receipt-outline" 
                color="#f59e0b" 
                onPress={() => router.push('/(app)/jobs/[id]/invoice' as any)} 
              />
              
              <ActionButton label="Add Client" icon="person-add-outline" color={Colors.text} onPress={() => router.push('/(app)/customers/add' as any)} />
              
              <ActionButton label="All Jobs" icon="list-outline" color={Colors.text} onPress={() => router.push('/(app)/jobs')} />
              <ActionButton label="Team" icon="people-outline" color={Colors.text} onPress={() => router.push('/(app)/workers' as any)} />
            </>
          ) : (
            <>
               <TouchableOpacity style={[styles.actionBtn, { width: '48%' }]} onPress={() => router.push('/(app)/jobs')}>
                 <View style={[styles.actionIconBox, { backgroundColor: `${Colors.primary}10`, width: '100%' }]}>
                   <Ionicons name="list-outline" size={24} color={Colors.primary} />
                 </View>
                 <Text style={styles.actionLabel}>My Schedule</Text>
               </TouchableOpacity>

               <TouchableOpacity style={[styles.actionBtn, { width: '48%' }]} onPress={() => router.push('/(app)/calendar')}>
                 <View style={[styles.actionIconBox, { backgroundColor: `${Colors.text}10`, width: '100%' }]}>
                   <Ionicons name="calendar-outline" size={24} color={Colors.text} />
                 </View>
                 <Text style={styles.actionLabel}>Calendar View</Text>
               </TouchableOpacity>
            </>
          )}
        </Animated.View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Schedule</Text>
          {stats.todaysJobs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No jobs scheduled for today.</Text>
            </View>
          ) : (
            stats.todaysJobs.map(job => <JobCard key={job.id} job={job} isToday />)
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Up Next</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/jobs')}>
              <Text style={styles.seeAll}>See Calendar</Text>
            </TouchableOpacity>
          </View>
          
          {stats.upcomingJobs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Nothing upcoming.</Text>
            </View>
          ) : (
            stats.upcomingJobs.map(job => (
              <View key={job.id} style={styles.upcomingRow}>
                <View style={styles.upcomingDateBox}>
                  <Text style={styles.upcomingDay}>{new Date(job.scheduled_date).getDate()}</Text>
                  <Text style={styles.upcomingMonth}>
                    {new Date(job.scheduled_date).toLocaleDateString('en-GB', { month: 'short' })}
                  </Text>
                </View>
                <JobCard job={job} />
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 24, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  headerDate: { fontSize: 13, color: Colors.textLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: Colors.text, marginTop: 4 },
  profileBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', ...Colors.shadow },
  profileText: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  statPill: { flex: 1, flexDirection: 'column', backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 12, shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  pillIcon: { alignSelf: 'flex-start', padding: 8, borderRadius: 10 },
  pillValue: { fontSize: 18, fontWeight: '700', color: Colors.text },
  pillLabel: { fontSize: 11, color: Colors.textLight, marginTop: 2 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 20, marginBottom: 40 },
  actionBtn: { alignItems: 'center', width: '22%' }, 
  actionIconBox: { width: 56, height: 56, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionLabel: { fontSize: 11, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  seeAll: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  jobCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  jobIndicator: { width: 4, height: 24, borderRadius: 2, marginRight: 16 },
  jobContent: { flex: 1 },
  jobHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  jobTime: { fontSize: 12, fontWeight: '600', color: Colors.textLight },
  todayBadge: { backgroundColor: Colors.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  todayText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  jobTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  jobAddress: { fontSize: 13, color: Colors.textLight },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  upcomingDateBox: { width: 44, alignItems: 'center', justifyContent: 'center' },
  upcomingDay: { fontSize: 18, fontWeight: '700', color: Colors.text },
  upcomingMonth: { fontSize: 10, fontWeight: '600', color: Colors.textLight, textTransform: 'uppercase' },
  emptyBox: { padding: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' },
  emptyText: { color: Colors.textLight, fontSize: 13 },
});