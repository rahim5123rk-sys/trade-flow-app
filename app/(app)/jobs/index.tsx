import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router'; // Added useFocusEffect
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Onboarding, { OnboardingTip } from '../../../components/Onboarding';
import { Colors, UI } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';

const JOBS_TIPS: OnboardingTip[] = [
  {
    title: 'Your Jobs List 📋',
    description: 'All your active jobs appear here, sorted by date. Swipe left on a job for quick actions.',
    icon: 'briefcase-outline',
    arrowDirection: 'none',
    accent: '#1D4ED8',
  },
  {
    title: 'Filter Jobs',
    description: 'Use the filter tabs at the top to switch between All Jobs and My Jobs.',
    icon: 'funnel-outline',
    arrowDirection: 'up',
    accent: '#7C3AED',
  },
  {
    title: 'Swipe Actions',
    description: 'Swipe any job left to quickly mark it In Progress, Complete, or Delete it.',
    icon: 'swap-horizontal-outline',
    arrowDirection: 'down',
    accent: '#059669',
  },
  {
    title: 'Create New Jobs',
    description: 'Tap the + button at the bottom right to create a new job with customer details, scheduling and pricing.',
    icon: 'add-circle-outline',
    arrowDirection: 'down',
    accent: '#D97706',
  },
];

  const GLASS_BG = UI.glass.bg;
  const GLASS_BORDER = UI.glass.border;

