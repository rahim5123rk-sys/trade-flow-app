import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router, useFocusEffect, useLocalSearchParams} from 'expo-router';
import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors, UI} from '../../../constants/theme';
import {supabase} from '../../../src/config/supabase';
import {useAuth} from '../../../src/context/AuthContext';
import {useAppTheme} from '../../../src/context/ThemeContext';
import {getSignedUrl, getSignedUrls} from '../../../src/services/storage';
import {Job, UserProfile} from '../../../src/types';

type WorkerJob = Job & {
  resolvedPhotos: string[];
  resolvedSignature: string | null;
};

type WorkerProfile = UserProfile & {
  is_test_user?: boolean;
};

const DONE_STATUSES = new Set<Job['status']>(['complete', 'paid']);

const formatJobDate = (ts: number) =>
  new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export default function WorkerDetailScreen() {
  const {id} = useLocalSearchParams<{id: string}>();
  const {userProfile} = useAuth();
  const {theme, isDark} = useAppTheme();
  const insets = useSafeAreaInsets();

  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [jobs, setJobs] = useState<WorkerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<{uri: string; title: string} | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id || !userProfile?.company_id) return;
      fetchWorkerDetails();
    }, [id, userProfile?.company_id])
  );

  const fetchWorkerDetails = async () => {
    if (!id || !userProfile?.company_id) return;
    setLoading(true);

    try {
      const [{data: workerData, error: workerError}, {data: jobsData, error: jobsError}] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, display_name, company_id, role, created_at, is_test_user')
          .eq('company_id', userProfile.company_id)
          .eq('id', id)
          .single(),
        supabase
          .from('jobs')
          .select('*')
          .eq('company_id', userProfile.company_id)
          .contains('assigned_to', [id])
          .neq('status', 'cancelled')
          .order('scheduled_date', {ascending: false}),
      ]);

      if (workerError) throw workerError;
      if (jobsError) throw jobsError;

      const hydratedJobs = await Promise.all(
        ((jobsData as Job[]) || []).map(async (job) => ({
          ...job,
          resolvedPhotos: job.photos?.length ? await getSignedUrls(job.photos) : [],
          resolvedSignature: job.signature ? await getSignedUrl(job.signature) : null,
        }))
      );

      setWorker(workerData as WorkerProfile);
      setJobs(hydratedJobs);
    } catch (error) {
      console.error('Error loading worker details:', error);
      Alert.alert('Error', 'Could not load worker details.');
    } finally {
      setLoading(false);
    }
  };

  const activeJobs = useMemo(
    () => jobs.filter((job) => !DONE_STATUSES.has(job.status)),
    [jobs]
  );

  const completedJobs = useMemo(
    () => jobs.filter((job) => DONE_STATUSES.has(job.status)),
    [jobs]
  );

  const renderJobCard = (job: WorkerJob, index: number) => {
    const proofCount = job.resolvedPhotos.length + (job.resolvedSignature ? 1 : 0);

    return (
      <Animated.View key={job.id} entering={FadeInDown.delay(Math.min(index * 45, 220)).springify()}>
        <TouchableOpacity
          style={[
            styles.jobCard,
            {backgroundColor: isDark ? theme.glass.bg : '#FFFFFF'},
            isDark && {borderColor: theme.glass.border, borderWidth: 1},
          ]}
          activeOpacity={0.78}
          onPress={() => router.push({pathname: '/(app)/jobs/[id]', params: {id: job.id, from: 'worker', workerId: id}} as any)}
        >
          <View style={styles.jobCardTop}>
            <View style={styles.jobTimeWrap}>
              <Text style={[styles.jobTime, {color: theme.text.title}]}>
                {new Date(job.scheduled_date).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})}
              </Text>
              <Text style={[styles.jobDate, {color: theme.text.muted}]}>{formatJobDate(job.scheduled_date)}</Text>
            </View>

            <View style={styles.jobMain}>
              <Text style={[styles.jobTitle, {color: theme.text.title}]} numberOfLines={1}>{job.title}</Text>
              <Text style={[styles.jobAddress, {color: theme.text.body}]} numberOfLines={2}>
                {job.customer_snapshot?.address || job.customer_snapshot?.name || 'No address'}
              </Text>
              <Text style={[styles.jobMeta, {color: theme.text.muted}]} numberOfLines={1}>
                {(job.customer_snapshot?.name || 'Unknown customer') + ' • ' + job.reference}
              </Text>
            </View>

            <View style={[styles.statusPill, {backgroundColor: DONE_STATUSES.has(job.status) ? 'rgba(16,185,129,0.12)' : '#F3F4F6'}]}>
              <Text style={[styles.statusText, {color: DONE_STATUSES.has(job.status) ? Colors.success : '#4B5563'}]}>
                {job.status.replace('_', ' ')}
              </Text>
            </View>
          </View>

          {(job.resolvedPhotos.length > 0 || job.resolvedSignature) && (
            <View style={[styles.proofWrap, {borderTopColor: isDark ? theme.surface.divider : 'rgba(226,232,240,0.7)'}]}>
              <View style={styles.proofHeader}>
                <Text style={[styles.proofTitle, {color: theme.text.title}]}>Proof of Work</Text>
                <Text style={[styles.proofCount, {color: theme.text.muted}]}>{proofCount} item{proofCount === 1 ? '' : 's'}</Text>
              </View>

              {job.resolvedPhotos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assetRow}>
                  {job.resolvedPhotos.map((uri, photoIndex) => (
                    <TouchableOpacity
                      key={`${job.id}-photo-${photoIndex}`}
                      activeOpacity={0.84}
                      onPress={() => setSelectedAsset({uri, title: `${job.title} photo ${photoIndex + 1}`})}
                    >
                      <Image source={{uri}} style={styles.assetThumb} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {job.resolvedSignature ? (
                <TouchableOpacity
                  activeOpacity={0.84}
                  style={[styles.signatureCard, {backgroundColor: isDark ? theme.surface.elevated : '#F8FAFC'}]}
                  onPress={() => setSelectedAsset({uri: job.resolvedSignature!, title: `${job.title} signature`})}
                >
                  <View>
                    <Text style={[styles.signatureLabel, {color: theme.text.muted}]}>Signature</Text>
                    <Text style={[styles.signatureHint, {color: theme.text.title}]}>Tap to view sign-off</Text>
                  </View>
                  <Image source={{uri: job.resolvedSignature}} style={styles.signaturePreview} resizeMode="contain" />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingWrap, {paddingTop: insets.top, backgroundColor: theme.surface.base}]}>
        <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={theme.brand.primary} />
      </View>
    );
  }

  if (!worker) {
    return (
      <View style={[styles.loadingWrap, {paddingTop: insets.top, backgroundColor: theme.surface.base}]}>
        <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} />
        <Text style={[styles.emptyText, {color: theme.text.title}]}>Worker not found.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, {backgroundColor: theme.surface.base}]}>
      <LinearGradient colors={theme.gradients.appBackground} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={StyleSheet.absoluteFill} />

      <View style={[styles.headerBar, {paddingTop: insets.top + 4}]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.78}>
          <Ionicons name="chevron-back" size={22} color={theme.brand.primary} />
          <Text style={[styles.backText, {color: theme.brand.primary}]}>Team</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{paddingHorizontal: 16, paddingBottom: insets.bottom + 32}} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(40).springify()} style={[styles.heroCard, {backgroundColor: isDark ? theme.glass.bg : '#FFFFFF'}, isDark && {borderColor: theme.glass.border, borderWidth: 1}]}>
          <View style={[styles.heroAvatar, {backgroundColor: isDark ? theme.surface.elevated : UI.surface.base}]}>
            <Text style={[styles.heroInitial, {color: theme.brand.primary}]}>{worker.display_name?.[0]?.toUpperCase() || 'W'}</Text>
          </View>
          <View style={styles.heroContent}>
            <Text style={[styles.heroName, {color: theme.text.title}]}>{worker.display_name}</Text>
            <Text style={[styles.heroEmail, {color: theme.text.muted}]}>{worker.email}</Text>
            <View style={styles.statRow}>
              <View style={[styles.statPill, {backgroundColor: isDark ? theme.surface.elevated : '#F3F4F6'}]}>
                <Text style={[styles.statText, {color: theme.text.title}]}>{activeJobs.length} assigned</Text>
              </View>
              <View style={[styles.statPill, {backgroundColor: isDark ? theme.surface.elevated : '#F3F4F6'}]}>
                <Text style={[styles.statText, {color: theme.text.title}]}>{completedJobs.length} completed</Text>
              </View>
              {worker.is_test_user ? (
                <View style={[styles.statPill, {backgroundColor: isDark ? theme.surface.elevated : '#FEF3C7'}]}>
                  <Text style={[styles.statText, {color: isDark ? theme.text.title : '#92400E'}]}>Test user</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(90).springify()} style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, {color: theme.text.title}]}>Assigned Jobs</Text>
            <Text style={[styles.sectionMeta, {color: theme.text.muted}]}>{activeJobs.length}</Text>
          </View>
          {activeJobs.length > 0 ? activeJobs.map(renderJobCard) : (
            <View style={[styles.emptyCard, {backgroundColor: isDark ? theme.glass.bg : '#FFFFFF'}, isDark && {borderColor: theme.glass.border, borderWidth: 1}]}>
              <Text style={[styles.emptyTitle, {color: theme.text.title}]}>No assigned jobs</Text>
              <Text style={[styles.emptyCopy, {color: theme.text.muted}]}>This worker has no active assigned jobs right now.</Text>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).springify()} style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, {color: theme.text.title}]}>Completed Jobs</Text>
            <Text style={[styles.sectionMeta, {color: theme.text.muted}]}>{completedJobs.length}</Text>
          </View>
          {completedJobs.length > 0 ? completedJobs.map(renderJobCard) : (
            <View style={[styles.emptyCard, {backgroundColor: isDark ? theme.glass.bg : '#FFFFFF'}, isDark && {borderColor: theme.glass.border, borderWidth: 1}]}>
              <Text style={[styles.emptyTitle, {color: theme.text.title}]}>No completed jobs yet</Text>
              <Text style={[styles.emptyCopy, {color: theme.text.muted}]}>Completed work, photos, and signatures will show here.</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <Modal visible={!!selectedAsset} transparent animationType="fade" onRequestClose={() => setSelectedAsset(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedAsset(null)}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>{selectedAsset?.title}</Text>
              <TouchableOpacity onPress={() => setSelectedAsset(null)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {selectedAsset ? <Image source={{uri: selectedAsset.uri}} style={styles.modalImage} resizeMode="contain" /> : null}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: Colors.background},
  loadingWrap: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  headerBar: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingRight: 12,
    gap: 2,
  },
  backText: {fontSize: 15, fontWeight: '700'},
  heroCard: {
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 18,
  },
  heroAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  heroInitial: {fontSize: 28, fontWeight: '800'},
  heroContent: {flex: 1},
  heroName: {fontSize: 24, fontWeight: '800'},
  heroEmail: {fontSize: 14, marginTop: 2},
  statRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12},
  statPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statText: {fontSize: 12, fontWeight: '700'},
  sectionBlock: {marginBottom: 20},
  sectionHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10},
  sectionTitle: {fontSize: 18, fontWeight: '800'},
  sectionMeta: {fontSize: 13, fontWeight: '600'},
  jobCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  jobCardTop: {flexDirection: 'row', alignItems: 'flex-start', gap: 12},
  jobTimeWrap: {width: 62},
  jobTime: {fontSize: 15, fontWeight: '700'},
  jobDate: {fontSize: 12, marginTop: 2},
  jobMain: {flex: 1},
  jobTitle: {fontSize: 16, fontWeight: '700'},
  jobAddress: {fontSize: 13, marginTop: 3, lineHeight: 18},
  jobMeta: {fontSize: 12, marginTop: 4},
  statusPill: {paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999},
  statusText: {fontSize: 11, fontWeight: '700', textTransform: 'capitalize'},
  proofWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  proofHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10},
  proofTitle: {fontSize: 13, fontWeight: '700'},
  proofCount: {fontSize: 12},
  assetRow: {gap: 10},
  assetThumb: {width: 84, height: 84, borderRadius: 14, backgroundColor: '#E5E7EB'},
  signatureCard: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  signatureLabel: {fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3},
  signatureHint: {fontSize: 14, fontWeight: '700', marginTop: 4},
  signaturePreview: {width: 120, height: 46},
  emptyCard: {
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  emptyTitle: {fontSize: 15, fontWeight: '700'},
  emptyCopy: {fontSize: 13, marginTop: 4, lineHeight: 18},
  emptyText: {fontSize: 16, fontWeight: '700'},
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {color: '#FFFFFF', fontSize: 15, fontWeight: '700', flex: 1, marginRight: 12},
  modalImage: {width: '100%', height: 360, backgroundColor: '#111827'},
});
