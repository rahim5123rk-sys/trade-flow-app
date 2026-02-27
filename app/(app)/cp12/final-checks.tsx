// ============================================
// FILE: app/(app)/cp12/final-checks.tsx
// Step 3 – Final checks, alarms, faults
// ============================================

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, UI } from '../../../constants/theme';
import { useCP12 } from '../../../src/context/CP12Context';
import { CP12FinalChecks, YesNoNA } from '../../../src/types/cp12';

const GLASS_BG = UI.glass.bg;
const GLASS_BORDER = UI.glass.border;
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;

// ─── Step indicator ─────────────────────────────────────────────

const StepIndicator = ({ current }: { current: number }) => (
  <View style={s.stepRow}>
    {['Details', 'Appliances', 'Checks', 'Review'].map((label, i) => {
      const step = i + 1;
      const isActive = step === current;
      const isDone = step < current;
      return (
        <View key={label} style={s.stepItem}>
          <View
            style={[s.stepDot, isActive && s.stepDotActive, isDone && s.stepDotDone]}
          >
            {isDone ? (
              <Ionicons name="checkmark" size={12} color="#fff" />
            ) : (
              <Text style={[s.stepDotText, (isActive || isDone) && { color: '#fff' }]}>
                {step}
              </Text>
            )}
          </View>
          <Text style={[s.stepLabel, isActive && s.stepLabelActive]}>{label}</Text>
        </View>
      );
    })}
  </View>
);

// ─── Reusable Yes/No/NA chips ───────────────────────────────────

