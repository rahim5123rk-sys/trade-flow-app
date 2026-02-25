// app/(admin)/jobs/create.tsx

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
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
import { Customer } from '../../../src/types';

const DURATIONS = ['30 mins', '1 hour', '2 hours', '3 hours', '4 hours', 'Full day', 'Multi-day'];

export default function CreateJobScreen() {
  const { userProfile } = useAuth();

  const [customerMode, setCustomerMode] = useState<'new' | 'existing'>('new');
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  // --- Granular Customer State ---
  const [customerName, setCustomerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postCode, setPostCode] = useState('');
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userProfile?.company_id) return;
    fetchCustomers();
  }, [userProfile]);

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', userProfile?.company_id)
      .order('name', { ascending: true });

    if (data) setExistingCustomers(data as Customer[]);
  };

  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomer(cust);
    setShowCustomerPicker(false);
  };

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

  const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selected) setScheduledDate(selected);
  };

  const handleCreateJob = async () => {
    if (!userProfile?.company_id) {
      Alert.alert('Please Wait', 'Your company profile is still loading.');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Missing Field', 'Please enter a job title.');
      return;
    }

    if (customerMode === 'new') {
      if (!customerName.trim() || !address1.trim() || !postCode.trim()) {
        Alert.alert('Missing Field', 'Contact Name, Address Line 1, and Post Code are required.');
        return;
      }
    } else if (!selectedCustomer) {
      Alert.alert('Missing Field', 'Please select an existing customer.');
      return;
    }

    setLoading(true);

    try {
      const { data: companyData } = await supabase
        .from('companies')
        .select('settings')
        .eq('id', userProfile.company_id)
        .single();

      const currentCount = companyData?.settings?.nextJobNumber || 1;
      const reference = `TF-${new Date().getFullYear()}-${String(currentCount).padStart(4, '0')}`;

      // Combined Address for Display
      const combinedAddress = [address1, address2, city, region, postCode]
        .filter(Boolean)
        .join(', ');

      let customerId = '';
      let finalCustomerSnapshot: any = {};

      if (customerMode === 'new') {
        finalCustomerSnapshot = {
          name: customerName.trim(),
          company_name: companyName.trim(),
          address_line_1: address1.trim(),
          address_line_2: address2.trim(),
          city: city.trim(),
          region: region.trim(),
          postal_code: postCode.trim().toUpperCase(),
          phone: customerPhone.trim(),
          email: customerEmail.trim(),
          address: combinedAddress,
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
        finalCustomerSnapshot = { ...selectedCustomer };
      }

      const { error: jobError } = await supabase.from('jobs').insert({
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

      await supabase.from('companies').update({ 
        settings: { ...companyData?.settings, nextJobNumber: currentCount + 1 } 
      }).eq('id', userProfile.company_id);

      Alert.alert('Success', 'Job created successfully.', [
        { text: 'OK', onPress: () => router.replace('/(admin)/jobs') },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create job.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        
        <View style={styles.tabContainer}>
            <TouchableOpacity style={[styles.tab, customerMode === 'new' && styles.activeTab]} onPress={() => setCustomerMode('new')}>
                <Text style={[styles.tabText, customerMode === 'new' && styles.activeTabText]}>New Customer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, customerMode === 'existing' && styles.activeTab]} onPress={() => setCustomerMode('existing')}>
                <Text style={[styles.tabText, customerMode === 'existing' && styles.activeTabText]}>Existing</Text>
            </TouchableOpacity>
        </View>

        <View style={styles.card}>
            {customerMode === 'new' ? (
                <>
                    <Text style={styles.label}>Contact Name *</Text>
                    <TextInput style={styles.input} placeholder="e.g. Sarah Jenkins" value={customerName} onChangeText={setCustomerName} />
                    
                    <Text style={styles.label}>Company Name</Text>
                    <TextInput style={styles.input} placeholder="e.g. Jenkins Plumbing Ltd" value={companyName} onChangeText={setCompanyName} />

                    <Text style={styles.label}>Address Line 1 *</Text>
                    <TextInput style={styles.input} placeholder="Street address" value={address1} onChangeText={setAddress1} />
                    
                    <Text style={styles.label}>Address Line 2</Text>
                    <TextInput style={styles.input} placeholder="Apt / Suite / Unit" value={address2} onChangeText={setAddress2} />

                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.label}>City</Text>
                            <TextInput style={styles.input} placeholder="Worcester" value={city} onChangeText={setCity} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Post Code *</Text>
                            <TextInput style={styles.input} placeholder="WR1 1PA" autoCapitalize="characters" value={postCode} onChangeText={setPostCode} />
                        </View>
                    </View>

                    <Text style={styles.label}>Region / County</Text>
                    <TextInput style={styles.input} placeholder="Worcestershire" value={region} onChangeText={setRegion} />
                    
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
                            {selectedCustomer ? selectedCustomer.name : 'Tap to search...'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                    {selectedCustomer && (
                        <View style={{ marginTop: 12 }}>
                            <Text style={styles.readOnlyText}>{selectedCustomer.address}</Text>
                        </View>
                    )}
                </>
            )}
        </View>

        <Text style={styles.sectionTitle}>Job Details</Text>
        <View style={styles.card}>
            <Text style={styles.label}>Job Title *</Text>
            <TextInput style={styles.input} placeholder="e.g. Boiler Repair" value={title} onChangeText={setTitle} />
            <Text style={styles.label}>Notes</Text>
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
                        setEstimatedDuration(DURATIONS[(idx + 1) % DURATIONS.length]);
                    }}>
                        <Text>{estimatedDuration}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>

        <Text style={styles.sectionTitle}>Schedule</Text>
        <View style={styles.card}>
            <View style={styles.row}>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustDate(-1)}><Ionicons name="chevron-back" size={20} color={Colors.primary} /></TouchableOpacity>
                <TouchableOpacity style={styles.dateDisplay} onPress={() => { setPickerMode('date'); setShowDatePicker(true); }}>
                  <Text style={styles.dateText}>{scheduledDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustDate(1)}><Ionicons name="chevron-forward" size={20} color={Colors.primary} /></TouchableOpacity>
            </View>
            <View style={[styles.row, { marginTop: 12 }]}>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustHour(-1)}><Ionicons name="chevron-back" size={20} color={Colors.primary} /></TouchableOpacity>
                <TouchableOpacity style={styles.dateDisplay} onPress={() => { setPickerMode('time'); setShowDatePicker(true); }}>
                  <Text style={styles.dateText}>{scheduledDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustHour(1)}><Ionicons name="chevron-forward" size={20} color={Colors.primary} /></TouchableOpacity>
            </View>
        </View>

        <Modal transparent visible={showDatePicker} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.pickerModalContent}>
              <DateTimePicker
                value={scheduledDate}
                mode={pickerMode}
                is24Hour={true}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                minuteInterval={15}
                textColor="#000000"
                themeVariant="light"
              />
              <TouchableOpacity style={styles.confirmBtn} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.confirmBtnText}>Confirm Selection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Text style={styles.sectionTitle}>Assign To</Text>
        <View style={styles.card}>
            <WorkerPicker companyId={userProfile?.company_id || ''} selectedWorkerIds={assignedTo} onSelect={setAssignedTo} />
        </View>

        <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleCreateJob} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create Job</Text>}
        </TouchableOpacity>

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
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, marginBottom: 16 },
  tab: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: '#fff', elevation: 2 },
  tabText: { fontWeight: '600', color: '#64748b' },
  activeTabText: { color: '#0f172a', fontWeight: '700' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 16, ...Colors.shadow, marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12, fontSize: 16 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', marginTop: 16, marginBottom: 8, textTransform: 'uppercase', paddingLeft: 4 },
  pickerBtn: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerText: { fontSize: 16, color: '#0f172a', fontWeight: '600' },
  placeholderText: { fontSize: 16, color: '#94a3b8' },
  readOnlyText: { color: '#64748b', fontSize: 14, fontStyle: 'italic' },
  adjustBtn: { padding: 10, backgroundColor: '#f1f5f9', borderRadius: 10 },
  dateDisplay: { flex: 1, justifyContent: 'center' },
  dateText: { textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#0f172a' },
  submitBtn: { backgroundColor: Colors.primary, padding: 20, borderRadius: 16, alignItems: 'center', marginTop: 24, marginBottom: 40, ...Colors.shadow },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, maxHeight: '80%', padding: 20 },
  pickerModalContent: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, alignItems: 'center' },
  confirmBtn: { marginTop: 20, backgroundColor: Colors.primary, padding: 12, borderRadius: 10, width: '100%', alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '700' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  customerItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  customerName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  customerAddr: { fontSize: 13, color: '#64748b', marginTop: 2 },
});