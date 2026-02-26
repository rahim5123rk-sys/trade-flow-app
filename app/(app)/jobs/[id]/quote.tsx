// ============================================
// FILE: app/(app)/quotes/create.tsx
// ============================================

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../../constants/theme';
import { supabase } from '../../../../src/config/supabase';
import { useAuth } from '../../../../src/context/AuthContext';
import {
    DocumentData,
    generateDocument,
    LineItem,
} from '../../../../src/services/DocumentGenerator';
import { Customer } from '../../../../src/types';

export default function CreateQuoteScreen() {
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Quote Meta
  const [quoteNumber, setQuoteNumber] = useState('1001');
  const [quoteRef, setQuoteRef] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: 1, unitPrice: 0, vatPercent: 0 }]);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [notes, setNotes] = useState(''); 
  const [terms, setTerms] = useState('Valid for 30 days');

  // Customer Fields
  const [customerName, setCustomerName] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [customerAddress1, setCustomerAddress1] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerPostcode, setCustomerPostcode] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  
  // Job Fields
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [jobAddress1, setJobAddress1] = useState('');
  const [jobCity, setJobCity] = useState('');
  const [jobPostcode, setJobPostcode] = useState('');

  // UI State
  const [editingCustomer, setEditingCustomer] = useState(true); // Start expanded
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    loadInitialData();
  }, [userProfile]);

  const loadInitialData = async () => {
    if (!userProfile?.company_id) return;

    // 1. Fetch Customers
    const { data: custData } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .order('name', { ascending: true });
    
    if (custData) setExistingCustomers(custData as Customer[]);

    // 2. Fetch Settings (Next Quote #, Terms)
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

    // Default Expiry (30 days)
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    setExpiryDate(expiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));

    setLoading(false);
  };

  // --- Customer Selection Logic ---
  const handleSelectCustomer = (cust: Customer) => {
    setCustomerId(cust.id);
    setCustomerName(cust.name);
    setCustomerCompany(cust.company_name || '');
    setCustomerAddress1(cust.address_line_1 || cust.address || ''); // Fallback
    setCustomerCity(cust.city || '');
    setCustomerPostcode(cust.postal_code || '');
    setShowCustomerPicker(false);
    setEditingCustomer(false); // Collapse after selection
  };

  // --- Item Logic ---
  const addLineItem = () => setItems([...items, { description: '', quantity: 1, unitPrice: 0, vatPercent: 0 }]);
  const removeLineItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: keyof LineItem, value: string) => {
    const updated = [...items];
    if (field === 'description') updated[index].description = value;
    else updated[index][field] = parseFloat(value) || 0;
    setItems(updated);
  };

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const handleGenerate = async () => {
    if (!userProfile?.company_id) return;
    if (items.length === 0) { Alert.alert('Error', 'Add at least one item.'); return; }
    if (!customerName.trim()) { Alert.alert('Error', 'Customer name is required.'); return; }
    
    setGenerating(true);

    try {
      const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      // 1. Save the Quote to DB (as a Job with status 'Quote')
      const combinedBilling = [customerAddress1, customerCity, customerPostcode].filter(Boolean).join(', ');
      
      await supabase.from('jobs').insert({
        company_id: userProfile.company_id,
        reference: quoteRef || `Q-${quoteNumber}`,
        title: `Quote for ${customerName}`,
        customer_id: customerId, 
        customer_snapshot: {
            name: customerName,
            company_name: customerCompany,
            address_line_1: customerAddress1,
            city: customerCity,
            postal_code: customerPostcode,
            address: combinedBilling
        },
        status: 'Quote', // Separate from active jobs
        scheduled_date: new Date().getTime(),
        price: subtotal,
        notes: notes
      });

      // 2. Generate PDF
      const docData: DocumentData = {
        type: 'quote',
        number: parseInt(quoteNumber) || 1001,
        reference: quoteRef || undefined,
        date: today,
        expiryDate: expiryDate || today,
        status: 'Draft',
        
        customerName,
        customerCompany: customerCompany || undefined,
        customerAddress1,
        customerCity,
        customerPostcode,
        
        jobAddress1: sameAsBilling ? customerAddress1 : jobAddress1,
        jobCity: sameAsBilling ? customerCity : jobCity,
        jobPostcode: sameAsBilling ? customerPostcode : jobPostcode,
        
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
        
        {/* Header with Back Button */}
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
        </View>

        {/* Addresses */}
        <View style={styles.customerCard}>
          <TouchableOpacity 
            style={styles.customerHeader} 
            onPress={() => setEditingCustomer(!editingCustomer)} 
            activeOpacity={0.7}
          >
            <Text style={styles.customerLabel}>CUSTOMER DETAILS</Text>
            <Ionicons name={editingCustomer ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primary} />
          </TouchableOpacity>

          {editingCustomer && (
            <View style={{ marginTop: 10 }}>
              <TouchableOpacity style={styles.selectBtn} onPress={() => setShowCustomerPicker(true)}>
                <Ionicons name="people" size={18} color="#fff" />
                <Text style={styles.selectBtnText}>Select Existing Customer</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <Text style={styles.subLabel}>Bill To</Text>
              <TextInput style={styles.input} value={customerName} onChangeText={setCustomerName} placeholder="Name" />
              <TextInput style={styles.input} value={customerCompany} onChangeText={setCustomerCompany} placeholder="Company" />
              <TextInput style={styles.input} value={customerAddress1} onChangeText={setCustomerAddress1} placeholder="Address Line 1" />
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1, marginRight: 5 }]} value={customerCity} onChangeText={setCustomerCity} placeholder="City" />
                <TextInput style={[styles.input, { flex: 1 }]} value={customerPostcode} onChangeText={setCustomerPostcode} placeholder="Postcode" />
              </View>

              <View style={styles.divider} />

              <View style={[styles.row, { alignItems: 'center', marginBottom: 10 }]}>
                <Text style={[styles.subLabel, { marginBottom: 0 }]}>Job Address</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 12, color: Colors.textLight }}>Same as Bill To</Text>
                  <Switch value={sameAsBilling} onValueChange={setSameAsBilling} trackColor={{ false: '#e2e8f0', true: Colors.primary }} />
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
          )}
        </View>

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
            <Text style={styles.totalLabel}>Total Estimate</Text>
            <Text style={styles.totalValue}>£{subtotal.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Scope / Notes</Text>
        <View style={styles.card}>
          <TextInput
            style={[styles.input, { minHeight: 80 }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Scope of works, exclusions..."
            multiline
          />
        </View>

        <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} disabled={generating}>
          {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateBtnText}>Generate Quote PDF</Text>}
        </TouchableOpacity>

        {/* Customer Picker Modal */}
        <Modal visible={showCustomerPicker} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Customer</Text>
                <TouchableOpacity onPress={() => setShowCustomerPicker(false)}><Ionicons name="close" size={24} /></TouchableOpacity>
              </View>
              <FlatList 
                data={existingCustomers} 
                keyExtractor={(item) => item.id} 
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.customerItem} onPress={() => handleSelectCustomer(item)}>
                    <Text style={styles.customerName}>{item.name}</Text>
                    <Text style={styles.customerAddr}>{item.address}</Text>
                  </TouchableOpacity>
                )} 
                ListEmptyComponent={<Text style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>No customers found.</Text>} 
              />
            </View>
          </View>
        </Modal>

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
  customerCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: Colors.primary, ...Colors.shadow },
  customerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customerLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 1 },
  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, padding: 10, borderRadius: 8, marginBottom: 12 },
  selectBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  label: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  subLabel: { fontSize: 12, fontWeight: '700', color: Colors.primary, marginBottom: 6 },
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
  generateBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 40 },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, maxHeight: '80%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  customerItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  customerName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  customerAddr: { fontSize: 13, color: '#64748b', marginTop: 2 },
});