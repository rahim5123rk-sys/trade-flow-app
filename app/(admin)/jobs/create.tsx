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
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { WorkerPicker } from '../../../components/WorkerPicker';
import { Colors } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';

// Types
interface Customer {
  id: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
}

const DURATIONS = ['30 mins', '1 hour', '2 hours', '3 hours', '4 hours', 'Full day', 'Multi-day'];

export default function CreateJobScreen() {
  const { userProfile } = useAuth();

  // Mode: 'new' or 'existing'
  const [customerMode, setCustomerMode] = useState<'new' | 'existing'>('new');

  // Existing Customers Data
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  // New Customer Fields
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // Job Fields
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [price, setPrice] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('1 hour');

  // Scheduling
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const [scheduledDate, setScheduledDate] = useState<Date>(tomorrow);

  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load existing customers on mount
  useEffect(() => {
    if (!userProfile?.company_id) return;
    const fetchCustomers = async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', userProfile.company_id)
        .order('name', { ascending: true });

      if (data) setExistingCustomers(data);
    };
    fetchCustomers();
  }, [userProfile]);

  // Handle Existing Customer Selection
  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomer(cust);
    setShowCustomerPicker(false);
  };

  // Date Helpers
  const adjustDate = (days: number) => {
    const d = new Date(scheduledDate);
    d.setDate(d.getDate() + days);
    setScheduledDate(d);
  };
  const adjustHour = (hours: number) => {
    const d = new Date(scheduledDate);
    d.setHours(d.getHours() + hours);
    setScheduledDate(d);
  };

  const handleCreateJob = async () => {
    if (!userProfile?.company_id) return;

    // Validation
    if (!title.trim()) {
      Alert.alert('Missing Field', 'Please enter a job title.');
      return;
    }

    if (customerMode === 'new') {
      if (!customerName.trim() || !customerAddress.trim()) {
        Alert.alert('Missing Field', 'Customer Name and Address are required.');
        return;
      }
    } else {
      if (!selectedCustomer) {
        Alert.alert('Missing Field', 'Please select an existing customer.');
        return;
      }
    }

    setLoading(true);

    try {
      // 1. Get Company Settings (for Job Ref)
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('settings')
        .eq('id', userProfile.company_id)
        .single();

      if (companyError || !companyData) throw new Error('Company not found');

      const currentCount = companyData.settings?.nextJobNumber || 1;
      const year = new Date().getFullYear();
      const reference = `TF-${year}-${String(currentCount).padStart(4, '0')}`;

      // 2. Handle Customer (Create if new, use ID if existing)
      let customerId = '';
      let finalCustomerSnapshot = {
        name: '',
        address: '',
        phone: '',
        email: ''
      };

      if (customerMode === 'new') {
        finalCustomerSnapshot = {
          name: customerName.trim(),
          address: customerAddress.trim(),
          phone: customerPhone.trim() || '',
          email: customerEmail.trim() || ''
        };

        const { data: newCust, error: custError } = await supabase
          .from('customers')
          .insert({
            company_id: userProfile.company_id,
            ...finalCustomerSnapshot
          })
          .select()
          .single();
        
        if (custError) throw custError;
        customerId = newCust.id;

      } else if (selectedCustomer) {
        customerId = selectedCustomer.id;
        finalCustomerSnapshot = {
          name: selectedCustomer.name,
          address: selectedCustomer.address,
          phone: selectedCustomer.phone || '',
          email: selectedCustomer.email || ''
        };
      }

      // 3. Create Job
      const { error: jobError } = await supabase
        .from('jobs')
        .insert({
          company_id: userProfile.company_id,
          reference,
          title: title.trim(),
          customer_id: customerId,
          customer_snapshot: finalCustomerSnapshot,
          assigned_to: assignedTo,
          status: 'pending',
          scheduled_date: scheduledDate.getTime(),
          estimated_duration: estimatedDuration,
          price: price ? parseFloat(price) : null,
          notes: notes.trim() || null,
        });

      if (jobError) throw jobError;

      // 4. Update Job Counter
      const newSettings = { ...companyData.settings, nextJobNumber: currentCount + 1 };
      await supabase
        .from('companies')
        .update({ settings: newSettings })
        .eq('id', userProfile.company_id);

      Alert.alert('Success', 'Job created successfully.', [
        { text: 'OK', onPress: () => router.replace('/(admin)/jobs') },
      ]);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', 'Failed to create job.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
        
        {/* Customer Selection Tabs */}
        <View style={styles.tabContainer}>
            <TouchableOpacity 
                style={[styles.tab, customerMode === 'new' && styles.activeTab]} 
                onPress={() => setCustomerMode('new')}
            >
                <Text style={[styles.tabText, customerMode === 'new' && styles.activeTabText]}>New Customer</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.tab, customerMode === 'existing' && styles.activeTab]} 
                onPress={() => setCustomerMode('existing')}
            >
                <Text style={[styles.tabText, customerMode === 'existing' && styles.activeTabText]}>Existing Customer</Text>
            </TouchableOpacity>
        </View>

        {/* Customer Form */}
        <View style={styles.card}>
            {customerMode === 'new' ? (
                <>
                    <Text style={styles.label}>Customer Name *</Text>
                    <TextInput style={styles.input} placeholder="e.g. Sarah Jenkins" value={customerName} onChangeText={setCustomerName} />
                    
                    <Text style={styles.label}>Site Address *</Text>
                    <TextInput style={styles.input} placeholder="Address..." value={customerAddress} onChangeText={setCustomerAddress} />
                    
                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.label}>Phone</Text>
                            <TextInput style={styles.input} placeholder="07700..." keyboardType="phone-pad" value={customerPhone} onChangeText={setCustomerPhone} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput style={styles.input} placeholder="email@..." keyboardType="email-address" value={customerEmail} onChangeText={setCustomerEmail} />
                        </View>
                    </View>
                </>
            ) : (
                <>
                    <Text style={styles.label}>Select Customer *</Text>
                    <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowCustomerPicker(true)}>
                        <Text style={selectedCustomer ? styles.pickerText : styles.placeholderText}>
                            {selectedCustomer ? selectedCustomer.name : 'Tap to search customers...'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color={Colors.textLight} />
                    </TouchableOpacity>
                    {selectedCustomer && (
                        <View style={{ marginTop: 12 }}>
                            <Text style={styles.readOnlyText}>{selectedCustomer.address}</Text>
                        </View>
                    )}
                </>
            )}
        </View>

        {/* Job Details */}
        <Text style={styles.sectionTitle}>Job Details</Text>
        <View style={styles.card}>
            <Text style={styles.label}>Job Title *</Text>
            <TextInput style={styles.input} placeholder="e.g. Boiler Repair" value={title} onChangeText={setTitle} />

            <Text style={styles.label}>Description / Notes</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Details..." multiline numberOfLines={3} value={notes} onChangeText={setNotes} />
            
            <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                     <Text style={styles.label}>Price (£)</Text>
                     <TextInput style={styles.input} placeholder="0.00" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Duration</Text>
                    <TouchableOpacity style={styles.input} onPress={() => {
                        const idx = DURATIONS.indexOf(estimatedDuration);
                        const next = DURATIONS[(idx + 1) % DURATIONS.length];
                        setEstimatedDuration(next);
                    }}>
                        <Text>{estimatedDuration}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>

        {/* Schedule */}
        <Text style={styles.sectionTitle}>Schedule</Text>
        <View style={styles.card}>
            <View style={styles.row}>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustDate(-1)}><Ionicons name="chevron-back" size={20} color={Colors.primary} /></TouchableOpacity>
                <Text style={styles.dateText}>{scheduledDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustDate(1)}><Ionicons name="chevron-forward" size={20} color={Colors.primary} /></TouchableOpacity>
            </View>
            <View style={[styles.row, { marginTop: 12 }]}>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustHour(-1)}><Ionicons name="chevron-back" size={20} color={Colors.primary} /></TouchableOpacity>
                <Text style={styles.dateText}>{scheduledDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Text>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustHour(1)}><Ionicons name="chevron-forward" size={20} color={Colors.primary} /></TouchableOpacity>
            </View>
        </View>

        {/* Assign */}
        <Text style={styles.sectionTitle}>Assign To</Text>
        <View style={styles.card}>
            <WorkerPicker companyId={userProfile?.company_id || ''} selectedWorkerIds={assignedTo} onSelect={setAssignedTo} />
        </View>

        <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleCreateJob} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create Job</Text>}
        </TouchableOpacity>

        {/* Customer Modal */}
        <Modal visible={showCustomerPicker} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Select Customer</Text>
                        <TouchableOpacity onPress={() => setShowCustomerPicker(false)}><Ionicons name="close" size={24} /></TouchableOpacity>
                    </View>
                    <FlatList 
                        data={existingCustomers}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.customerItem} onPress={() => handleSelectCustomer(item)}>
                                <Text style={styles.customerName}>{item.name}</Text>
                                <Text style={styles.customerAddr}>{item.address}</Text>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={{ padding: 20, textAlign: 'center', color: '#888' }}>No customers found.</Text>}
                    />
                </View>
            </View>
        </Modal>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, padding: 4, marginBottom: 16 },
  tab: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 6 },
  activeTab: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  tabText: { fontWeight: '600', color: Colors.textLight },
  activeTabText: { color: Colors.text, fontWeight: '700' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, ...Colors.shadow, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 12, fontSize: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textLight, marginTop: 16, marginBottom: 8, textTransform: 'uppercase' },
  pickerBtn: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerText: { fontSize: 16, color: Colors.text, fontWeight: '500' },
  placeholderText: { fontSize: 16, color: '#94a3b8' },
  readOnlyText: { color: '#64748b', fontSize: 14, fontStyle: 'italic' },
  adjustBtn: { padding: 10, backgroundColor: '#f1f5f9', borderRadius: 8 },
  dateText: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', alignSelf: 'center' },
  submitBtn: { backgroundColor: Colors.primary, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 24, ...Colors.shadow },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, maxHeight: '80%', padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  customerItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  customerName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  customerAddr: { fontSize: 14, color: '#64748b' },
});