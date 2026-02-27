// ============================================
// FILE: app/(app)/dashboard.tsx
// Modern glassmorphism dashboard
// ============================================

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInRight,
    SlideInRight,
} from 'react-native-reanimated';
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

// --- Greeting based on time of day ---
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// --- Quick Action Pill ---
const QuickAction = ({
  icon,
  label,
  gradient,
  onPress,
  delay = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  gradient: readonly [string, string];
  onPress: () => void;
  delay?: number;
}) => (
  <Animated.View entering={FadeInDown.delay(delay).springify()}>
    <TouchableOpacity style={s.quickAction} activeOpacity={0.75} onPress={onPress}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.quickGradient}
      >
        <Ionicons name={icon} size={22} color="#fff" />
      </LinearGradient>
      <Text style={s.quickLabel}>{label}</Text>
    </TouchableOpacity>
  </Animated.View>
);

// --- Glassmorphic Stat Card ---
const GlassCard = ({
  label,
  value,
  icon,
  accent,
  delay = 0,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  delay?: number;
}) => (
  <Animated.View
    entering={FadeInDown.delay(delay).springify()}
    style={s.glassOuter}
  >
    <View style={s.glassCard}>
      <View style={[s.glassAccent, { backgroundColor: accent }]} />
      <View style={s.glassBody}>
        <View style={[s.glassIconCircle, { backgroundColor: `${accent}18` }]}>
          <Ionicons name={icon} size={18} color={accent} />
        </View>
        <Text style={s.glassValue}>{value}</Text>
        <Text style={s.glassLabel}>{label}</Text>
      </View>
    </View>
  </Animated.View>
);

