import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router, useFocusEffect} from 'expo-router'; // Added useFocusEffect
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
import ReanimatedSwipeable, {SwipeableMethods} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Onboarding, {OnboardingTip} from '../../../../components/Onboarding';
import {Colors, UI} from '../../../../constants/theme';
import {useJobs} from '../../../../hooks/useJobs';
import {useRealtimeJobs} from '../../../../hooks/useRealtime';
import {useWorkers} from '../../../../hooks/useWorkers';
import {supabase} from '../../../../src/config/supabase';
import {useAuth} from '../../../../src/context/AuthContext';
import {useAppTheme} from '../../../../src/context/ThemeContext';

const JOBS_TIPS: OnboardingTip[] = [
  {
    title: 'Your Jobs List',
    description: 'All your active jobs appear here, sorted by date. Swipe left on a job for quick actions.',
    icon: 'briefcase-outline',
    position: 'center',
    arrowDirection: 'none',
    accent: '#1D4ED8',
  },
  {
    title: 'Filter Jobs',
    description: 'Use the filter tabs at the top to switch between All Jobs and My Jobs.',
    icon: 'funnel-outline',
    position: 'top',
    arrowDirection: 'up',
    accent: '#7C3AED',
  },
  {
    title: 'Swipe Actions',
    description: 'Swipe any job left to quickly mark it In Progress, Complete, or Delete it.',
    icon: 'swap-horizontal-outline',
    position: 'center',
    arrowDirection: 'down',
    accent: '#059669',
  },
  {
    title: 'Create New Jobs',
    description: 'Tap the + button at the bottom right to create a new job with customer details, scheduling and pricing.',
    icon: 'add-circle-outline',
    position: 'bottom',
    arrowDirection: 'down',
    accent: '#D97706',
  },
];

const GLASS_BG = UI.glass.bg;
const GLASS_BORDER = UI.glass.border;
const DONE_STATUSES = new Set(['complete', 'paid']);

type ScopeFilter = 'all' | 'mine';
type JobTab = 'active' | 'completed' | 'workers';

