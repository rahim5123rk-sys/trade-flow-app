import {Ionicons} from '@expo/vector-icons';
import DateTimePicker, {DateTimePickerEvent} from '@react-native-community/datetimepicker';
import {LinearGradient} from 'expo-linear-gradient';
import {router} from 'expo-router';
import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import EmailRecipientsList from '../../../../components/EmailRecipientsList';
import {SignaturePad} from '../../../../components/SignaturePad';
import {FormHeader} from '../../../../components/forms/FormHeader';
import {FormStepIndicator} from '../../../../components/forms/FormStepIndicator';
import {upsertSiteAddress} from '../../../../components/forms/SiteAddressPicker';
import {UI} from '../../../../constants/theme';
import {useAuth} from '../../../../src/context/AuthContext';
import {useOfflineMode} from '../../../../src/context/OfflineContext';
import {useAppTheme} from '../../../../src/context/ThemeContext';
import {useWarningNotice} from '../../../../src/context/WarningNoticeContext';
import {sanitizeRecipients} from '../../../../src/services/email';
import {buildCustomerAddress, buildCustomerSnapshot, completeFormAction, getNextCertReference} from '../../../../src/services/formDocumentService';
import {WarningNoticePdfData} from '../../../../src/services/warningNoticePdfGenerator';
import {formatGBDate, parseGBDate} from '../../../../src/utils/dates';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;
const STEPS = ['Details', 'Hazard', 'Review'];