export default function UnifiedJobList() {
  const { userProfile, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filter, setFilter] = useState<'all' | 'mine'>('mine');
  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) setFilter('mine');
    else setFilter('all');
  }, [isAdmin]);

  // ✅ FIX: useFocusEffect ensures the list reloads when you navigate back to it
  useFocusEffect(
    useCallback(() => {
      if (userProfile?.company_id) {
        fetchJobs();
      }
    }, [userProfile, filter])
  );

  const fetchJobs = async () => {
    if (!userProfile?.company_id) return;
    // Don't set loading to true here to avoid flickering on every focus
    
    // ✅ FIX: Removed "customer_snapshot(name)" which was breaking the query.
    // Using "*" automatically fetches the customer_snapshot column.
    let query = supabase
      .from('jobs')
      .select('*') 
      .eq('company_id', userProfile.company_id)
      .neq('status', 'cancelled')
      .order('scheduled_date', { ascending: false });

    if (filter === 'mine' && user) {
        query = query.contains('assigned_to', [user.id]);
    }

    const { data, error } = await query;
    if (error) console.error("Error fetching jobs:", error);
    if (data) setJobs(data);
    setLoading(false);
  };

  const handleUpdateJobStatus = async (
    jobId: string,
    status: 'pending' | 'in_progress' | 'complete',
  ) => {
    const previous = [...jobs];
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)));

    const { error } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', jobId)
      .eq('company_id', userProfile?.company_id);

    if (error) {
      setJobs(previous);
      Alert.alert('Error', 'Could not update job status.');
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    Alert.alert('Delete Job', 'Are you sure you want to delete this job?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const previous = [...jobs];
          setJobs((prev) => prev.filter((j) => j.id !== jobId));

          const { error } = await supabase
            .from('jobs')
            .delete()
            .eq('id', jobId)
            .eq('company_id', userProfile?.company_id);

          if (error) {
            setJobs(previous);
            Alert.alert('Error', 'Could not delete job.');
          }
        },
      },
    ]);
  };

  const openRowRef = useRef<Swipeable | null>(null);

  const closeOpenRow = () => {
    openRowRef.current?.close();
    openRowRef.current = null;
  };

  const renderSwipeActions = (item: any) => {
    const isPending = item.status === 'pending';
    const isInProgress = item.status === 'in_progress';
    const isComplete = item.status === 'complete';

    return (
      <View style={styles.swipeActionsWrap}>
        {/* Show contextual status action */}
        {isPending && (
          <TouchableOpacity
            style={[styles.swipeActionBtn, { backgroundColor: UI.status.inProgress }]}
            onPress={() => { closeOpenRow(); handleUpdateJobStatus(item.id, 'in_progress'); }}
          >
            <Ionicons name="play" size={18} color={UI.text.white} />
            <Text style={styles.swipeActionText}>Start</Text>
          </TouchableOpacity>
        )}

        {isInProgress && (
          <TouchableOpacity
            style={[styles.swipeActionBtn, { backgroundColor: UI.status.complete }]}
            onPress={() => { closeOpenRow(); handleUpdateJobStatus(item.id, 'complete'); }}
          >
            <Ionicons name="checkmark-circle" size={18} color={UI.text.white} />
            <Text style={styles.swipeActionText}>Done</Text>
          </TouchableOpacity>
        )}

        {isComplete && (
          <TouchableOpacity
            style={[styles.swipeActionBtn, { backgroundColor: UI.status.pending }]}
            onPress={() => { closeOpenRow(); handleUpdateJobStatus(item.id, 'pending'); }}
          >
            <Ionicons name="refresh" size={18} color={UI.text.white} />
            <Text style={styles.swipeActionText}>Reopen</Text>
          </TouchableOpacity>
        )}

        {isAdmin && (
          <TouchableOpacity
            style={[styles.swipeActionBtn, { backgroundColor: UI.brand.danger }]}
            onPress={() => { closeOpenRow(); handleDeleteJob(item.id); }}
          >
            <Ionicons name="trash" size={18} color={UI.text.white} />
            <Text style={styles.swipeActionText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <LinearGradient
        colors={UI.gradients.appBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View entering={FadeInDown.delay(40).springify()} style={styles.header}>
        <View>
          <Text style={styles.title}>Jobs</Text>
          <Text style={styles.subtitle}>{isAdmin ? 'All scheduled work' : 'Your assigned jobs'}</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{jobs.length}</Text>
        </View>
      </Animated.View>

      {isAdmin && (
        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.toggleWrap}>
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, filter === 'all' && styles.toggleActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.toggleText, filter === 'all' && styles.activeText]}>All Jobs</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, filter === 'mine' && styles.toggleActive]}
              onPress={() => setFilter('mine')}
            >
              <Text style={[styles.toggleText, filter === 'mine' && styles.activeText]}>My Jobs</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={UI.brand.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); fetchJobs(); }} tintColor={UI.brand.primary} />}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index * 30, 200)).duration(300)}>
              <Swipeable
                renderRightActions={() => renderSwipeActions(item)}
                overshootRight={false}
                friction={2}
                rightThreshold={40}
                onSwipeableWillOpen={() => {
                  closeOpenRow();
                }}
                onSwipeableOpen={(direction, swipeable) => {
                  openRowRef.current = swipeable;
                }}
              >
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => router.push(`/(app)/jobs/${item.id}` as any)}
                  activeOpacity={0.72}
                >
                  <LinearGradient
                    colors={item.status === 'complete' ? UI.gradients.successLight : UI.gradients.primary}
                    style={styles.cardStrip}
                  />

                  <View style={styles.cardBody}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.ref}>{item.reference}</Text>
                      <View style={[styles.statusPill, { backgroundColor: item.status === 'complete' ? 'rgba(16,185,129,0.14)' : 'rgba(99,102,241,0.14)' }]}>
                        <View style={[styles.statusDot, { backgroundColor: item.status === 'complete' ? Colors.success : UI.brand.primary }]} />
                        <Text style={[styles.status, { color: item.status === 'complete' ? Colors.success : UI.brand.primary }]}>
                          {item.status.replace('_', ' ')}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.jobTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={styles.metaRow}>
                      <Ionicons name="person-outline" size={13} color={UI.text.muted} />
                      <Text style={styles.customer} numberOfLines={1}>{item.customer_snapshot?.name || 'Unknown customer'}</Text>
                    </View>

                    <View style={styles.cardFooter}>
                      <View style={styles.datePill}>
                        <Ionicons name="calendar-outline" size={13} color={UI.text.muted} />
                        <Text style={styles.date}>{new Date(item.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={UI.surface.border} />
                    </View>
                  </View>
                </TouchableOpacity>
              </Swipeable>
            </Animated.View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="briefcase-outline" size={32} color={UI.surface.border} />
              <Text style={styles.empty}>No jobs found.</Text>
            </View>
          }
        />
      )}

      {isAdmin && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(app)/jobs/create' as any)}
          activeOpacity={0.85}
        >
          <LinearGradient colors={UI.gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradient}>
            <Ionicons name="add" size={28} color={UI.text.white} />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* First-run onboarding */}
      <Onboarding screenKey="jobs" tips={JOBS_TIPS} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 30, fontWeight: '800', color: UI.text.title },
  subtitle: { fontSize: 13, color: UI.text.muted, marginTop: 2 },
  countBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(99,102,241,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  countText: { color: UI.brand.primary, fontSize: 13, fontWeight: '800' },
  toggleWrap: { paddingHorizontal: 16, marginBottom: 12 },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: GLASS_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 4,
    gap: 4,
  },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  toggleActive: { backgroundColor: 'rgba(99,102,241,0.14)' },
  toggleText: { fontSize: 12, fontWeight: '700', color: UI.text.muted },
  activeText: { color: UI.brand.primary },
  card: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 16,
    marginBottom: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Colors.shadow,
  },
  cardStrip: { width: 4, alignSelf: 'stretch' },
  cardBody: { flex: 1, paddingVertical: 12, paddingHorizontal: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  ref: { fontSize: 11, fontWeight: '800', color: UI.text.muted, letterSpacing: 0.5 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  status: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  jobTitle: { fontSize: 16, fontWeight: '700', color: UI.text.title },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  customer: { fontSize: 13, color: UI.text.body, flex: 1 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.2)',
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.80)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  date: { fontSize: 12, color: UI.text.body, fontWeight: '600' },
  emptyCard: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 28,
    marginTop: 8,
    gap: 8,
  },
  empty: { textAlign: 'center', color: UI.text.muted, fontWeight: '600' },
  swipeActionsWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 10,
    marginLeft: 6,
    borderRadius: 14,
    overflow: 'hidden',
  },
  swipeActionBtn: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  swipeActionText: { color: UI.text.white, fontSize: 10, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    ...Colors.shadow,
  },
  fabGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});