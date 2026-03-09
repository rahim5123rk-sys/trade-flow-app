import {Ionicons} from '@expo/vector-icons';
import DateTimePicker, {DateTimePickerEvent} from '@react-native-community/datetimepicker';
import {LinearGradient} from 'expo-linear-gradient';
import {router} from 'expo-router';
import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {SignaturePad} from '../../../../components/SignaturePad';
import {FormHeader} from '../../../../components/forms/FormHeader';
import {FormStepIndicator} from '../../../../components/forms/FormStepIndicator';
import {Button} from '../../../../components/ui/Button';
import {useAuth} from '../../../../src/context/AuthContext';
import {useOfflineMode} from '../../../../src/context/OfflineContext';
import {useAppTheme} from '../../../../src/context/ThemeContext';
import {useWarningNotice} from '../../../../src/context/WarningNoticeContext';
import {completeFormAction, getNextCertReference} from '../../../../src/services/formDocumentService';
import {WarningNoticePdfData} from '../../../../src/services/warningNoticePdfGenerator';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;
const STEPS = ['Details', 'Hazard', 'Review'];
const parseDate = (ddmmyyyy: string) => {const [dd, mm, yyyy] = ddmmyyyy.split('/'); return new Date(Number(yyyy), Number(mm) - 1, Number(dd));};
const formatDate = (date: Date) => date.toLocaleDateString('en-GB');