function TriChips({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={s.chipRow}>
      {['Yes', 'No', 'N/A'].map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[s.chip, active && s.chipActive]}
            onPress={() => onSelect(opt)}
            activeOpacity={0.7}
          >
            <Text style={[s.chipText, active && s.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Section divider ────────────────────────────────────────────

const SectionDivider = ({ title, icon }: { title: string; icon?: keyof typeof Ionicons.glyphMap }) => (
  <View style={s.sectionHeader}>
    {icon && (
      <View style={s.sectionIconWrap}>
        <Ionicons name={icon} size={16} color="#6366F1" />
      </View>
    )}
    <Text style={s.sectionTitle}>{title}</Text>
  </View>
);

// ─── Main ───────────────────────────────────────────────────────

export default function FinalChecksScreen() {
  const insets = useSafeAreaInsets();
  const {
    finalChecks,
    setFinalChecks,
    appliances,
    landlordForm,
    tenantName,
    propertyAddress,
  } = useCP12();

  const update = <K extends keyof CP12FinalChecks>(key: K, val: CP12FinalChecks[K]) =>
    setFinalChecks({ ...finalChecks, [key]: val });

  const handleNext = () => {
    // Basic validation
    const missingChecks = [
      !finalChecks.visualInspection,
      !finalChecks.ecvAccessible,
      !finalChecks.tightnessTest,
      !finalChecks.equipotentialBonding,
    ].some(Boolean);

    if (missingChecks) {
      Alert.alert('Incomplete', 'Please complete all required checks before continuing.');
      return;
    }

    router.push('/(app)/cp12/review-sign');
  };

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#EEF2FF', '#E0F2FE', '#F0FDFA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            s.scroll,
            { paddingTop: insets.top + 8, paddingBottom: TAB_BAR_HEIGHT + 120 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(50).springify()} style={s.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={s.backBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={Colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Final Checks</Text>
              <Text style={s.subtitleText}>
                {appliances.length} appliance(s) inspected
              </Text>
            </View>
          </Animated.View>

          <StepIndicator current={3} />

          {/* Summary banner */}
          <Animated.View entering={FadeInDown.delay(150).springify()} style={s.summaryBanner}>
            <View style={s.summaryRow}>
              <Ionicons name="person" size={14} color="#6366F1" />
              <Text style={s.summaryText}>
                {landlordForm.customerName || 'Landlord'}
              </Text>
            </View>
            {tenantName ? (
              <View style={s.summaryRow}>
                <Ionicons name="people" size={14} color="#10B981" />
                <Text style={s.summaryText}>{tenantName}</Text>
              </View>
            ) : null}
            {propertyAddress ? (
              <View style={s.summaryRow}>
                <Ionicons name="home" size={14} color="#F59E0B" />
                <Text style={s.summaryText} numberOfLines={1}>
                  {propertyAddress}
                </Text>
              </View>
            ) : null}
          </Animated.View>

          {/* ── Installation Checks ── */}
          <Animated.View entering={FadeInDown.delay(200).springify()} style={s.card}>
            <SectionDivider title="Installation Checks" icon="shield-checkmark" />

            <CheckRow
              label="Satisfactory Visual Inspection"
              value={finalChecks.visualInspection}
              onChange={(v) => update('visualInspection', v as YesNoNA)}
            />
            <CheckRow
              label="ECV Accessible"
              value={finalChecks.ecvAccessible}
              onChange={(v) => update('ecvAccessible', v as YesNoNA)}
            />
            <CheckRow
              label="Tightness Test Satisfactory"
              value={finalChecks.tightnessTest}
              onChange={(v) => update('tightnessTest', v as YesNoNA)}
            />
            <CheckRow
              label="Equipotential Bonding Satisfactory"
              value={finalChecks.equipotentialBonding}
              onChange={(v) => update('equipotentialBonding', v as YesNoNA)}
            />
          </Animated.View>

          {/* ── CO Alarm ── */}
          <Animated.View entering={FadeInDown.delay(300).springify()} style={s.card}>
            <SectionDivider title="CO Alarm" icon="alert-circle" />

            <CheckRow
              label="CO Alarm Fitted"
              value={finalChecks.coAlarmFitted}
              onChange={(v) => update('coAlarmFitted', v as YesNoNA)}
            />

            <CheckRow
              label="Testing of CO Alarm Satisfactory"
              value={finalChecks.coAlarmTestSatisfactory}
              onChange={(v) => update('coAlarmTestSatisfactory', v as YesNoNA)}
            />

            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>CO Alarm Test Date</Text>
              <View style={s.inputWrapper}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={UI.text.muted}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={s.input}
                  value={finalChecks.coAlarmTestDate}
                  onChangeText={(v) => update('coAlarmTestDate', v)}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>CO Alarm Expiry Date</Text>
              <View style={s.inputWrapper}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={UI.text.muted}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={s.input}
                  value={finalChecks.coAlarmExpiryDate}
                  onChangeText={(v) => update('coAlarmExpiryDate', v)}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <CheckRow
              label="CO Alarm Within Date"
              value={finalChecks.coAlarmInDate}
              onChange={(v) => update('coAlarmInDate', v as YesNoNA)}
            />
          </Animated.View>

          {/* ── Smoke Alarm ── */}
          <Animated.View entering={FadeInDown.delay(400).springify()} style={s.card}>
            <SectionDivider title="Smoke Alarm" icon="flame" />

            <CheckRow
              label="Smoke Alarm Fitted"
              value={finalChecks.smokeAlarmFitted}
              onChange={(v) => update('smokeAlarmFitted', v as YesNoNA)}
            />
            <CheckRow
              label="Smoke Alarm Tested"
              value={finalChecks.smokeAlarmTested}
              onChange={(v) => update('smokeAlarmTested', v as YesNoNA)}
            />
          </Animated.View>

          {/* ── Notes & Faults ── */}
          <Animated.View entering={FadeInDown.delay(500).springify()} style={s.card}>
            <SectionDivider title="Notes & Observations" icon="document-text" />

            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>Faults Identified</Text>
              <View style={[s.inputWrapper, s.textAreaWrapper]}>
                <TextInput
                  style={[s.input, s.textArea]}
                  value={finalChecks.faults}
                  onChangeText={(v) => update('faults', v)}
                  placeholder="Record any faults found…"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>

            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>Rectification Work Carried Out</Text>
              <View style={[s.inputWrapper, s.textAreaWrapper]}>
                <TextInput
                  style={[s.input, s.textArea]}
                  value={finalChecks.rectificationWork}
                  onChangeText={(v) => update('rectificationWork', v)}
                  placeholder="Describe any rectification work…"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>

            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>Details of Work Carried Out</Text>
              <View style={[s.inputWrapper, s.textAreaWrapper]}>
                <TextInput
                  style={[s.input, s.textArea]}
                  value={finalChecks.workCarriedOut}
                  onChangeText={(v) => update('workCarriedOut', v)}
                  placeholder="Describe the work carried out…"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Bottom CTA */}
        <Animated.View
          entering={FadeIn.delay(600)}
          style={[s.bottomBar, { bottom: TAB_BAR_HEIGHT, paddingBottom: 12 }]}
        >
          <TouchableOpacity
            style={s.completeBtn}
            activeOpacity={0.85}
            onPress={handleNext}
          >
            <LinearGradient
              colors={['#6366F1', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.completeGradient}
            >
              <Text style={s.completeText}>Next: Review & Sign</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Check row component ────────────────────────────────────────

function CheckRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.checkRow}>
      <Text style={s.checkLabel}>{label}</Text>
      <View style={s.chipRow}>
        {['Yes', 'No', 'N/A'].map((opt) => {
          const active = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[s.chip, active && s.chipActive]}
              onPress={() => onChange(opt)}
              activeOpacity={0.7}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  backBtn: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: GLASS_BG, borderWidth: 1, borderColor: GLASS_BORDER,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  subtitleText: { fontSize: 13, color: '#64748B', fontWeight: '500', marginTop: 2 },

  // Steps
  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 24, paddingVertical: 14, backgroundColor: GLASS_BG, borderRadius: 16, borderWidth: 1, borderColor: GLASS_BORDER },
  stepItem: { alignItems: 'center', gap: 6 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  stepDotActive: { backgroundColor: '#6366F1' },
  stepDotDone: { backgroundColor: '#10B981' },
  stepDotText: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  stepLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  stepLabelActive: { color: '#6366F1' },

  // Summary banner
  summaryBanner: {
    backgroundColor: GLASS_BG, borderRadius: 16, borderWidth: 1, borderColor: GLASS_BORDER,
    padding: 14, marginBottom: 20, gap: 8,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryText: { fontSize: 13, fontWeight: '600', color: '#334155', flex: 1 },

  // Card
  card: {
    backgroundColor: GLASS_BG, borderRadius: 18, borderWidth: 1, borderColor: GLASS_BORDER,
    padding: 18, marginBottom: 16,
    shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },

  // Check rows
  checkRow: { marginBottom: 16 },
  checkLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },

  // Chips
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#6366F1' },

  // Inputs
  inputContainer: { marginBottom: 14 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  input: { flex: 1, fontSize: 15, color: '#0F172A', padding: 0 },
  textAreaWrapper: { alignItems: 'flex-start', minHeight: 100 },
  textArea: { minHeight: 88, textAlignVertical: 'top' },

  // Bottom
  bottomBar: {
    position: 'absolute', left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: 'rgba(248,250,252,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  completeBtn: { borderRadius: 16, overflow: 'hidden' },
  completeGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 8,
  },
  completeText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
