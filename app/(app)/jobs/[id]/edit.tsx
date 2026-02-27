// ============================================
// FILE: app/(app)/jobs/[id]/edit.tsx
// Glassmorphism edit job modal — full parity with create
// ============================================

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { WorkerPicker } from '../../../../components/WorkerPicker';
import { Colors, UI } from '../../../../constants/theme';
import { supabase } from '../../../../src/config/supabase';
import { useAuth } from '../../../../src/context/AuthContext';

const GLASS_BG = UI.glass.bg;
const GLASS_BORDER = UI.glass.border;

const DURATIONS = ['30 mins', '1 hour', '2 hours', '3 hours', '4 hours', 'Full day', 'Multi-day'];

export default function EditJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fields
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [price, setPrice] = useState('');
  const [reference, setReference] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [estimatedDuration, setEstimatedDuration] = useState('1 hour');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [hasWorkers, setHasWorkers] = useState(false);

  // Picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  useEffect(() => {
    if (!id) return;
    fetchJob();
  }, [id]);

  useEffect(() => {
    if (userProfile?.company_id) checkForWorkers();
  }, [userProfile]);

  const fetchJob = async () => {
    const { data } = await supabase.from('jobs').select('*').eq('id', id).single();
    if (data) {
      setTitle(data.title);
      setNotes(data.notes || '');
      setPrice(data.price ? data.price.toString() : '');
      setReference(data.reference || '');
      setScheduledDate(new Date(data.scheduled_date));
      setEstimatedDuration(data.estimated_duration || '1 hour');
      setAssignedTo(data.assigned_to || []);
    }
    setLoading(false);
  };

  const checkForWorkers = async () => {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', userProfile?.company_id)
      .eq('role', 'worker');
    setHasWorkers((count || 0) > 0);
  };

  // Date helpers
  const adjustDate = (days: number) => {
    const d = new Date(scheduledDate);
    d.setDate(d.getDate() + days);
    setScheduledDate(d);
  };

  const adjustHour = (hours: number) => {
    const d = new Date(scheduledDate);
    d.setHours(d.getHours() + hours);
    setScheduledDate(d);
  };

  const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selected) setScheduledDate(selected);
  };

  const handleSave = async () => {
    if (!id) return;
    if (!title.trim()) {
      Alert.alert('Missing Field', 'Job title is required.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          title: title.trim(),
          notes: notes.trim() || null,
          price: price ? parseFloat(price) : null,
          scheduled_date: scheduledDate.getTime(),
          estimated_duration: estimatedDuration,
          assigned_to: assignedTo.length > 0 ? assignedTo : null,
        })
        .eq('id', id);

      if (error) throw error;
      router.back();
    } catch {
      Alert.alert('Error', 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <LinearGradient colors={UI.gradients.appBackground} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={UI.brand.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={UI.gradients.appBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Reference badge */}
          {reference ? (
            <Animated.View entering={FadeInDown.delay(30).duration(350)} style={styles.refRow}>
              <View style={styles.refBadge}>
                <Ionicons name="document-text-outline" size={12} color={UI.brand.primary} />
                <Text style={styles.refText}>{reference}</Text>
              </View>
            </Animated.View>
          ) : null}

          {/* ─── Job Title ─── */}
          <Animated.View entering={FadeInDown.delay(60).duration(350)}>
            <View style={styles.glassCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.iconWrap, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                  <Ionicons name="briefcase" size={15} color={UI.brand.primary} />
                </View>
                <Text style={styles.sectionTitle}>Job Title</Text>
              </View>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Kitchen renovation"
                placeholderTextColor={UI.text.muted}
              />
            </View>
          </Animated.View>

          {/* ─── Schedule ─── */}
          <Animated.View entering={FadeInDown.delay(100).duration(350)}>
            <View style={styles.glassCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.iconWrap, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                  <Ionicons name="calendar" size={15} color="#3B82F6" />
                </View>
                <Text style={styles.sectionTitle}>Schedule</Text>
              </View>

              {/* Date row */}
              <View style={styles.dateRow}>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustDate(-1)}>
                  <Ionicons name="chevron-back" size={18} color={UI.brand.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateDisplay}
                  onPress={() => { setPickerMode('date'); setShowDatePicker(true); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={15} color={UI.text.muted} />
                  <Text style={styles.dateText}>
                    {scheduledDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustDate(1)}>
                  <Ionicons name="chevron-forward" size={18} color={UI.brand.primary} />
                </TouchableOpacity>
              </View>

              {/* Time row */}
              <View style={[styles.dateRow, { marginTop: 8 }]}>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustHour(-1)}>
                  <Ionicons name="chevron-back" size={18} color={UI.brand.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateDisplay}
                  onPress={() => { setPickerMode('time'); setShowDatePicker(true); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="time-outline" size={15} color={UI.text.muted} />
                  <Text style={styles.dateText}>
                    {scheduledDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustHour(1)}>
                  <Ionicons name="chevron-forward" size={18} color={UI.brand.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* ─── Price & Duration ─── */}
          <Animated.View entering={FadeInDown.delay(140).duration(350)}>
            <View style={styles.twoCol}>
              {/* Price */}
              <View style={[styles.glassCard, { flex: 1, marginRight: 6 }]}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                    <Ionicons name="cash" size={15} color="#10B981" />
                  </View>
                  <Text style={styles.sectionTitle}>Price</Text>
                </View>
                <View style={styles.priceInputRow}>
                  <Text style={styles.currencySymbol}>£</Text>
                  <TextInput
                    style={[styles.input, styles.priceInput]}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={UI.text.muted}
                  />
                </View>
              </View>

              {/* Duration */}
              <View style={[styles.glassCard, { flex: 1, marginLeft: 6 }]}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
                    <Ionicons name="hourglass" size={15} color="#8B5CF6" />
                  </View>
                  <Text style={styles.sectionTitle}>Duration</Text>
                </View>
                <TouchableOpacity
                  style={styles.durationBtn}
                  onPress={() => {
                    const idx = DURATIONS.indexOf(estimatedDuration);
                    setEstimatedDuration(DURATIONS[(idx + 1) % DURATIONS.length]);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.durationText}>{estimatedDuration}</Text>
                  <Ionicons name="swap-vertical" size={16} color={UI.text.muted} />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* ─── Notes ─── */}
          <Animated.View entering={FadeInDown.delay(180).duration(350)}>
            <View style={styles.glassCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.iconWrap, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                  <Ionicons name="create" size={15} color="#F59E0B" />
                </View>
                <Text style={styles.sectionTitle}>Notes</Text>
              </View>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                placeholder="Add any job details or special instructions..."
                placeholderTextColor={UI.text.muted}
              />
            </View>
          </Animated.View>

          {/* ─── Assign Workers ─── */}
          {hasWorkers && (
            <Animated.View entering={FadeInDown.delay(220).duration(350)}>
              <View style={styles.glassCard}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                    <Ionicons name="people" size={15} color="#3B82F6" />
                  </View>
                  <Text style={styles.sectionTitle}>Assigned Workers</Text>
                </View>
                <WorkerPicker
                  companyId={userProfile?.company_id || ''}
                  selectedWorkerIds={assignedTo}
                  onSelect={setAssignedTo}
                />
              </View>
            </Animated.View>
          )}

          {/* ─── Save button ─── */}
          <Animated.View entering={FadeInDown.delay(260).duration(350)}>
            <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              <LinearGradient
                colors={UI.gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Date/Time Picker Modal ─── */}
      <Modal transparent visible={showDatePicker} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {pickerMode === 'date' ? 'Select Date' : 'Select Time'}
              </Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={28} color={UI.text.muted} />
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={scheduledDate}
              mode={pickerMode}
              is24Hour
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
              minuteInterval={15}
              textColor="#000000"
              themeVariant="light"
            />
            <TouchableOpacity onPress={() => setShowDatePicker(false)} activeOpacity={0.85}>
              <LinearGradient colors={UI.gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmBtn}>
                <Text style={styles.confirmBtnText}>Confirm</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1, paddingTop: 12 },

  // ── Ref badge ──
  refRow: { alignItems: 'flex-start', marginBottom: 12 },
  refBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(99,102,241,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  refText: { fontSize: 12, fontWeight: '700', color: UI.brand.primary, letterSpacing: 0.3 },

  // ── Glass card ──
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
    marginBottom: 12,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: UI.text.title },

  // ── Inputs ──
  input: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    fontSize: 16,
    color: UI.text.title,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '800',
    color: UI.text.muted,
    marginRight: 8,
    marginLeft: 4,
  },
  priceInput: { flex: 1 },
  textArea: { minHeight: 120, paddingTop: 14 },
  twoCol: { flexDirection: 'row' },

  // ── Schedule ──
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adjustBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(99,102,241,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  dateText: {
    fontSize: 15,
    fontWeight: '700',
    color: UI.text.title,
  },

  // ── Duration ──
  durationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.7)',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  durationText: {
    fontSize: 15,
    fontWeight: '700',
    color: UI.text.title,
  },

  // ── Save button ──
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
    ...Colors.shadow,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  pickerModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    ...Colors.shadow,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: UI.text.title,
  },
  confirmBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});