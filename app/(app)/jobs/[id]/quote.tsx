// ============================================
// FILE: app/(app)/jobs/[id]/quote.tsx
// Saves to `documents` table (not jobs)
// Uses shared CustomerSelector + auto-prefills from job
// ============================================

import { Ionicons } from '@expo/vector-icons';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    buildCustomerInsert,
    buildCustomerSnapshot,
    CustomerFormData,
    CustomerSelector,
    EMPTY_CUSTOMER_FORM,
    getJobAddress,
    prefillFromJob,
} from '../../../../components/CustomerSelector';
import { Colors } from '../../../../constants/theme';
import { supabase } from '../../../../src/config/supabase';
import { useAuth } from '../../../../src/context/AuthContext';
import {
    DocumentData,
    generateDocument,
    LineItem,
} from '../../../../src/services/DocumentGenerator';

export default function CreateQuoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Customer (shared component) ──────────────────────────────
  const [customerForm, setCustomerForm] = useState<CustomerFormData>(EMPTY_CUSTOMER_FORM);
  const [prefilled, setPrefilled] = useState(false);

  // ─── Quote Meta ───────────────────────────────────────────────
  const [quoteNumber, setQuoteNumber] = useState('1001');
  const [quoteRef, setQuoteRef] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: 1, unitPrice: 0, vatPercent: 0 }]);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Valid for 30 days');

  // ─── Job link (if coming from a job) ──────────────────────────
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, [userProfile, id]);

  const loadInitialData = async () => {
    if (!userProfile?.company_id) return;

    // 1. Load company settings
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

    // 2. Default expiry
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    setExpiryDate(expiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));

    // 3. AUTO-PREFILL from job if navigating from a job
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
          setItems([{
            description: jobData.title,
            quantity: 1,
            unitPrice: jobData.price || 0,
            vatPercent: 0,
          }]);
        }
        if (jobData.notes) setNotes(jobData.notes);
      }
    }

    setLoading(false);
  };

  // ─── Line Items ───────────────────────────────────────────────
  const addLineItem = () => setItems([...items, { description: '', quantity: 1, unitPrice: 0, vatPercent: 0 }]);
  const removeLineItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: keyof LineItem, value: string) => {
    const updated = [...items];
    if (field === 'description') updated[index].description = value;
    else updated[index][field] = parseFloat(value) || 0;
    setItems(updated);
  };

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = subtotal * (parseFloat(discountPercent) || 0) / 100;
  const total = subtotal - discount;

  // ─── Validate ─────────────────────────────────────────────────
  const validate = (): boolean => {
    if (items.length === 0 || !items.some(i => i.description.trim())) {
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
  const buildDocData = (): { snapshot: any; jobAddr: any; today: string } => {
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const snapshot = buildCustomerSnapshot(customerForm);
    const jobAddr = getJobAddress(customerForm);
    return { snapshot, jobAddr, today };
  };

  // ─── Save to documents table (As Draft) ──────────────────────────────────
  const handleSaveDraft = async () => {
    if (!userProfile?.company_id) return;
    if (!validate()) return;

    setSaving(true);

    try {
      const { snapshot, jobAddr } = buildDocData();

      let finalCustomerId = customerForm.customerId;
      if (!finalCustomerId) {
        const insertData = buildCustomerInsert(customerForm, userProfile.company_id);
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
        status: 'Draft', // Explicitly Draft
        customer_id: finalCustomerId,
        customer_snapshot: snapshot,
        job_id: jobId || null,
        job_address: {
          address_line_1: jobAddr.jobAddress1,
          city: jobAddr.jobCity,
          postcode: jobAddr.jobPostcode,
        },
        items: items,
        subtotal: subtotal,
        discount_percent: parseFloat(discountPercent) || 0,
        total: total,
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

  // ─── Save & Generate PDF (Changes status to Sent) ──────────────────────────────────────
  const handleSaveAndGenerate = async () => {
    if (!userProfile?.company_id) return;
    if (!validate()) return;

    setGenerating(true);

    try {
      const { snapshot, jobAddr, today } = buildDocData();

      let finalCustomerId = customerForm.customerId;
      if (!finalCustomerId) {
        const insertData = buildCustomerInsert(customerForm, userProfile.company_id);
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert(insertData)
          .select('id')
          .single();
        if (custErr) throw new Error('Failed to create new customer.');
        finalCustomerId = newCust.id;
      }

      const { data: docRecord, error: insertError } = await supabase.from('documents').insert({
        company_id: userProfile.company_id,
        type: 'quote',
        number: parseInt(quoteNumber) || 1001,
        reference: quoteRef || null,
        date: new Date().toISOString(),
        expiry_date: expiryDate || null,
        status: 'Sent', // Assumes they are sending it
        customer_id: finalCustomerId,
        customer_snapshot: snapshot,
        job_id: jobId || null,
        job_address: {
          address_line_1: jobAddr.jobAddress1,
          city: jobAddr.jobCity,
          postcode: jobAddr.jobPostcode,
        },
        items: items,
        subtotal: subtotal,
        discount_percent: parseFloat(discountPercent) || 0,
        total: total,
        notes: notes || null,
      }).select().single();

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
        customerCity: customerForm.city,
        customerPostcode: customerForm.postCode,
        jobAddress1: jobAddr.jobAddress1,
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

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>New Quote</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Quote Meta */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Quote #</Text>
              <TextInput style={styles.input} value={quoteNumber} onChangeText={setQuoteNumber} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Valid Until</Text>
              <TextInput style={styles.input} value={expiryDate} onChangeText={setExpiryDate} />
            </View>
          </View>
          {quoteRef ? (
            <View style={{ marginTop: 4 }}>
              <Text style={styles.label}>Job Reference</Text>
              <Text style={styles.refText}>{quoteRef}</Text>
            </View>
          ) : null}
        </View>

        {/* Prefill Banner */}
        {prefilled && (
          <View style={styles.prefillBanner}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={styles.prefillText}>Customer details prefilled from job</Text>
          </View>
        )}

        {/* SHARED CUSTOMER SELECTOR */}
        <CustomerSelector
          value={customerForm}
          onChange={setCustomerForm}
          mode="compact"
          showJobAddress={true}
          prefillMode={prefilled ? 'locked' : 'none'}
        />

        {prefilled && (
          <TouchableOpacity style={styles.editPrefillBtn} onPress={() => setPrefilled(false)}>
            <Ionicons name="create-outline" size={16} color={Colors.primary} />
            <Text style={styles.editPrefillText}>Edit Customer Details</Text>
          </TouchableOpacity>
        )}

        {/* Line Items */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Line Items</Text>
          <TouchableOpacity onPress={addLineItem}><Text style={styles.addLink}>+ Add Item</Text></TouchableOpacity>
        </View>

        {items.map((item, index) => (
          <View key={index} style={styles.lineItemCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.itemIndex}>#{index + 1}</Text>
              {items.length > 1 && (
                <TouchableOpacity onPress={() => removeLineItem(index)}>
                  <Ionicons name="close" size={16} color={Colors.textLight} />
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={[styles.input, { marginTop: 4 }]}
              value={item.description}
              onChangeText={(v) => updateItem(index, 'description', v)}
              placeholder="Description"
              placeholderTextColor="#94a3b8"
            />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 5 }}>
                <Text style={styles.label}>Qty</Text>
                <TextInput style={styles.input} value={String(item.quantity)} onChangeText={(v) => updateItem(index, 'quantity', v)} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1, marginRight: 5 }}>
                <Text style={styles.label}>Price</Text>
                <TextInput style={styles.input} value={String(item.unitPrice)} onChangeText={(v) => updateItem(index, 'unitPrice', v)} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>VAT %</Text>
                <TextInput style={styles.input} value={String(item.vatPercent)} onChangeText={(v) => updateItem(index, 'vatPercent', v)} keyboardType="numeric" />
              </View>
            </View>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.card}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>£{subtotal.toFixed(2)}</Text>
          </View>
          {parseFloat(discountPercent) > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount ({discountPercent}%)</Text>
              <Text style={[styles.totalValue, { color: Colors.danger }]}>-£{discount.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, { borderTopWidth: 2, borderTopColor: '#0f172a', paddingTop: 10, marginTop: 6 }]}>
            <Text style={[styles.totalLabel, { fontWeight: '800', fontSize: 18 }]}>Total Estimate</Text>
            <Text style={[styles.totalValue, { fontWeight: '800', fontSize: 20 }]}>£{total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Discount */}
        <View style={styles.card}>
          <Text style={styles.label}>Discount %</Text>
          <TextInput style={styles.input} value={discountPercent} onChangeText={setDiscountPercent} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" />
        </View>

        {/* Notes */}
        <Text style={styles.sectionTitle}>Scope / Notes</Text>
        <View style={styles.card}>
          <TextInput
            style={[styles.input, { minHeight: 80 }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Scope of works, exclusions..."
            placeholderTextColor="#94a3b8"
            multiline
          />
        </View>

        {/* Terms */}
        <Text style={styles.sectionTitle}>Terms</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            value={terms}
            onChangeText={setTerms}
            placeholder="e.g. Valid for 30 days"
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* Action Buttons */}
        <TouchableOpacity style={styles.draftBtn} onPress={handleSaveDraft} disabled={saving || generating}>
          {saving ? <ActivityIndicator color="#64748b" /> : (
            <Text style={styles.draftBtnText}>Save as Draft</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.generateBtn} onPress={handleSaveAndGenerate} disabled={generating || saving}>
          {generating ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.generateBtnText}>Save & Generate PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', ...Colors.shadow },
  screenTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, ...Colors.shadow },
  label: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  input: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 14, marginBottom: 8, color: Colors.text },
  row: { flexDirection: 'row' },
  refText: { fontSize: 14, fontWeight: '600', color: Colors.primary, marginBottom: 4 },

  prefillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  prefillText: { fontSize: 13, fontWeight: '600', color: '#15803D' },
  editPrefillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 12,
  },
  editPrefillText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  lineItemCard: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  itemIndex: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', marginTop: 16, marginBottom: 8, textTransform: 'uppercase', paddingLeft: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 8 },
  addLink: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  totalLabel: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  totalValue: { fontSize: 18, fontWeight: '800', color: Colors.primary },

  // Buttons
  draftBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  draftBtnText: { color: '#64748b', fontWeight: '700', fontSize: 16 },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 40,
    ...Colors.shadow,
  },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});