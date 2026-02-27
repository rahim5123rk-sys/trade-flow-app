// ============================================
// FILE: app/(app)/invoice.tsx
// Saves to `documents` table (not jobs)
// Uses shared CustomerSelector + auto-prefills from job
// ============================================

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
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
import { UI } from '../../constants/theme';
import { supabase } from '../../src/config/supabase';
import { useAuth } from '../../src/context/AuthContext';
import {
    DocumentData,
    generateDocument,
    LineItem,
} from '../../src/services/DocumentGenerator';

// ─── Design tokens ──────────────────────────────────────────────────
const GLASS_BG =
  Platform.OS === 'ios' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.92)';
const GLASS_BORDER = 'rgba(255,255,255,0.80)';

const fmtCurrency = (n: number) =>
  `£${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

export default function CreateInvoiceScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Customer (shared component) ──────────────────────────────
  const [customerForm, setCustomerForm] =
    useState<CustomerFormData>(EMPTY_CUSTOMER_FORM);
  const [prefilled, setPrefilled] = useState(false);

  // ─── Invoice Meta ─────────────────────────────────────────────
  const [invoiceNumber, setInvoiceNumber] = useState('1');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, vatPercent: 0 },
  ]);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [notes, setNotes] = useState('');
  const [paymentInfo, setPaymentInfo] = useState('');

  // ─── Job link (if coming from a job) ──────────────────────────
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, id]);

  const loadInitialData = async () => {
    if (!userProfile?.company_id) return;

    const { data: companyData } = await supabase
      .from('companies')
      .select('settings')
      .eq('id', userProfile.company_id)
      .single();

    if (companyData?.settings) {
      const s = companyData.settings;
      if (s.invoiceNotes) setPaymentInfo(s.invoiceNotes);
      if (s.nextInvoiceNumber) setInvoiceNumber(String(s.nextInvoiceNumber));
    }

    const due = new Date();
    due.setDate(due.getDate() + 14);
    setDueDate(
      due.toLocaleDateString('en-GB', {
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
        setInvoiceRef(jobData.reference || '');
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
    if (!customerForm.customerName.trim()) {
      Alert.alert('Error', 'Customer name is required.');
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

  // ─── Save Draft ───────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!userProfile?.company_id) return;
    if (!validate()) return;
    setSaving(true);

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

      const { error } = await supabase.from('documents').insert({
        company_id: userProfile.company_id,
        type: 'invoice',
        number: parseInt(invoiceNumber) || 1,
        reference: invoiceRef || null,
        date: new Date().toISOString(),
        expiry_date: dueDate || null,
        status: 'Draft',
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
        payment_info: paymentInfo || null,
      });

      if (error) throw error;

      const { data: companyData } = await supabase
        .from('companies')
        .select('settings')
        .eq('id', userProfile.company_id)
        .single();

      const currentSettings = companyData?.settings || {};
      await supabase
        .from('companies')
        .update({
          settings: {
            ...currentSettings,
            nextInvoiceNumber: (parseInt(invoiceNumber) || 1) + 1,
          },
        })
        .eq('id', userProfile.company_id);

      Alert.alert('Saved', 'Invoice saved as draft.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save invoice.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Save & Generate PDF ──────────────────────────────────────
  const handleSaveAndGenerate = async () => {
    if (!userProfile?.company_id) return;
    if (!validate()) return;
    setGenerating(true);

    try {
      const { snapshot, jobAddr, today } = buildDocData();

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

      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          company_id: userProfile.company_id,
          type: 'invoice',
          number: parseInt(invoiceNumber) || 1,
          reference: invoiceRef || null,
          date: new Date().toISOString(),
          expiry_date: dueDate || null,
          status: 'Unpaid',
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
          payment_info: paymentInfo || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const { data: companyData } = await supabase
        .from('companies')
        .select('settings')
        .eq('id', userProfile.company_id)
        .single();

      const currentSettings = companyData?.settings || {};
      await supabase
        .from('companies')
        .update({
          settings: {
            ...currentSettings,
            nextInvoiceNumber: (parseInt(invoiceNumber) || 1) + 1,
          },
        })
        .eq('id', userProfile.company_id);

      const docData: DocumentData = {
        type: 'invoice',
        number: parseInt(invoiceNumber) || 1,
        reference: invoiceRef || undefined,
        date: today,
        expiryDate: dueDate || today,
        status: 'Unpaid',
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
        paymentInfo: paymentInfo || undefined,
      };

      await generateDocument(docData, userProfile.company_id);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to generate invoice.');
    } finally {
      setGenerating(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────

  if (loading)
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={UI.brand.primary} />
      </View>
    );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <LinearGradient
        colors={UI.gradients.appBackground}
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
              <Ionicons name="arrow-back" size={22} color={UI.text.bodyLight} />
            </TouchableOpacity>
            <View style={st.headerCenter}>
              <Text style={st.screenTitle}>New Invoice</Text>
              <Text style={st.screenSubtitle}>
                Create and send a professional invoice
              </Text>
            </View>
            <View style={{ width: 42 }} />
          </Animated.View>

          {/* ─── Invoice Meta ─── */}
          <Animated.View
            entering={FadeInDown.delay(50).duration(350).springify()}
            style={st.card}
          >
            <View style={st.cardHeader}>
              <View style={st.cardIconWrap}>
                <Ionicons name="document-text" size={18} color={UI.status.pending} />
              </View>
              <Text style={st.cardTitle}>Invoice Details</Text>
            </View>

            <View style={st.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={st.label}>Invoice #</Text>
                <TextInput
                  style={st.input}
                  value={invoiceNumber}
                  onChangeText={setInvoiceNumber}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.label}>Due Date</Text>
                <TextInput
                  style={st.input}
                  value={dueDate}
                  onChangeText={setDueDate}
                />
              </View>
            </View>
            {invoiceRef ? (
              <View style={st.refRow}>
                <Ionicons name="link" size={14} color={UI.brand.primary} />
                <Text style={st.refLabel}>Job Ref:</Text>
                <Text style={st.refValue}>{invoiceRef}</Text>
              </View>
            ) : null}
          </Animated.View>

          {/* ─── Prefill Banner ─── */}
          {prefilled && (
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
              prefillMode={prefilled ? 'locked' : 'none'}
            />
          </Animated.View>

          {prefilled && (
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

              <TextInput
                style={[st.input, { marginTop: 8 }]}
                value={item.description}
                onChangeText={(v) => updateItem(index, 'description', v)}
                placeholder="Description"
                placeholderTextColor="#94a3b8"
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
              colors={UI.gradients.amberLight}
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
                <Text style={st.grandTotalLabel}>Total</Text>
                <Text style={st.grandTotalValue}>{fmtCurrency(total)}</Text>
              </View>
            </View>
          </Animated.View>

          {/* ─── Notes & Payment ─── */}
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
                <Ionicons name="chatbox-ellipses" size={16} color={UI.status.inProgress} />
              </View>
              <Text style={st.cardTitle}>Notes & Payment</Text>
            </View>
            <Text style={st.label}>Notes</Text>
            <TextInput
              style={[st.input, { minHeight: 60 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional notes..."
              placeholderTextColor="#94a3b8"
              multiline
            />
            <Text style={st.label}>Payment Instructions</Text>
            <TextInput
              style={[st.input, { minHeight: 80 }]}
              value={paymentInfo}
              onChangeText={setPaymentInfo}
              placeholder="Bank details, payment terms..."
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
                  <Text style={st.draftBtnText}>Save as Draft</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSaveAndGenerate}
              disabled={generating || saving}
              style={st.generateWrap}
            >
              <LinearGradient
                colors={UI.gradients.amberOrange}
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
                      Save & Generate PDF
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: UI.surface.base },

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
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, marginLeft: 12 },
  screenTitle: { fontSize: 22, fontWeight: '800', color: UI.text.title },
  screenSubtitle: { fontSize: 13, color: UI.text.muted, marginTop: 2 },

  // Glass card
  card: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    shadowColor: UI.text.muted,
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
    backgroundColor: 'rgba(245,158,11,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: UI.text.bodyLight },

  // Labels & inputs
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: UI.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  input: {
    backgroundColor:
      Platform.OS === 'ios' ? 'rgba(248,250,252,0.8)' : UI.surface.base,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.surface.divider,
    fontSize: 15,
    color: UI.text.title,
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
  refLabel: { fontSize: 12, fontWeight: '600', color: UI.text.muted },
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
  sectionTitle: { fontSize: 15, fontWeight: '700', color: UI.text.bodyLight },
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
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: UI.text.muted,
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
    color: UI.text.bodyLight,
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
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 18,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: UI.text.muted,
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
  totalLabel: { fontSize: 15, fontWeight: '600', color: UI.text.muted },
  totalValue: { fontSize: 16, fontWeight: '700', color: UI.text.bodyLight },
  totalDivider: {
    height: 2,
    backgroundColor: UI.surface.divider,
    borderRadius: 1,
    marginVertical: 8,
  },
  grandTotalLabel: { fontSize: 18, fontWeight: '800', color: UI.text.title },
  grandTotalValue: { fontSize: 22, fontWeight: '800', color: UI.status.pending },

  // Actions
  actions: { marginTop: 8, gap: 10 },
  draftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    borderRadius: 14,
  },
  draftBtnText: { color: UI.text.muted, fontWeight: '700', fontSize: 16 },
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
