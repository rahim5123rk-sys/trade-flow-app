// ============================================
// FILE: app/(app)/quote.tsx
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
import { supabase } from '../../src/config/supabase';
import { useAuth } from '../../src/context/AuthContext';
import {
    DocumentData,
    generateDocument,
    LineItem,
} from '../../src/services/DocumentGenerator';

// ─── Design tokens ──────────────────────────────────────────────────
const GLASS_BG =
  Platform.OS === 'ios' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.88)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

const fmtCurrency = (n: number) =>
  `£${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

export default function CreateQuoteScreen() {
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

  // ─── Quote Meta ───────────────────────────────────────────────
  const [quoteNumber, setQuoteNumber] = useState('1001');
  const [quoteRef, setQuoteRef] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, vatPercent: 0 },
  ]);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Valid for 30 days');

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
      if (s.quoteTerms) setTerms(s.quoteTerms);
      if (s.nextQuoteNumber) setQuoteNumber(String(s.nextQuoteNumber));
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
        type: 'quote',
        number: parseInt(quoteNumber) || 1001,
        reference: quoteRef || null,
        date: new Date().toISOString(),
        expiry_date: expiryDate || null,
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
            nextQuoteNumber: (parseInt(quoteNumber) || 1001) + 1,
          },
        })
        .eq('id', userProfile.company_id);

      Alert.alert('Saved', 'Quote saved as draft.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save quote.');
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
          type: 'quote',
          number: parseInt(quoteNumber) || 1001,
          reference: quoteRef || null,
          date: new Date().toISOString(),
          expiry_date: expiryDate || null,
          status: 'Sent',
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
            nextQuoteNumber: (parseInt(quoteNumber) || 1001) + 1,
          },
        })
        .eq('id', userProfile.company_id);

      const docData: DocumentData = {
        type: 'quote',
        number: parseInt(quoteNumber) || 1001,
        reference: quoteRef || undefined,
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

      await generateDocument(docData, userProfile.company_id);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to generate quote.');
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
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <LinearGradient
        colors={['#EEF2FF', '#F8FAFC', '#F1F5F9']}
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
              <Ionicons name="arrow-back" size={22} color="#334155" />
            </TouchableOpacity>
            <View style={st.headerCenter}>
              <Text style={st.screenTitle}>New Quote</Text>
              <Text style={st.screenSubtitle}>
                Build and send a detailed estimate
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
                <Ionicons name="calculator" size={18} color="#6366F1" />
              </View>
              <Text style={st.cardTitle}>Quote Details</Text>
            </View>

            <View style={st.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={st.label}>Quote #</Text>
                <TextInput
                  style={st.input}
                  value={quoteNumber}
                  onChangeText={setQuoteNumber}
                  keyboardType="number-pad"
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
                <Ionicons name="link" size={14} color="#6366F1" />
                <Text style={st.refLabel}>Job Ref:</Text>
                <Text style={st.refValue}>{quoteRef}</Text>
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
                <Ionicons name="checkmark" size={14} color="#10B981" />
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
              <Ionicons name="create-outline" size={15} color="#6366F1" />
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
                <Ionicons name="list" size={16} color="#6366F1" />
              </View>
              <Text style={st.sectionTitle}>Line Items</Text>
            </View>
            <TouchableOpacity style={st.addBtn} onPress={addLineItem}>
              <Ionicons name="add" size={16} color="#6366F1" />
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
                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
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
                <Ionicons name="pricetag" size={16} color="#EF4444" />
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
              colors={['#6366F1', '#818CF8']}
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
                  <Text style={[st.totalValue, { color: '#EF4444' }]}>
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
                <Ionicons name="document-text" size={16} color="#3B82F6" />
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

          {/* ─── Terms ─── */}
          <Animated.View
            entering={FadeInDown.delay(320).duration(350).springify()}
            style={st.card}
          >
            <View style={st.cardHeader}>
              <View
                style={[
                  st.cardIconWrap,
                  { backgroundColor: 'rgba(16,185,129,0.1)' },
                ]}
              >
                <Ionicons name="shield-checkmark" size={16} color="#10B981" />
              </View>
              <Text style={st.cardTitle}>Terms</Text>
            </View>
            <TextInput
              style={st.input}
              value={terms}
              onChangeText={setTerms}
              placeholder="e.g. Valid for 30 days"
              placeholderTextColor="#94a3b8"
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
                <ActivityIndicator color="#64748b" />
              ) : (
                <>
                  <Ionicons name="document-outline" size={18} color="#64748b" />
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
                colors={['#6366F1', '#818CF8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={st.generateBtn}
              >
                {generating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name="download-outline"
                      size={20}
                      color="#fff"
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },

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
  screenTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  screenSubtitle: { fontSize: 13, color: '#94a3b8', marginTop: 2 },

  // Glass card
  card: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    shadowColor: '#64748B',
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
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#334155' },

  // Labels & inputs
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  input: {
    backgroundColor:
      Platform.OS === 'ios' ? 'rgba(248,250,252,0.8)' : '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 15,
    color: '#0f172a',
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
  refLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  refValue: { fontSize: 14, fontWeight: '700', color: '#6366F1' },

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
  prefillText: { fontSize: 13, fontWeight: '600', color: '#059669' },
  editPrefillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 12,
  },
  editPrefillText: { fontSize: 13, fontWeight: '600', color: '#6366F1' },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 8,
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#334155' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99,102,241,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#6366F1' },

  // Line item card
  lineCard: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: '#64748B',
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
  lineBadgeText: { fontSize: 11, fontWeight: '800', color: '#6366F1' },
  lineTotal: {
    flex: 1,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
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
    shadowColor: '#64748B',
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
  totalLabel: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  totalValue: { fontSize: 16, fontWeight: '700', color: '#334155' },
  totalDivider: {
    height: 2,
    backgroundColor: '#e2e8f0',
    borderRadius: 1,
    marginVertical: 8,
  },
  grandTotalLabel: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  grandTotalValue: { fontSize: 22, fontWeight: '800', color: '#6366F1' },

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
  draftBtnText: { color: '#64748b', fontWeight: '700', fontSize: 16 },
  generateWrap: { borderRadius: 14, overflow: 'hidden' },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
