// ============================================
// FILE: app/(app)/forms/service-record/review-sign.tsx
// Step 3 – Review, sign & complete
// ============================================

import {Ionicons} from '@expo/vector-icons';
import DateTimePicker, {DateTimePickerEvent} from '@react-native-community/datetimepicker';
import {LinearGradient} from 'expo-linear-gradient';
import {router} from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {FadeIn, FadeInDown} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import ReminderSection from '../../../../components/ReminderSection';
import {SignaturePad} from '../../../../components/SignaturePad';
import {UI} from '../../../../constants/theme';
import {supabase} from '../../../../src/config/supabase';
import {useAuth} from '../../../../src/context/AuthContext';
import {useOfflineMode} from '../../../../src/context/OfflineContext';
import {useServiceRecord} from '../../../../src/context/ServiceRecordContext';
import {useAppTheme} from '../../../../src/context/ThemeContext';
import {sanitizeRecipients, sendCp12CertificateEmail} from '../../../../src/services/email';
import {
  buildServiceRecordLockedPayload,
  generateServiceRecordPdfBase64FromPayload,
  generateServiceRecordPdfFromPayload,
  generateServiceRecordPdfUrl,
  ServiceRecordPdfData,
} from '../../../../src/services/serviceRecordPdfGenerator';

const GLASS_BG = UI.glass.bg;
const GLASS_BORDER = UI.glass.border;
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;
const ACCENT = '#059669';

// ─── Step indicator ─────────────────────────────────────────────

