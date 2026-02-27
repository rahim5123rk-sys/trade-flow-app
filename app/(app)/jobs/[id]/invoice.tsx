// ============================================
// FILE: app/(app)/jobs/[id]/invoice.tsx
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

export default function CreateInvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Customer (shared component) ──────────────────────────────
  const [customerForm, setCustomerForm] = useState<CustomerFormData>(EMPTY_CUSTOMER_FORM);
  const [prefilled, setPrefilled] = useState(false);

  // ─── Invoice Meta ─────────────────────────────────────────────
  const [invoiceNumber, setInvoiceNumber] = useState('1');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: 1, unitPrice: 0, vatPercent: 0 }]);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [notes, setNotes] = useState('');
  const [paymentInfo, setPaymentInfo] = useState('');

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
      if (s.invoiceNotes) setPaymentInfo(s.invoiceNotes);
      if (s.nextInvoiceNumber) setInvoiceNumber(String(s.nextInvoiceNumber));
    }

    // 2. Default due date
    const due = new Date();
    due.setDate(due.getDate() + 14);
    setDueDate(due.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));

    // 3. AUTO-PREFILL from job if navigating from a job detail
    if (id && id !== '[id]') {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (jobData) {
        setJobId(jobData.id);

        // Prefill customer from job snapshot
        const prefillData = prefillFromJob(jobData);
        setCustomerForm(prefillData);
        setPrefilled(true);

        // Prefill job reference and first line item
        setInvoiceRef(jobData.reference || '');
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

  // ─── Save to documents table ──────────────────────────────────
  const handleSave = async () => {
    if (!userProfile?.company_id) return;
    if (!validate()) return;

    setSaving(true);

    try {
      const { snapshot, jobAddr, today } = buildDocData();

      const { error } = await supabase.from('documents').insert({
        company_id: userProfile.company_id,
        type: 'invoice',
        number: parseInt(invoiceNumber) || 1,
        reference: invoiceRef || null,
        date: new Date().toISOString(),
        expiry_date: dueDate || null,
        status: 'Draft',
        customer_id: customerForm.customerId || null,
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
        payment_info: paymentInfo || null,
      });

      if (error) throw error;

      // Increment invoice number in company settings
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

      Alert.alert('Saved', 'Invoice saved successfully.', [
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

      // 1. Save to documents table
      const { data: docRecord, error: insertError } = await supabase.from('documents').insert({
        company_id: userProfile.company_id,
        type: 'invoice',
        number: parseInt(invoiceNumber) || 1,
        reference: invoiceRef || null,
        date: new Date().toISOString(),
        expiry_date: dueDate || null,
        status: 'Draft',
        customer_id: customerForm.customerId || null,
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
        payment_info: paymentInfo || null,
      }).select().single();

      if (insertError) throw insertError;

      // 2. Increment invoice number
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

      // 3. Generate PDF
      const docData: DocumentData = {
        type: 'invoice',
        number: parseInt(invoiceNumber) || 1,
        reference: invoiceRef || undefined,
        date: today,
        expiryDate: dueDate || today,
        status: 'Draft',

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
        paymentInfo: paymentInfo || undefined,
      };

      await generateDocument(docData, userProfile.company_id);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to generate invoice.');
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
          <Text style={styles.screenTitle}>New Invoice</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Invoice Meta */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Invoice #</Text>
              <TextInput style={styles.input} value={invoiceNumber} onChangeText={setInvoiceNumber} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Due Date</Text>
              <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} />
            </View>
          </View>
          {invoiceRef ? (
            <View style={{ marginTop: 4 }}>
              <Text style={styles.label}>Job Reference</Text>
              <Text style={styles.refText}>{invoiceRef}</Text>
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

        {/* Allow editing if prefilled */}
        {prefilled && (
          <TouchableOpacity
            style={styles.editPrefillBtn}
            onPress={() => setPrefilled(false)}
          >
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
            <Text style={[styles.totalLabel, { fontWeight: '800', fontSize: 18 }]}>Total</Text>
            <Text style={[styles.totalValue, { fontWeight: '800', fontSize: 20 }]}>£{total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Notes & Payment */}
        <Text style={styles.sectionTitle}>Notes & Payment</Text>
        <View style={styles.card}>
          <TextInput style={[styles.input, { minHeight: 60 }]} value={notes} onChangeText={setNotes} placeholder="Notes..." placeholderTextColor="#94a3b8" multiline />
          <Text style={[styles.label, { marginTop: 10 }]}>Payment Instructions</Text>
          <TextInput style={[styles.input, { minHeight: 80 }]} value={paymentInfo} onChangeText={setPaymentInfo} placeholder="Bank Details..." placeholderTextColor="#94a3b8" multiline />
        </View>

        {/* Discount */}
        <View style={styles.card}>
          <Text style={styles.label}>Discount %</Text>
          <TextInput style={styles.input} value={discountPercent} onChangeText={setDiscountPercent} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" />
        </View>

        {/* Action Buttons */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving || generating}>
          {saving ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>Save Invoice</Text>
            </>
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

  // Prefill
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

  // Line items
  lineItemCard: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  itemIndex: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', marginTop: 16, marginBottom: 8, textTransform: 'uppercase', paddingLeft: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 8 },
  addLink: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  // Totals
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  totalLabel: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  totalValue: { fontSize: 18, fontWeight: '800', color: Colors.primary },

  // Buttons
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.success,
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    ...Colors.shadow,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
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