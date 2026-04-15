// ============================================
// FILE: app/(app)/quote.tsx
// Saves to `documents` table (not jobs)
// Uses shared CustomerSelector + auto-prefills from job
// ============================================

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
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
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    buildCustomerInsert,
    buildCustomerSnapshot,
    CustomerFormData,
    CustomerSelector,
    EMPTY_CUSTOMER_FORM,
    getJobAddress,
    prefillFromJob,
} from '../../components/CustomerSelector';
import { upsertSiteAddress } from '../../components/forms';
import ProPaywallModal from '../../components/ProPaywallModal';
import RichTextLineInput from '../../components/RichTextLineInput';
import { UI } from '../../constants/theme';
import { supabase } from '../../src/config/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useSubscription } from '../../src/context/SubscriptionContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import {
    DocumentData,
    generateDocument,
    generateDocumentBase64,
    generateDocumentUrl,
    LineItem,
} from '../../src/services/DocumentGenerator';
import { sanitizeRecipients, sendCp12CertificateEmail, createQuoteResponseToken } from '../../src/services/email';
import { getNextQuoteReference } from '../../src/services/formDocumentService';

// ─── Design tokens ──────────────────────────────────────────────────
const GLASS_BG =
  Platform.OS === 'ios' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.92)';
const GLASS_BORDER = 'rgba(255,255,255,0.80)';

