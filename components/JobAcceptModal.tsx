// components/JobAcceptModal.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../src/config/supabase';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/ThemeContext';

interface Props {
  jobId: string | null;
  visible: boolean;
  onDismiss: () => void;
}

interface JobDetail {
  id: string;
  title: string;
  scheduled_date: number | string;
  estimated_duration?: string;
  notes?: string;
  customer_snapshot: {
    name?: string;
    address?: string;
    address_line_1?: string;
    city?: string;
    postal_code?: string;
  };
}

export default function JobAcceptModal({ jobId, visible, onDismiss }: Props) {
  const { theme, isDark } = useAppTheme();
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<'accept' | 'decline' | null>(null);
  const [acceptanceStatus, setAcceptanceStatus] = useState<string | null>(null);

  useEffect(() => {
    if (visible && jobId) fetchJob();
    else {
      setJob(null);
      setAcceptanceStatus(null);
    }
  }, [visible, jobId]);

  const fetchJob = async () => {
    if (!jobId) return;
    setLoading(true);
    const { data } = await supabase
      .from('jobs')
      .select('id, title, scheduled_date, estimated_duration, notes, customer_snapshot')
      .eq('id', jobId)
      .single();
    setJob(data as JobDetail);
    const { data: acceptance } = await supabase
      .from('job_acceptance')
      .select('status')
      .eq('job_id', jobId!)
      .eq('worker_id', userProfile?.id ?? '')
      .maybeSingle();
    setAcceptanceStatus(acceptance?.status ?? null);
    setLoading(false);
  };

  const handleAccept = async () => {
    if (!jobId || !userProfile) return;
    setActing('accept');
    const { error } = await supabase
      .from('job_acceptance')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('job_id', jobId)
      .eq('worker_id', userProfile.id);
    setActing(null);
    if (error) { Alert.alert('Error', 'Could not accept job. Try again.'); return; }
    onDismiss();
  };

  const handleDecline = async () => {
    if (!jobId || !userProfile) return;
    Alert.alert('Decline Job', 'Are you sure? Your admin will be notified.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setActing('decline');
          // Update acceptance row
          const { error: declineError } = await supabase
            .from('job_acceptance')
            .update({ status: 'declined', updated_at: new Date().toISOString() })
            .eq('job_id', jobId)
            .eq('worker_id', userProfile.id);

          if (declineError) {
            setActing(null);
            Alert.alert('Error', 'Could not decline job. Try again.');
            return;
          }

          // Notify admin (best-effort — don't block UI on failure)
          try {
            const { data: { session } } = await supabase.auth.getSession();
            await fetch(
              `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/notify-admin-decline`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ jobId }),
              }
            );
          } catch (_) { /* silent */ }

          setActing(null);
          onDismiss();
        },
      },
    ]);
  };

  const formatDate = (val: number | string) => {
    const d = typeof val === 'number' ? new Date(val) : new Date(val);
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const formatTime = (val: number | string) => {
    const d = typeof val === 'number' ? new Date(val) : new Date(val);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const address = job
    ? [job.customer_snapshot.address_line_1, job.customer_snapshot.city, job.customer_snapshot.postal_code]
        .filter(Boolean).join(', ') || job.customer_snapshot.address || 'No address'
    : '';

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop}>
        <Animated.View
          entering={FadeInDown.duration(320).springify()}
          style={[styles.sheet, { backgroundColor: isDark ? theme.surface.elevated : '#FFFFFF', paddingBottom: insets.bottom + 16 }]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: isDark ? theme.surface.border : '#F0F0F0' }]}>
            <View style={[styles.pill, { backgroundColor: '#FF9500' + '22' }]}>
              <Text style={[styles.pillText, { color: '#FF9500' }]}>JOB ASSIGNED TO YOU</Text>
            </View>
            <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={theme.text.muted} />
            </TouchableOpacity>
          </View>

          {loading || !job ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={theme.brand.primary} />
            </View>
          ) : (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              <Text style={[styles.jobTitle, { color: theme.text.title }]}>{job.title}</Text>
              <Text style={[styles.address, { color: theme.text.muted }]}>{address}</Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={16} color={theme.brand.primary} />
                  <Text style={[styles.metaText, { color: theme.text.body }]}>{formatDate(job.scheduled_date)}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={16} color={theme.brand.primary} />
                  <Text style={[styles.metaText, { color: theme.text.body }]}>{formatTime(job.scheduled_date)}</Text>
                </View>
                {job.estimated_duration ? (
                  <View style={styles.metaItem}>
                    <Ionicons name="hourglass-outline" size={16} color={theme.brand.primary} />
                    <Text style={[styles.metaText, { color: theme.text.body }]}>{job.estimated_duration}</Text>
                  </View>
                ) : null}
              </View>

              {job.notes ? (
                <View style={[styles.notesBox, { backgroundColor: isDark ? theme.surface.base : '#F8F9FA' }]}>
                  <Text style={[styles.notesLabel, { color: theme.text.muted }]}>NOTES</Text>
                  <Text style={[styles.notesText, { color: theme.text.body }]}>{job.notes}</Text>
                </View>
              ) : null}

              {acceptanceStatus && acceptanceStatus !== 'pending' ? (
                <View style={{ padding: 16, borderRadius: 12, backgroundColor: acceptanceStatus === 'accepted' ? '#1C3A2A' : '#3A1C1C', marginBottom: 16 }}>
                  <Text style={{ color: acceptanceStatus === 'accepted' ? '#2ECC71' : '#E74C3C', fontWeight: '700', textAlign: 'center' }}>
                    You have already {acceptanceStatus} this job
                  </Text>
                </View>
              ) : null}

              {/* Actions */}
              {(!acceptanceStatus || acceptanceStatus === 'pending') && (
                <>
                  <TouchableOpacity
                    style={[styles.acceptBtn, acting === 'accept' && { opacity: 0.6 }]}
                    onPress={handleAccept}
                    disabled={!!acting}
                  >
                    {acting === 'accept' ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.acceptBtnText}>Accept Job</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.declineBtn, { borderColor: isDark ? theme.surface.border : '#E5E5E5' }, acting === 'decline' && { opacity: 0.6 }]}
                    onPress={handleDecline}
                    disabled={!!acting}
                  >
                    {acting === 'decline' ? (
                      <ActivityIndicator color="#E74C3C" />
                    ) : (
                      <>
                        <Ionicons name="close-circle-outline" size={20} color="#E74C3C" />
                        <Text style={styles.declineBtnText}>Decline Job</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  pill: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  closeBtn: { padding: 4 },
  loadingWrap: { padding: 60, alignItems: 'center' },
  body: { padding: 20 },
  jobTitle: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  address: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  metaRow: { gap: 12, marginBottom: 20 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 14 },
  notesBox: { borderRadius: 10, padding: 14, marginBottom: 24 },
  notesLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  notesText: { fontSize: 14, lineHeight: 20 },
  acceptBtn: { backgroundColor: '#2ECC71', borderRadius: 14, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  acceptBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  declineBtn: { borderRadius: 14, borderWidth: 1.5, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  declineBtnText: { color: '#E74C3C', fontSize: 17, fontWeight: '700' },
});
