// ============================================
// FILE: app/(app)/documents/[id].tsx
// View/manage a single quote, invoice or gas form
// ============================================

import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router, useLocalSearchParams} from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors, UI} from '../../../../constants/theme';
import {supabase} from '../../../../src/config/supabase';
import {useAuth} from '../../../../src/context/AuthContext';
import {useOfflineMode} from '../../../../src/context/OfflineContext';
import {useAppTheme} from '../../../../src/context/ThemeContext';
import {generateDocument, generateDocumentBase64, generateDocumentUrl} from '../../../../src/services/DocumentGenerator';
import type {CP12LockedPayload} from '../../../../src/services/cp12PdfGenerator';
import {sanitizeRecipients, sendCp12CertificateEmail, createQuoteResponseToken} from '../../../../src/services/email';
import type {BreakdownReportLockedPayload} from '../../../../src/services/breakdownReportPdfGenerator';
import type {CommissioningLockedPayload} from '../../../../src/services/commissioningPdfGenerator';
import type {DecommissioningLockedPayload} from '../../../../src/services/decommissioningPdfGenerator';
import type {InstallationCertLockedPayload} from '../../../../src/services/installationCertPdfGenerator';
import {stripHtml} from '../../../../components/RichTextLineInput';
import {
  generateRegisteredPdf,
  generateRegisteredPdfBase64,
  generateRegisteredPdfUrl,
  parseLockedPayload,
} from '../../../../src/services/pdf';
import type {ServiceRecordLockedPayload} from '../../../../src/services/serviceRecordPdfGenerator';
import type {WarningNoticeLockedPayload} from '../../../../src/services/warningNoticePdfGenerator';
import {Document} from '../../../../src/types';
import EmailRecipientsList from '../../../../components/EmailRecipientsList';
import GasFormDetails from '../../../../components/documents/GasFormDetails';
import {styles} from '../../../../components/documents/DocumentDetailStyles';
import {formatDisplayDate, duplicateDocument, editDocument} from '../../../../src/services/documentActions';

const INVOICE_STATUSES = ['Draft', 'Sent', 'Unpaid', 'Paid', 'Overdue'];
const QUOTE_STATUSES = ['Draft', 'Sent', 'Accepted', 'Declined'];

const STATUS_COLORS: Record<string, {color: string; bg: string}> = {
  Draft: {color: UI.text.muted, bg: UI.surface.elevated},
  Sent: {color: UI.brand.accent, bg: '#eff6ff'},
  Accepted: {color: '#15803d', bg: '#f0fdf4'},
  Declined: {color: UI.brand.danger, bg: '#fef2f2'},
  Unpaid: {color: '#c2410c', bg: '#fff7ed'},
  Paid: {color: '#047857', bg: '#f0fdf4'},
  Overdue: {color: UI.brand.danger, bg: '#fef2f2'},
};

