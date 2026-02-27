// ============================================
// FILE: app/(app)/cp12/review-sign.tsx
// Step 4 – Review, sign & complete
// ============================================

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
    DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
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
import { SignaturePad } from '../../../components/SignaturePad';
import { UI } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';
import { useCP12 } from '../../../src/context/CP12Context';
import {
    buildCP12LockedPayload,
    CP12PdfData,
    generateCP12PdfFromPayload,
} from '../../../src/services/cp12PdfGenerator';

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
              <Text
                style={[s.stepDotText, (isActive || isDone) && { color: '#fff' }]}
              >
                {step}
              </Text>
            )}
          </View>
          <Text style={[s.stepLabel, isActive && s.stepLabelActive]}>
            {label}
          </Text>
        </View>
      );
    })}
  </View>
);

// ─── helpers ────────────────────────────────────────────────────

const parseDate = (ddmmyyyy: string): Date => {
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

const formatDate = (d: Date): string =>
  d.toLocaleDateString('en-GB'); // dd/mm/yyyy

// ─── Screen ─────────────────────────────────────────────────────

export default function ReviewSign() {
  const insets = useSafeAreaInsets();
  const { userProfile } = useAuth();
  const {
    inspectionDate,
    setInspectionDate,
    nextDueDate,
    setNextDueDate,
    customerSignature,
    setCustomerSignature,
    certRef,
    setCertRef,
    landlordForm,
    tenantName,
    tenantEmail,
    tenantPhone,
    propertyAddress,
    appliances,
    finalChecks,
    resetCP12,
  } = useCP12();

  // Loading state for PDF generation
  const [generating, setGenerating] = useState(false);

  // Date picker state
  const [showInspDate, setShowInspDate] = useState(false);
  const [showDueDate, setShowDueDate] = useState(false);

  // Signature modal
  const [showSigPad, setShowSigPad] = useState(false);

  // ── date change handlers ──
  const onInspDateChange = (_e: DateTimePickerEvent, date?: Date) => {
    setShowInspDate(Platform.OS === 'ios'); // keep open on iOS
    if (date) setInspectionDate(formatDate(date));
  };

  const onDueDateChange = (_e: DateTimePickerEvent, date?: Date) => {
    setShowDueDate(Platform.OS === 'ios');
    if (date) setNextDueDate(formatDate(date));
  };

  // ── signature callback ──
  const handleSignature = (base64: string) => {
    setCustomerSignature(base64);
    setShowSigPad(false);
  };

  // ── complete ──
  const handleComplete = async () => {
    if (!customerSignature) {
      Alert.alert('Signature Required', 'Please capture the customer\'s signature before completing.');
      return;
    }

    if (!userProfile?.company_id) {
      Alert.alert('Error', 'Company profile not found. Please check your settings.');
      return;
    }

    setGenerating(true);
    try {
      const pdfData: CP12PdfData = {
        landlordName: landlordForm.customerName || '',
        landlordCompany: landlordForm.customerCompany || '',
        landlordAddress: [landlordForm.addressLine1, landlordForm.addressLine2, landlordForm.city, landlordForm.postCode].filter(Boolean).join(', '),
        landlordPostcode: landlordForm.postCode || '',
        landlordEmail: landlordForm.email || '',
        landlordPhone: landlordForm.phone || '',
        tenantName,
        tenantEmail,
        tenantPhone,
        propertyAddress,
        appliances,
        finalChecks,
        inspectionDate,
        nextDueDate,
        customerSignature,
        certRef,
      };

      const lockedPayload = await buildCP12LockedPayload(
        pdfData,
        userProfile.company_id,
        userProfile.id,
      );

      const cp12Number = Number(String(Date.now()).slice(-8));
      const cp12Reference = certRef?.trim() || `CP12-${cp12Number}`;

      const documentBase = {
        company_id: userProfile.company_id,
        type: 'cp12' as const,
        number: cp12Number,
        reference: cp12Reference,
        date: new Date().toISOString(),
        expiry_date: nextDueDate || null,
        status: 'Sent' as const,
        customer_id: landlordForm.customerId || null,
        customer_snapshot: {
          name: landlordForm.customerName || tenantName || 'CP12 Customer',
          company_name: landlordForm.customerCompany || null,
          address_line_1: landlordForm.addressLine1 || null,
          address_line_2: landlordForm.addressLine2 || null,
          city: landlordForm.city || null,
          postal_code: landlordForm.postCode || null,
          phone: landlordForm.phone || null,
          email: landlordForm.email || null,
          address: [landlordForm.addressLine1, landlordForm.addressLine2, landlordForm.city, landlordForm.postCode]
            .filter(Boolean)
            .join(', '),
        },
        items: [],
        subtotal: 0,
        discount_percent: 0,
        total: 0,
        notes: 'CP12 Gas Safety Certificate (locked snapshot)',
        payment_info: JSON.stringify(lockedPayload),
      };

      let { error: saveError } = await supabase
        .from('documents')
        .insert(documentBase);

      if (saveError) {
        const msg = (saveError.message || '').toLowerCase();
        const canFallback =
          msg.includes('type') ||
          msg.includes('enum') ||
          msg.includes('check constraint');

        if (!canFallback) throw saveError;

        const { error: fallbackError } = await supabase
          .from('documents')
          .insert({ ...documentBase, type: 'quote' as const });

        if (fallbackError) throw fallbackError;
      }

      await generateCP12PdfFromPayload(lockedPayload);

      Alert.alert(
        'CP12 Complete',
        `Gas Safety Record saved to Documents as a locked snapshot.\n\nFuture customer edits will not change this saved CP12.\n\n${appliances.length} appliance(s) inspected.`,
        [
          {
            text: 'Done',
            onPress: () => {
              resetCP12();
              router.replace('/(app)/dashboard');
            },
          },
        ],
      );
    } catch (err: any) {
      Alert.alert('PDF Error', err?.message || 'Failed to generate CP12 PDF.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#EEF2FF', '#E0F2FE', '#F0FDFA']}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeIn.duration(300)} style={s.header}>
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={20} color="#6366F1" />
            </TouchableOpacity>
            <View>
              <Text style={s.title}>Review & Sign</Text>
              <Text style={s.subtitleText}>Step 4 of 4</Text>
            </View>
          </Animated.View>

          <StepIndicator current={4} />

          {/* ── Inspection date ────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.card}>
            <View style={s.sectionHeader}>
              <View style={s.sectionIconWrap}>
                <Ionicons name="calendar-outline" size={16} color="#6366F1" />
              </View>
              <Text style={s.sectionTitle}>Dates</Text>
            </View>

            {/* Inspection date */}
            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>Inspection Date</Text>
              <TouchableOpacity
                style={s.inputWrapper}
                activeOpacity={0.7}
                onPress={() => setShowInspDate(true)}
              >
                <Ionicons name="calendar" size={18} color="#6366F1" style={{ marginRight: 10 }} />
                <Text style={s.inputValue}>{inspectionDate}</Text>
              </TouchableOpacity>
              {showInspDate && (
                <DateTimePicker
                  value={parseDate(inspectionDate)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onInspDateChange}
                />
              )}
            </View>

            {/* Next due date */}
            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>Next Due Date</Text>
              <TouchableOpacity
                style={s.inputWrapper}
                activeOpacity={0.7}
                onPress={() => setShowDueDate(true)}
              >
                <Ionicons name="calendar" size={18} color="#F59E0B" style={{ marginRight: 10 }} />
                <Text style={s.inputValue}>{nextDueDate}</Text>
              </TouchableOpacity>
              {showDueDate && (
                <DateTimePicker
                  value={parseDate(nextDueDate)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDueDateChange}
                />
              )}
            </View>
          </Animated.View>

          {/* ── Cert ref ───────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(160).duration(400)} style={s.card}>
            <View style={s.sectionHeader}>
              <View style={s.sectionIconWrap}>
                <Ionicons name="document-text-outline" size={16} color="#6366F1" />
              </View>
              <Text style={s.sectionTitle}>Certificate Reference</Text>
            </View>

            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>Cert Ref Number</Text>
              <View style={s.inputWrapper}>
                <Ionicons name="barcode-outline" size={18} color="#6366F1" style={{ marginRight: 10 }} />
                <TextInput
                  style={s.input}
                  value={certRef}
                  onChangeText={setCertRef}
                  placeholder="e.g. CP12-2025-001"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>
          </Animated.View>

          {/* ── Signature ──────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(240).duration(400)} style={s.card}>
            <View style={s.sectionHeader}>
              <View style={s.sectionIconWrap}>
                <Ionicons name="pencil-outline" size={16} color="#6366F1" />
              </View>
              <Text style={s.sectionTitle}>Customer Signature</Text>
            </View>

            {customerSignature ? (
              <View style={s.signaturePreview}>
                <Image
                  source={{ uri: customerSignature }}
                  style={s.signatureImage}
                  resizeMode="contain"
                />
                <TouchableOpacity
                  style={s.resignBtn}
                  onPress={() => {
                    setCustomerSignature('');
                    setShowSigPad(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh" size={16} color="#6366F1" />
                  <Text style={s.resignText}>Re-sign</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={s.signatureBtn}
                onPress={() => setShowSigPad(true)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#EEF2FF', '#E0E7FF']}
                  style={s.signatureBtnGradient}
                >
                  <Ionicons name="pencil" size={22} color="#6366F1" />
                  <Text style={s.signatureBtnText}>Tap to Capture Signature</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Bottom bar ──────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(400)}
        style={[s.bottomBar, { bottom: TAB_BAR_HEIGHT }]}
      >
        <TouchableOpacity
          style={s.completeBtn}
          activeOpacity={0.85}
          onPress={handleComplete}
          disabled={generating}
        >
          <LinearGradient
            colors={generating ? ['#94A3B8', '#94A3B8'] : ['#10B981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.completeGradient}
          >
            {generating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="checkmark-done-circle" size={22} color="#fff" />
            )}
            <Text style={s.completeText}>{generating ? 'Generating PDF...' : 'Complete CP12'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Signature modal */}
      <SignaturePad
        visible={showSigPad}
        onClose={() => setShowSigPad(false)}
        onOK={handleSignature}
      />
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
  stepRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 24,
    paddingVertical: 14, backgroundColor: GLASS_BG, borderRadius: 16,
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  stepItem: { alignItems: 'center', gap: 6 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center',
  },
  stepDotActive: { backgroundColor: '#6366F1' },
  stepDotDone: { backgroundColor: '#10B981' },
  stepDotText: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  stepLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  stepLabelActive: { color: '#6366F1' },

  // Card
  card: {
    backgroundColor: GLASS_BG, borderRadius: 18, borderWidth: 1, borderColor: GLASS_BORDER,
    padding: 18, marginBottom: 16,
    shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },

  // Inputs
  inputContainer: { marginBottom: 14 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  input: { flex: 1, fontSize: 15, color: '#0F172A', padding: 0 },
  inputValue: { fontSize: 15, color: '#0F172A', fontWeight: '500' },

  // Signature
  signaturePreview: {
    borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0',
    backgroundColor: '#fff', padding: 12, alignItems: 'center',
  },
  signatureImage: { width: '100%', height: 160, borderRadius: 8 },
  resignBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 10, backgroundColor: '#EEF2FF',
  },
  resignText: { fontSize: 13, fontWeight: '600', color: '#6366F1' },
  signatureBtn: { borderRadius: 14, overflow: 'hidden' },
  signatureBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 32, gap: 10, borderRadius: 14,
    borderWidth: 2, borderColor: '#C7D2FE', borderStyle: 'dashed',
  },
  signatureBtnText: { fontSize: 15, fontWeight: '600', color: '#6366F1' },

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