const StepIndicator = ({current}: {current: number}) => {
  const {isDark, theme} = useAppTheme();
  return (
    <View style={[s.stepRow, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
      {['Details', 'Service', 'Review'].map((label, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <View key={label} style={s.stepItem}>
            <View style={[s.stepDot, isActive && s.stepDotActive, isDone && s.stepDotDone]}>
              {isDone ? (
                <Ionicons name="checkmark" size={12} color={UI.text.white} />
              ) : (
                <Text style={[s.stepDotText, (isActive || isDone) && {color: UI.text.white}, isDark && !isActive && !isDone && {color: theme.text.muted}]}>
                  {step}
                </Text>
              )}
            </View>
            <Text style={[s.stepLabel, isActive ? {color: ACCENT} : isDark && {color: theme.text.muted}]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
};

// ─── Helpers ────────────────────────────────────────────────────

const parseDate = (ddmmyyyy: string): Date => {
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

const formatDate = (d: Date): string => d.toLocaleDateString('en-GB');

// ─── Screen ─────────────────────────────────────────────────────

export default function ServiceRecordReviewSign() {
  const {theme, isDark} = useAppTheme();
  const insets = useSafeAreaInsets();
  const {userProfile} = useAuth();
  const {offlineModeEnabled} = useOfflineMode();
  const {
    serviceDate,
    setServiceDate,
    nextInspectionDate,
    setNextInspectionDate,
    renewalReminderEnabled,
    setRenewalReminderEnabled,
    customerSignature,
    setCustomerSignature,
    certRef,
    setCertRef,
    customerForm,
    propertyAddress,
    appliances,
    finalInfo,
    resetServiceRecord,
    editingDocumentId,
  } = useServiceRecord();

  const [processingAction, setProcessingAction] = useState<null | 'save' | 'email' | 'view'>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNextDatePicker, setShowNextDatePicker] = useState(false);
  const [showSigPad, setShowSigPad] = useState(false);
  const [oneTimeEmails, setOneTimeEmails] = useState<string[]>([]);

  const savedEmails: string[] = [];
  const emailRecipients = sanitizeRecipients([customerForm.email || '']);

  useEffect(() => {
    const preloadNextReference = async () => {
      if (certRef) return;
      if (editingDocumentId) return;
      try {
        const {data, error} = await supabase.rpc('get_next_gas_cert_reference', {reserve: false});
        if (!error && typeof data === 'string') setCertRef(data);
      } catch { }
    };
    void preloadNextReference();
  }, [certRef, setCertRef, editingDocumentId]);

  const onDateChange = (_e: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) setServiceDate(formatDate(date));
  };

  const onNextDateChange = (_e: DateTimePickerEvent, date?: Date) => {
    setShowNextDatePicker(Platform.OS === 'ios');
    if (date) setNextInspectionDate(formatDate(date));
  };

  const handleSignature = (base64: string) => {
    setCustomerSignature(base64);
    setShowSigPad(false);
  };

  const getNextReference = async () => {
    const {data, error} = await supabase.rpc('get_next_gas_cert_reference', {reserve: true});
    if (error || typeof data !== 'string') throw new Error(error?.message || 'Failed to generate reference.');
    setCertRef(data);
    return data;
  };

  const createDocument = async (reference: string) => {
    if (!userProfile?.company_id) throw new Error('Company profile not found.');

    const pdfData: ServiceRecordPdfData = {
      customerName: customerForm.customerName || '',
      customerCompany: customerForm.customerCompany || '',
      customerAddress: [customerForm.addressLine1, customerForm.addressLine2, customerForm.city, customerForm.postCode].filter(Boolean).join(', '),
      customerEmail: customerForm.email || '',
      customerPhone: customerForm.phone || '',
      propertyAddress,
      appliances,
      finalInfo,
      serviceDate,
      nextInspectionDate,
      renewalReminderEnabled,
      customerSignature,
      certRef: reference,
    };

    const lockedPayload = await buildServiceRecordLockedPayload(pdfData, userProfile.company_id, userProfile.id);

    const customerSnapshot = {
      name: customerForm.customerName || 'Service Customer',
      company_name: customerForm.customerCompany || null,
      address_line_1: customerForm.addressLine1 || null,
      address_line_2: customerForm.addressLine2 || null,
      city: customerForm.city || null,
      postal_code: customerForm.postCode || null,
      phone: customerForm.phone || null,
      email: customerForm.email || null,
      address: [customerForm.addressLine1, customerForm.addressLine2, customerForm.city, customerForm.postCode].filter(Boolean).join(', '),
    };

    if (editingDocumentId) {
      const payloadToSave = oneTimeEmails.length > 0
        ? { ...lockedPayload, oneTimeReminderEmails: oneTimeEmails }
        : lockedPayload;
      const {error: updateError} = await supabase
        .from('documents')
        .update({
          reference,
          expiry_date: nextInspectionDate || null,
          customer_id: customerForm.customerId || null,
          customer_snapshot: customerSnapshot,
          payment_info: JSON.stringify(payloadToSave),
        })
        .eq('id', editingDocumentId);
      if (updateError) throw updateError;
      return {lockedPayload, documentId: editingDocumentId};
    }

    const docNumber = Number(String(Date.now()).slice(-8));
    const insertPayloadToSave = oneTimeEmails.length > 0
      ? { ...lockedPayload, oneTimeReminderEmails: oneTimeEmails }
      : lockedPayload;
    const documentBase = {
      company_id: userProfile.company_id,
      type: 'service_record' as any,
      number: docNumber,
      reference,
      date: new Date().toISOString(),
      expiry_date: nextInspectionDate || null,
      status: 'Sent' as const,
      customer_id: customerForm.customerId || null,
      customer_snapshot: customerSnapshot,
      items: [],
      subtotal: 0,
      discount_percent: 0,
      total: 0,
      notes: 'Gas Service Record (locked snapshot)',
      payment_info: JSON.stringify(insertPayloadToSave),
    };

    const {data: insertedRows, error: saveError} = await supabase
      .from('documents')
      .insert(documentBase)
      .select('id')
      .limit(1);

    if (saveError) {
      // Fallback: if type constraint fails, use quote
      const msg = (saveError.message || '').toLowerCase();
      if (msg.includes('type') || msg.includes('enum') || msg.includes('check constraint')) {
        const {data: fallbackRows, error: fbErr} = await supabase
          .from('documents')
          .insert({...documentBase, type: 'quote' as const})
          .select('id')
          .limit(1);
        if (fbErr) throw fbErr;
        return {lockedPayload, documentId: fallbackRows?.[0]?.id as string};
      }
      throw saveError;
    }

    return {lockedPayload, documentId: insertedRows?.[0]?.id as string};
  };

  const handleComplete = async (action: 'save' | 'email' | 'view') => {
    if (!userProfile?.company_id) {
      Alert.alert('Error', 'Company profile not found.');
      return;
    }
    if (offlineModeEnabled) {
      Alert.alert('Offline Mode', 'Disable Offline Mode to save service records.');
      return;
    }

    setProcessingAction(action);
    try {
      const reference = editingDocumentId && certRef ? certRef : await getNextReference();
      const {lockedPayload, documentId} = await createDocument(reference);
      if (!documentId) throw new Error('Failed to create service record.');

      const savedLabel = editingDocumentId ? 'Updated' : 'Saved';

      if (action === 'save') {
        Alert.alert(savedLabel, `Service Record ${reference} was ${editingDocumentId ? 'updated' : 'saved'}.`, [
          {text: 'Done', onPress: () => {resetServiceRecord(); router.replace(`/(app)/documents/${documentId}` as any);}},
        ]);
        return;
      }

      if (action === 'view') {
        const pdfUrl = await generateServiceRecordPdfUrl(lockedPayload, userProfile.company_id);
        resetServiceRecord();
        router.replace(`/(app)/documents/${documentId}` as any);
        await WebBrowser.openBrowserAsync(pdfUrl);
        return;
      }

      // Email
      const recipients = sanitizeRecipients([customerForm.email || '']);
      if (!recipients.length) {
        Alert.alert('No Email Found', 'Add a customer email before using Save & Send.');
        return;
      }

      const pdfBase64 = await generateServiceRecordPdfBase64FromPayload(lockedPayload, userProfile.company_id);

      await sendCp12CertificateEmail({
        to: recipients,
        certRef: reference,
        propertyAddress,
        inspectionDate: serviceDate,
        nextDueDate: nextInspectionDate || '',
        landlordName: customerForm.customerName,
        tenantName: '',
        pdfBase64,
      });

      await generateServiceRecordPdfFromPayload(lockedPayload, 'share', userProfile.company_id);

      Alert.alert(
        `${savedLabel} & Sent ✓`,
        `Service Record ${reference} was ${editingDocumentId ? 'updated' : 'saved'} and emailed to ${recipients.join(', ')}.`,
        [{text: 'Done', onPress: () => {resetServiceRecord(); router.replace(`/(app)/documents/${documentId}` as any);}}],
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to generate service record.');
    } finally {
      setProcessingAction(null);
    }
  };

  return (
    <View style={[s.root, {paddingTop: insets.top}]}>
      <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={{paddingBottom: TAB_BAR_HEIGHT + 100}}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeIn.duration(300)} style={s.header}>
            <TouchableOpacity
              style={[s.backBtn, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={20} color={ACCENT} />
            </TouchableOpacity>
            <View>
              <Text style={[s.title, {color: theme.text.title}]}>{editingDocumentId ? 'Edit & Update' : 'Review & Sign'}</Text>
              <Text style={[s.subtitleText, {color: theme.text.muted}]}>
                {editingDocumentId ? 'Editing service record' : 'Step 3 of 3'}
              </Text>
            </View>
          </Animated.View>

          <StepIndicator current={3} />

          {/* ── Summary ── */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={[s.summaryBanner, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
            <View style={s.summaryRow}>
              <Ionicons name="person" size={14} color={ACCENT} />
              <Text style={[s.summaryText, {color: theme.text.bodyLight}]}>{customerForm.customerName || 'Customer'}</Text>
            </View>
            <View style={s.summaryRow}>
              <Ionicons name="home" size={14} color={UI.status.pending} />
              <Text style={[s.summaryText, {color: theme.text.bodyLight}]} numberOfLines={1}>{propertyAddress || '–'}</Text>
            </View>
            <View style={s.summaryRow}>
              <Ionicons name="construct" size={14} color={ACCENT} />
              <Text style={[s.summaryText, {color: theme.text.bodyLight}]}>
                {appliances.length} appliance{appliances.length !== 1 ? 's' : ''} serviced
              </Text>
            </View>
          </Animated.View>

          {/* ── Service Date ── */}
          <Animated.View entering={FadeInDown.delay(120).duration(400)} style={[s.card, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
            <View style={s.sectionHeader}>
              <View style={s.sectionIconWrap}><Ionicons name="calendar-outline" size={16} color={ACCENT} /></View>
              <Text style={[s.sectionTitle, {color: theme.text.title}]}>Service Date</Text>
            </View>

            <View style={s.inputContainer}>
              <Text style={[s.inputLabel, {color: theme.text.bodyLight}]}>Date of Service</Text>
              <TouchableOpacity
                style={[s.inputWrapper, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}
                activeOpacity={0.7}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={18} color={ACCENT} style={{marginRight: 10}} />
                <Text style={[s.inputValue, {color: theme.text.title}]}>{serviceDate}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={parseDate(serviceDate)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange}
                  textColor="#000000"
                  themeVariant="light"
                />
              )}
            </View>
          </Animated.View>

          {/* ── Next Inspection Date ── */}
          <Animated.View entering={FadeInDown.delay(140).duration(400)} style={[s.card, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
            <View style={s.sectionHeader}>
              <View style={s.sectionIconWrap}><Ionicons name="calendar-clear-outline" size={16} color={ACCENT} /></View>
              <Text style={[s.sectionTitle, {color: theme.text.title}]}>Next Inspection Date</Text>
            </View>

            <View style={s.inputContainer}>
              <Text style={[s.inputLabel, {color: theme.text.bodyLight}]}>Due Date</Text>
              <TouchableOpacity
                style={[s.inputWrapper, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}
                activeOpacity={0.7}
                onPress={() => setShowNextDatePicker(true)}
              >
                <Ionicons name="calendar" size={18} color={ACCENT} style={{marginRight: 10}} />
                <Text style={[s.inputValue, {color: theme.text.title}]}>{nextInspectionDate || 'Select date'}</Text>
              </TouchableOpacity>
              {showNextDatePicker && (
                <DateTimePicker
                  value={parseDate(nextInspectionDate || serviceDate)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onNextDateChange}
                  textColor="#000000"
                  themeVariant="light"
                />
              )}
            </View>
          </Animated.View>

          {/* ── Cert ref ── */}
          <Animated.View entering={FadeInDown.delay(160).duration(400)} style={[s.card, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
            <View style={s.sectionHeader}>
              <View style={s.sectionIconWrap}><Ionicons name="document-text-outline" size={16} color={ACCENT} /></View>
              <Text style={[s.sectionTitle, {color: theme.text.title}]}>Reference</Text>
            </View>

            <View style={s.inputContainer}>
              <Text style={[s.inputLabel, {color: theme.text.bodyLight}]}>Record Reference</Text>
              <View style={[s.inputWrapper, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}>
                <Ionicons name="barcode-outline" size={18} color={ACCENT} style={{marginRight: 10}} />
                <Text style={[s.inputValue, {color: theme.text.title}]}>{certRef || 'REF-0001'}</Text>
              </View>
            </View>
          </Animated.View>

          {/* ── Signature ── */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={[s.card, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
            <View style={s.sectionHeader}>
              <View style={s.sectionIconWrap}><Ionicons name="pencil-outline" size={16} color={ACCENT} /></View>
              <Text style={[s.sectionTitle, {color: theme.text.title}]}>Customer Signature</Text>
            </View>

            {customerSignature ? (
              <View style={[s.signaturePreview, isDark && {borderColor: theme.surface.border}]}>
                <Image source={{uri: customerSignature}} style={s.signatureImage} resizeMode="contain" />
                <TouchableOpacity
                  style={s.resignBtn}
                  onPress={() => {setCustomerSignature(''); setShowSigPad(true);}}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh" size={16} color={ACCENT} />
                  <Text style={[s.resignText, {color: ACCENT}]}>Re-sign</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={s.signatureBtn} onPress={() => setShowSigPad(true)} activeOpacity={0.7}>
                <View style={s.signatureBtnInner}>
                  <Ionicons name="pencil" size={22} color={ACCENT} />
                  <Text style={[s.signatureBtnText, {color: ACCENT}]}>Tap to Capture Signature</Text>
                </View>
              </TouchableOpacity>
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(220).duration(400)}>
            <ReminderSection
              enabled={renewalReminderEnabled}
              onToggle={setRenewalReminderEnabled}
              savedEmails={savedEmails}
              onOneTimeEmailsChange={setOneTimeEmails}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Bottom bar ── */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(400)}
        style={[s.bottomBar, {bottom: TAB_BAR_HEIGHT}, isDark && {backgroundColor: 'rgba(28,28,30,0.97)', borderTopColor: 'rgba(255,255,255,0.08)'}]}
      >
        <View style={s.bottomBtnRow}>
          <TouchableOpacity
            style={s.saveCp12Btn}
            activeOpacity={0.85}
            onPress={() => handleComplete('save')}
            disabled={!!processingAction}
          >
            {processingAction === 'save' ? (
              <ActivityIndicator color={ACCENT} size="small" />
            ) : (
              <>
                <Ionicons name={editingDocumentId ? 'checkmark-circle-outline' : 'save-outline'} size={20} color={ACCENT} />
                <Text style={[s.saveCp12Text, {color: ACCENT}]}>{editingDocumentId ? 'Update' : 'Save'}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.shareBtn}
            activeOpacity={0.85}
            onPress={() => handleComplete('email')}
            disabled={!!processingAction}
          >
            <LinearGradient
              colors={processingAction === 'email' ? [UI.text.muted, UI.text.muted] as readonly [string, string] : ['#059669', '#10B981'] as readonly [string, string]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={s.shareGradient}
            >
              {processingAction === 'email' ? (
                <ActivityIndicator color={UI.text.white} size="small" />
              ) : (
                <>
                  <Ionicons name="mail-outline" size={20} color={UI.text.white} />
                  <Text style={s.shareText}>Save & Send</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[s.viewBtn, !!processingAction && {opacity: 0.6}]}
          activeOpacity={0.85}
          onPress={() => handleComplete('view')}
          disabled={!!processingAction}
        >
          {processingAction === 'view' ? (
            <ActivityIndicator color={ACCENT} size="small" />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={18} color={ACCENT} />
              <Text style={[s.viewText, {color: ACCENT}]}>View Service Record</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>

      <SignaturePad visible={showSigPad} onClose={() => setShowSigPad(false)} onOK={handleSignature} />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {flex: 1},
  scroll: {paddingHorizontal: 20},

  header: {flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12},
  backBtn: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: GLASS_BG, borderWidth: 1, borderColor: GLASS_BORDER,
    justifyContent: 'center', alignItems: 'center',
  },
  title: {fontSize: 24, fontWeight: '800', color: UI.text.title, letterSpacing: -0.5},
  subtitleText: {fontSize: 13, color: UI.text.muted, fontWeight: '500', marginTop: 2},

  stepRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 24,
    paddingVertical: 14, backgroundColor: GLASS_BG, borderRadius: 16,
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  stepItem: {alignItems: 'center', gap: 6},
  stepDot: {width: 28, height: 28, borderRadius: 14, backgroundColor: UI.surface.divider, justifyContent: 'center', alignItems: 'center'},
  stepDotActive: {backgroundColor: ACCENT},
  stepDotDone: {backgroundColor: UI.status.complete},
  stepDotText: {fontSize: 12, fontWeight: '700', color: UI.text.muted},
  stepLabel: {fontSize: 11, fontWeight: '600', color: UI.text.muted},

  summaryBanner: {
    backgroundColor: GLASS_BG, borderRadius: 16, borderWidth: 1, borderColor: GLASS_BORDER,
    padding: 14, marginBottom: 20, gap: 8,
  },
  summaryRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  summaryText: {fontSize: 13, fontWeight: '600', flex: 1},

  card: {
    backgroundColor: GLASS_BG, borderRadius: 18, borderWidth: 1, borderColor: GLASS_BORDER,
    padding: 18, marginBottom: 16,
    shadowColor: UI.text.muted, shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },

  sectionHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16},
  sectionIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: {fontSize: 16, fontWeight: '700', color: UI.text.title},

  inputContainer: {marginBottom: 14},
  inputLabel: {fontSize: 13, fontWeight: '600', color: UI.text.bodyLight, marginBottom: 6},
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: UI.surface.base, borderRadius: 12, borderWidth: 1, borderColor: UI.surface.divider,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  inputValue: {fontSize: 15, fontWeight: '500'},

  signaturePreview: {
    borderRadius: 12, borderWidth: 1, borderColor: UI.surface.divider,
    backgroundColor: '#fff', padding: 12, alignItems: 'center',
  },
  signatureImage: {width: '100%', height: 200, borderRadius: 8},
  resignBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 10, backgroundColor: '#ECFDF5',
  },
  resignText: {fontSize: 13, fontWeight: '600'},
  signatureBtn: {borderRadius: 14, overflow: 'hidden'},
  signatureBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 32, gap: 10, borderRadius: 14,
    borderWidth: 2, borderColor: '#A7F3D0', borderStyle: 'dashed',
    backgroundColor: '#ECFDF5',
  },
  signatureBtnText: {fontSize: 15, fontWeight: '600'},

  emailList: {gap: 8},
  emailChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0',
  },
  emailChipText: {fontSize: 14, fontWeight: '600'},
  noEmailText: {fontSize: 13, lineHeight: 18},
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: UI.surface.base,
    borderWidth: 1,
    borderColor: UI.surface.divider,
  },
  reminderCopy: {
    flex: 1,
    gap: 4,
  },
  reminderTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  reminderDescription: {
    fontSize: 12,
    lineHeight: 17,
  },

  bottomBar: {
    position: 'absolute', left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: 'rgba(248,250,252,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  bottomBtnRow: {flexDirection: 'row', gap: 10},
  saveCp12Btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 16, borderRadius: 16,
    backgroundColor: '#ECFDF5', borderWidth: 1.5, borderColor: '#A7F3D0',
  },
  saveCp12Text: {fontSize: 15, fontWeight: '700'},
  shareBtn: {flex: 1, borderRadius: 16, overflow: 'hidden'},
  shareGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 8,
  },
  shareText: {fontSize: 15, fontWeight: '700', color: UI.text.white},

  viewBtn: {
    marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0',
  },
  viewText: {fontSize: 14, fontWeight: '700'},
});