// --- Modern Job Card ---
const JobTile = ({
  job,
  isToday,
  delay = 0,
}: {
  job: DashboardJob;
  isToday?: boolean;
  delay?: number;
}) => {
  const statusMap: Record<string, { color: string; label: string }> = {
    in_progress: { color: '#3B82F6', label: 'In Progress' },
    pending: { color: '#F59E0B', label: 'Pending' },
    complete: { color: '#10B981', label: 'Complete' },
    paid: { color: '#8B5CF6', label: 'Paid' },
  };
  const st = statusMap[job.status] || { color: Colors.secondary, label: job.status };
  const time = new Date(job.scheduled_date).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Animated.View entering={FadeInRight.delay(delay).springify()}>
      <TouchableOpacity
        style={s.jobTile}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/(app)/jobs/[id]', params: { id: job.id } })}
      >
        {/* Left accent strip */}
        <LinearGradient
          colors={[st.color, `${st.color}88`] as readonly [string, string]}
          style={s.jobStrip}
        />

        <View style={s.jobBody}>
          <View style={s.jobTopRow}>
            <View style={s.jobTimeBox}>
              <Ionicons name="time-outline" size={12} color={Colors.textLight} />
              <Text style={s.jobTime}>{time}</Text>
            </View>
            {isToday && (
              <LinearGradient
                colors={['#3B82F6', '#6366F1'] as readonly [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.todayChip}
              >
                <Text style={s.todayChipText}>TODAY</Text>
              </LinearGradient>
            )}
            <View style={[s.statusDot, { backgroundColor: st.color }]} />
            <Text style={[s.statusLabel, { color: st.color }]}>{st.label}</Text>
          </View>

          <Text style={s.jobTileTitle} numberOfLines={1}>
            {job.title}
          </Text>
          <View style={s.jobMeta}>
            <Ionicons name="person-outline" size={12} color="#94A3B8" />
            <Text style={s.jobMetaText} numberOfLines={1}>
              {job.customer_snapshot?.name || 'Unknown'}
            </Text>
          </View>
        </View>

        <View style={s.jobChevron}>
          <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// --- Upcoming Row (date + job) ---
const UpcomingRow = ({
  job,
  delay = 0,
}: {
  job: DashboardJob;
  delay?: number;
}) => {
  const d = new Date(job.scheduled_date);
  return (
    <Animated.View entering={SlideInRight.delay(delay).springify()} style={s.upRow}>
      <View style={s.upDatePill}>
        <Text style={s.upDay}>{d.getDate()}</Text>
        <Text style={s.upMonth}>
          {d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <JobTile job={job} />
      </View>
    </Animated.View>
  );
};

// --- Nav Button (secondary grid) ---
const NavButton = ({
  icon,
  label,
  onPress,
  delay = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  delay?: number;
}) => (
  <Animated.View entering={FadeIn.delay(delay)} style={s.navBtnWrap}>
    <TouchableOpacity style={s.navBtn} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={20} color={Colors.textLight} />
      <Text style={s.navLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
    </TouchableOpacity>
  </Animated.View>
);

// --- Main Dashboard ---
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

    const active = allJobs.filter((j) => j.status === 'in_progress').length;
    const pending = allJobs.filter((j) => j.status === 'pending').length;

    const revenue = isAdmin
      ? allJobs
          .filter((j) => j.status === 'paid' || j.payment_status === 'paid')
          .reduce((sum, j) => sum + (j.price || 0), 0)
      : 0;

    const todaysJobs = allJobs.filter(
      (j) => j.scheduled_date >= startOfDay && j.scheduled_date < endOfDay
    );

    const upcomingJobs = allJobs
      .filter(
        (j) =>
          j.scheduled_date >= endOfDay && !['complete', 'paid'].includes(j.status)
      )
      .slice(0, 5);

    return { active, pending, revenue, todaysJobs, upcomingJobs };
  }, [allJobs, isAdmin]);

  const fmtCurrency = (n: number) =>
    `£${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

  if (loading && allJobs.length === 0) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const firstName = userProfile?.display_name?.split(' ')[0] || 'There';

  return (
    <View style={s.root}>
      {/* Background gradient */}
      <LinearGradient
        colors={['#EEF2FF', '#E0F2FE', '#F0FDFA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 8 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchDashboardData();
            }}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerGreeting}>{getGreeting()},</Text>
            <Text style={s.headerName}>{firstName}</Text>
            <Text style={s.headerDate}>
              {new Date().toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(app)/settings')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#6366F1', '#3B82F6'] as readonly [string, string]}
              style={s.avatar}
            >
              <Text style={s.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Stats Row */}
        <View style={s.statsRow}>
          <GlassCard
            label="Active"
            value={stats.active}
            icon="flash"
            accent="#3B82F6"
            delay={100}
          />
          <GlassCard
            label="Pending"
            value={stats.pending}
            icon="hourglass-outline"
            accent="#F59E0B"
            delay={150}
          />
          {isAdmin ? (
            <GlassCard
              label="Revenue"
              value={fmtCurrency(stats.revenue)}
              icon="trending-up"
              accent="#10B981"
              delay={200}
            />
          ) : (
            <GlassCard
              label="Done"
              value={allJobs.filter((j) => j.status === 'complete').length}
              icon="checkmark-done"
              accent="#10B981"
              delay={200}
            />
          )}
        </View>

        {/* Quick Actions */}
        {isAdmin ? (
          <Animated.View entering={FadeInDown.delay(250).springify()}>
            <Text style={s.sectionLabel}>Quick Actions</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.quickRow}
            >
              <QuickAction
                icon="add-circle"
                label="New Job"
                gradient={['#3B82F6', '#6366F1']}
                onPress={() => router.push('/(app)/jobs/create' as any)}
                delay={300}
              />
              <QuickAction
                icon="document-text"
                label="Quote"
                gradient={['#8B5CF6', '#A78BFA']}
                onPress={() => router.push('/(app)/quote' as any)}
                delay={350}
              />
              <QuickAction
                icon="receipt"
                label="Invoice"
                gradient={['#F59E0B', '#FBBF24']}
                onPress={() => router.push('/(app)/invoice' as any)}
                delay={400}
              />
              <QuickAction
                icon="person-add"
                label="Client"
                gradient={['#10B981', '#34D399']}
                onPress={() => router.push('/(app)/customers/add' as any)}
                delay={450}
              />
              <QuickAction
                icon="flame"
                label="CP12"
                gradient={['#EF4444', '#F97316']}
                onPress={() => router.push('/(app)/cp12' as any)}
                delay={500}
              />
            </ScrollView>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(250).springify()}>
            <Text style={s.sectionLabel}>Quick Actions</Text>
            <View style={s.quickRow}>
              <QuickAction
                icon="list"
                label="Schedule"
                gradient={['#3B82F6', '#6366F1']}
                onPress={() => router.push('/(app)/jobs')}
                delay={300}
              />
              <QuickAction
                icon="calendar"
                label="Calendar"
                gradient={['#10B981', '#34D399']}
                onPress={() => router.push('/(app)/calendar')}
                delay={350}
              />
            </View>
          </Animated.View>
        )}

        {/* Today's Schedule */}
        <Animated.View entering={FadeInDown.delay(350).springify()}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionLabel}>{"Today's Schedule"}</Text>
            <View style={s.countBadge}>
              <Text style={s.countText}>{stats.todaysJobs.length}</Text>
            </View>
          </View>

          {stats.todaysJobs.length === 0 ? (
            <View style={s.emptyCard}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="sunny-outline" size={28} color="#94A3B8" />
              </View>
              <Text style={s.emptyTitle}>All clear!</Text>
              <Text style={s.emptySubtitle}>No jobs scheduled for today.</Text>
            </View>
          ) : (
            stats.todaysJobs.map((job, i) => (
              <JobTile key={job.id} job={job} isToday delay={400 + i * 60} />
            ))
          )}
        </Animated.View>

        {/* Up Next */}
        <Animated.View entering={FadeInDown.delay(500).springify()}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionLabel}>Up Next</Text>
            <TouchableOpacity
              onPress={() => router.push('/(app)/calendar')}
              style={s.seeAllBtn}
            >
              <Text style={s.seeAllText}>Calendar</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {stats.upcomingJobs.length === 0 ? (
            <View style={s.emptyCard}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="checkmark-circle-outline" size={28} color="#94A3B8" />
              </View>
              <Text style={s.emptyTitle}>{"You're all caught up"}</Text>
              <Text style={s.emptySubtitle}>Nothing upcoming.</Text>
            </View>
          ) : (
            stats.upcomingJobs.map((job, i) => (
              <UpcomingRow key={job.id} job={job} delay={550 + i * 60} />
            ))
          )}
        </Animated.View>

        {/* Navigation Grid (admin) */}
        {isAdmin && (
          <Animated.View entering={FadeInDown.delay(650).springify()}>
            <Text style={[s.sectionLabel, { marginTop: 8 }]}>Navigate</Text>
            <View style={s.navGrid}>
              <NavButton icon="briefcase-outline" label="All Jobs" onPress={() => router.push('/(app)/jobs')} delay={700} />
              <NavButton icon="people-outline" label="Customers" onPress={() => router.push('/(app)/customers' as any)} delay={740} />
              <NavButton icon="person-outline" label="Team" onPress={() => router.push('/(app)/workers' as any)} delay={780} />
              <NavButton icon="documents-outline" label="Documents" onPress={() => router.push('/(app)/documents' as any)} delay={820} />
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

// --- Styles ---
const GLASS_BG = Platform.OS === 'ios' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.88)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 8,
  },
  headerGreeting: { fontSize: 14, fontWeight: '600', color: '#64748B', letterSpacing: 0.3 },
  headerName: { fontSize: 30, fontWeight: '800', color: '#0F172A', marginTop: 2, letterSpacing: -0.5 },
  headerDate: { fontSize: 13, color: '#94A3B8', marginTop: 4, fontWeight: '500' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  glassOuter: { flex: 1 },
  glassCard: {
    borderRadius: 18,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  glassAccent: { height: 3, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  glassBody: { padding: 14 },
  glassIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  glassValue: { fontSize: 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
  glassLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Quick actions
  quickRow: { flexDirection: 'row', gap: 12, marginBottom: 28, paddingRight: 8 },
  quickAction: { alignItems: 'center', width: 72 },
  quickGradient: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  quickLabel: { fontSize: 11, fontWeight: '700', color: '#334155', textAlign: 'center' },

  // Section headers
  sectionLabel: { fontSize: 17, fontWeight: '700', color: '#0F172A', marginBottom: 14, letterSpacing: -0.2 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  countBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  countText: { fontSize: 12, fontWeight: '700', color: '#6366F1' },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  // Job tiles
  jobTile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  jobStrip: { width: 4, alignSelf: 'stretch', borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  jobBody: { flex: 1, paddingVertical: 14, paddingHorizontal: 14 },
  jobTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  jobTimeBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  jobTime: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  todayChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  todayChipText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 'auto' },
  statusLabel: { fontSize: 10, fontWeight: '700' },
  jobTileTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  jobMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  jobMetaText: { fontSize: 12, color: '#94A3B8', flex: 1 },
  jobChevron: { paddingRight: 14 },

  // Upcoming
  upRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  upDatePill: {
    width: 44,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upDay: { fontSize: 18, fontWeight: '800', color: '#4F46E5' },
  upMonth: { fontSize: 9, fontWeight: '700', color: '#818CF8', letterSpacing: 0.5 },

  // Nav grid
  navGrid: {
    borderRadius: 18,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
    marginBottom: 16,
  },
  navBtnWrap: {},
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  navLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#334155' },

  // Empty state
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: GLASS_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 12,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: '#94A3B8' },
});