export default function UnifiedJobList() {
  const {userProfile, user} = useAuth();
  const {theme, isDark} = useAppTheme();
  const insets = useSafeAreaInsets();
  const {workers} = useWorkers();
  const {jobs, loading, refreshing, loadingMore, hasMore, fetchJobs, onRefresh, loadMore} = useJobs({
    autoFetch: false,
  });

  const [filter, setFilter] = useState<ScopeFilter>('mine');
  const [tab, setTab] = useState<JobTab>('active');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const isAdmin = userProfile?.role === 'admin';
  const showWorkersTab = isAdmin && workers.length > 0;

  useEffect(() => {
    if (!isAdmin) setFilter('mine');
    else setFilter('all');
  }, [isAdmin]);

  useEffect(() => {
    if (!showWorkersTab && tab === 'workers') {
      setTab('active');
    }
  }, [showWorkersTab, tab]);

  useEffect(() => {
    if (!workers.length) {
      setSelectedWorkerId(null);
      return;
    }

    setSelectedWorkerId((current) =>
      current && workers.some((worker: any) => worker.id === current) ? current : workers[0].id,
    );
  }, [workers]);

  useFocusEffect(
    useCallback(() => {
      if (userProfile?.company_id) {
        fetchJobs();
      }
    }, [userProfile?.company_id, fetchJobs])
  );

  // Live updates when jobs change (from other devices / workers)
  useRealtimeJobs(userProfile?.company_id, fetchJobs);

  const handleUpdateJobStatus = async (
    jobId: string,
    status: 'pending' | 'in_progress' | 'complete',
  ) => {
    const {error} = await supabase
      .from('jobs')
      .update({status})
      .eq('id', jobId)
      .eq('company_id', userProfile?.company_id);

    if (error) {
      Alert.alert('Error', 'Could not update job status.');
    } else {
      fetchJobs();
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    Alert.alert('Delete Job', 'Are you sure you want to delete this job?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const jobToDelete = jobs.find((j) => j.id === jobId);

          // Best-effort: remove this job's photos from storage before deleting the record
          if (jobToDelete?.photos?.length) {
            try {
              const photoPaths = (jobToDelete.photos as string[])
                .map((ref) => {
                  const colonIdx = ref.indexOf(':');
                  return colonIdx !== -1 && !ref.includes('://') ? ref.slice(colonIdx + 1) : null;
                })
                .filter(Boolean) as string[];
              if (photoPaths.length) {
                await supabase.storage.from('job-photos').remove(photoPaths);
              }
            } catch {
              // best-effort — proceed with job deletion regardless
            }
          }

          const {error} = await supabase
            .from('jobs')
            .delete()
            .eq('id', jobId)
            .eq('company_id', userProfile?.company_id);

          if (error) {
            Alert.alert('Error', 'Could not delete job.');
          } else {
            fetchJobs();
          }
        },
      },
    ]);
  };

  const openRowRef = useRef<SwipeableMethods | null>(null);

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
            style={[styles.swipeActionBtn, {backgroundColor: UI.status.inProgress}]}
            onPress={() => {closeOpenRow(); handleUpdateJobStatus(item.id, 'in_progress');}}
          >
            <Ionicons name="play" size={18} color={UI.text.white} />
            <Text style={styles.swipeActionText}>Start</Text>
          </TouchableOpacity>
        )}

        {isInProgress && (
          <TouchableOpacity
            style={[styles.swipeActionBtn, {backgroundColor: UI.status.complete}]}
            onPress={() => {closeOpenRow(); handleUpdateJobStatus(item.id, 'complete');}}
          >
            <Ionicons name="checkmark-circle" size={18} color={UI.text.white} />
            <Text style={styles.swipeActionText}>Done</Text>
          </TouchableOpacity>
        )}

        {isComplete && (
          <TouchableOpacity
            style={[styles.swipeActionBtn, {backgroundColor: UI.status.pending}]}
            onPress={() => {closeOpenRow(); handleUpdateJobStatus(item.id, 'pending');}}
          >
            <Ionicons name="refresh" size={18} color={UI.text.white} />
            <Text style={styles.swipeActionText}>Reopen</Text>
          </TouchableOpacity>
        )}

        {isAdmin && (
          <TouchableOpacity
            style={[styles.swipeActionBtn, {backgroundColor: UI.brand.danger}]}
            onPress={() => {closeOpenRow(); handleDeleteJob(item.id);}}
          >
            <Ionicons name="trash" size={18} color={UI.text.white} />
            <Text style={styles.swipeActionText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const scopedJobs = useMemo(() => {
    if (filter === 'mine' && user) {
      return jobs.filter((job) => Array.isArray(job.assigned_to) && job.assigned_to.includes(user.id));
    }
    return jobs;
  }, [filter, jobs, user]);

  const activeJobs = useMemo(() => scopedJobs.filter((job) => !DONE_STATUSES.has(job.status)), [scopedJobs]);
  const completedJobs = useMemo(() => scopedJobs.filter((job) => DONE_STATUSES.has(job.status)), [scopedJobs]);
  const selectedWorker = workers.find((worker: any) => worker.id === selectedWorkerId) || null;
  const selectedWorkerJobs = useMemo(() => {
    if (!selectedWorkerId) return [];
    return jobs.filter((job) => Array.isArray(job.assigned_to) && job.assigned_to.includes(selectedWorkerId));
  }, [jobs, selectedWorkerId]);

  const workerActiveJobs = useMemo(
    () => selectedWorkerJobs.filter((job) => !DONE_STATUSES.has(job.status)),
    [selectedWorkerJobs],
  );
  const workerCompletedJobs = useMemo(
    () => selectedWorkerJobs.filter((job) => DONE_STATUSES.has(job.status)),
    [selectedWorkerJobs],
  );

  const listRows = useMemo(() => {
    if (tab === 'workers') {
      return [
        ...(workerActiveJobs.length > 0 ? [{type: 'section' as const, key: 'section-worker-active', title: 'Active Jobs'}] : []),
        ...workerActiveJobs.map((job) => ({type: 'job' as const, key: `worker-job-${job.id}`, item: job})),
        ...(workerCompletedJobs.length > 0 ? [{type: 'section' as const, key: 'section-worker-completed', title: 'Completed Jobs'}] : []),
        ...workerCompletedJobs.map((job) => ({type: 'job' as const, key: `worker-job-complete-${job.id}`, item: job})),
      ];
    }

    const source = tab === 'completed' ? completedJobs : activeJobs;
    return source.map((job) => ({type: 'job' as const, key: `${tab}-job-${job.id}`, item: job}));
  }, [tab, workerActiveJobs, workerCompletedJobs, completedJobs, activeJobs]);

  const visibleCount = tab === 'workers'
    ? selectedWorkerJobs.length
    : tab === 'completed'
      ? completedJobs.length
      : activeJobs.length;

  const renderJobRow = (item: any, index: number) => {
    const scheduledAt = new Date(item.scheduled_date);
    const time = scheduledAt.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
    const subtitle = `${item.customer_snapshot?.name || 'Unknown customer'} • ${scheduledAt.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'})}`;
    const rowRef = React.createRef<SwipeableMethods>();

    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index * 30, 200)).duration(300)}>
        <ReanimatedSwipeable
          ref={rowRef}
          renderRightActions={() => renderSwipeActions(item)}
          overshootRight={false}
          friction={2}
          rightThreshold={40}
          onSwipeableWillOpen={() => {
            closeOpenRow();
          }}
          onSwipeableOpen={() => {
            openRowRef.current = rowRef.current;
          }}
        >
          <TouchableOpacity
            style={[styles.card, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
            onPress={() => router.push({pathname: '/(app)/jobs/[id]', params: {id: item.id, from: 'jobs'}} as any)}
            activeOpacity={0.72}
          >
            <View style={styles.cardBody}>
              <View style={styles.jobRow}>
                <Text style={[styles.timeText, {color: theme.text.muted}]}>{time}</Text>
                <View style={styles.timeDivider} />

                <View style={styles.jobInfo}>
                  <Text style={[styles.jobTitle, {color: theme.text.title}]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.customer, {color: theme.text.body}]} numberOfLines={1}>{subtitle}</Text>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    item.status === 'complete' || item.status === 'paid'
                      ? styles.statusPillComplete
                      : item.status === 'in_progress'
                        ? styles.statusPillInProgress
                        : styles.statusPillPending,
                  ]}
                >
                  <Text
                    style={[
                      styles.status,
                      item.status === 'complete' || item.status === 'paid'
                        ? styles.statusTextComplete
                        : item.status === 'in_progress'
                          ? styles.statusTextInProgress
                          : styles.statusTextPending,
                    ]}
                  >
                    {item.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={16} color={theme.surface.border} style={styles.cardChevron} />
          </TouchableOpacity>
        </ReanimatedSwipeable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top + 8, backgroundColor: isDark ? theme.surface.base : '#F8F9FA'}]}>
      <LinearGradient
        colors={isDark ? [theme.surface.base, theme.surface.base, theme.surface.base] : theme.gradients.appBackground}
        start={{x: 0.5, y: 0}}
        end={{x: 0.5, y: 1}}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View entering={FadeInDown.delay(40).springify()} style={styles.header}>
        <View>
          <Text style={[styles.title, {color: theme.text.title}]}>Jobs</Text>
          <Text style={[styles.subtitle, {color: theme.text.muted}]}>
            {tab === 'workers'
              ? 'Select a worker to see their assigned jobs'
              : isAdmin
                ? 'Switch between active and completed work'
                : 'Your active and completed jobs'}
          </Text>
        </View>
        <View style={[styles.countBadge, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}>
          <Text style={[styles.countText, {color: theme.text.title}]}>{visibleCount}</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).springify()} style={styles.toggleWrap}>
        <View style={[styles.toggleContainer, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}> 
          <TouchableOpacity
            style={[styles.toggleBtn, tab === 'active' && [styles.toggleActive, isDark && {backgroundColor: 'rgba(255,255,255,0.12)'}]]}
            onPress={() => setTab('active')}
          >
            <Text style={[styles.toggleText, tab === 'active' ? styles.toggleTextActive : styles.toggleTextInactive]}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, tab === 'completed' && [styles.toggleActive, isDark && {backgroundColor: 'rgba(255,255,255,0.12)'}]]}
            onPress={() => setTab('completed')}
          >
            <Text style={[styles.toggleText, tab === 'completed' ? styles.toggleTextActive : styles.toggleTextInactive]}>Completed</Text>
          </TouchableOpacity>
          {showWorkersTab ? (
            <TouchableOpacity
              style={[styles.toggleBtn, tab === 'workers' && [styles.toggleActive, isDark && {backgroundColor: 'rgba(255,255,255,0.12)'}]]}
              onPress={() => setTab('workers')}
            >
              <Text style={[styles.toggleText, tab === 'workers' ? styles.toggleTextActive : styles.toggleTextInactive]}>Workers</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>

      {isAdmin && tab !== 'workers' && (
        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.toggleWrap}>
          <View style={[styles.toggleContainer, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
            <TouchableOpacity
              style={[styles.toggleBtn, filter === 'all' && [styles.toggleActive, isDark && {backgroundColor: 'rgba(255,255,255,0.12)'}]]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.toggleText, filter === 'all' ? styles.toggleTextActive : styles.toggleTextInactive]}>All Jobs</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, filter === 'mine' && [styles.toggleActive, isDark && {backgroundColor: 'rgba(255,255,255,0.12)'}]]}
              onPress={() => setFilter('mine')}
            >
              <Text style={[styles.toggleText, filter === 'mine' ? styles.toggleTextActive : styles.toggleTextInactive]}>My Jobs</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {showWorkersTab && tab === 'workers' ? (
        <Animated.View entering={FadeInDown.delay(90).springify()} style={styles.workerSection}>
          <FlatList
            horizontal
            data={workers}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.workerChipsRow}
            renderItem={({item}) => {
              const isActive = item.id === selectedWorkerId;
              return (
                <TouchableOpacity
                  style={[
                    styles.workerChip,
                    isActive
                      ? [styles.workerChipActive, isDark && {backgroundColor: 'rgba(255,255,255,0.12)', borderColor: theme.brand.primary}]
                      : [styles.workerChipInactive, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}],
                  ]}
                  onPress={() => setSelectedWorkerId(item.id)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="person-outline" size={14} color={isActive ? theme.brand.primary : theme.text.muted} />
                  <Text style={[styles.workerChipText, {color: isActive ? theme.brand.primary : theme.text.body}]}>
                    {item.display_name || 'Worker'}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
          {selectedWorker ? (
            <Text style={[styles.workerHint, {color: theme.text.muted}]}>Showing {selectedWorker.display_name}'s jobs</Text>
          ) : null}
        </Animated.View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color={theme.brand.primary} style={{marginTop: 24}} />
      ) : (
        <FlatList
          data={listRows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{paddingHorizontal: 16, paddingBottom: 120}}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.brand.primary} />}
          renderItem={({item, index}) => item.type === 'section' ? (
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeaderText, {color: theme.text.title}]}>{item.title}</Text>
            </View>
          ) : renderJobRow(item.item, index)}
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 8, paddingVertical: 14, marginHorizontal: 0, marginTop: 8, marginBottom: 20,
                  borderRadius: 14, backgroundColor: UI.surface.primaryLight,
                  borderWidth: 1, borderColor: '#C7D2FE',
                }}
                onPress={loadMore}
                activeOpacity={0.7}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={UI.brand.primary} />
                ) : (
                  <>
                    <Ionicons name="chevron-down-outline" size={18} color={UI.brand.primary} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: UI.brand.primary }}>Load more jobs</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : jobs.length > 0 ? (
              <Text style={{ textAlign: 'center', color: theme.text.muted, fontSize: 13, paddingVertical: 16 }}>
                All jobs loaded
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={[styles.emptyCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
              <Ionicons name={tab === 'workers' ? 'people-outline' : 'briefcase-outline'} size={32} color={theme.surface.border} />
              <Text style={[styles.empty, {color: theme.text.muted}]}>
                {tab === 'completed'
                  ? 'No completed jobs found.'
                  : tab === 'workers'
                    ? (selectedWorker ? `No jobs found for ${selectedWorker.display_name}.` : 'No worker selected.')
                    : 'No active jobs found.'}
              </Text>
            </View>
          }
        />
      )}

      {/* First-run onboarding */}
      <Onboarding screenKey="jobs" tips={JOBS_TIPS} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8F9FA'},
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {fontSize: 30, fontWeight: '800', color: UI.text.title},
  subtitle: {fontSize: 13, color: UI.text.muted, marginTop: 2},
  countBadge: {
    minWidth: 42,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.04)',
  },
  countText: {color: UI.text.title, fontSize: 13, fontWeight: '700'},
  sectionHeaderRow: {paddingTop: 6, paddingBottom: 8},
  sectionHeaderText: {fontSize: 14, fontWeight: '700'},
  toggleWrap: {paddingHorizontal: 16, marginBottom: 12},
  workerSection: {marginBottom: 10},
  workerChipsRow: {paddingHorizontal: 16, gap: 8},
  workerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  workerChipActive: {
    backgroundColor: UI.surface.primaryLight,
    borderColor: '#C7D2FE',
  },
  workerChipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(15,23,42,0.06)',
  },
  workerChipText: {fontSize: 13, fontWeight: '700'},
  workerHint: {paddingHorizontal: 16, marginTop: 8, fontSize: 12, fontWeight: '500'},
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.66)',
    borderRadius: 14,
    padding: 4,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  toggleBtn: {flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center'},
  toggleActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  toggleText: {fontSize: 13},
  toggleTextActive: {fontWeight: '700', color: '#111111'},
  toggleTextInactive: {fontWeight: '400', color: '#6B7280'},
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardBody: {flex: 1, paddingVertical: 14, paddingHorizontal: 14},
  jobRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: UI.text.muted,
    width: 52,
    fontVariant: ['tabular-nums'],
  },
  timeDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(148,163,184,0.28)',
  },
  jobInfo: {flex: 1},
  statusPill: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillPending: {backgroundColor: '#F6ECDD'},
  statusPillInProgress: {backgroundColor: '#F3F4F6'},
  statusPillComplete: {backgroundColor: 'rgba(16,185,129,0.12)'},
  status: {fontSize: 11, fontWeight: '700', textTransform: 'capitalize'},
  statusTextPending: {color: '#B45309'},
  statusTextInProgress: {color: '#4B5563'},
  statusTextComplete: {color: Colors.success},
  jobTitle: {fontSize: 16, fontWeight: '700', color: UI.text.title},
  customer: {fontSize: 13, color: UI.text.body, flex: 1, marginTop: 2},
  cardChevron: {marginRight: 14},
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 28,
    marginTop: 8,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  empty: {textAlign: 'center', color: UI.text.muted, fontWeight: '600'},
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
  swipeActionText: {color: UI.text.white, fontSize: 10, fontWeight: '700'},
});