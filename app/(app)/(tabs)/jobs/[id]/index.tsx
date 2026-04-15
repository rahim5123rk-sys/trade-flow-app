// ============================================
// FILE: app/(app)/jobs/[id]/index.tsx
// Glassmorphism job detail screen
// ============================================

import {Ionicons} from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {LinearGradient} from 'expo-linear-gradient';
import {router, useFocusEffect, useLocalSearchParams} from 'expo-router';
import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import JobAcceptModal from '../../../../../components/JobAcceptModal';
import JobPartsSection from '../../../../../components/JobPartsSection';
import {SignaturePad} from '../../../../../components/SignaturePad';
import {Colors, UI} from '../../../../../constants/theme';
import {supabase} from '../../../../../src/config/supabase';
import {useAuth} from '../../../../../src/context/AuthContext';
import {useAppTheme} from '../../../../../src/context/ThemeContext';
import {generateJobSheet} from '../../../../../src/services/pdfGenerator';
import {getSignedUrl, getSignedUrls, uploadImage} from '../../../../../src/services/storage';
import {Job} from '../../../../../src/types';

const GLASS_BG = UI.glass.bg;
const GLASS_BORDER = UI.glass.border;

const STATUS_FLOW = ['pending', 'in_progress', 'complete', 'paid'];

const isValidUUID = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

function AcceptancePill({ status }: { status?: string }) {
  const config = {
    accepted:  { label: 'Accepted',  bg: '#1C3A2A', color: '#2ECC71' },
    declined:  { label: 'Declined',  bg: '#3A1C1C', color: '#E74C3C' },
    pending:   { label: 'Awaiting',  bg: '#3A2E1C', color: '#FF9500' },
  }[status ?? 'pending'] ?? { label: 'Awaiting', bg: '#3A2E1C', color: '#FF9500' };

  return (
    <View style={{ backgroundColor: config.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 }}>
      <Text style={{ color: config.color, fontSize: 11, fontWeight: '700' }}>{config.label}</Text>
    </View>
  );
}

const STATUS_CONFIG: Record<string, {label: string; color: string; icon: keyof typeof Ionicons.glyphMap; gradient: readonly [string, string]}> = {
  pending: {label: 'Pending', color: UI.status.pending, icon: 'time-outline', gradient: UI.gradients.amberLight},
  in_progress: {label: 'In Progress', color: UI.status.inProgress, icon: 'play-circle-outline', gradient: UI.gradients.blueLight},
  complete: {label: 'Complete', color: UI.status.complete, icon: 'checkmark-circle-outline', gradient: UI.gradients.successLight},
  paid: {label: 'Paid', color: UI.status.paid, icon: 'wallet-outline', gradient: UI.gradients.violet},
  cancelled: {label: 'Cancelled', color: UI.brand.danger, icon: 'close-circle-outline', gradient: [UI.brand.danger, '#F87171']},
};