export default function DocumentDetailScreen() {
  const {id} = useLocalSearchParams<{id: string}>();
  const {userProfile} = useAuth();
  const insets = useSafeAreaInsets();
  const {offlineModeEnabled} = useOfflineMode();
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  const [oneTimeEmails, setOneTimeEmails] = useState<string[]>([]);
  const [hasUnsavedEmails, setHasUnsavedEmails] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [additionalSendEmails, setAdditionalSendEmails] = useState<string[]>([]);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const {theme, isDark} = useAppTheme();

  useEffect(() => {
    if (id) fetchDocument();
    if (id) fetchEmailStatus();
  }, [id]);

  useEffect(() => {
    const payload = parseLockedPayload(doc?.payment_info);
    const existing = (payload as any)?.oneTimeReminderEmails;
    if (Array.isArray(existing) && existing.length > 0) {
      setOneTimeEmails(existing);
    } else {
      setOneTimeEmails([]);
    }
  }, [doc?.id]);

  const fetchDocument = async () => {
    const {data, error} = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();
    if (data) setDoc(data as Document);
    if (error) Alert.alert('Error', 'Could not load document.');
    setLoading(false);
  };

  const fetchEmailStatus = async () => {
    if (!id) return;
    const {data} = await supabase
      .from('email_events')
      .select('status')
      .eq('document_id', id)
      .order('updated_at', {ascending: false})
      .limit(1)
      .maybeSingle();
    if (data?.status) setEmailStatus(data.status);
  };

  const resolveCustomerId = async (currentId: string | null | undefined, name: string) => {
    if (currentId) return currentId;
    if (!name || !userProfile?.company_id) return null;
    try {
      const {data} = await supabase
        .from('customers')
        .select('id')
        .eq('company_id', userProfile.company_id)
        .ilike('name', name)
        .limit(1)
        .maybeSingle();
      return data?.id || null;
    } catch {
      return null;
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!doc) return;
    if (offlineModeEnabled) {
      Alert.alert('Offline Mode', 'Disable Offline Mode to update status.');
      return;
    }
    setUpdating(true);
    const {error} = await supabase
      .from('documents')
      .update({status: newStatus})
      .eq('id', doc.id);
    if (!error) setDoc({...doc, status: newStatus as any});
    else Alert.alert('Error', 'Could not update status.');
    setUpdating(false);
  };

  // ─── Build doc data for PDF generation ──────────────────────

  const buildDocData = () => {
    if (!doc) return null;
    const regenType: 'invoice' | 'quote' =
      doc.type === 'invoice' ? 'invoice' : 'quote';
    return {
      type: regenType,
      number: doc.number,
      reference: doc.reference,
      date: new Date(doc.date).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'}),
      expiryDate: doc.expiry_date || '',
      status: doc.status,
      customerName: doc.customer_snapshot?.name || '',
      customerCompany: doc.customer_snapshot?.company_name,
      customerAddress1: doc.customer_snapshot?.address_line_1 || '',
      customerAddress2: doc.customer_snapshot?.address_line_2 || undefined,
      customerCity: doc.customer_snapshot?.city || '',
      customerPostcode: doc.customer_snapshot?.postal_code || '',
      customerEmail: doc.customer_snapshot?.email || undefined,
      customerPhone: doc.customer_snapshot?.phone || undefined,
      jobAddress1: doc.job_address?.address_line_1 || doc.customer_snapshot?.address_line_1 || '',
      jobAddress2: doc.job_address?.address_line_2 || doc.customer_snapshot?.address_line_2 || undefined,
      jobCity: doc.job_address?.city || doc.customer_snapshot?.city || '',
      jobPostcode: doc.job_address?.postcode || doc.customer_snapshot?.postal_code || '',
      items: doc.items || [],
      discountPercent: doc.discount_percent || 0,
      partialPayment: 0,
      notes: doc.notes,
      paymentInfo: doc.payment_info,
    };
  };


  // ─── Share PDF ──────────────────────────────────────────────

  const handleShare = async () => {
    if (!doc || !userProfile?.company_id) return;
    setSharing(true);
    try {
      const payload = parseLockedPayload(doc.payment_info);
      if (payload) {
        await generateRegisteredPdf(payload, 'share', userProfile.company_id, doc.reference);
      } else {
        const docData = buildDocData();
        if (docData) await generateDocument(docData, userProfile.company_id, 'share');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to share PDF.');
    }
    setSharing(false);
  };

  const handleViewCertificate = async () => {
    if (!doc || !userProfile?.company_id) return;
    setViewing(true);
    try {
      const payload = parseLockedPayload(doc.payment_info);
      if (!payload) throw new Error('No gas form payload found');
      const pdfUrl = await generateRegisteredPdfUrl(payload, userProfile.company_id, doc.reference || '');
      await WebBrowser.openBrowserAsync(pdfUrl);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to open document view.');
    }
    setViewing(false);
  };

  const handleViewDocument = async () => {
    if (!doc || !userProfile?.company_id) return;
    const docData = buildDocData();
    if (!docData) return;
    setViewing(true);
    try {
      const pdfUrl = await generateDocumentUrl(docData, userProfile.company_id);
      await WebBrowser.openBrowserAsync(pdfUrl);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to open document view.');
    }
    setViewing(false);
  };

  const handleReminderToggle = async (enabled: boolean) => {
    if (!doc) return;
    if (offlineModeEnabled) {
      Alert.alert('Offline Mode', 'Disable Offline Mode to update renewal reminders.');
      return;
    }

    const payload = parseLockedPayload(doc.payment_info);
    if (!payload || (payload.kind !== 'cp12' && payload.kind !== 'service_record')) {
      Alert.alert('Unavailable', 'Renewal reminders are only available for gas certificates and service records.');
      return;
    }

    setSavingReminder(true);
    try {
      const nextPayload = {
        ...payload,
        pdfData: {
          ...(payload as any).pdfData,
          renewalReminderEnabled: enabled,
        },
      };

      const {error} = await supabase
        .from('documents')
        .update({payment_info: JSON.stringify(nextPayload)})
        .eq('id', doc.id);

      if (error) throw error;

      setDoc({
        ...doc,
        payment_info: JSON.stringify(nextPayload),
      });
    } catch (error: any) {
      Alert.alert('Reminder Error', error?.message || 'Could not update renewal reminder.');
    } finally {
      setSavingReminder(false);
    }
  };

  const handleSaveOneTimeEmails = async () => {
    if (!doc) return;
    const currentPayload = parseLockedPayload(doc.payment_info) as Record<string, unknown> | null;
    if (!currentPayload) return;

    const updated = oneTimeEmails.length > 0
      ? { ...currentPayload, oneTimeReminderEmails: oneTimeEmails }
      : (() => { const p = { ...currentPayload }; delete p.oneTimeReminderEmails; return p; })();

    const { error } = await supabase
      .from('documents')
      .update({ payment_info: JSON.stringify(updated) })
      .eq('id', doc.id);

    if (!error) {
      setDoc({ ...doc, payment_info: JSON.stringify(updated) });
      setHasUnsavedEmails(false);
    } else {
      Alert.alert('Error', 'Could not save emails.');
    }
  };

  const openSendEmailModal = () => {
    if (!doc) return;
    const payload = parseLockedPayload(doc.payment_info);

    // For CP12, include landlord + tenant emails; for all others, use customer snapshot
    const cp12P = payload?.kind === 'cp12' ? payload as CP12LockedPayload : null;
    const emailCandidates = cp12P
      ? [cp12P.pdfData.landlordEmail || '', cp12P.pdfData.tenantEmail || '', doc.customer_snapshot?.email || '', ...additionalSendEmails]
      : [doc.customer_snapshot?.email || '', ...additionalSendEmails];

    const recipients = sanitizeRecipients(emailCandidates);
    if (!recipients.length) {
      Alert.alert('No Email Found', 'No valid email found for this document. Add a customer email first.');
      return;
    }

    const typeLabel = doc.type === 'invoice' ? 'Invoice' : doc.type === 'quote' ? 'Quote' : null;
    const defaultSubject = cp12P
      ? `Landlord Gas Safety Record for ${cp12P.pdfData.propertyAddress || doc.customer_snapshot?.address || 'Property'}`
      : typeLabel
        ? `${typeLabel} ${doc.reference || `#${String(doc.number).padStart(4, '0')}`} — ${doc.customer_snapshot?.name || 'Customer'}`
        : `${doc.reference || 'Service Record'} — ${doc.customer_snapshot?.name || 'Customer'}`;
    setEmailSubject(defaultSubject.trim());
    setAdditionalSendEmails([]);
    setShowEmailModal(true);
  };

  const handleSendEmail = async () => {
    if (!doc || !userProfile?.company_id) return;
    if (offlineModeEnabled) {
      Alert.alert('Offline Mode', 'Disable Offline Mode to send emails.');
      return;
    }

    const payload = parseLockedPayload(doc.payment_info);
    const cp12P = payload?.kind === 'cp12' ? payload as CP12LockedPayload : null;
    const emailCandidates = cp12P
      ? [cp12P.pdfData.landlordEmail || '', cp12P.pdfData.tenantEmail || '', doc.customer_snapshot?.email || '', ...additionalSendEmails]
      : [doc.customer_snapshot?.email || '', ...additionalSendEmails];

    const recipients = sanitizeRecipients(emailCandidates);
    if (!recipients.length) {
      Alert.alert('No Email Found', 'No valid email found for this document.');
      return;
    }

    setSendingEmail(true);
    try {
      const formLabelMap: Record<string, string> = {
        cp12: 'Gas Safety Certificate',
        service_record: 'Service Record',
        commissioning: 'Commissioning Certificate',
        decommissioning: 'Decommissioning Certificate',
        warning_notice: 'Warning Notice',
        breakdown_report: 'Breakdown Report',
        installation_cert: 'Installation Certificate',
        invoice: 'Invoice',
        quote: 'Quote',
      };

      let pdfBase64: string;
      if (payload) {
        // Gas forms — use locked payload registry
        pdfBase64 = await generateRegisteredPdfBase64(payload, userProfile.company_id);
      } else {
        // Invoices/Quotes — use DocumentGenerator
        const docData = buildDocData();
        if (!docData) throw new Error('Could not build document data');
        pdfBase64 = await generateDocumentBase64(docData, userProfile.company_id);
      }

      const formLabel = payload
        ? (formLabelMap[payload.kind] || doc.type)
        : (formLabelMap[doc.type] || doc.type);

      await sendCp12CertificateEmail({
        to: recipients,
        certRef: doc.reference || cp12P?.pdfData.certRef || `#${String(doc.number).padStart(4, '0')}`,
        propertyAddress: cp12P?.pdfData.propertyAddress || doc.customer_snapshot?.address || '',
        inspectionDate: cp12P?.pdfData.inspectionDate || formatDisplayDate(doc.date),
        nextDueDate: cp12P?.pdfData.nextDueDate || (doc.expiry_date ? formatDisplayDate(doc.expiry_date) : ''),
        landlordName: cp12P?.pdfData.landlordName || doc.customer_snapshot?.name || '',
        tenantName: cp12P?.pdfData.tenantName || '',
        pdfBase64,
        subjectOverride: emailSubject,
        formLabel,
        documentId: doc.id,
        quoteResponseUrl: doc.type === 'quote' ? await createQuoteResponseToken(doc.id).catch(() => undefined) : undefined,
      });
      setShowEmailModal(false);
      // Refresh email status after sending
      fetchEmailStatus();
      Alert.alert('Email Sent', `Document emailed to ${recipients.join(', ')}.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send email.');
    }
    setSendingEmail(false);
  };

  // ─── Delete ─────────────────────────────────────────────────

  const handleDelete = () => {
    if (!doc) return;
    if (offlineModeEnabled) {
      Alert.alert('Offline Mode', 'Disable Offline Mode to delete documents.');
      return;
    }
    const payload = parseLockedPayload(doc.payment_info);
    const isCp12 = payload?.kind === 'cp12' || (doc.type as string) === 'cp12' || doc.reference?.startsWith('CP12-');
    const isSRDoc = payload?.kind === 'service_record' || (doc.type as string) === 'service_record' || doc.reference?.startsWith('SR-');
    const isCommissioningDoc = payload?.kind === 'commissioning' || (doc.type as string) === 'commissioning';
    const isDecommissioningDoc = payload?.kind === 'decommissioning' || (doc.type as string) === 'decommissioning';
    const isGasDoc = !!payload || isCp12 || isSRDoc || isCommissioningDoc || isDecommissioningDoc;
    const label = isCp12
      ? 'Landlord Gas Safety Record'
      : isSRDoc
        ? 'Service Record'
        : isCommissioningDoc
          ? 'Commissioning Certificate'
          : isDecommissioningDoc
            ? 'Decommissioning Certificate'
            : isGasDoc
              ? 'Gas Form'
              : doc.type === 'invoice'
                ? 'Invoice'
                : 'Quote';
    Alert.alert(
      `Delete ${label}`,
      'This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const {error} = await supabase.from('documents').delete().eq('id', doc.id);
            if (!error) router.back();
            else Alert.alert('Error', 'Could not delete.');
          },
        },
      ]
    );
  };

  const handleDuplicate = async (payload: any) => {
    if (!doc) return;
    setDuplicating(true);
    try {
      await duplicateDocument(doc, payload, resolveCustomerId);
    } finally {
      setDuplicating(false);
    }
  };

  const handleEdit = async (payload: any) => {
    if (!doc) return;
    setDuplicating(true);
    try {
      await editDocument(doc, payload, resolveCustomerId);
    } finally {
      setDuplicating(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!doc) return <View style={styles.center}><Text>Document not found.</Text></View>;

  const lockedPayload = parseLockedPayload(doc.payment_info);
  const safeEngineer = {
    name: (lockedPayload as any)?.engineer?.name || userProfile?.display_name || 'Not specified',
    gasSafeNumber: (lockedPayload as any)?.engineer?.gasSafeNumber || '',
  };
  const cp12Payload = lockedPayload?.kind === 'cp12'
    ? {
      ...(lockedPayload as CP12LockedPayload),
      engineer: safeEngineer,
      pdfData: {
        ...(lockedPayload as any).pdfData,
        propertyAddress: (lockedPayload as any).pdfData?.propertyAddress || doc.customer_snapshot?.address || '',
        landlordName: (lockedPayload as any).pdfData?.landlordName || doc.customer_snapshot?.name || '',
        tenantName: (lockedPayload as any).pdfData?.tenantName || '',
        inspectionDate: (lockedPayload as any).pdfData?.inspectionDate || formatDisplayDate(doc.date),
        nextDueDate: (lockedPayload as any).pdfData?.nextDueDate || formatDisplayDate(doc.expiry_date),
        appliances: Array.isArray((lockedPayload as any).pdfData?.appliances) ? (lockedPayload as any).pdfData.appliances : [],
      },
    } as CP12LockedPayload
    : null;
  const srPayload = lockedPayload?.kind === 'service_record'
    ? {
      ...(lockedPayload as ServiceRecordLockedPayload),
      engineer: safeEngineer,
      pdfData: {
        ...(lockedPayload as any).pdfData,
        customerName: (lockedPayload as any).pdfData?.customerName || doc.customer_snapshot?.name || '',
        propertyAddress: (lockedPayload as any).pdfData?.propertyAddress || doc.customer_snapshot?.address || '',
        serviceDate: (lockedPayload as any).pdfData?.serviceDate || formatDisplayDate(doc.date),
        nextInspectionDate: (lockedPayload as any).pdfData?.nextInspectionDate || formatDisplayDate(doc.expiry_date),
        appliances: Array.isArray((lockedPayload as any).pdfData?.appliances) ? (lockedPayload as any).pdfData.appliances : [],
      },
    } as ServiceRecordLockedPayload
    : null;
  const savedEmails = [
    cp12Payload?.pdfData?.landlordEmail,
    cp12Payload?.pdfData?.tenantEmail,
    srPayload?.pdfData?.customerEmail,
  ].filter(Boolean) as string[];
  const commissioningPayload = lockedPayload?.kind === 'commissioning'
    ? {
      ...(lockedPayload as CommissioningLockedPayload),
      engineer: safeEngineer,
      pdfData: {
        ...(lockedPayload as any).pdfData,
        customerName: (lockedPayload as any).pdfData?.customerName || doc.customer_snapshot?.name || '',
        propertyAddress: (lockedPayload as any).pdfData?.propertyAddress || doc.customer_snapshot?.address || '',
        commissioningDate: (lockedPayload as any).pdfData?.commissioningDate || formatDisplayDate(doc.date),
        nextServiceDate: (lockedPayload as any).pdfData?.nextServiceDate || formatDisplayDate(doc.expiry_date),
        finalInfo: (lockedPayload as any).pdfData?.finalInfo || {commissioningOutcome: '', additionalWorkRequired: ''},
        appliances: Array.isArray((lockedPayload as any).pdfData?.appliances) ? (lockedPayload as any).pdfData.appliances : [],
      },
    } as CommissioningLockedPayload
    : null;
  const decommissioningPayload = lockedPayload?.kind === 'decommissioning' ? lockedPayload as DecommissioningLockedPayload : null;
  const warningNoticePayload = lockedPayload?.kind === 'warning_notice'
    ? {
      ...(lockedPayload as WarningNoticeLockedPayload),
      engineer: safeEngineer,
      pdfData: {
        ...(lockedPayload as any).pdfData,
        customerName: (lockedPayload as any).pdfData?.customerName || doc.customer_snapshot?.name || '',
        propertyAddress: (lockedPayload as any).pdfData?.propertyAddress || doc.customer_snapshot?.address || '',
        issueDate: (lockedPayload as any).pdfData?.issueDate || formatDisplayDate(doc.date),
        finalInfo: (lockedPayload as any).pdfData?.finalInfo || {engineerOpinion: '', furtherActionRequired: ''},
        appliances: Array.isArray((lockedPayload as any).pdfData?.appliances) ? (lockedPayload as any).pdfData.appliances : [],
      },
    } as WarningNoticeLockedPayload
    : null;
  const breakdownPayload = lockedPayload?.kind === 'breakdown_report' ? lockedPayload as BreakdownReportLockedPayload : null;
  const installationPayload = lockedPayload?.kind === 'installation_cert' ? lockedPayload as InstallationCertLockedPayload : null;
  const isCp12 = lockedPayload?.kind === 'cp12' || (doc.type as string) === 'cp12' || doc.reference?.startsWith('CP12-');
  const isSR = lockedPayload?.kind === 'service_record' || (doc.type as string) === 'service_record' || doc.reference?.startsWith('SR-');
  const isCommissioning = lockedPayload?.kind === 'commissioning' || (doc.type as string) === 'commissioning';
  const isDecommissioning = lockedPayload?.kind === 'decommissioning' || (doc.type as string) === 'decommissioning';
  const isWarningNotice = lockedPayload?.kind === 'warning_notice' || (doc.type as string) === 'warning_notice';
  const isBreakdown = lockedPayload?.kind === 'breakdown_report' || (doc.type as string) === 'breakdown_report';
  const isInstallation = lockedPayload?.kind === 'installation_cert' || (doc.type as string) === 'installation_cert';
  const isGasForm = !!lockedPayload || isCp12 || isSR || isCommissioning || isDecommissioning || isWarningNotice || isBreakdown || isInstallation;
  const isInvoice = doc.type === 'invoice' && !isGasForm;
  const statuses = isInvoice ? INVOICE_STATUSES : QUOTE_STATUSES;
  const statusStyle = STATUS_COLORS[doc.status] || STATUS_COLORS.Draft;

  // Document type config
  const typeConfig = isCp12
    ? {label: 'GAS CERTIFICATE', icon: 'shield-checkmark-outline' as const, color: UI.brand.primary, bg: UI.surface.base, gradient: UI.gradients.cp12}
    : isSR
      ? {label: 'SERVICE RECORD', icon: 'construct-outline' as const, color: '#059669', bg: '#ecfdf5', gradient: ['#059669', '#10b981'] as [string, string]}
      : isCommissioning
        ? {label: 'COMMISSIONING', icon: 'checkmark-circle-outline' as const, color: '#7C3AED', bg: '#F5F3FF', gradient: ['#7C3AED', '#A78BFA'] as [string, string]}
        : isDecommissioning
          ? {label: 'DECOMMISSIONING', icon: 'close-circle-outline' as const, color: '#64748B', bg: '#F8FAFC', gradient: ['#64748B', '#94A3B8'] as [string, string]}
          : isWarningNotice
            ? {label: 'WARNING NOTICE', icon: 'warning-outline' as const, color: '#DC2626', bg: '#FEF2F2', gradient: ['#DC2626', '#EF4444'] as [string, string]}
            : isBreakdown
              ? {label: 'BREAKDOWN REPORT', icon: 'build-outline' as const, color: '#D97706', bg: '#FFF7ED', gradient: ['#D97706', '#F59E0B'] as [string, string]}
              : isInstallation
                ? {label: 'INSTALLATION', icon: 'home-outline' as const, color: '#0284C7', bg: '#F0F9FF', gradient: ['#0284C7', '#38BDF8'] as [string, string]}
                : isInvoice
                  ? {label: 'INVOICE', icon: 'receipt-outline' as const, color: '#C2410C', bg: '#FFF7ED', gradient: UI.gradients.amberLight}
                  : {label: 'QUOTE', icon: 'document-text-outline' as const, color: UI.brand.primary, bg: UI.surface.primaryLight, gradient: UI.gradients.primary};

  const isBusy = sharing || updating || duplicating || viewing || sendingEmail;

  return (
    <ScrollView style={[styles.container, isDark && {backgroundColor: theme.surface.base}]} contentContainerStyle={{paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40}}>
      {/* Back button */}
      <TouchableOpacity
        onPress={() => router.replace('/(app)/documents' as any)}
        style={[styles.backBtn, isDark && {backgroundColor: theme.surface.card, borderColor: theme.surface.border}]}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={20} color={isDark ? theme.text.title : UI.text.title} />
        <Text style={[styles.backBtnText, isDark && {color: theme.text.title}]}>Back</Text>
      </TouchableOpacity>

      {/* Header Card */}
      <Animated.View entering={FadeInDown.delay(50).springify()}>
        <View style={[styles.headerCard, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
          <View style={styles.headerTop}>
            <View style={[styles.typeIcon, {backgroundColor: typeConfig.bg}]}>
              <Ionicons name={typeConfig.icon} size={28} color={typeConfig.color} />
            </View>
            <View style={{flex: 1}}>
              <Text style={[styles.docType, isDark && {color: theme.text.muted}]}>{typeConfig.label}</Text>
              <Text style={[styles.docNumber, isDark && {color: theme.text.title}]}>
                {isCp12
                  ? doc.reference || `CP12-${String(doc.number).padStart(4, '0')}`
                  : isSR
                    ? doc.reference || `SR-${String(doc.number).padStart(4, '0')}`
                    : isGasForm
                      ? doc.reference || `REF-${String(doc.number).padStart(4, '0')}`
                      : `#${String(doc.number).padStart(4, '0')}`}
              </Text>
            </View>
            <View style={[styles.statusBadgeLg, {backgroundColor: isGasForm ? UI.surface.base : statusStyle.bg}]}>
              <Text style={[styles.statusTextLg, {color: isGasForm ? '#0284c7' : statusStyle.color}]}>
                {isGasForm ? 'Issued' : doc.status}
              </Text>
            </View>
          </View>

          {/* Email delivery status badge */}
          {emailStatus ? (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: isDark ? theme.surface.divider : UI.surface.elevated}}>
              <Ionicons
                name={emailStatus === 'opened' ? 'mail-open-outline' : emailStatus === 'delivered' ? 'checkmark-done-outline' : emailStatus === 'bounced' ? 'alert-circle-outline' : 'mail-outline'}
                size={14}
                color={emailStatus === 'opened' ? '#16a34a' : emailStatus === 'delivered' ? '#2563eb' : emailStatus === 'bounced' ? '#dc2626' : '#64748b'}
              />
              <Text style={{fontSize: 12, fontWeight: '600', color: emailStatus === 'opened' ? '#16a34a' : emailStatus === 'delivered' ? '#2563eb' : emailStatus === 'bounced' ? '#dc2626' : '#64748b'}}>
                Email {emailStatus === 'opened' ? 'Opened' : emailStatus === 'delivered' ? 'Delivered' : emailStatus === 'bounced' ? 'Bounced' : emailStatus === 'sent' ? 'Sent' : emailStatus.charAt(0).toUpperCase() + emailStatus.slice(1)}
              </Text>
            </View>
          ) : null}

          <View style={styles.headerMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color={isDark ? theme.text.muted : Colors.textLight} />
              <Text style={[styles.metaText, isDark && {color: theme.text.muted}]}>
                {formatDisplayDate(doc.date)}
              </Text>
            </View>
            {doc.expiry_date ? (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color={isGasForm ? UI.status.pending : Colors.textLight} />
                <Text style={[styles.metaText, isGasForm && {color: UI.status.pending, fontWeight: '600'}]}>
                  {isCp12 ? 'Next due' : isSR ? 'Next inspection' : isCommissioning || isInstallation ? 'Next service' : isInvoice ? 'Due' : 'Valid until'}: {formatDisplayDate(doc.expiry_date)}
                </Text>
              </View>
            ) : null}
            {doc.reference && !isGasForm ? (
              <View style={styles.metaItem}>
                <Ionicons name="bookmark-outline" size={14} color={isDark ? theme.text.muted : Colors.textLight} />
                <Text style={[styles.metaText, isDark && {color: theme.text.muted}]}>Ref: {doc.reference}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Animated.View>

      {/* Gas Form Details */}
      {isGasForm ? (
        <GasFormDetails
          isCp12={!!isCp12}
          isSR={!!isSR}
          isCommissioning={isCommissioning}
          isDecommissioning={isDecommissioning}
          isWarningNotice={isWarningNotice}
          isBreakdown={isBreakdown}
          isInstallation={isInstallation}
          cp12Payload={cp12Payload}
          srPayload={srPayload}
          commissioningPayload={commissioningPayload}
          decommissioningPayload={decommissioningPayload}
          warningNoticePayload={warningNoticePayload}
          breakdownPayload={breakdownPayload}
          installationPayload={installationPayload}
          lockedPayload={lockedPayload}
          savedEmails={savedEmails}
          hasUnsavedEmails={hasUnsavedEmails}
          isDark={isDark}
          theme={theme}
          onReminderToggle={handleReminderToggle}
          onOneTimeEmailsChange={(emails) => {
            setOneTimeEmails(emails);
            setHasUnsavedEmails(true);
          }}
          onSaveOneTimeEmails={handleSaveOneTimeEmails}
        />
      ) : (
        /* Non-gas-form document sections (invoice/quote) */
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          {/* Customer */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Customer</Text>
            <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
              <Text style={[styles.customerName, isDark && {color: theme.text.title}]}>{doc.customer_snapshot?.name || 'Unknown'}</Text>
              {doc.customer_snapshot?.company_name ? (
                <Text style={[styles.customerDetail, isDark && {color: theme.text.muted}]}>{doc.customer_snapshot.company_name}</Text>
              ) : null}
              <Text style={[styles.customerDetail, isDark && {color: theme.text.muted}]}>
                {doc.customer_snapshot?.address || 'No address'}
              </Text>
            </View>
          </View>

          {/* Line Items */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Items</Text>
            <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
              {doc.items?.map((item: any, idx: number) => (
                <View key={idx} style={[styles.itemRow, idx > 0 && {borderTopWidth: 1, borderTopColor: UI.surface.elevated, paddingTop: 10}]}>
                  <View style={{flex: 1}}>
                    <Text style={[styles.itemDesc, isDark && {color: theme.text.title}]}>{stripHtml(item.description) || 'Item'}</Text>
                    <Text style={[styles.itemMeta, isDark && {color: theme.text.muted}]}>{item.quantity} x £{item.unitPrice?.toFixed(2)}</Text>
                  </View>
                  <Text style={[styles.itemTotal, isDark && {color: theme.text.title}]}>£{(item.quantity * item.unitPrice).toFixed(2)}</Text>
                </View>
              ))}

              <View style={[styles.totalsDivider, isDark && {backgroundColor: theme.surface.divider}]} />
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, isDark && {color: theme.text.title}]}>Total</Text>
                <Text style={styles.totalValue}>£{doc.total?.toFixed(2) || '0.00'}</Text>
              </View>
            </View>
          </View>

          {/* Notes */}
          {doc.notes && !doc.notes.includes('CP12') && !doc.notes.includes('Gas Safety Certificate') ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Notes</Text>
              <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
                <Text style={[styles.notesText, isDark && {color: theme.text.body}]}>{doc.notes}</Text>
              </View>
            </View>
          ) : null}

          {/* Status Actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Update Status</Text>
            <View style={styles.statusGrid}>
              {statuses.map((s) => {
                const sc = STATUS_COLORS[s] || STATUS_COLORS.Draft;
                const isActive = doc.status === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusChip, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}, isActive && {backgroundColor: sc.bg, borderColor: sc.color, borderWidth: 2}]}
                    onPress={() => updateStatus(s)}
                    disabled={isBusy}
                  >
                    {isActive && <Ionicons name="checkmark-circle" size={14} color={sc.color} />}
                    <Text style={[styles.statusChipText, isDark && {color: theme.text.body}, isActive && {color: sc.color, fontWeight: '700'}]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>
      )}

      {/* ─── Action Buttons ──────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.actionsSection}>
        <TouchableOpacity
          style={styles.shareAction}
          onPress={handleShare}
          disabled={isBusy}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={isCp12 ? UI.gradients.cp12 : typeConfig.gradient}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={styles.shareGradient}
          >
            {sharing ? (
              <ActivityIndicator color={UI.text.white} size="small" />
            ) : (
              <>
                <Ionicons name="share-outline" size={20} color={UI.text.white} />
                <Text style={styles.shareActionText}>Share</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* View PDF — invoice/quote uses handleViewDocument; gas forms use handleViewCertificate */}
        {!isGasForm ? (
          <>
            <TouchableOpacity
              style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}
              onPress={handleViewDocument}
              disabled={isBusy}
              activeOpacity={0.8}
            >
              {viewing ? (
                <ActivityIndicator color={UI.brand.primary} size="small" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={18} color={UI.brand.primary} />
                  <Text style={styles.duplicateActionText}>View {isInvoice ? 'Invoice' : 'Quote'}</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}
              onPress={openSendEmailModal}
              disabled={isBusy}
              activeOpacity={0.8}
            >
              {sendingEmail ? (
                <ActivityIndicator color={UI.brand.primary} size="small" />
              ) : (
                <>
                  <Ionicons name="mail-outline" size={18} color={UI.brand.primary} />
                  <Text style={styles.duplicateActionText}>Send Email</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}, {backgroundColor: isDark ? theme.surface.elevated : '#f0fdf4', borderColor: isDark ? theme.surface.border : '#86efac'}]}
              onPress={handleShare}
              disabled={isBusy}
              activeOpacity={0.8}
            >
              {sharing ? (
                <ActivityIndicator color="#25D366" size="small" />
              ) : (
                <>
                  <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                  <Text style={[styles.duplicateActionText, {color: '#25D366'}]}>WhatsApp</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}
              onPress={() => {
                const route = isInvoice ? '/(app)/invoice' : '/(app)/quote';
                router.push({pathname: route as any, params: {editId: doc.id}});
              }}
              disabled={isBusy}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={18} color={UI.brand.primary} />
              <Text style={styles.duplicateActionText}>Edit {isInvoice ? 'Invoice' : 'Quote'}</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {/* CP12-specific: edit + duplicate */}
        {isCp12 ? (
          <TouchableOpacity style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={() => handleEdit(cp12Payload)} disabled={isBusy}>
            {duplicating ? (
              <ActivityIndicator color={UI.brand.primary} size="small" />
            ) : (
              <>
                <Ionicons name="create-outline" size={18} color={UI.brand.primary} />
                <Text style={styles.duplicateActionText}>Edit Certificate</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        {isCp12 ? (
          <TouchableOpacity style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={() => handleDuplicate(cp12Payload)} disabled={isBusy}>
            {duplicating ? (
              <ActivityIndicator color={UI.brand.primary} size="small" />
            ) : (
              <>
                <Ionicons name="copy-outline" size={18} color={UI.brand.primary} />
                <Text style={styles.duplicateActionText}>Duplicate for This Year</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        {isSR ? (
          <TouchableOpacity style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={() => handleEdit(srPayload)} disabled={isBusy}>
            {duplicating ? (
              <ActivityIndicator color={UI.brand.primary} size="small" />
            ) : (
              <>
                <Ionicons name="create-outline" size={18} color={UI.brand.primary} />
                <Text style={styles.duplicateActionText}>Edit Service Record</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        {isSR ? (
          <TouchableOpacity style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={() => handleDuplicate(srPayload)} disabled={isBusy}>
            {duplicating ? (
              <ActivityIndicator color={UI.brand.primary} size="small" />
            ) : (
              <>
                <Ionicons name="copy-outline" size={18} color={UI.brand.primary} />
                <Text style={styles.duplicateActionText}>Duplicate Service Record</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        {isCommissioning ? (
          <TouchableOpacity style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={() => handleEdit(commissioningPayload)} disabled={isBusy}>
            {duplicating ? (
              <ActivityIndicator color={UI.brand.primary} size="small" />
            ) : (
              <>
                <Ionicons name="create-outline" size={18} color={UI.brand.primary} />
                <Text style={styles.duplicateActionText}>Edit Certificate</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        {isCommissioning ? (
          <TouchableOpacity style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={() => handleDuplicate(commissioningPayload)} disabled={isBusy}>
            {duplicating ? (
              <ActivityIndicator color={UI.brand.primary} size="small" />
            ) : (
              <>
                <Ionicons name="copy-outline" size={18} color={UI.brand.primary} />
                <Text style={styles.duplicateActionText}>Duplicate for Next Visit</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        {isDecommissioning ? (
          <TouchableOpacity style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={() => handleEdit(decommissioningPayload)} disabled={isBusy}>
            {duplicating ? (
              <ActivityIndicator color={UI.brand.primary} size="small" />
            ) : (
              <>
                <Ionicons name="create-outline" size={18} color={UI.brand.primary} />
                <Text style={styles.duplicateActionText}>Edit Certificate</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        {isDecommissioning ? (
          <TouchableOpacity style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={() => handleDuplicate(decommissioningPayload)} disabled={isBusy}>
            {duplicating ? (
              <ActivityIndicator color={UI.brand.primary} size="small" />
            ) : (
              <>
                <Ionicons name="copy-outline" size={18} color={UI.brand.primary} />
                <Text style={styles.duplicateActionText}>Duplicate Certificate</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        {isWarningNotice ? (
          <TouchableOpacity style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={() => handleEdit(warningNoticePayload)} disabled={isBusy}>
            {duplicating ? <ActivityIndicator color={UI.brand.primary} size="small" /> : <><Ionicons name="create-outline" size={18} color={UI.brand.primary} /><Text style={styles.duplicateActionText}>Edit Notice</Text></>}
          </TouchableOpacity>
        ) : null}

        {isWarningNotice ? (
          <TouchableOpacity style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={() => handleDuplicate(warningNoticePayload)} disabled={isBusy}>
            {duplicating ? <ActivityIndicator color={UI.brand.primary} size="small" /> : <><Ionicons name="copy-outline" size={18} color={UI.brand.primary} /><Text style={styles.duplicateActionText}>Duplicate Notice</Text></>}
          </TouchableOpacity>
        ) : null}

        {isBreakdown ? (
          <TouchableOpacity style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={() => handleEdit(breakdownPayload)} disabled={isBusy}>
            {duplicating ? <ActivityIndicator color={UI.brand.primary} size="small" /> : <><Ionicons name="create-outline" size={18} color={UI.brand.primary} /><Text style={styles.duplicateActionText}>Edit Report</Text></>}
          </TouchableOpacity>
        ) : null}

        {isBreakdown ? (
          <TouchableOpacity style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={() => handleDuplicate(breakdownPayload)} disabled={isBusy}>
            {duplicating ? <ActivityIndicator color={UI.brand.primary} size="small" /> : <><Ionicons name="copy-outline" size={18} color={UI.brand.primary} /><Text style={styles.duplicateActionText}>Duplicate Report</Text></>}
          </TouchableOpacity>
        ) : null}

        {isInstallation ? (
          <TouchableOpacity style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={() => handleEdit(installationPayload)} disabled={isBusy}>
            {duplicating ? <ActivityIndicator color={UI.brand.primary} size="small" /> : <><Ionicons name="create-outline" size={18} color={UI.brand.primary} /><Text style={styles.duplicateActionText}>Edit Certificate</Text></>}
          </TouchableOpacity>
        ) : null}

        {isInstallation ? (
          <TouchableOpacity style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={() => handleDuplicate(installationPayload)} disabled={isBusy}>
            {duplicating ? <ActivityIndicator color={UI.brand.primary} size="small" /> : <><Ionicons name="copy-outline" size={18} color={UI.brand.primary} /><Text style={styles.duplicateActionText}>Duplicate for Next Service</Text></>}
          </TouchableOpacity>
        ) : null}

        {/* View + Email buttons — all gas forms */}
        {isGasForm ? (
          <View style={styles.cp12ExtraActions}>
            <TouchableOpacity style={[styles.secondaryAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={handleViewCertificate} disabled={isBusy}>
              {viewing ? (
                <ActivityIndicator color={UI.brand.primary} size="small" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={18} color={UI.brand.primary} />
                  <Text style={styles.secondaryActionText}>
                    {isCp12 ? 'View Certificate' : isSR ? 'View Service Record' : isCommissioning ? 'View Commissioning' : isDecommissioning ? 'View Decommissioning' : isWarningNotice ? 'View Notice' : isBreakdown ? 'View Report' : isInstallation ? 'View Certificate' : 'View Document'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.secondaryAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={openSendEmailModal} disabled={isBusy}>
              {sendingEmail ? (
                <ActivityIndicator color={UI.brand.primary} size="small" />
              ) : (
                <>
                  <Ionicons name="mail-outline" size={18} color={UI.brand.primary} />
                  <Text style={styles.secondaryActionText}>Send Email</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}, {backgroundColor: isDark ? theme.surface.elevated : '#f0fdf4', borderColor: isDark ? theme.surface.border : '#86efac'}]}
            onPress={handleShare}
            disabled={isBusy}
            activeOpacity={0.8}
          >
            {sharing ? (
              <ActivityIndicator color="#25D366" size="small" />
            ) : (
              <>
                <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                <Text style={[styles.duplicateActionText, {color: '#25D366'}]}>WhatsApp</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={[styles.deleteAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: '#FCA5A5'}]} onPress={handleDelete} disabled={isBusy}>
          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          <Text style={styles.deleteActionText}>
            Delete {isCp12 ? 'Certificate' : isSR ? 'Service Record' : isCommissioning ? 'Commissioning' : isDecommissioning ? 'Decommissioning' : isWarningNotice ? 'Warning Notice' : isBreakdown ? 'Breakdown Report' : isInstallation ? 'Installation Certificate' : isGasForm ? 'Gas Form' : isInvoice ? 'Invoice' : 'Quote'}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <Modal
        visible={showEmailModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.modalCard, isDark && {backgroundColor: theme.surface.card}]}>
              <Text style={[styles.modalTitle, isDark && {color: theme.text.title}]}>Send Document Email</Text>

              <Text style={[styles.modalLabel, isDark && {color: theme.text.body}]}>Subject</Text>
              <TextInput
                style={[styles.modalInput, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title}, {marginBottom: 16}]}
                value={emailSubject}
                onChangeText={setEmailSubject}
                placeholder="Email subject line"
                placeholderTextColor={isDark ? theme.text.placeholder : UI.text.muted}
                autoCapitalize="sentences"
              />

              <EmailRecipientsList
                defaultEmails={sanitizeRecipients(
                  parseLockedPayload(doc?.payment_info)?.kind === 'cp12'
                    ? [(parseLockedPayload(doc?.payment_info) as CP12LockedPayload).pdfData.landlordEmail || '', (parseLockedPayload(doc?.payment_info) as CP12LockedPayload).pdfData.tenantEmail || '', doc?.customer_snapshot?.email || '']
                    : [doc?.customer_snapshot?.email || '']
                )}
                additionalEmails={additionalSendEmails}
                onAdditionalEmailsChange={setAdditionalSendEmails}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, isDark && {backgroundColor: theme.surface.elevated}]}
                  onPress={() => setShowEmailModal(false)}
                  disabled={sendingEmail}
                >
                  <Text style={[styles.modalCancelText, isDark && {color: theme.text.body}]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSendBtn}
                  onPress={handleSendEmail}
                  disabled={sendingEmail}
                >
                  {sendingEmail ? (
                    <ActivityIndicator color={UI.text.white} size="small" />
                  ) : (
                    <Text style={styles.modalSendText}>Send</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScrollView>
  );
}