export default function WarningNoticeReviewSignScreen() {
  const insets = useSafeAreaInsets();
  const {theme, isDark} = useAppTheme();
  const {userProfile} = useAuth();
  const {offlineModeEnabled} = useOfflineMode();
  const {customerForm, propertyAddress, appliances, finalInfo, issueDate, setIssueDate, customerSignature, setCustomerSignature, certRef, setCertRef, resetWarningNotice, editingDocumentId} = useWarningNotice();
  const [processingAction, setProcessingAction] = useState<null | 'save' | 'email' | 'view'>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSigPad, setShowSigPad] = useState(false);

  useEffect(() => {const preload = async () => {if (certRef || editingDocumentId) return; try {setCertRef(await getNextCertReference(false));} catch { } }; void preload();}, [certRef, editingDocumentId, setCertRef]);

  const appliance = appliances[0];
  const canSubmit = useMemo(() => !!appliance && !!customerForm.customerName.trim(), [appliance, customerForm.customerName]);
  const pdfData: WarningNoticePdfData = {customerName: customerForm.customerName || '', customerCompany: customerForm.customerCompany || '', customerAddress: [customerForm.addressLine1, customerForm.addressLine2, customerForm.city, customerForm.postCode].filter(Boolean).join(', '), customerEmail: customerForm.email || '', customerPhone: customerForm.phone || '', propertyAddress, appliances, finalInfo, issueDate, customerSignature, certRef};
  const customerSnapshot = {name: customerForm.customerName || 'Customer', company_name: customerForm.customerCompany || null, address_line_1: customerForm.addressLine1 || null, address_line_2: customerForm.addressLine2 || null, city: customerForm.city || null, postal_code: customerForm.postCode || null, phone: customerForm.phone || null, email: customerForm.email || null, address: [customerForm.addressLine1, customerForm.addressLine2, customerForm.city, customerForm.postCode].filter(Boolean).join(', ')};

  const handleComplete = async (action: 'save' | 'email' | 'view') => {
    if (!userProfile?.company_id) return Alert.alert('Error', 'Company profile not found.');
    if (offlineModeEnabled) return Alert.alert('Offline Mode', 'Disable Offline Mode to save warning notices.');
    if (!canSubmit) return Alert.alert('Missing Details', 'Complete the appliance details before continuing.');
    setProcessingAction(action);
    try {
      const documentId = await completeFormAction({action, config: {kind: 'warning_notice', documentType: 'warning_notice', label: 'Warning Notice'}, companyId: userProfile.company_id, userId: userProfile.id, certRef, pdfData, customerSnapshot, customerId: customerForm.customerId || null, editingDocumentId, emailRecipients: [customerForm.email || ''], emailContext: {propertyAddress, inspectionDate: issueDate, nextDueDate: '', landlordName: customerForm.customerName, tenantName: ''}, onReset: resetWarningNotice, setCertRef});
      Alert.alert(editingDocumentId ? 'Updated' : 'Saved', action === 'email' ? `Warning notice ${certRef || 'record'} was ${editingDocumentId ? 'updated' : 'saved'} and emailed.` : `Warning notice ${certRef || 'record'} was ${editingDocumentId ? 'updated' : 'saved'}.`, [{text: 'Done', onPress: () => {resetWarningNotice(); router.replace(`/(app)/documents/${documentId}` as any);}}]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to save warning notice.');
    } finally {setProcessingAction(null);}
  };

  return <View style={styles.root}><LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} /><KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={{paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: TAB_BAR_HEIGHT + 140}} showsVerticalScrollIndicator={false}><FormHeader title={editingDocumentId ? 'Edit Warning Notice' : 'Review & Sign'} subtitle={editingDocumentId ? 'Update the saved notice' : 'Step 3 of 3'} /><FormStepIndicator steps={STEPS} current={3} />
    <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, borderColor: theme.surface.border}]}><Text style={[styles.cardTitle, {color: theme.text.title}]}>Summary</Text><View style={styles.summaryRow}><Ionicons name="person-outline" size={16} color="#DC2626" /><Text style={[styles.summaryText, {color: theme.text.body}]}>{customerForm.customerName || 'Customer'}</Text></View><View style={styles.summaryRow}><Ionicons name="home-outline" size={16} color="#DC2626" /><Text style={[styles.summaryText, {color: theme.text.body}]}>{propertyAddress || 'No property address'}</Text></View><View style={styles.summaryRow}><Ionicons name="warning-outline" size={16} color="#DC2626" /><Text style={[styles.summaryText, {color: theme.text.body}]}>{appliance ? `${appliance.warningClassification || 'Warning'} • ${appliance.make} ${appliance.model}` : 'No appliance saved'}</Text></View><View style={styles.summaryRow}><Ionicons name="bookmark-outline" size={16} color="#DC2626" /><Text style={[styles.summaryText, {color: theme.text.body}]}>{certRef || 'Reference will be generated'}</Text></View></View>
    <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, borderColor: theme.surface.border}]}><Text style={[styles.cardTitle, {color: theme.text.title}]}>Issue Date</Text><TouchableOpacity style={[styles.dateButton, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={() => setShowDatePicker(true)}><Ionicons name="calendar-outline" size={18} color="#DC2626" /><Text style={[styles.dateText, {color: theme.text.title}]}>{issueDate}</Text></TouchableOpacity>{showDatePicker ? <DateTimePicker value={parseDate(issueDate)} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_e: DateTimePickerEvent, date?: Date) => {setShowDatePicker(Platform.OS === 'ios'); if (date) setIssueDate(formatDate(date));}} /> : null}</View>
    <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, borderColor: theme.surface.border}]}><Text style={[styles.cardTitle, {color: theme.text.title}]}>Customer Signature</Text>{customerSignature ? <Image source={{uri: customerSignature}} style={styles.signaturePreview} resizeMode="contain" /> : <Text style={[styles.helperText, {color: theme.text.muted}]}>Capture the customer signature before saving.</Text>}<Button title={customerSignature ? 'Retake Signature' : 'Capture Signature'} onPress={() => setShowSigPad(true)} variant="secondary" icon="create-outline" /></View>
  </ScrollView><View style={[styles.bottomBar, isDark && {backgroundColor: theme.surface.base, borderTopColor: theme.surface.border}]}><View style={styles.actionsRow}><Button title="Save" onPress={() => handleComplete('save')} loading={processingAction === 'save'} disabled={!canSubmit} style={{flex: 1}} /><Button title="View" onPress={() => handleComplete('view')} variant="secondary" loading={processingAction === 'view'} disabled={!canSubmit} style={{flex: 1}} /></View><Button title="Save & Send" onPress={() => handleComplete('email')} variant="success" loading={processingAction === 'email'} disabled={!canSubmit} icon="mail-outline" /></View></KeyboardAvoidingView>{showSigPad ? <SignaturePad visible={showSigPad} onClose={() => setShowSigPad(false)} onOK={(base64) => {setCustomerSignature(base64); setShowSigPad(false);}} /> : null}{processingAction ? <View style={styles.loadingOverlay}><ActivityIndicator size="large" color="#FFFFFF" /></View> : null}</View>;
}

const styles = StyleSheet.create({root: {flex: 1}, card: {backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginBottom: 16}, cardTitle: {fontSize: 18, fontWeight: '800', marginBottom: 12}, summaryRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10}, summaryText: {fontSize: 14, fontWeight: '500', flex: 1}, dateButton: {minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12}, dateText: {fontSize: 15, fontWeight: '600'}, helperText: {fontSize: 13, marginBottom: 12}, signaturePreview: {height: 120, width: '100%', marginBottom: 12}, bottomBar: {position: 'absolute', left: 0, right: 0, bottom: TAB_BAR_HEIGHT, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, backgroundColor: 'rgba(255,255,255,0.96)', borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 10}, actionsRow: {flexDirection: 'row', gap: 10}, loadingOverlay: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'center', alignItems: 'center'}});