const fmtCurrency = (n: number) =>
  `£${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

export default function CreateQuoteScreen() {
  const { theme, isDark } = useAppTheme();
  const st = makeStyles(theme, isDark);
  const { id, editId } = useLocalSearchParams<{ id?: string; editId?: string }>();
  const { userProfile } = useAuth();
  const { isPro } = useSubscription();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailing, setEmailing] = useState(false);

  // ─── Customer (shared component) ──────────────────────────────
  const [customerForm, setCustomerForm] =
    useState<CustomerFormData>(EMPTY_CUSTOMER_FORM);
  const [prefilled, setPrefilled] = useState(false);

  // ─── Quote Meta ───────────────────────────────────────────────
  const [quoteNumber, setQuoteNumber] = useState('QTE-0001');
  const [quoteRef, setQuoteRef] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, vatPercent: 0 },
  ]);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Valid for 30 days');
  const [focusedDescIdx, setFocusedDescIdx] = useState<number | null>(null);

  // ─── Job link (if coming from a job) ──────────────────────────
  const [jobId, setJobId] = useState<string | null>(null);
  // ─── Edit mode (editing existing document) ────────────────────
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const [originalStatus, setOriginalStatus] = useState<string | null>(null);
  const [viewingPdf, setViewingPdf] = useState(false);

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, id, editId]);

  const loadInitialData = async () => {
    if (!userProfile?.company_id) return;

    // ─── Edit mode: load existing document ─────────────────────
    if (editId) {
      const { data: existingDoc } = await supabase
        .from('documents')
        .select('*')
        .eq('id', editId)
        .single();

      if (existingDoc) {
        setEditingDocId(existingDoc.id);
        setOriginalStatus(existingDoc.status);
        // New format stores QTE-0001 in reference; old format stored job ref there
        const ref = existingDoc.reference || '';
        if (ref.startsWith('QTE-')) {
          setQuoteNumber(ref);
        } else {
          setQuoteNumber(String(existingDoc.number || 1001));
          if (ref) setQuoteRef(ref);
        }
        setExpiryDate(existingDoc.expiry_date || '');
        setItems(existingDoc.items?.length ? existingDoc.items : [{ description: '', quantity: 1, unitPrice: 0, vatPercent: 0 }]);
        setDiscountPercent(String(existingDoc.discount_percent || 0));
        setNotes(existingDoc.notes || '');
        setJobId(existingDoc.job_id || null);

        const snap = existingDoc.customer_snapshot;
        const jobAddr = existingDoc.job_address;
        if (snap) {
          setCustomerForm({
            customerId: existingDoc.customer_id || null,
            customerName: snap.name || '',
            customerCompany: snap.company_name || '',
            addressLine1: snap.address_line_1 || '',
            addressLine2: snap.address_line_2 || '',
            city: snap.city || '',
            region: '',
            postCode: snap.postal_code || '',
            phone: snap.phone || '',
            email: snap.email || '',
            sameAsBilling: !(jobAddr?.address_line_1),
            jobAddressLine1: jobAddr?.address_line_1 || '',
            jobAddressLine2: jobAddr?.address_line_2 || '',
            jobCity: jobAddr?.city || '',
            jobPostCode: jobAddr?.postcode || '',
            siteContactName: '',
            siteContactEmail: '',
            siteContactPhone: '',
            siteContactTitle: '',
          });
          // Don't lock fields in edit mode — show all fields editable
        }
      }
      setLoading(false);
      return;
    }

    // ─── New quote mode ────────────────────────────────────────
    const { data: companyData } = await supabase
      .from('companies')
      .select('settings')
      .eq('id', userProfile.company_id)
      .single();

    if (companyData?.settings) {
      const s = companyData.settings;
      if (s.quoteTerms) setTerms(s.quoteTerms);
    }

    // Get next quote reference (per-company, e.g. QTE-0001)
    try {
      const nextRef = await getNextQuoteReference(false, userProfile.company_id);
      setQuoteNumber(nextRef);
    } catch {
      // fallback handled by default state
    }

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    setExpiryDate(
      expiry.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    );

    if (id && id !== 'new' && id !== '[id]') {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (jobData) {
        setJobId(jobData.id);
        const prefillData = prefillFromJob(jobData);
        setCustomerForm(prefillData);
        setPrefilled(true);
        setQuoteRef(jobData.reference || '');
        if (jobData.title) {
          setItems([
            {
              description: jobData.title,
              quantity: 1,
              unitPrice: jobData.price || 0,
              vatPercent: 0,
            },
          ]);
        }
        if (jobData.notes) setNotes(jobData.notes);
      }
    }

    setLoading(false);
  };

  // ─── Line Items ───────────────────────────────────────────────
  const addLineItem = () =>
    setItems([
      ...items,
      { description: '', quantity: 1, unitPrice: 0, vatPercent: 0 },
    ]);
  const removeLineItem = (index: number) =>
    setItems(items.filter((_, i) => i !== index));
  const updateItem = (
    index: number,
    field: keyof LineItem,
    value: string,
  ) => {
    const updated = [...items];
    if (field === 'description') updated[index].description = value;
    else updated[index][field] = parseFloat(value) || 0;
    setItems(updated);
  };

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const discount =
    (subtotal * (parseFloat(discountPercent) || 0)) / 100;
  const total = subtotal - discount;

  // ─── Validate ─────────────────────────────────────────────────
  const validate = (): boolean => {
    if (items.length === 0 || !items.some((i) => i.description.trim())) {
      Alert.alert('Error', 'Add at least one item with a description.');
      return false;
    }
    if (!customerForm.customerName.trim() && !customerForm.customerCompany.trim()) {
      Alert.alert('Error', 'Either a customer name or company name is required.');
      return false;
    }
    return true;
  };

  // ─── Build document data ──────────────────────────────────────
  const buildDocData = (): {
    snapshot: any;
    jobAddr: any;
    today: string;
  } => {
    const today = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const snapshot = buildCustomerSnapshot(customerForm);
    const jobAddr = getJobAddress(customerForm);
    return { snapshot, jobAddr, today };
  };

  // ─── Save (shared for draft & generate) ──────────────────────
  const saveDocument = async (status: string) => {
    if (!userProfile?.company_id) return;
    if (!validate()) return;

    const isSavingDraft = status === 'Draft';
    if (isSavingDraft) setSaving(true); else setGenerating(true);

    try {
      const { snapshot, jobAddr } = buildDocData();

      let finalCustomerId = customerForm.customerId;
      if (!finalCustomerId) {
        const insertData = buildCustomerInsert(
          customerForm,
          userProfile.company_id,
        );
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert(insertData)
          .select('id')
          .single();
        if (custErr) throw new Error('Failed to create new customer.');
        finalCustomerId = newCust.id;
      }

      // Reserve the quote reference atomically for new quotes
      let finalQuoteRef = quoteNumber;
      if (!editingDocId) {
        try {
          finalQuoteRef = await getNextQuoteReference(true, userProfile.company_id);
        } catch {
          // Fall back to the previewed reference
        }
      }

      const docPayload = {
        company_id: userProfile.company_id,
        user_id: userProfile.id,
        type: 'quote' as const,
        number: parseInt(finalQuoteRef.replace(/\D/g, '')) || 1,
        reference: finalQuoteRef,
        expiry_date: expiryDate || null,
        status: editingDocId ? (originalStatus || status) : status,
        customer_id: finalCustomerId,
        customer_snapshot: snapshot,
        job_id: jobId || null,
        job_address: {
          address_line_1: jobAddr.jobAddress1,
          address_line_2: jobAddr.jobAddress2 || null,
          city: jobAddr.jobCity,
          postcode: jobAddr.jobPostcode,
        },
        items,
        subtotal,
        discount_percent: parseFloat(discountPercent) || 0,
        total,
        notes: notes || null,
      };

      if (editingDocId) {
        const { error } = await supabase
          .from('documents')
          .update(docPayload)
          .eq('id', editingDocId);
        if (error) throw error;
      } else {
        const { data: insertedDoc, error } = await supabase.from('documents').insert({
          ...docPayload,
          date: new Date().toISOString(),
        }).select('id').single();
        if (error) throw error;
        if (insertedDoc?.id) setSavedDocId(insertedDoc.id);
      }

      // Save site/job address for future reuse
      if (jobAddr.jobAddress1 && jobAddr.jobPostcode) {
        void upsertSiteAddress(userProfile.company_id, {
          addressLine1: jobAddr.jobAddress1,
          addressLine2: jobAddr.jobAddress2 || '',
          city: jobAddr.jobCity || '',
          postCode: jobAddr.jobPostcode,
          tenantName: customerForm.siteContactName || '',
          tenantEmail: customerForm.siteContactEmail || '',
        });
      }

      const msg = editingDocId ? 'Quote updated.' : (isSavingDraft ? 'Quote saved as draft.' : 'Quote saved.');
      if (editingDocId) {
        Alert.alert('Saved', msg, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Saved', msg);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save quote.');
    } finally {
      setSaving(false);
      setGenerating(false);
    }
  };

  // ─── Save Draft ───────────────────────────────────────────────
  const handleSaveDraft = () => saveDocument('Draft');

  // ─── Save & Generate PDF ──────────────────────────────────────
  const handleSaveAndGenerate = async () => {
    await saveDocument('Sent');

    try {
      if (!userProfile?.company_id) return;
      const { jobAddr, today } = buildDocData();
      const docData: DocumentData = {
        type: 'quote',
        number: parseInt(quoteNumber.replace(/\D/g, '')) || 1,
        reference: quoteNumber || undefined,
        date: today,
        expiryDate: expiryDate || today,
        status: editingDocId ? (originalStatus || 'Sent') : 'Sent',
        customerName: customerForm.customerName,
        customerCompany: customerForm.customerCompany || undefined,
        customerAddress1: customerForm.addressLine1,
        customerAddress2: customerForm.addressLine2 || undefined,
        customerCity: customerForm.city,
        customerPostcode: customerForm.postCode,
        customerEmail: customerForm.email || undefined,
        customerPhone: customerForm.phone || undefined,
        jobAddress1: jobAddr.jobAddress1,
        jobAddress2: jobAddr.jobAddress2 || undefined,
        jobCity: jobAddr.jobCity,
        jobPostcode: jobAddr.jobPostcode,
        items,
        discountPercent: parseFloat(discountPercent) || 0,
        partialPayment: 0,
        notes: notes || undefined,
      };
      await generateDocument(docData, userProfile.company_id);
    } catch {
      // PDF generation is optional - save already succeeded
    }
  };

  // ─── Save & Send Email ──────────────────────────────────────
  const handleSaveAndEmail = async () => {
    if (!userProfile?.company_id) return;
    if (!validate()) return;

    const email = customerForm.email?.trim();
    if (!email) {
      Alert.alert('No Email', 'Add a customer email address to send a quote.');
      return;
    }

    const recipients = sanitizeRecipients([email]);
    if (!recipients.length) {
      Alert.alert('Invalid Email', 'The customer email address is not valid.');
      return;
    }

    setEmailing(true);
    try {
      // Save first
      await saveDocument('Sent');

      // Get the document ID (either editing or newly created)
      const docId = editingDocId || savedDocId;

      // Build PDF data
      const { jobAddr, today } = buildDocData();
      const docData: DocumentData = {
        type: 'quote',
        number: parseInt(quoteNumber.replace(/\D/g, '')) || 1,
        reference: quoteNumber || undefined,
        date: today,
        expiryDate: expiryDate || today,
        status: 'Sent',
        customerName: customerForm.customerName,
        customerCompany: customerForm.customerCompany || undefined,
        customerAddress1: customerForm.addressLine1,
        customerAddress2: customerForm.addressLine2 || undefined,
        customerCity: customerForm.city,
        customerPostcode: customerForm.postCode,
        customerEmail: customerForm.email || undefined,
        customerPhone: customerForm.phone || undefined,
        jobAddress1: jobAddr.jobAddress1,
        jobAddress2: jobAddr.jobAddress2 || undefined,
        jobCity: jobAddr.jobCity,
        jobPostcode: jobAddr.jobPostcode,
        items,
        discountPercent: parseFloat(discountPercent) || 0,
        partialPayment: 0,
        notes: notes || undefined,
      };

      const pdfBase64 = await generateDocumentBase64(docData, userProfile.company_id);

      // Create quote response token for accept/decline buttons in email
      let quoteResponseUrl: string | undefined;
      if (docId) {
        try {
          quoteResponseUrl = await createQuoteResponseToken(docId);
        } catch {
          // Non-critical — email will still send without accept/decline buttons
        }
      }

      await sendCp12CertificateEmail({
        to: recipients,
        certRef: quoteNumber,
        propertyAddress: `${jobAddr.jobAddress1}${jobAddr.jobCity ? `, ${jobAddr.jobCity}` : ''}${jobAddr.jobPostcode ? ` ${jobAddr.jobPostcode}` : ''}`,
        inspectionDate: today,
        nextDueDate: expiryDate || '',
        landlordName: customerForm.customerName,
        tenantName: '',
        pdfBase64,
        formLabel: 'Quote',
        documentId: docId || undefined,
        quoteResponseUrl,
      });

      Alert.alert('Sent', `Quote emailed to ${recipients.join(', ')}.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      if (e.message && !e.message.includes('save')) {
        Alert.alert('Email Failed', e.message || 'Quote saved but email could not be sent.');
      }
    } finally {
      setEmailing(false);
    }
  };

  // ─── View PDF directly ─────────────────────────────────────
  const handleViewPdf = async () => {
    if (!userProfile?.company_id) return;
    setViewingPdf(true);
    try {
      const { jobAddr, today } = buildDocData();
      const docData: DocumentData = {
        type: 'quote',
        number: parseInt(quoteNumber.replace(/\D/g, '')) || 1,
        reference: quoteNumber || undefined,
        date: today,
        expiryDate: expiryDate || today,
        status: originalStatus || 'Draft',
        customerName: customerForm.customerName,
        customerCompany: customerForm.customerCompany || undefined,
        customerAddress1: customerForm.addressLine1,
        customerAddress2: customerForm.addressLine2 || undefined,
        customerCity: customerForm.city,
        customerPostcode: customerForm.postCode,
        customerEmail: customerForm.email || undefined,
        customerPhone: customerForm.phone || undefined,
        jobAddress1: jobAddr.jobAddress1,
        jobAddress2: jobAddr.jobAddress2 || undefined,
        jobCity: jobAddr.jobCity,
        jobPostcode: jobAddr.jobPostcode,
        items,
        discountPercent: parseFloat(discountPercent) || 0,
        partialPayment: 0,
        notes: notes || undefined,
      };
      const pdfUrl = await generateDocumentUrl(docData, userProfile.company_id);
      await WebBrowser.openBrowserAsync(pdfUrl);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to open PDF.');
    } finally {
      setViewingPdf(false);
    }
  };

  // ─── Share PDF ────────────────────────────────────────────────
  const handleSharePdf = async () => {
    if (!userProfile?.company_id) return;
    setViewingPdf(true);
    try {
      const { jobAddr, today } = buildDocData();
      const docData: DocumentData = {
        type: 'quote',
        number: parseInt(quoteNumber.replace(/\D/g, '')) || 1,
        reference: quoteNumber || undefined,
        date: today,
        expiryDate: expiryDate || today,
        status: originalStatus || 'Draft',
        customerName: customerForm.customerName,
        customerCompany: customerForm.customerCompany || undefined,
        customerAddress1: customerForm.addressLine1,
        customerAddress2: customerForm.addressLine2 || undefined,
        customerCity: customerForm.city,
        customerPostcode: customerForm.postCode,
        customerEmail: customerForm.email || undefined,
        customerPhone: customerForm.phone || undefined,
        jobAddress1: jobAddr.jobAddress1,
        jobAddress2: jobAddr.jobAddress2 || undefined,
        jobCity: jobAddr.jobCity,
        jobPostcode: jobAddr.jobPostcode,
        items,
        discountPercent: parseFloat(discountPercent) || 0,
        partialPayment: 0,
        notes: notes || undefined,
      };
      await generateDocument(docData, userProfile.company_id, 'share');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to share PDF.');
    } finally {
      setViewingPdf(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────

  if (loading)
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={theme.brand.primary} />
      </View>
    );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ProPaywallModal
        visible={!isPro}
        onDismiss={() => router.back()}
        featureTitle="Invoices & Quotes"
        featureDescription="Create professional quotes with expiry dates, terms, and send them directly to your customers."
      />
      <LinearGradient
        colors={theme.gradients.appBackground}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={st.container}
          contentContainerStyle={{
            paddingTop: insets.top + 10,
            paddingBottom: 80,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Header ─── */}
          <Animated.View
            entering={FadeInDown.duration(350).springify()}
            style={st.headerRow}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={st.backBtn}
            >
              <Ionicons name="arrow-back" size={22} color={theme.text.body} />
            </TouchableOpacity>
            <View style={st.headerCenter}>
              <Text style={st.screenTitle}>{editingDocId ? 'Edit Quote' : 'New Quote'}</Text>
              <Text style={st.screenSubtitle}>
                {editingDocId ? 'Update quote details' : 'Build and send a detailed estimate'}
              </Text>
            </View>
            <View style={{ width: 42 }} />
          </Animated.View>

          {/* ─── Quote Meta ─── */}
          <Animated.View
            entering={FadeInDown.delay(50).duration(350).springify()}
            style={st.card}
          >
            <View style={st.cardHeader}>
              <View style={st.cardIconWrap}>
                <Ionicons name="calculator" size={18} color={UI.brand.primary} />
              </View>
              <Text style={st.cardTitle}>Quote Details</Text>
            </View>

            <View style={st.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={st.label}>Quote #</Text>
                <TextInput
                  style={st.input}
                  value={quoteNumber}
                  editable={false}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.label}>Valid Until</Text>
                <TextInput
                  style={st.input}
                  value={expiryDate}
                  onChangeText={setExpiryDate}
                />
              </View>
            </View>
            {quoteRef ? (
              <View style={st.refRow}>
                <Ionicons name="link" size={14} color={UI.brand.primary} />
                <Text style={st.refLabel}>Job Ref:</Text>
                <Text style={st.refValue}>{quoteRef}</Text>
              </View>
            ) : null}
          </Animated.View>

          {/* ─── Prefill Banner ─── */}
          {prefilled && !editingDocId && (
            <Animated.View
              entering={FadeIn.duration(300)}
              style={st.prefillBanner}
            >
              <View style={st.prefillIconWrap}>
                <Ionicons name="checkmark" size={14} color={UI.status.complete} />
              </View>
              <Text style={st.prefillText}>
                Customer details prefilled from job
              </Text>
            </Animated.View>
          )}

          {/* ─── Customer Selector ─── */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(350).springify()}
          >
            <CustomerSelector
              value={customerForm}
              onChange={setCustomerForm}
              mode="compact"
              showJobAddress={true}
              prefillMode={prefilled && !editingDocId ? 'locked' : 'none'}
            />
          </Animated.View>

          {prefilled && !editingDocId && (
            <TouchableOpacity
              style={st.editPrefillBtn}
              onPress={() => setPrefilled(false)}
            >
              <Ionicons name="create-outline" size={15} color={UI.brand.primary} />
              <Text style={st.editPrefillText}>Edit Customer Details</Text>
            </TouchableOpacity>
          )}

          {/* ─── Line Items ─── */}
          <Animated.View
            entering={FadeInDown.delay(150).duration(350).springify()}
            style={st.sectionHeader}
          >
            <View style={st.sectionLeft}>
              <View style={[st.cardIconWrap, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                <Ionicons name="list" size={16} color={UI.brand.primary} />
              </View>
              <Text style={st.sectionTitle}>Line Items</Text>
            </View>
            <TouchableOpacity style={st.addBtn} onPress={addLineItem}>
              <Ionicons name="add" size={16} color={UI.brand.primary} />
              <Text style={st.addBtnText}>Add Item</Text>
            </TouchableOpacity>
          </Animated.View>

          {items.map((item, index) => (
            <Animated.View
              key={index}
              entering={FadeInDown.delay(180 + index * 50)
                .duration(300)
                .springify()}
              style={st.lineCard}
            >
              <View style={st.lineHeader}>
                <View style={st.lineBadge}>
                  <Text style={st.lineBadgeText}>#{index + 1}</Text>
                </View>
                <Text style={st.lineTotal}>
                  {fmtCurrency(item.quantity * item.unitPrice)}
                </Text>
                {items.length > 1 && (
                  <TouchableOpacity
                    style={st.lineRemove}
                    onPress={() => removeLineItem(index)}
                  >
                    <Ionicons name="trash-outline" size={14} color={UI.brand.danger} />
                  </TouchableOpacity>
                )}
              </View>

              <RichTextLineInput
                value={item.description}
                onChangeText={(v) => updateItem(index, 'description', v)}
                placeholder="Description"
                isFocused={focusedDescIdx === index}
                onFocus={() => setFocusedDescIdx(index)}
                onBlur={() => { if (focusedDescIdx === index) setFocusedDescIdx(null); }}
                isDark={isDark}
                theme={theme}
              />

              <View style={st.row}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={st.label}>Qty</Text>
                  <TextInput
                    style={st.input}
                    value={String(item.quantity)}
                    onChangeText={(v) => updateItem(index, 'quantity', v)}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={st.label}>Unit Price</Text>
                  <TextInput
                    style={st.input}
                    value={String(item.unitPrice)}
                    onChangeText={(v) =>
                      updateItem(index, 'unitPrice', v)
                    }
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.label}>VAT %</Text>
                  <TextInput
                    style={st.input}
                    value={String(item.vatPercent)}
                    onChangeText={(v) =>
                      updateItem(index, 'vatPercent', v)
                    }
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </Animated.View>
          ))}

          {/* ─── Discount ─── */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(350).springify()}
            style={st.card}
          >
            <View style={st.cardHeader}>
              <View
                style={[
                  st.cardIconWrap,
                  { backgroundColor: 'rgba(239,68,68,0.1)' },
                ]}
              >
                <Ionicons name="pricetag" size={16} color={UI.brand.danger} />
              </View>
              <Text style={st.cardTitle}>Discount</Text>
            </View>
            <TextInput
              style={st.input}
              value={discountPercent}
              onChangeText={setDiscountPercent}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#94a3b8"
            />
          </Animated.View>

          {/* ─── Totals ─── */}
          <Animated.View
            entering={FadeInDown.delay(250).duration(350).springify()}
            style={st.totalsCard}
          >
            <LinearGradient
              colors={UI.gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={st.totalsAccent}
            />
            <View style={st.totalsBody}>
              <View style={st.totalRow}>
                <Text style={st.totalLabel}>Subtotal</Text>
                <Text style={st.totalValue}>{fmtCurrency(subtotal)}</Text>
              </View>
              {parseFloat(discountPercent) > 0 && (
                <View style={st.totalRow}>
                  <Text style={st.totalLabel}>
                    Discount ({discountPercent}%)
                  </Text>
                  <Text style={[st.totalValue, { color: UI.brand.danger }]}>
                    -{fmtCurrency(discount)}
                  </Text>
                </View>
              )}
              <View style={st.totalDivider} />
              <View style={st.totalRow}>
                <Text style={st.grandTotalLabel}>Total Estimate</Text>
                <Text style={st.grandTotalValue}>{fmtCurrency(total)}</Text>
              </View>
            </View>
          </Animated.View>

          {/* ─── Scope / Notes ─── */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(350).springify()}
            style={st.card}
          >
            <View style={st.cardHeader}>
              <View
                style={[
                  st.cardIconWrap,
                  { backgroundColor: 'rgba(59,130,246,0.1)' },
                ]}
              >
                <Ionicons name="document-text" size={16} color={UI.status.inProgress} />
              </View>
              <Text style={st.cardTitle}>Scope & Notes</Text>
            </View>
            <TextInput
              style={[st.input, { minHeight: 80 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Scope of works, exclusions..."
              placeholderTextColor="#94a3b8"
              multiline
            />
          </Animated.View>

          {/* ─── Action Buttons ─── */}
          <Animated.View
            entering={FadeInUp.delay(350).duration(400).springify()}
            style={st.actions}
          >
            <TouchableOpacity
              style={st.draftBtn}
              onPress={handleSaveDraft}
              disabled={saving || generating}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator color={UI.text.muted} />
              ) : (
                <>
                  <Ionicons name="document-outline" size={18} color={UI.text.muted} />
                  <Text style={st.draftBtnText}>{editingDocId ? 'Save Changes' : 'Save as Draft'}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSaveAndEmail}
              disabled={emailing || generating || saving}
              style={st.generateWrap}
            >
              <LinearGradient
                colors={[UI.brand.primary, '#6366f1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={st.generateBtn}
              >
                {emailing ? (
                  <ActivityIndicator color={UI.text.white} />
                ) : (
                  <>
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color={UI.text.white}
                    />
                    <Text style={st.generateBtnText}>
                      Save & Send Email
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSaveAndGenerate}
              disabled={generating || saving || emailing}
              style={st.generateWrap}
            >
              <LinearGradient
                colors={UI.gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={st.generateBtn}
              >
                {generating ? (
                  <ActivityIndicator color={UI.text.white} />
                ) : (
                  <>
                    <Ionicons
                      name="download-outline"
                      size={20}
                      color={UI.text.white}
                    />
                    <Text style={st.generateBtnText}>
                      {editingDocId ? 'Save & View PDF' : 'Save & Generate PDF'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {(editingDocId || savedDocId) && (
              <>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleViewPdf}
                  disabled={viewingPdf}
                  style={[st.draftBtn, { borderColor: UI.brand.primary, borderWidth: 1.5 }]}
                >
                  {viewingPdf ? (
                    <ActivityIndicator color={UI.brand.primary} />
                  ) : (
                    <>
                      <Ionicons name="document-text-outline" size={18} color={UI.brand.primary} />
                      <Text style={[st.draftBtnText, { color: UI.brand.primary }]}>View Quote PDF</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleSharePdf}
                  disabled={viewingPdf}
                  style={[st.draftBtn, { borderColor: '#059669', borderWidth: 1.5 }]}
                >
                  <Ionicons name="share-outline" size={18} color="#059669" />
                  <Text style={[st.draftBtnText, { color: '#059669' }]}>Share</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>

          {/* ─── Terms (at the bottom) ─── */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(350).springify()}
            style={[st.card, { marginTop: 8 }]}
          >
            <View style={st.cardHeader}>
              <View
                style={[
                  st.cardIconWrap,
                  { backgroundColor: 'rgba(16,185,129,0.1)' },
                ]}
              >
                <Ionicons name="shield-checkmark" size={16} color={UI.status.complete} />
              </View>
              <Text style={st.cardTitle}>Terms & Conditions</Text>
            </View>
            <TextInput
              style={[st.input, { minHeight: 60 }]}
              value={terms}
              onChangeText={setTerms}
              placeholder="e.g. Valid for 30 days"
              placeholderTextColor="#94a3b8"
              multiline
            />
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const makeStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface.base },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: isDark ? theme.glass.bg : GLASS_BG,
    borderWidth: 1,
    borderColor: isDark ? theme.glass.border : GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, marginLeft: 12 },
  screenTitle: { fontSize: 22, fontWeight: '800', color: theme.text.title },
  screenSubtitle: { fontSize: 13, color: theme.text.muted, marginTop: 2 },

  // Glass card
  card: {
    backgroundColor: isDark ? theme.glass.bg : GLASS_BG,
    borderWidth: 1,
    borderColor: isDark ? theme.glass.border : GLASS_BORDER,
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    shadowColor: theme.text.muted,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(99,102,241,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.text.body },

  // Labels & inputs
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  input: {
    backgroundColor:
      isDark ? theme.surface.elevated : (Platform.OS === 'ios' ? 'rgba(248,250,252,0.8)' : UI.surface.base),
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? theme.surface.border : UI.surface.divider,
    fontSize: 15,
    color: theme.text.title,
    marginBottom: 8,
  },
  row: { flexDirection: 'row' },

  // Ref badge
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99,102,241,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  refLabel: { fontSize: 12, fontWeight: '600', color: theme.text.muted },
  refValue: { fontSize: 14, fontWeight: '700', color: UI.brand.primary },

  // Prefill
  prefillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(16,185,129,0.08)',
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
  },
  prefillIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(16,185,129,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  prefillText: { fontSize: 13, fontWeight: '600', color: UI.brand.success },
  editPrefillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 12,
  },
  editPrefillText: { fontSize: 13, fontWeight: '600', color: UI.brand.primary },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 8,
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.text.body },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99,102,241,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: UI.brand.primary },

  // Line item card
  lineCard: {
    backgroundColor: isDark ? theme.glass.bg : GLASS_BG,
    borderWidth: 1,
    borderColor: isDark ? theme.glass.border : GLASS_BORDER,
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: theme.text.muted,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  lineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lineBadge: {
    backgroundColor: 'rgba(99,102,241,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lineBadgeText: { fontSize: 11, fontWeight: '800', color: UI.brand.primary },
  lineTotal: {
    flex: 1,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '700',
    color: theme.text.body,
    marginRight: 8,
  },
  lineRemove: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Totals card
  totalsCard: {
    backgroundColor: isDark ? theme.glass.bg : GLASS_BG,
    borderWidth: 1,
    borderColor: isDark ? theme.glass.border : GLASS_BORDER,
    borderRadius: 18,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: theme.text.muted,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  totalsAccent: { width: 5 },
  totalsBody: { flex: 1, padding: 16 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  totalLabel: { fontSize: 15, fontWeight: '600', color: theme.text.muted },
  totalValue: { fontSize: 16, fontWeight: '700', color: theme.text.body },
  totalDivider: {
    height: 2,
    backgroundColor: theme.surface.divider,
    borderRadius: 1,
    marginVertical: 8,
  },
  grandTotalLabel: { fontSize: 18, fontWeight: '800', color: theme.text.title },
  grandTotalValue: { fontSize: 22, fontWeight: '800', color: UI.brand.primary },

  // Actions
  actions: { marginTop: 8, gap: 10 },
  draftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: isDark ? theme.glass.bg : GLASS_BG,
    borderWidth: 1,
    borderColor: isDark ? theme.glass.border : GLASS_BORDER,
    padding: 16,
    borderRadius: 14,
  },
  draftBtnText: { color: theme.text.muted, fontWeight: '700', fontSize: 16 },
  generateWrap: { borderRadius: 14, overflow: 'hidden' },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  generateBtnText: { color: UI.text.white, fontWeight: '700', fontSize: 16 },
});
