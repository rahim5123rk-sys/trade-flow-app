// ============================================
// FILE: app/(app)/jobs/[id]/invoice.tsx
// ============================================

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../../../constants/theme';
import { supabase } from '../../../../src/config/supabase';
import { useAuth } from '../../../../src/context/AuthContext';
import {
  generateInvoice,
  InvoiceData,
  InvoiceLineItem,
} from '../../../../src/services/InvoiceGenerator';

export default function CreateInvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [job, setJob] = useState<any>(null);

  // Invoice Meta
  const [invoiceNumber, setInvoiceNumber] = useState('1');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [partialPayment, setPartialPayment] = useState('0');
  const [terms, setTerms] = useState('14 days');

  // Notes
  const [notes, setNotes] = useState(''); 
  const [paymentInfo, setPaymentInfo] = useState('');

  // Customer Fields (Billing)
  const [customerName, setCustomerName] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [customerAddress1, setCustomerAddress1] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerPostcode, setCustomerPostcode] = useState('');
  
  // Job Fields (Granular)
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [jobAddress1, setJobAddress1] = useState('');
  const [jobCity, setJobCity] = useState('');
  const [jobPostcode, setJobPostcode] = useState('');

  const [editingCustomer, setEditingCustomer] = useState(false);

  useEffect(() => {
    fetchJob();
  }, [id]);

  const fetchJob = async () => {
    if (!id || !userProfile?.company_id) return;

    const { data } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .single();

    if (data) {
      setJob(data);
      setInvoiceRef(data.reference || '');

      const snap = data.customer_snapshot || {};

      // 1. Populate Customer (Billing)
      setCustomerName(snap.name || 'Customer');
      setCustomerCompany(snap.company_name || '');
      
      if (snap.address_line_1) {
        setCustomerAddress1(snap.address_line_1);
        setCustomerCity(snap.city || '');
        setCustomerPostcode(snap.postal_code || '');
      } else {
        setCustomerAddress1(snap.address || '');
      }

      // 2. Populate Job Address (Default to Same as Billing)
      setSameAsBilling(true);
      // We don't populate job fields yet because the flag handles it.
      // If you had separate job address columns in DB, you'd check them here.

      // 3. Line Items
      if (data.title) {
        setItems([{ description: data.title, quantity: 1, unitPrice: data.price || 0, vatPercent: 0 }]);
      }

      // 4. Dates
      const due = new Date();
      due.setDate(due.getDate() + 14);
      setDueDate(due.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
    }

    // 5. Company Settings
    const { data: companyData } = await supabase.from('companies').select('settings').eq('id', userProfile!.company_id).single();
    if (companyData?.settings) {
      const s = companyData.settings;
      if (s.invoiceTerms) setTerms(s.invoiceTerms);
      if (s.nextInvoiceNumber) setInvoiceNumber(String(s.nextInvoiceNumber));
      if (s.invoiceNotes) setPaymentInfo(s.invoiceNotes);
    }

    setLoading(false);
  };

  const addLineItem = () => setItems([...items, { description: '', quantity: 1, unitPrice: 0, vatPercent: 0 }]);
  const removeLineItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: keyof InvoiceLineItem, value: string) => {
    const updated = [...items];
    if (field === 'description') updated[index].description = value;
    else updated[index][field] = parseFloat(value) || 0;
    setItems(updated);
  };

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const handleGenerate = async () => {
    if (!userProfile?.company_id) return;
    if (items.length === 0) { Alert.alert('Error', 'Add at least one item.'); return; }
    
    setGenerating(true);

    try {
      const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      // Determine Job Address values
      const finalJobAddress1 = sameAsBilling ? customerAddress1 : jobAddress1;
      const finalJobCity = sameAsBilling ? customerCity : jobCity;
      const finalJobPostcode = sameAsBilling ? customerPostcode : jobPostcode;

      const invoiceData: InvoiceData = {
        invoiceNumber: parseInt(invoiceNumber) || 1,
        invoiceRef: invoiceRef || undefined,
        date: today,
        dueDate: dueDate || today,
        status: 'Unpaid',
        
        customerName,
        customerCompany: customerCompany || undefined,
        customerAddress1,
        customerCity,
        customerPostcode,
        
        // Granular Job Address
        jobAddress1: finalJobAddress1,
        jobCity: finalJobCity,
        jobPostcode: finalJobPostcode,
        jobDate: job?.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString('en-GB') : undefined,

        items,
        discountPercent: parseFloat(discountPercent) || 0,
        partialPayment: parseFloat(partialPayment) || 0,
        notes: notes || undefined,
        paymentInfo: paymentInfo || undefined
      };

      await generateInvoice(invoiceData, userProfile.company_id);
    } catch (e) {
      console.log(e);
      Alert.alert('Error', 'Failed to generate invoice.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        
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
        </View>

        {/* Addresses Card */}
        <TouchableOpacity style={styles.customerCard} onPress={() => setEditingCustomer(!editingCustomer)} activeOpacity={0.7}>
          <View style={styles.customerHeader}>
            <Text style={styles.customerLabel}>ADDRESSES</Text>
            <Ionicons name="create-outline" size={16} color={Colors.primary} />
          </View>

          {editingCustomer ? (
            <View style={{ marginTop: 10 }}>
              {/* Bill To */}
              <Text style={styles.subLabel}>Bill To (Landlord/Owner)</Text>
              <TextInput style={styles.input} value={customerName} onChangeText={setCustomerName} placeholder="Name" />
              <TextInput style={styles.input} value={customerCompany} onChangeText={setCustomerCompany} placeholder="Company (Opt)" />
              <TextInput style={styles.input} value={customerAddress1} onChangeText={setCustomerAddress1} placeholder="Address Line 1" />
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1, marginRight: 5 }]} value={customerCity} onChangeText={setCustomerCity} placeholder="City" />
                <TextInput style={[styles.input, { flex: 1 }]} value={customerPostcode} onChangeText={setCustomerPostcode} placeholder="Postcode" />
              </View>

              <View style={styles.divider} />

              {/* Job Address */}
              <View style={[styles.row, { alignItems: 'center', marginBottom: 10 }]}>
                <Text style={[styles.subLabel, { marginBottom: 0 }]}>Job Address</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 12, color: Colors.textLight }}>Same as Bill To</Text>
                  <Switch 
                    value={sameAsBilling} 
                    onValueChange={setSameAsBilling} 
                    trackColor={{ false: '#e2e8f0', true: Colors.primary }}
                  />
                </View>
              </View>

              {!sameAsBilling && (
                <>
                  <TextInput style={styles.input} value={jobAddress1} onChangeText={setJobAddress1} placeholder="Site Address Line 1" />
                  <View style={styles.row}>
                    <TextInput style={[styles.input, { flex: 1, marginRight: 5 }]} value={jobCity} onChangeText={setJobCity} placeholder="City" />
                    <TextInput style={[styles.input, { flex: 1 }]} value={jobPostcode} onChangeText={setJobPostcode} placeholder="Postcode" />
                  </View>
                </>
              )}
            </View>
          ) : (
            <View style={{ marginTop: 6 }}>
              <Text style={styles.summaryLabel}>Bill To:</Text>
              <Text style={styles.summaryText}>{customerName} {customerCompany ? `(${customerCompany})` : ''}</Text>
              <Text style={styles.summaryText}>{[customerAddress1, customerCity, customerPostcode].filter(Boolean).join(', ')}</Text>
              
              <View style={styles.divider} />
              
              <Text style={styles.summaryLabel}>Job Address:</Text>
              <Text style={styles.summaryText}>
                {sameAsBilling 
                  ? 'Same as Bill To' 
                  : [jobAddress1, jobCity, jobPostcode].filter(Boolean).join(', ') || 'Not set'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Line Items */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Line Items</Text>
          <TouchableOpacity onPress={addLineItem}><Text style={styles.addLink}>+ Add Item</Text></TouchableOpacity>
        </View>

        {items.map((item, index) => (
          <View key={index} style={styles.lineItemCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.itemIndex}>#{index + 1}</Text>
              <TouchableOpacity onPress={() => removeLineItem(index)}><Ionicons name="close" size={16} color={Colors.textLight} /></TouchableOpacity>
            </View>
            <TextInput style={[styles.input, { marginTop: 4 }]} value={item.description} onChangeText={(v) => updateItem(index, 'description', v)} placeholder="Description" />
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
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>£{subtotal.toFixed(2)}</Text>
          </View>
        </View>

        {/* Notes & Payment */}
        <Text style={styles.sectionTitle}>Notes & Payment</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Job Notes (Visible on Invoice)</Text>
          <TextInput
            style={[styles.input, { minHeight: 60 }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Work completed on ground floor..."
            multiline
          />
          <Text style={[styles.label, { marginTop: 10 }]}>Payment Instructions (Editable)</Text>
          <TextInput
            style={[styles.input, { minHeight: 80 }]}
            value={paymentInfo}
            onChangeText={setPaymentInfo}
            placeholder="Bank Details..."
            multiline
          />
        </View>

        <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} disabled={generating}>
          {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateBtnText}>Generate Invoice</Text>}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, ...Colors.shadow },
  customerCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: Colors.primary, ...Colors.shadow },
  customerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customerLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 1 },
  label: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  subLabel: { fontSize: 12, fontWeight: '700', color: Colors.primary, marginBottom: 6 },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginTop: 4 },
  summaryText: { fontSize: 13, color: '#0f172a', fontWeight: '500', marginBottom: 2 },
  input: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 14, marginBottom: 8 },
  row: { flexDirection: 'row' },
  lineItemCard: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  itemIndex: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', marginTop: 16, marginBottom: 8, textTransform: 'uppercase', paddingLeft: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 8 },
  addLink: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },
  totalLabel: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  totalValue: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  editChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  editChipText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  customerSummary: { marginTop: 6 },
  customerNameText: { fontSize: 15, fontWeight: '700', color: Colors.text },
  customerCompanyText: { fontSize: 13, color: Colors.textLight, fontStyle: 'italic' },
  customerAddrText: { fontSize: 13, color: Colors.textLight, marginTop: 2 },
  generateBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 40 },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});