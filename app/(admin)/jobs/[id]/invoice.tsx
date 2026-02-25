// ============================================
// FILE: app/(admin)/jobs/[id]/invoice.tsx
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

  // Invoice fields
  const [invoiceNumber, setInvoiceNumber] = useState('1');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [partialPayment, setPartialPayment] = useState('0');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('14 days');

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

      // Pre-populate with job as first line item
      if (data.title) {
        setItems([
          {
            description: data.title,
            quantity: 1,
            unitPrice: data.price || 0,
            vatPercent: 0,
          },
        ]);
      }

      // Calculate due date (14 days from now)
      const due = new Date();
      due.setDate(due.getDate() + 14);
      setDueDate(
        due.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );
    }

    setLoading(false);
  };

  const addLineItem = () => {
    setItems([
      ...items,
      { description: '', quantity: 1, unitPrice: 0, vatPercent: 0 },
    ]);
  };

  const removeLineItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (
    index: number,
    field: keyof InvoiceLineItem,
    value: string
  ) => {
    const updated = [...items];
    if (field === 'description') {
      updated[index].description = value;
    } else {
      updated[index][field] = parseFloat(value) || 0;
    }
    setItems(updated);
  };

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const handleGenerate = async () => {
    if (!userProfile?.company_id) return;

    if (items.length === 0) {
      Alert.alert('No Items', 'Add at least one line item.');
      return;
    }

    const emptyItems = items.filter((i) => !i.description.trim());
    if (emptyItems.length > 0) {
      Alert.alert('Missing Info', 'All line items need a description.');
      return;
    }

    setGenerating(true);

    try {
      const today = new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      const customerAddress = [
        job?.customer_snapshot?.address_line_1,
        job?.customer_snapshot?.address_line_2,
        job?.customer_snapshot?.city,
        job?.customer_snapshot?.region,
        job?.customer_snapshot?.postal_code,
      ]
        .filter(Boolean)
        .join('\n') || job?.customer_snapshot?.address || '';

      const invoiceData: InvoiceData = {
        invoiceNumber: parseInt(invoiceNumber) || 1,
        invoiceRef: invoiceRef || undefined,
        date: today,
        dueDate: dueDate || today,
        status: 'Unpaid',
        customerName: job?.customer_snapshot?.name || 'Customer',
        customerCompany:
          job?.customer_snapshot?.company_name || undefined,
        customerAddress,
        items,
        discountPercent: parseFloat(discountPercent) || 0,
        partialPayment: parseFloat(partialPayment) || 0,
        notes: notes || undefined,
        terms: terms || undefined,
      };

      await generateInvoice(invoiceData, userProfile.company_id);
    } catch (e) {
      Alert.alert('Error', 'Failed to generate invoice.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Invoice Info */}
        <Text style={styles.sectionTitle}>Invoice Details</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Invoice #</Text>
              <TextInput
                style={styles.input}
                value={invoiceNumber}
                onChangeText={setInvoiceNumber}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Reference</Text>
              <TextInput
                style={styles.input}
                value={invoiceRef}
                onChangeText={setInvoiceRef}
                placeholder="Optional"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <Text style={styles.label}>Due Date</Text>
          <TextInput
            style={styles.input}
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="e.g. 13th October 2025"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>Terms</Text>
          <TextInput
            style={styles.input}
            value={terms}
            onChangeText={setTerms}
            placeholder="e.g. 14 days"
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* Customer (read-only from job) */}
        <Text style={styles.sectionTitle}>Customer</Text>
        <View style={styles.card}>
          <Text style={styles.customerName}>
            {job?.customer_snapshot?.name || 'Unknown'}
          </Text>
          {job?.customer_snapshot?.company_name && (
            <Text style={styles.customerCompany}>
              {job.customer_snapshot.company_name}
            </Text>
          )}
          <Text style={styles.customerAddr}>
            {job?.customer_snapshot?.address || 'No address'}
          </Text>
        </View>

        {/* Line Items */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Line Items</Text>
          <TouchableOpacity onPress={addLineItem}>
            <Text style={styles.addLink}>+ Add Item</Text>
          </TouchableOpacity>
        </View>

        {items.map((item, index) => (
          <View key={index} style={styles.lineItemCard}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Text style={styles.lineItemNum}>Item {index + 1}</Text>
              {items.length > 1 && (
                <TouchableOpacity onPress={() => removeLineItem(index)}>
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={item.description}
              onChangeText={(v) => updateItem(index, 'description', v)}
              placeholder="e.g. Boiler Service"
              placeholderTextColor="#94a3b8"
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={styles.label}>Qty</Text>
                <TextInput
                  style={styles.input}
                  value={String(item.quantity)}
                  onChangeText={(v) => updateItem(index, 'quantity', v)}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={styles.label}>Price (£)</Text>
                <TextInput
                  style={styles.input}
                  value={String(item.unitPrice)}
                  onChangeText={(v) => updateItem(index, 'unitPrice', v)}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>VAT %</Text>
                <TextInput
                  style={styles.input}
                  value={String(item.vatPercent)}
                  onChangeText={(v) => updateItem(index, 'vatPercent', v)}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>
        ))}

        {/* Discount & Partial */}
        <Text style={styles.sectionTitle}>Adjustments</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Discount %</Text>
              <TextInput
                style={styles.input}
                value={discountPercent}
                onChangeText={setDiscountPercent}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Partial Payment (£)</Text>
              <TextInput
                style={styles.input}
                value={partialPayment}
                onChangeText={setPartialPayment}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>

        {/* Notes */}
        <Text style={styles.sectionTitle}>Notes</Text>
        <View style={styles.card}>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Payment instructions, bank details, etc..."
            placeholderTextColor="#94a3b8"
            multiline
          />
        </View>

        {/* Running Total */}
        <View style={styles.totalBar}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>£{subtotal.toFixed(2)}</Text>
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={[styles.generateBtn, generating && { opacity: 0.7 }]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="document-text" size={20} color="#fff" />
              <Text style={styles.generateBtnText}>Generate Invoice PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    paddingLeft: 4,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  addLink: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    paddingRight: 4,
  },

  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    ...Colors.shadow,
    marginBottom: 12,
  },
  lineItemCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    ...Colors.shadow,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  lineItemNum: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },

  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    fontSize: 16,
    color: Colors.text,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },

  customerName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  customerCompany: {
    fontSize: 14,
    color: Colors.textLight,
    fontStyle: 'italic',
    marginTop: 2,
  },
  customerAddr: { fontSize: 14, color: Colors.textLight, marginTop: 4 },

  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    ...Colors.shadow,
  },
  totalLabel: { fontSize: 14, fontWeight: '600', color: Colors.textLight },
  totalValue: { fontSize: 20, fontWeight: '800', color: Colors.primary },

  generateBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 24,
    marginBottom: 40,
    ...Colors.shadow,
  },
  generateBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
});