export default function JobDetailScreen() {
  const {id, from, workerId, showAcceptModal: showAcceptParam} = useLocalSearchParams<{id: string; from?: string; workerId?: string; showAcceptModal?: string}>();
  const insets = useSafeAreaInsets();
  const {user, userProfile} = useAuth();

  const [job, setJob] = useState<Job | any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [resolvedPhotos, setResolvedPhotos] = useState<string[]>([]);
  const [acceptModalVisible, setAcceptModalVisible] = useState(showAcceptParam === 'true');
  const [acceptanceStatuses, setAcceptanceStatuses] = useState<Record<string, string>>({});
  const [workerNames, setWorkerNames] = useState<Record<string, string>>({});
  const {theme, isDark} = useAppTheme();

  const isAdmin = userProfile?.role === 'admin';

  const backLabel = from === 'worker' ? 'Team' : from === 'calendar' ? 'Calendar' : 'Jobs';

  const handleBack = () => {
    if (from === 'worker' && workerId) {
      router.replace({pathname: '/(app)/workers/[id]', params: {id: workerId}} as any);
      return;
    }

    if (from === 'calendar') {
      // NativeTabs: switch back to the calendar tab directly
      router.navigate('/(app)/(tabs)/calendar' as any);
      return;
    }

    // Default: pop the current stack (e.g. jobs list, completed jobs)
    router.back();
  };

  useFocusEffect(
    useCallback(() => {
      if (user && id && isValidUUID(id)) fetchJobData();
      else if (id && !isValidUUID(id)) setLoading(false);
    }, [user, id])
  );

  const fetchJobData = async () => {
    try {
      const {data, error} = await supabase.from('jobs').select('*').eq('id', id).single();
      if (error) throw error;
      setJob(data);
      if (userProfile?.role === 'admin' && data?.assigned_to?.length > 0) {
        const {data: acceptances, error: acceptErr} = await supabase
          .from('job_acceptance')
          .select('worker_id, status')
          .eq('job_id', id);
        if (acceptErr) console.warn('acceptance fetch failed', acceptErr);
        const map: Record<string, string> = {};
        for (const row of acceptances ?? []) map[row.worker_id] = row.status;
        setAcceptanceStatuses(map);

        // Fetch worker display names
        const {data: workerProfiles} = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', data.assigned_to);
        const names: Record<string, string> = {};
        for (const p of workerProfiles ?? []) names[p.id] = p.display_name ?? 'Unknown Worker';
        setWorkerNames(names);
      }
      // Resolve private storage refs to signed URLs for display
      if (data?.photos?.length) {
        const signed = await getSignedUrls(data.photos);
        setResolvedPhotos(signed);
      } else {
        setResolvedPhotos([]);
      }
    } catch (e) {
      console.error('Error fetching job:', e);
      Alert.alert('Error', 'Could not load job details.');
    } finally {
      setLoading(false);
    }
  };

  // --- Admin actions ---
  const adminUpdateStatus = async (newStatus: string) => {
    if (!job) return;
    setUpdating(true);
    try {
      const {error} = await supabase.from('jobs').update({status: newStatus}).eq('id', job.id);
      if (error) throw error;
      fetchJobData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleGeneratePdf = () => job && generateJobSheet(job);
  const handleCreateInvoice = () => job && router.push({pathname: '/(app)/invoice', params: {id: job.id}} as any);

  // --- Worker actions ---
  const workerStartJob = async () => {
    setUpdating(true);
    try {
      const {error} = await supabase.from('jobs').update({status: 'in_progress'}).eq('id', id);
      if (error) throw error;
      setJob({...job, status: 'in_progress'});
    } catch {
      Alert.alert('Error', 'Could not start job.');
    } finally {
      setUpdating(false);
    }
  };

  const workerAddPhoto = async () => {
    const {status} = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
    });
    if (!result.canceled) {
      setUpdating(true);
      try {
        const storageRef = await uploadImage(result.assets[0].uri, 'job-photos');
        const newPhotos = [...(job.photos || []), storageRef];
        await supabase.from('jobs').update({photos: newPhotos}).eq('id', id);
        setJob({...job, photos: newPhotos});
        // Resolve the new photo for display
        const signedUrl = await getSignedUrl(storageRef);
        setResolvedPhotos(prev => [...prev, signedUrl]);
      } catch {
        Alert.alert('Upload Failed', 'Could not save photo.');
      } finally {
        setUpdating(false);
      }
    }
  };

  const workerFinishJob = async (signature: string) => {
    setSignatureModalVisible(false);
    setUpdating(true);
    try {
      await supabase.from('jobs').update({signature, status: 'complete'}).eq('id', id);
      Alert.alert('Job Complete', 'Job has been signed off.');
      handleBack();
    } catch {
      Alert.alert('Error', 'Could not save signature.');
    } finally {
      setUpdating(false);
    }
  };

  const openMaps = () => {
    const address = encodeURIComponent(job?.customer_snapshot?.address || '');
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${address}`);
  };

  // --- Loading / empty ---
  if (loading) {
    return (
      <View style={[styles.loadingWrap, {paddingTop: insets.top}]}>
        <LinearGradient colors={isDark ? theme.gradients.appBackground : UI.gradients.appBackground} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={isDark ? theme.brand.primary : UI.brand.primary} />
      </View>
    );
  }
  if (!job) {
    return (
      <View style={[styles.loadingWrap, {paddingTop: insets.top}]}>
        <LinearGradient colors={isDark ? theme.gradients.appBackground : UI.gradients.appBackground} style={StyleSheet.absoluteFill} />
        <Text style={{color: isDark ? theme.text.muted : UI.text.muted}}>Job not found.</Text>
      </View>
    );
  }

  const status = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
  const nextStatus = isAdmin ? (STATUS_FLOW[STATUS_FLOW.indexOf(job.status) + 1] || null) : null;
  const nextStatusConfig = nextStatus ? STATUS_CONFIG[nextStatus] : null;

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'});
  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});

  const customerName = job.customer_snapshot?.name || 'Unknown';
  const jobAddress = job.customer_snapshot?.address || '';

  return (
    <View style={styles.root}>
      <LinearGradient colors={isDark ? theme.gradients.appBackground : UI.gradients.appBackground} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={StyleSheet.absoluteFill} />

      {/* ─── Custom header ─── */}
      <View style={[styles.headerBar, {paddingTop: insets.top + 4}]}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={UI.brand.primary} />
          <Text style={styles.backText}>{backLabel}</Text>
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push(`/(app)/jobs/${job.id}/edit` as any)} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={20} color={UI.brand.primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{paddingHorizontal: 16, paddingBottom: insets.bottom + 40}}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Details card ─── */}
        <Animated.View entering={FadeInDown.delay(50).duration(400)}>
          <View style={[styles.glassCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
            <View style={[styles.sectionHeader, {justifyContent: 'space-between'}]}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <View style={[styles.sectionIconWrap, {backgroundColor: 'rgba(99,102,241,0.1)'}]}>
                  <Ionicons name="document-text" size={16} color={isDark ? theme.brand.primary : UI.brand.primary} />
                </View>
                <Text style={[styles.sectionTitle, isDark && {color: theme.text.title}]}>Job Details</Text>
              </View>
              <View style={[styles.statusPill, {backgroundColor: `${status.color}18`}]}>
                <Ionicons name={status.icon} size={13} color={status.color} />
                <Text style={[styles.statusText, {color: status.color}]}>{status.label}</Text>
              </View>
            </View>

            <Text style={[styles.heroTitle, isDark && {color: theme.text.title}, {marginBottom: 16}]} numberOfLines={2}>{job.title}</Text>

            <View style={styles.detailGrid}>
              <View style={[styles.detailTile, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.glass.border}]}>
                <Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Customer</Text>
                <Text style={[styles.detailValue, isDark && {color: theme.text.title}]} numberOfLines={2}>{customerName}</Text>
              </View>
              <View style={[styles.detailTile, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.glass.border}]}>
                <Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Reference</Text>
                <Text style={[styles.detailValue, isDark && {color: theme.text.title}]} numberOfLines={1}>{job.reference}</Text>
              </View>
              <View style={[styles.detailTile, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.glass.border}]}>
                <Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Scheduled</Text>
                <Text style={[styles.detailValue, isDark && {color: theme.text.title}]} numberOfLines={1}>{formatDate(job.scheduled_date)}</Text>
              </View>
              <View style={[styles.detailTile, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.glass.border}]}>
                <Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Time</Text>
                <Text style={[styles.detailValue, isDark && {color: theme.text.title}]}>{formatTime(job.scheduled_date)}</Text>
              </View>
            </View>

            {job.notes ? (
              <View style={[styles.notesBox, isDark && {backgroundColor: 'rgba(255,255,255,0.05)'}]}>
                <Text style={[styles.notesLabel, isDark && {color: theme.text.muted}]}>Notes</Text>
                <Text style={[styles.notesText, isDark && {color: theme.text.body}]}>{job.notes}</Text>
              </View>
            ) : (
              <Text style={[styles.notesText, {color: isDark ? theme.text.muted : UI.text.muted}]}>No notes added.</Text>
            )}

            {isAdmin && job.price != null && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, isDark && {color: theme.text.muted}]}>Price</Text>
                <Text style={[styles.priceValue, isDark && {color: theme.brand.primary}]}>£{job.price.toFixed(2)}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ─── Worker action zone ─── */}
        {!isAdmin && job.status === 'pending' && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <TouchableOpacity onPress={workerStartJob} disabled={updating} activeOpacity={0.85}>
              <LinearGradient colors={UI.gradients.blue} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.bigAction}>
                {updating ? (
                  <ActivityIndicator color={UI.text.white} />
                ) : (
                  <>
                    <Ionicons name="play-circle" size={28} color={UI.text.white} />
                    <Text style={styles.bigActionText}>Start Job</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {!isAdmin && job.status === 'in_progress' && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.workerTools}>
            <TouchableOpacity style={[styles.toolCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]} onPress={workerAddPhoto} activeOpacity={0.75}>
              <View style={[styles.toolIconWrap, {backgroundColor: 'rgba(59,130,246,0.1)'}]}>
                <Ionicons name="camera" size={22} color={UI.status.inProgress} />
              </View>
              <Text style={[styles.toolLabel, isDark && {color: theme.text.title}]}>Add Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85} onPress={() => setSignatureModalVisible(true)} style={{flex: 1}}>
              <LinearGradient colors={UI.gradients.successLight} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.finishCard}>
                <Ionicons name="checkmark-done-circle" size={22} color={UI.text.white} />
                <Text style={styles.finishLabel}>Finish Job</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ─── Location card ─── */}
        {job.customer_snapshot?.address && (
          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <TouchableOpacity style={[styles.glassCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]} onPress={openMaps} activeOpacity={0.75}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, {backgroundColor: 'rgba(59,130,246,0.1)'}]}>
                  <Ionicons name="location" size={16} color={UI.status.inProgress} />
                </View>
                <Text style={[styles.sectionTitle, isDark && {color: theme.text.title}]}>Location</Text>
                <Ionicons name="open-outline" size={16} color={isDark ? theme.text.muted : UI.text.muted} style={{marginLeft: 'auto'}} />
              </View>
              <View style={[styles.infoPanel, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.glass.border}]}>
                <Text style={[styles.addressText, isDark && {color: theme.text.body}]}>{job.customer_snapshot.address}</Text>
                <Text style={[styles.helperText, isDark && {color: theme.text.muted}]}>Tap to open turn-by-turn directions.</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ─── Customer contact (visible to workers & admins) ─── */}
        {(job.customer_snapshot?.phone || job.customer_snapshot?.email) && (
          <Animated.View entering={FadeInDown.delay(175).duration(400)}>
            <View style={[styles.glassCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, {backgroundColor: 'rgba(16,185,129,0.1)'}]}>
                  <Ionicons name="call" size={16} color={UI.status.complete} />
                </View>
                <Text style={[styles.sectionTitle, isDark && {color: theme.text.title}]}>Contact</Text>
              </View>
              <View style={styles.contactRow}>
                {job.customer_snapshot?.phone && (
                  <TouchableOpacity
                    style={[styles.contactBtn, {backgroundColor: 'rgba(16,185,129,0.1)'}]}
                    onPress={() => Linking.openURL(`tel:${job.customer_snapshot.phone}`)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="call" size={18} color={UI.status.complete} />
                    <Text style={[styles.contactBtnText, {color: UI.status.complete}]}>{job.customer_snapshot.phone}</Text>
                  </TouchableOpacity>
                )}
                {job.customer_snapshot?.email && (
                  <TouchableOpacity
                    style={[styles.contactBtn, {backgroundColor: 'rgba(99,102,241,0.08)'}]}
                    onPress={() => Linking.openURL(`mailto:${job.customer_snapshot.email}`)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="mail" size={18} color={isDark ? theme.brand.primary : UI.brand.primary} />
                    <Text style={[styles.contactBtnText, {color: isDark ? theme.brand.primary : UI.brand.primary}]} numberOfLines={1}>{job.customer_snapshot.email}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>
        )}

        {/* ─── Certificates (worker in_progress) ─── */}
        {!isAdmin && job.status === 'in_progress' && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <View style={[styles.glassCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, {backgroundColor: 'rgba(139,92,246,0.1)'}]}>
                  <Ionicons name="document-text" size={16} color={UI.status.paid} />
                </View>
                <Text style={[styles.sectionTitle, isDark && {color: theme.text.title}]}>Certificates</Text>
              </View>
              <View style={styles.certRow}>
                <TouchableOpacity
                  style={[styles.certBtn, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.glass.border}]}
                  onPress={() => router.push('/(app)/cp12' as any)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.certIconWrap, {backgroundColor: 'rgba(239,68,68,0.1)'}]}>
                    <Ionicons name="flame" size={18} color="#EF4444" />
                  </View>
                  <Text style={[styles.certBtnLabel, isDark && {color: theme.text.title}]}>CP12</Text>
                  <Text style={[styles.certBtnSub, isDark && {color: theme.text.muted}]}>Gas Safety</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.certBtn, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.glass.border}]}
                  onPress={() => router.push('/(app)/forms/service-record' as any)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.certIconWrap, {backgroundColor: 'rgba(59,130,246,0.1)'}]}>
                    <Ionicons name="build" size={18} color={UI.status.inProgress} />
                  </View>
                  <Text style={[styles.certBtnLabel, isDark && {color: theme.text.title}]}>Service</Text>
                  <Text style={[styles.certBtnSub, isDark && {color: theme.text.muted}]}>Record</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.certBtn, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.glass.border}]}
                  onPress={() => router.push('/(app)/forms' as any)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.certIconWrap, {backgroundColor: 'rgba(16,185,129,0.1)'}]}>
                    <Ionicons name="grid" size={18} color={UI.status.complete} />
                  </View>
                  <Text style={[styles.certBtnLabel, isDark && {color: theme.text.title}]}>All</Text>
                  <Text style={[styles.certBtnSub, isDark && {color: theme.text.muted}]}>Forms</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ─── Parts Needed ─── */}
        <Animated.View entering={FadeInDown.delay(225).duration(400)}>
          <JobPartsSection jobId={job.id} />
        </Animated.View>

        {/* ─── Assigned Workers (admin only) ─── */}
        {isAdmin && job.assigned_to?.length > 0 && (
          <Animated.View entering={FadeInDown.delay(240).duration(400)}>
            <View style={[styles.glassCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, {backgroundColor: 'rgba(99,102,241,0.1)'}]}>
                  <Ionicons name="people" size={16} color={isDark ? theme.brand.primary : UI.brand.primary} />
                </View>
                <Text style={[styles.sectionTitle, isDark && {color: theme.text.title}]}>Assigned Workers</Text>
              </View>
              {(job.assigned_to as string[]).map((wId: string) => (
                <View key={wId} style={{flexDirection: 'row', alignItems: 'center', paddingVertical: 6}}>
                  <Text style={[styles.detailValue, isDark && {color: theme.text.body}, {flex: 1, fontSize: 14}]}>{workerNames[wId] ?? 'Worker'}</Text>
                  <AcceptancePill status={acceptanceStatuses[wId]} />
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ─── Proof of work ─── */}
        {(resolvedPhotos.length > 0 || job.signature) && (
          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <View style={[styles.glassCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, {backgroundColor: 'rgba(16,185,129,0.1)'}]}>
                  <Ionicons name="images" size={16} color={UI.status.complete} />
                </View>
                <Text style={[styles.sectionTitle, isDark && {color: theme.text.title}]}>Proof of Work</Text>
              </View>

              {resolvedPhotos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 8}} contentContainerStyle={styles.proofRail}>
                  {resolvedPhotos.map((uri: string, idx: number) => (
                    <Image key={idx} source={{uri}} style={styles.proofImage} />
                  ))}
                </ScrollView>
              )}

              {job.signature && (
                <View style={[styles.signatureWrap, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.glass.border}]}>
                  <Text style={styles.signatureLabel}>Customer Signature</Text>
                  <Image source={{uri: job.signature}} style={styles.signatureImage} />
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* ─── Admin actions ─── */}
        {isAdmin && (
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.adminActions}>
            {nextStatus && nextStatusConfig && (
              <TouchableOpacity onPress={() => adminUpdateStatus(nextStatus)} disabled={updating} activeOpacity={0.85}>
                <LinearGradient colors={nextStatusConfig.gradient} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.actionBtnGradient}>
                  {updating ? (
                    <ActivityIndicator color={UI.text.white} />
                  ) : (
                    <>
                      <Ionicons name={nextStatusConfig.icon} size={18} color={UI.text.white} />
                      <Text style={styles.actionBtnText}>Move to {nextStatusConfig.label}</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            <View style={styles.adminRow}>
              <TouchableOpacity style={[styles.adminCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]} onPress={handleCreateInvoice} activeOpacity={0.75}>
                <View style={[styles.adminCardIcon, {backgroundColor: 'rgba(16,185,129,0.1)'}]}>
                  <Ionicons name="receipt-outline" size={18} color={UI.status.complete} />
                </View>
                <Text style={[styles.adminCardLabel, isDark && {color: theme.text.title}]}>Invoice</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.adminCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]} onPress={handleGeneratePdf} activeOpacity={0.75}>
                <View style={[styles.adminCardIcon, {backgroundColor: 'rgba(139,92,246,0.1)'}]}>
                  <Ionicons name="download-outline" size={18} color={UI.status.paid} />
                </View>
                <Text style={[styles.adminCardLabel, isDark && {color: theme.text.title}]}>PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.adminCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]} onPress={() => router.push(`/(app)/jobs/${job.id}/edit` as any)} activeOpacity={0.75}>
                <View style={[styles.adminCardIcon, {backgroundColor: 'rgba(59,130,246,0.1)'}]}>
                  <Ionicons name="create-outline" size={18} color={UI.status.inProgress} />
                </View>
                <Text style={[styles.adminCardLabel, isDark && {color: theme.text.title}]}>Edit</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <SignaturePad
        visible={signatureModalVisible}
        onClose={() => setSignatureModalVisible(false)}
        onOK={workerFinishJob}
      />
      <JobAcceptModal
        jobId={id}
        visible={acceptModalVisible}
        onDismiss={() => setAcceptModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: Colors.background},
  loadingWrap: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background},

  // ── Header ──
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 12,
    gap: 2,
  },
  backText: {fontSize: 16, color: UI.brand.primary, fontWeight: '600'},
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: {flex: 1},

  // ── Hero card ──
  heroCard: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
    ...Colors.shadow,
  },
  heroStrip: {height: 4},
  heroBody: {padding: 16},
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroRef: {fontSize: 11, fontWeight: '800', color: UI.text.muted, letterSpacing: 0.5},
  heroSubtitle: {fontSize: 14, color: UI.text.muted, lineHeight: 20, marginTop: 6},
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {fontSize: 12, fontWeight: '700'},
  heroTitle: {fontSize: 22, fontWeight: '800', color: UI.text.title, lineHeight: 28},
  heroMetaGrid: {gap: 10, marginTop: 14},
  heroMetricCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  heroMetricIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroMetricLabel: {fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4},
  heroMetricValue: {fontSize: 14, color: UI.text.title, fontWeight: '700', lineHeight: 20},

  // ── Worker actions ──
  bigAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  bigActionText: {color: UI.text.white, fontSize: 17, fontWeight: '800'},

  workerTools: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  toolCard: {
    flex: 1,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    ...Colors.shadow,
  },
  toolIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: {fontSize: 13, fontWeight: '700', color: UI.text.title},
  finishCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  finishLabel: {color: UI.text.white, fontSize: 13, fontWeight: '800'},

  // ── Glass card (reusable) ──
  glassCard: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    ...Colors.shadow,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {fontSize: 14, fontWeight: '700', color: UI.text.title},

  // ── Contact ──
  contactRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flex: 1,
    minWidth: 140,
  },
  contactBtnText: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },

  // ── Certificates ──
  certRow: {
    flexDirection: 'row',
    gap: 10,
  },
  certBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  certIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certBtnLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: UI.text.title,
  },
  certBtnSub: {
    fontSize: 11,
    color: UI.text.muted,
    fontWeight: '500',
  },

  // ── Location ──
  infoPanel: {
    marginLeft: 38,
    borderRadius: 14,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  addressText: {fontSize: 14, color: UI.text.body, lineHeight: 20},
  helperText: {fontSize: 12, color: UI.text.muted, marginTop: 8, fontWeight: '500'},

  // ── Details ──
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  detailTile: {
    width: '48.5%',
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  detailLabel: {fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, color: UI.text.muted, marginBottom: 6},
  detailValue: {fontSize: 14, color: UI.text.title, fontWeight: '700', lineHeight: 20},
  notesBox: {
    backgroundColor: 'rgba(99,102,241,0.05)',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.08)',
  },
  notesLabel: {fontSize: 10, fontWeight: '800', color: UI.text.muted, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5},
  notesText: {fontSize: 14, color: UI.text.body, lineHeight: 20},
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.15)',
  },
  priceLabel: {fontSize: 13, fontWeight: '600', color: UI.text.muted},
  priceValue: {fontSize: 20, fontWeight: '800', color: UI.brand.primary},

  // ── Proof of work ──
  proofRail: {paddingRight: 8},
  proofImage: {
    width: 88,
    height: 88,
    borderRadius: 14,
    marginRight: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  signatureWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.15)',
    borderRadius: 14,
  },
  signatureLabel: {fontSize: 10, fontWeight: '800', color: UI.text.muted, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5},
  signatureImage: {height: 60, width: 150, resizeMode: 'contain', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(148,163,184,0.15)'},

  // ── Admin actions ──
  adminActions: {marginTop: 4, gap: 12, marginBottom: 12},
  actionBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    borderRadius: 14,
  },
  actionBtnText: {color: UI.text.white, fontSize: 16, fontWeight: '700'},

  adminRow: {
    flexDirection: 'row',
    gap: 10,
  },
  adminCard: {
    flex: 1,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
    ...Colors.shadow,
  },
  adminCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminCardLabel: {fontSize: 12, fontWeight: '700', color: UI.text.title},
});