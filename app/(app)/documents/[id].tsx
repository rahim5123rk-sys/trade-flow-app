// ============================================
// FILE: app/(app)/documents/[id].tsx
// View/manage a single quote, invoice or gas form
// ============================================

import {Ionicons} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {LinearGradient} from 'expo-linear-gradient';
import {router, useLocalSearchParams} from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors, UI} from '../../../constants/theme';
import {supabase} from '../../../src/config/supabase';
import {useAuth} from '../../../src/context/AuthContext';
import {useOfflineMode} from '../../../src/context/OfflineContext';
import {useAppTheme} from '../../../src/context/ThemeContext';
import {generateDocument, generateDocumentUrl} from '../../../src/services/DocumentGenerator';
import type {CP12LockedPayload} from '../../../src/services/cp12PdfGenerator';
import {sanitizeRecipients, sendCp12CertificateEmail} from '../../../src/services/email';
// Importing the barrel registers all PDF generators in the registry
import {
  generateRegisteredPdf,
  generateRegisteredPdfBase64,
  generateRegisteredPdfUrl,
  parseLockedPayload,
} from '../../../src/services/pdf';
import type {ServiceRecordLockedPayload} from '../../../src/services/serviceRecordPdfGenerator';
import {Document} from '../../../src/types';

const INVOICE_STATUSES = ['Draft', 'Sent', 'Unpaid', 'Paid', 'Overdue'];
const QUOTE_STATUSES = ['Draft', 'Sent', 'Accepted', 'Declined'];
const CP12_DUPLICATE_SEED_KEY = 'cp12_duplicate_seed_v1';
const CP12_EDIT_SEED_KEY = 'cp12_edit_seed_v1';

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
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const {theme, isDark} = useAppTheme();

  useEffect(() => {
    if (id) fetchDocument();
  }, [id]);

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
        await generateRegisteredPdf(payload, 'share', userProfile.company_id);
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

  const openSendEmailModal = () => {
    if (!doc) return;
    const payload = parseLockedPayload(doc.payment_info);
    if (!payload) return;

    // For CP12, include landlord + tenant emails; for all others, use customer snapshot
    const cp12P = payload.kind === 'cp12' ? payload as CP12LockedPayload : null;
    const emailCandidates = cp12P
      ? [cp12P.pdfData.landlordEmail || '', cp12P.pdfData.tenantEmail || '', doc.customer_snapshot?.email || '']
      : [doc.customer_snapshot?.email || ''];

    const recipients = sanitizeRecipients(emailCandidates);
    if (!recipients.length) {
      Alert.alert('No Email Found', 'No valid email found for this document.');
      return;
    }

    const defaultSubject = cp12P
      ? `Gas Certificate for ${cp12P.pdfData.propertyAddress || doc.customer_snapshot?.address || 'Property'}`
      : `${doc.reference || 'Service Record'} — ${doc.customer_snapshot?.name || 'Customer'}`;
    setEmailSubject(defaultSubject.trim());
    setShowEmailModal(true);
  };

  const handleSendEmail = async () => {
    if (!doc || !userProfile?.company_id) return;
    if (offlineModeEnabled) {
      Alert.alert('Offline Mode', 'Disable Offline Mode to send emails.');
      return;
    }

    const payload = parseLockedPayload(doc.payment_info);
    if (!payload) return;

    const cp12P = payload.kind === 'cp12' ? payload as CP12LockedPayload : null;
    const emailCandidates = cp12P
      ? [cp12P.pdfData.landlordEmail || '', cp12P.pdfData.tenantEmail || '', doc.customer_snapshot?.email || '']
      : [doc.customer_snapshot?.email || ''];

    const recipients = sanitizeRecipients(emailCandidates);
    if (!recipients.length) {
      Alert.alert('No Email Found', 'No valid email found for this document.');
      return;
    }

    setSendingEmail(true);
    try {
      const pdfBase64 = await generateRegisteredPdfBase64(payload, userProfile.company_id);
      await sendCp12CertificateEmail({
        to: recipients,
        certRef: doc.reference || cp12P?.pdfData.certRef || 'REF',
        propertyAddress: cp12P?.pdfData.propertyAddress || doc.customer_snapshot?.address || '',
        inspectionDate: cp12P?.pdfData.inspectionDate || '',
        nextDueDate: cp12P?.pdfData.nextDueDate || '',
        landlordName: cp12P?.pdfData.landlordName || doc.customer_snapshot?.name || '',
        tenantName: cp12P?.pdfData.tenantName || '',
        pdfBase64,
        subjectOverride: emailSubject,
      });
      setShowEmailModal(false);
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
    const isGasDoc = !!payload || isCp12 || isSRDoc;
    const label = isCp12 ? 'Gas Certificate' : isSRDoc ? 'Service Record' : isGasDoc ? 'Gas Form' : doc.type === 'invoice' ? 'Invoice' : 'Quote';
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

  const handleDuplicateCp12 = async () => {
    if (!cp12Payload) return;
    setDuplicating(true);
    try {
      const {pdfData} = cp12Payload;

      // Increment nextDueDate by 1 year (dd/mm/yyyy format)
      const [dd, mm, yyyy] = (pdfData.nextDueDate || '').split('/');
      const incrementedDueDate = yyyy ? `${dd}/${mm}/${String(Number(yyyy) + 1)}` : '';

      // Parse landlord address parts back into form fields
      const addrParts = (pdfData.landlordAddress || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      // Remove the postcode from the end if it matches landlordPostcode
      const postCode = pdfData.landlordPostcode || '';
      const partsWithoutPostcode =
        postCode && addrParts[addrParts.length - 1] === postCode
          ? addrParts.slice(0, -1)
          : addrParts;
      const addrLine1 = partsWithoutPostcode[0] || '';
      const addrCity = partsWithoutPostcode.length > 1 ? partsWithoutPostcode[partsWithoutPostcode.length - 1] : '';
      const addrLine2 = partsWithoutPostcode.length > 2 ? partsWithoutPostcode.slice(1, -1).join(', ') : '';

      await AsyncStorage.setItem(
        CP12_DUPLICATE_SEED_KEY,
        JSON.stringify({
          propertyAddress: pdfData.propertyAddress,
          appliances: pdfData.appliances,
          landlordForm: {
            customerName: pdfData.landlordName || '',
            customerCompany: pdfData.landlordCompany || '',
            addressLine1: addrLine1,
            addressLine2: addrLine2,
            city: addrCity,
            postCode,
            email: pdfData.landlordEmail || '',
            phone: pdfData.landlordPhone || '',
          },
          tenantName: pdfData.tenantName || '',
          tenantEmail: pdfData.tenantEmail || '',
          tenantPhone: pdfData.tenantPhone || '',
          nextDueDate: incrementedDueDate,
        }),
      );
      router.push('/(app)/cp12' as any);
    } catch {
      Alert.alert('Error', 'Could not duplicate this gas certificate.');
    } finally {
      setDuplicating(false);
    }
  };

  const handleEditCp12 = async () => {
    if (!cp12Payload || !doc) return;
    setDuplicating(true);
    try {
      const {pdfData} = cp12Payload;

      // Parse landlord address parts back into form fields
      const addrParts = (pdfData.landlordAddress || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const postCode = pdfData.landlordPostcode || '';
      const partsWithoutPostcode =
        postCode && addrParts[addrParts.length - 1] === postCode
          ? addrParts.slice(0, -1)
          : addrParts;
      const addrLine1 = partsWithoutPostcode[0] || '';
      const addrCity = partsWithoutPostcode.length > 1 ? partsWithoutPostcode[partsWithoutPostcode.length - 1] : '';
      const addrLine2 = partsWithoutPostcode.length > 2 ? partsWithoutPostcode.slice(1, -1).join(', ') : '';

      await AsyncStorage.setItem(
        CP12_EDIT_SEED_KEY,
        JSON.stringify({
          documentId: doc.id,
          propertyAddress: pdfData.propertyAddress,
          appliances: pdfData.appliances,
          landlordForm: {
            customerName: pdfData.landlordName || '',
            customerCompany: pdfData.landlordCompany || '',
            addressLine1: addrLine1,
            addressLine2: addrLine2,
            city: addrCity,
            postCode,
            email: pdfData.landlordEmail || '',
            phone: pdfData.landlordPhone || '',
          },
          tenantName: pdfData.tenantName || '',
          tenantEmail: pdfData.tenantEmail || '',
          tenantPhone: pdfData.tenantPhone || '',
          nextDueDate: pdfData.nextDueDate || '',
          inspectionDate: pdfData.inspectionDate || '',
          finalChecks: pdfData.finalChecks,
          customerSignature: pdfData.customerSignature || '',
          certRef: pdfData.certRef || doc.reference || '',
        }),
      );
      router.push('/(app)/cp12' as any);
    } catch {
      Alert.alert('Error', 'Could not open certificate for editing.');
    } finally {
      setDuplicating(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!doc) return <View style={styles.center}><Text>Document not found.</Text></View>;

  const lockedPayload = parseLockedPayload(doc.payment_info);
  const cp12Payload = lockedPayload?.kind === 'cp12' ? lockedPayload as CP12LockedPayload : null;
  const srPayload = lockedPayload?.kind === 'service_record' ? lockedPayload as ServiceRecordLockedPayload : null;
  const isCp12 = lockedPayload?.kind === 'cp12' || (doc.type as string) === 'cp12' || doc.reference?.startsWith('CP12-');
  const isSR = lockedPayload?.kind === 'service_record' || (doc.type as string) === 'service_record' || doc.reference?.startsWith('SR-');
  const isGasForm = !!lockedPayload || isCp12 || isSR;
  const isInvoice = doc.type === 'invoice' && !isGasForm;
  const statuses = isInvoice ? INVOICE_STATUSES : QUOTE_STATUSES;
  const statusStyle = STATUS_COLORS[doc.status] || STATUS_COLORS.Draft;

  // Document type config
  const typeConfig = isCp12
    ? {label: 'GAS CERTIFICATE', icon: 'shield-checkmark-outline' as const, color: UI.brand.primary, bg: UI.surface.base, gradient: UI.gradients.cp12}
    : isSR
      ? {label: 'SERVICE RECORD', icon: 'construct-outline' as const, color: '#059669', bg: '#ecfdf5', gradient: ['#059669', '#10b981'] as [string, string]}
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
                    : `#${String(doc.number).padStart(4, '0')}`}
              </Text>
            </View>
            <View style={[styles.statusBadgeLg, {backgroundColor: isGasForm ? UI.surface.base : statusStyle.bg}]}>
              <Text style={[styles.statusTextLg, {color: isGasForm ? '#0284c7' : statusStyle.color}]}>
                {isGasForm ? 'Issued' : doc.status}
              </Text>
            </View>
          </View>

          <View style={styles.headerMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color={isDark ? theme.text.muted : Colors.textLight} />
              <Text style={[styles.metaText, isDark && {color: theme.text.muted}]}>
                {new Date(doc.date).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'})}
              </Text>
            </View>
            {doc.expiry_date ? (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color={isGasForm ? UI.status.pending : Colors.textLight} />
                <Text style={[styles.metaText, isGasForm && {color: UI.status.pending, fontWeight: '600'}]}>
                  {isCp12 ? 'Next due' : isSR ? 'Next inspection' : isInvoice ? 'Due' : 'Valid until'}: {doc.expiry_date}
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

      {/* CP12 Details */}
      {isCp12 && cp12Payload ? (
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          {/* Engineer info */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Engineer</Text>
            <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={16} color={UI.brand.primary} />
                <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{cp12Payload.engineer.name || 'Not specified'}</Text>
              </View>
              {cp12Payload.engineer.gasSafeNumber ? (
                <View style={styles.detailRow}>
                  <Ionicons name="shield-outline" size={16} color={UI.status.complete} />
                  <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>Gas Safe: {cp12Payload.engineer.gasSafeNumber}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Property & People */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Property & People</Text>
            <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
              <View style={styles.detailRow}>
                <Ionicons name="home-outline" size={16} color={UI.status.inProgress} />
                <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{cp12Payload.pdfData.propertyAddress || 'No address'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Ionicons name="business-outline" size={16} color={UI.status.pending} />
                <View>
                  <Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Landlord</Text>
                  <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{cp12Payload.pdfData.landlordName || '—'}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="people-outline" size={16} color={UI.status.paid} />
                <View>
                  <Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Tenant</Text>
                  <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{cp12Payload.pdfData.tenantName || '—'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Appliances summary */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Appliances ({cp12Payload.pdfData.appliances.length})</Text>
            <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
              {cp12Payload.pdfData.appliances.map((app, i) => (
                <View key={i} style={[styles.applianceRow, i > 0 && {borderTopWidth: 1, borderTopColor: isDark ? theme.surface.divider : UI.surface.elevated, paddingTop: 10}]}>
                  <View style={styles.applianceNum}>
                    <Text style={styles.applianceNumText}>{i + 1}</Text>
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={[styles.applianceName, isDark && {color: theme.text.title}]}>{app.make} {app.model}</Text>
                    <Text style={[styles.applianceLocation, isDark && {color: theme.text.muted}]}>{app.location} • {app.type}</Text>
                  </View>
                  <View style={[
                    styles.safetyBadge,
                    {backgroundColor: app.applianceSafeToUse === 'Yes' ? '#F0FDF4' : app.applianceSafeToUse === 'No' ? '#FEF2F2' : UI.surface.elevated}
                  ]}>
                    <Ionicons
                      name={app.applianceSafeToUse === 'Yes' ? 'checkmark-circle' : app.applianceSafeToUse === 'No' ? 'close-circle' : 'help-circle'}
                      size={14}
                      color={app.applianceSafeToUse === 'Yes' ? '#15803d' : app.applianceSafeToUse === 'No' ? UI.brand.danger : UI.text.muted}
                    />
                    <Text style={[
                      styles.safetyText,
                      {color: app.applianceSafeToUse === 'Yes' ? '#15803d' : app.applianceSafeToUse === 'No' ? UI.brand.danger : UI.text.muted}
                    ]}>
                      {app.applianceSafeToUse === 'Yes' ? 'Safe' : app.applianceSafeToUse === 'No' ? 'Unsafe' : 'N/A'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Inspection dates */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Inspection</Text>
            <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
              <View style={styles.dateRow}>
                <View style={styles.dateItem}>
                  <Ionicons name="calendar" size={18} color={UI.brand.primary} />
                  <View>
                    <Text style={[styles.dateLabel, isDark && {color: theme.text.muted}]}>Inspected</Text>
                    <Text style={[styles.dateValue, isDark && {color: theme.text.title}]}>{cp12Payload.pdfData.inspectionDate}</Text>
                  </View>
                </View>
                <View style={styles.dateItem}>
                  <Ionicons name="alarm" size={18} color={UI.status.pending} />
                  <View>
                    <Text style={[styles.dateLabel, isDark && {color: theme.text.muted}]}>Next Due</Text>
                    <Text style={[styles.dateValue, {color: UI.status.pending}]}>{cp12Payload.pdfData.nextDueDate}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>
      ) : isSR && srPayload ? (
        /* Service Record details */
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          {/* Engineer info */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Engineer</Text>
            <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={16} color="#059669" />
                <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{srPayload.engineer.name || 'Not specified'}</Text>
              </View>
              {srPayload.engineer.gasSafeNumber ? (
                <View style={styles.detailRow}>
                  <Ionicons name="shield-outline" size={16} color={UI.status.complete} />
                  <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>Gas Safe: {srPayload.engineer.gasSafeNumber}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Customer & Property */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Customer & Property</Text>
            <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={16} color={UI.status.pending} />
                <View>
                  <Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Customer</Text>
                  <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{srPayload.pdfData.customerName || '—'}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Ionicons name="home-outline" size={16} color={UI.status.inProgress} />
                <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{srPayload.pdfData.propertyAddress || 'No address'}</Text>
              </View>
            </View>
          </View>

          {/* Appliance summary */}
          {srPayload.pdfData.appliances.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Appliance</Text>
              <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
                {srPayload.pdfData.appliances.map((app, i) => (
                  <View key={i} style={[styles.applianceRow, i > 0 && {borderTopWidth: 1, borderTopColor: isDark ? theme.surface.divider : UI.surface.elevated, paddingTop: 10}]}>
                    <View style={styles.applianceNum}>
                      <Text style={styles.applianceNumText}>{i + 1}</Text>
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={[styles.applianceName, isDark && {color: theme.text.title}]}>{app.make} {app.model}</Text>
                      <Text style={[styles.applianceLocation, isDark && {color: theme.text.muted}]}>{app.location} • {app.category}</Text>
                    </View>
                    <View style={[
                      styles.safetyBadge,
                      {backgroundColor: app.applianceCondition === 'Safe' ? '#F0FDF4' : app.applianceCondition === 'Unsafe' ? '#FEF2F2' : UI.surface.elevated}
                    ]}>
                      <Ionicons
                        name={app.applianceCondition === 'Safe' ? 'checkmark-circle' : app.applianceCondition === 'Unsafe' ? 'close-circle' : 'help-circle'}
                        size={14}
                        color={app.applianceCondition === 'Safe' ? '#15803d' : app.applianceCondition === 'Unsafe' ? UI.brand.danger : UI.text.muted}
                      />
                      <Text style={[
                        styles.safetyText,
                        {color: app.applianceCondition === 'Safe' ? '#15803d' : app.applianceCondition === 'Unsafe' ? UI.brand.danger : UI.text.muted}
                      ]}>
                        {app.applianceCondition || 'N/A'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Service dates */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Service Dates</Text>
            <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
              <View style={styles.dateRow}>
                <View style={styles.dateItem}>
                  <Ionicons name="calendar" size={18} color="#059669" />
                  <View>
                    <Text style={[styles.dateLabel, isDark && {color: theme.text.muted}]}>Service Date</Text>
                    <Text style={[styles.dateValue, isDark && {color: theme.text.title}]}>{srPayload.pdfData.serviceDate}</Text>
                  </View>
                </View>
                <View style={styles.dateItem}>
                  <Ionicons name="alarm" size={18} color={UI.status.pending} />
                  <View>
                    <Text style={[styles.dateLabel, isDark && {color: theme.text.muted}]}>Next Inspection</Text>
                    <Text style={[styles.dateValue, {color: UI.status.pending}]}>{srPayload.pdfData.nextInspectionDate || '—'}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>
      ) : (
        /* Non-CP12 document sections */
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
                    <Text style={[styles.itemDesc, isDark && {color: theme.text.title}]}>{item.description || 'Item'}</Text>
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
        ) : null}

        {/* CP12-specific: edit + duplicate */}
        {isCp12 ? (
          <TouchableOpacity style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={handleEditCp12} disabled={isBusy}>
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
          <TouchableOpacity style={[styles.duplicateAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]} onPress={handleDuplicateCp12} disabled={isBusy}>
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
                    {isCp12 ? 'View Certificate' : isSR ? 'View Service Record' : 'View Document'}
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
        ) : null}

        <TouchableOpacity style={[styles.deleteAction, isDark && {backgroundColor: theme.surface.elevated, borderColor: '#FCA5A5'}]} onPress={handleDelete} disabled={isBusy}>
          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          <Text style={styles.deleteActionText}>
            Delete {isCp12 ? 'Certificate' : isSR ? 'Service Record' : isGasForm ? 'Gas Form' : isInvoice ? 'Invoice' : 'Quote'}
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
          <View style={[styles.modalCard, isDark && {backgroundColor: theme.surface.card}]}>
            <Text style={[styles.modalTitle, isDark && {color: theme.text.title}]}>Send Document Email</Text>
            <Text style={[styles.modalSubtitle, isDark && {color: theme.text.muted}]}>Edit the subject line before sending.</Text>

            <Text style={[styles.modalLabel, isDark && {color: theme.text.body}]}>Subject</Text>
            <TextInput
              style={[styles.modalInput, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title}]}
              value={emailSubject}
              onChangeText={setEmailSubject}
              placeholder="Gas Safety Certificate"
              placeholderTextColor={isDark ? theme.text.placeholder : UI.text.muted}
              autoCapitalize="sentences"
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
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background, padding: 16},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 1, borderColor: UI.surface.divider,
    marginBottom: 12,
  },
  backBtnText: {fontSize: 14, fontWeight: '600', color: UI.text.title},

  // Header card
  headerCard: {backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, ...Colors.shadow},
  headerTop: {flexDirection: 'row', alignItems: 'center', gap: 14},
  typeIcon: {width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center'},
  docType: {fontSize: 11, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 1},
  docNumber: {fontSize: 22, fontWeight: '800', color: Colors.text},
  statusBadgeLg: {paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8},
  statusTextLg: {fontSize: 12, fontWeight: '700'},
  headerMeta: {flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: UI.surface.elevated},
  metaItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  metaText: {fontSize: 13, color: Colors.textLight},

  // Sections
  section: {marginBottom: 16},
  sectionLabel: {fontSize: 12, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4},
  card: {backgroundColor: '#fff', padding: 16, borderRadius: 12, ...Colors.shadow},

  // Detail rows (CP12)
  detailRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8},
  detailLabel: {fontSize: 11, fontWeight: '600', color: UI.text.muted, textTransform: 'uppercase'},
  detailText: {fontSize: 14, fontWeight: '500', color: Colors.text},
  divider: {height: 1, backgroundColor: UI.surface.elevated, marginVertical: 8},

  // Appliance rows (CP12)
  applianceRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8},
  applianceNum: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: UI.surface.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  applianceNumText: {fontSize: 12, fontWeight: '700', color: UI.brand.primary},
  applianceName: {fontSize: 14, fontWeight: '600', color: Colors.text},
  applianceLocation: {fontSize: 12, color: UI.text.muted, marginTop: 1},
  safetyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  safetyText: {fontSize: 11, fontWeight: '700'},

  // Date row (CP12)
  dateRow: {flexDirection: 'row', gap: 16},
  dateItem: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10},
  dateLabel: {fontSize: 11, fontWeight: '600', color: UI.text.muted, textTransform: 'uppercase'},
  dateValue: {fontSize: 15, fontWeight: '700', color: Colors.text},

  // Customer
  customerName: {fontSize: 16, fontWeight: '700', color: Colors.text},
  customerDetail: {fontSize: 14, color: UI.text.muted, marginTop: 2},

  // Line items
  itemRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10},
  itemDesc: {fontSize: 14, fontWeight: '600', color: Colors.text},
  itemMeta: {fontSize: 12, color: Colors.textLight, marginTop: 2},
  itemTotal: {fontSize: 14, fontWeight: '700', color: Colors.text},
  totalsDivider: {height: 2, backgroundColor: UI.text.title, marginVertical: 12},
  totalRow: {flexDirection: 'row', justifyContent: 'space-between'},
  totalLabel: {fontSize: 16, fontWeight: '700', color: Colors.text},
  totalValue: {fontSize: 20, fontWeight: '800', color: Colors.primary},

  notesText: {fontSize: 14, color: UI.text.bodyLight, lineHeight: 20},

  // Status
  statusGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: UI.surface.elevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusChipText: {fontSize: 13, fontWeight: '500', color: UI.text.muted},

  // Actions
  actionsSection: {gap: 12, marginTop: 8, marginBottom: 20},
  shareAction: {borderRadius: 14, overflow: 'hidden'},
  shareGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  shareActionText: {color: UI.text.white, fontWeight: '700', fontSize: 15},
  duplicateAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 12,
    backgroundColor: UI.surface.primaryLight,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  duplicateActionText: {
    color: UI.brand.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  cp12ExtraActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  secondaryActionText: {
    color: UI.brand.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  deleteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteActionText: {color: Colors.danger, fontWeight: '600', fontSize: 14},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    ...Colors.shadow,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: UI.text.muted,
  },
  modalLabel: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: UI.text.body,
    textTransform: 'uppercase',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: UI.surface.divider,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: UI.surface.base,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: UI.surface.elevated,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: UI.text.body,
  },
  modalSendBtn: {
    minWidth: 88,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: UI.brand.primary,
  },
  modalSendText: {
    fontSize: 13,
    fontWeight: '700',
    color: UI.text.white,
  },
});