export default function WarningNoticeReviewSignScreen() {
  const insets = useSafeAreaInsets();
  const {theme, isDark} = useAppTheme();
  const {userProfile} = useAuth();
  const {offlineModeEnabled} = useOfflineMode();
  const {customerForm, propertyAddress, propertyAddressLine1, propertyAddressLine2, propertyCity, propertyPostCode, appliances, finalInfo, issueDate, setIssueDate, customerSignature, setCustomerSignature, certRef, setCertRef, resetWarningNotice, editingDocumentId} = useWarningNotice();
  const [processingAction, setProcessingAction] = useState<null | 'save' | 'email' | 'view'>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSigPad, setShowSigPad] = useState(false);
  const [additionalSendEmails, setAdditionalSendEmails] = useState<string[]>([]);
  const [defaultSendEmails, setDefaultSendEmails] = useState<string[]>(() =>
    sanitizeRecipients([customerForm.email || ''])
  );

  useEffect(() => {const preload = async () => {if (certRef || editingDocumentId) return; try {setCertRef(await getNextCertReference(false, userProfile?.company_id));} catch { } }; void preload();}, [certRef, editingDocumentId, setCertRef, userProfile?.company_id]);

  const appliance = appliances[0];
  const canSubmit = useMemo(() => !!appliance, [appliance]);
  const customerAddress = buildCustomerAddress(customerForm);
  const pdfData: WarningNoticePdfData = {customerName: customerForm.customerName || '', customerCompany: customerForm.customerCompany || '', customerAddress, customerEmail: customerForm.email || '', customerPhone: customerForm.phone || '', propertyAddress, appliances, finalInfo, issueDate, customerSignature, certRef};
  const customerSnapshot = buildCustomerSnapshot(customerForm);

  const handleComplete = async (action: 'save' | 'email' | 'view') => {
    if (!userProfile?.company_id) return Alert.alert('Error', 'Company profile not found.');
    if (offlineModeEnabled) return Alert.alert('Offline Mode', 'Disable Offline Mode to save warning notices.');
    if (!canSubmit) return Alert.alert('Missing Details', 'Complete the appliance details before continuing.');
    setProcessingAction(action);
    try {
      const documentId = await completeFormAction({action, config: {kind: 'warning_notice', documentType: 'warning_notice', label: 'Warning Notice'}, companyId: userProfile.company_id, userId: userProfile.id, certRef, pdfData, customerSnapshot, customerId: customerForm.customerId || null, editingDocumentId, emailRecipients: sanitizeRecipients([...defaultSendEmails, ...additionalSendEmails]), emailContext: {propertyAddress, inspectionDate: issueDate, nextDueDate: '', landlordName: customerForm.customerName, tenantName: ''}, onReset: resetWarningNotice, setCertRef});
      void upsertSiteAddress(userProfile.company_id, {addressLine1: propertyAddressLine1, addressLine2: propertyAddressLine2, city: propertyCity, postCode: propertyPostCode});
      Alert.alert(editingDocumentId ? 'Updated' : 'Saved', action === 'email' ? `Warning notice ${certRef || 'record'} was ${editingDocumentId ? 'updated' : 'saved'} and emailed.` : `Warning notice ${certRef || 'record'} was ${editingDocumentId ? 'updated' : 'saved'}.`, [{text: 'Done', onPress: () => {resetWarningNotice(); router.replace(`/(app)/documents/${documentId}` as any);}}]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to save warning notice.');
    } finally {setProcessingAction(null);}
  };

  return <View style={styles.root}><LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} /><KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={{paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: TAB_BAR_HEIGHT + 140}} showsVerticalScrollIndicator={false}><FormHeader title={editingDocumentId ? 'Edit Warning Notice' : 'Review & Sign'} subtitle={editingDocumentId ? 'Update the saved notice' : 'Step 3 of 3'} /><FormStepIndicator steps={STEPS} current={3} />
    <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, borderColor: theme.surface.border}]}><Text style={[styles.cardTitle, {color: theme.text.title}]}>Summary</Text><View style={styles.summaryRow}><Ionicons name="person-outline" size={16} color="#DC2626" /><Text style={[styles.summaryText, {color: theme.text.body}]}>{customerForm.customerName || 'Customer'}</Text></View><View style={styles.summaryRow}><Ionicons name="home-outline" size={16} color="#DC2626" /><Text style={[styles.summaryText, {color: theme.text.body}]}>{propertyAddress || 'No property address'}</Text></View><View style={styles.summaryRow}><Ionicons name="warning-outline" size={16} color="#DC2626" /><Text style={[styles.summaryText, {color: theme.text.body}]}>{appliance ? `${appliance.warningClassification || 'Warning'} • ${appliance.make} ${appliance.model}` : 'No appliance saved'}</Text></View><View style={styles.summaryRow}><Ionicons name="bookmark-outline" size={16} color="#DC2626" /><Text style={[styles.summaryText, {color: theme.text.body}]}>{certRef || 'Reference will be generated'}</Text></View></View>
    <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, borderColor: theme.surface.border}]}><Text style={[styles.cardTitle, {color: theme.text.title}]}>Issue Date</Text><TouchableOpacity style={[styles.dateButton, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={() => setShowDatePicker(true)}><Ionicons name="calendar-outline" size={18} color="#EF4444" /><Text style={[styles.dateText, {color: theme.text.title}]}>{issueDate}</Text></TouchableOpacity>{showDatePicker ? <DateTimePicker value={parseGBDate(issueDate)} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_e: DateTimePickerEvent, date?: Date) => {setShowDatePicker(Platform.OS === 'ios'); if (date) setIssueDate(formatGBDate(date));}} /> : null}</View>
    <View style={{marginBottom: 16}}>
      <EmailRecipientsList
        defaultEmails={defaultSendEmails}
        additionalEmails={additionalSendEmails}
        onAdditionalEmailsChange={setAdditionalSendEmails}
        onDefaultEmailsChange={setDefaultSendEmails}
      />
    </View>
    <View style={[styles.card, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
      <View style={styles.sigSectionHeader}>
        <View style={styles.sigIconWrap}>
          <Ionicons name="pencil-outline" size={16} color={theme.brand.primary} />
        </View>
        <Text style={[styles.sigSectionTitle, {color: theme.text.title}]}>Customer Signature</Text>
      </View>

      {customerSignature ? (
        <View style={[styles.sigPreview, isDark && {borderColor: theme.surface.border}]}>
          <Image source={{uri: customerSignature}} style={styles.sigImage} resizeMode="contain" />
          <TouchableOpacity
            style={styles.resignBtn}
            onPress={() => {setCustomerSignature(''); setShowSigPad(true);}}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={16} color={UI.brand.primary} />
            <Text style={styles.resignText}>Re-sign</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.signatureBtn} onPress={() => setShowSigPad(true)} activeOpacity={0.7}>
          <LinearGradient colors={UI.gradients.soft} style={styles.signatureBtnGradient}>
            <Ionicons name="pencil" size={22} color={UI.brand.primary} />
            <Text style={styles.signatureBtnText}>Tap to Capture Signature</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  </ScrollView><View style={[styles.bottomBar, isDark && {backgroundColor: 'rgba(28,28,30,0.97)', borderTopColor: 'rgba(255,255,255,0.08)'}]}>
      <View style={styles.bottomBtnRow}>
        <TouchableOpacity style={styles.saveBtn} activeOpacity={0.85} onPress={() => handleComplete('save')} disabled={!!processingAction}>
          {processingAction === 'save' ? (
            <ActivityIndicator color={UI.brand.primary} size="small" />
          ) : (
            <>
              <Ionicons name={editingDocumentId ? 'checkmark-circle-outline' : 'save-outline'} size={20} color={UI.brand.primary} />
              <Text style={styles.saveBtnText}>{editingDocumentId ? 'Update' : 'Save'}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.sendBtn} activeOpacity={0.85} onPress={() => handleComplete('email')} disabled={!!processingAction}>
          <LinearGradient
            colors={processingAction === 'email' ? [UI.text.muted, UI.text.muted] as readonly [string, string] : UI.gradients.success}
            start={{x: 0, y: 0}} end={{x: 1, y: 0}}
            style={styles.sendBtnGradient}
          >
            {processingAction === 'email' ? (
              <ActivityIndicator color={UI.text.white} size="small" />
            ) : (
              <>
                <Ionicons name="mail-outline" size={20} color={UI.text.white} />
                <Text style={styles.sendBtnText}>Save & Send</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.viewBtn, !!processingAction && {opacity: 0.6}]} activeOpacity={0.85} onPress={() => handleComplete('view')} disabled={!!processingAction}>
        {processingAction === 'view' ? (
          <ActivityIndicator color={UI.brand.primary} size="small" />
        ) : (
          <>
            <Ionicons name="document-text-outline" size={18} color={UI.brand.primary} />
            <Text style={styles.viewBtnText}>View Certificate</Text>
          </>
        )}
      </TouchableOpacity>
    </View></KeyboardAvoidingView>{showSigPad ? <SignaturePad visible={showSigPad} onClose={() => setShowSigPad(false)} onOK={(base64) => {setCustomerSignature(base64); setShowSigPad(false);}} /> : null}{processingAction ? <View style={styles.loadingOverlay}><ActivityIndicator size="large" color="#FFFFFF" /></View> : null}</View>;
}

const styles = StyleSheet.create({
  root: {flex: 1},
  card: {backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginBottom: 16},
  cardTitle: {fontSize: 18, fontWeight: '800', marginBottom: 12},
  summaryRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10},
  summaryText: {fontSize: 14, fontWeight: '500', flex: 1},
  dateButton: {minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12},
  dateText: {fontSize: 15, fontWeight: '600'},
  sigSectionHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16},
  sigIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: UI.surface.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  sigSectionTitle: {fontSize: 16, fontWeight: '700'},
  sigPreview: {
    borderRadius: 12, borderWidth: 1, borderColor: UI.surface.divider,
    backgroundColor: '#fff', padding: 12, alignItems: 'center',
  },
  sigImage: {width: '100%', height: 200, borderRadius: 8},
  resignBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 10, backgroundColor: UI.surface.primaryLight,
  },
  resignText: {fontSize: 13, fontWeight: '600', color: UI.brand.primary},
  signatureBtn: {borderRadius: 14, overflow: 'hidden'},
  signatureBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 32, gap: 10, borderRadius: 14,
    borderWidth: 2, borderColor: '#C7D2FE', borderStyle: 'dashed',
  },
  signatureBtnText: {fontSize: 15, fontWeight: '600', color: UI.brand.primary},
  bottomBar: {position: 'absolute', left: 0, right: 0, bottom: TAB_BAR_HEIGHT, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, backgroundColor: 'rgba(255,255,255,0.96)', borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 10},
  bottomBtnRow: {flexDirection: 'row', gap: 10},
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 16, borderRadius: 16,
    backgroundColor: UI.surface.primaryLight, borderWidth: 1.5, borderColor: '#C7D2FE',
  },
  saveBtnText: {fontSize: 15, fontWeight: '700', color: UI.brand.primary},
  sendBtn: {flex: 1, borderRadius: 16, overflow: 'hidden'},
  sendBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 8,
  },
  sendBtnText: {fontSize: 15, fontWeight: '700', color: UI.text.white},
  viewBtn: {
    marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
    backgroundColor: UI.surface.primaryLight, borderWidth: 1, borderColor: '#C7D2FE',
  },
  viewBtnText: {fontSize: 14, fontWeight: '700', color: UI.brand.primary},
  loadingOverlay: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'center', alignItems: 'center'},
});
