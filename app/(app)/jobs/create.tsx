// ============================================
// FILE: app/(app)/jobs/create.tsx
// Uses shared CustomerSelector component
// ============================================

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  buildCustomerInsert,
  buildCustomerSnapshot,
  CustomerFormData,
  CustomerSelector,
  EMPTY_CUSTOMER_FORM,
} from '../../../components/CustomerSelector';
import { WorkerPicker } from '../../../components/WorkerPicker';
import { Colors } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';

const DURATIONS = ['30 mins', '1 hour', '2 hours', '3 hours', '4 hours', 'Full day', 'Multi-day'];

export default function CreateJobScreen() {
  const { userProfile, user } = useAuth();
  const { mode, prefillDate } = useLocalSearchParams();
  const isQuoteMode = mode === 'quote';

  // ─── Customer State (shared component) ────────────────────────
  const [customerForm, setCustomerForm] = useState<CustomerFormData>(EMPTY_CUSTOMER_FORM);
  const [isQuickEntry, setIsQuickEntry] = useState(false);

  // ─── Job Fields ───────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [price, setPrice] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('1 hour');

  // ─── Scheduling ───────────────────────────────────────────────
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const [scheduledDate, setScheduledDate] = useState<Date>(() => {
    if (prefillDate && typeof prefillDate === 'string') {
      const d = new Date(prefillDate + 'T09:00:00');
      return isNaN(d.getTime()) ? tomorrow : d;
    }
    return tomorrow;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  // ─── Worker Assignment ────────────────────────────────────────
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [hasWorkers, setHasWorkers] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userProfile?.company_id) return;
    checkForWorkers();
  }, [userProfile]);

  const checkForWorkers = async () => {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', userProfile?.company_id)
      .eq('role', 'worker');
    setHasWorkers((count || 0) > 0);
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

  // ─── Submit ───────────────────────────────────────────────────

  const handleCreateJob = async () => {
    if (!userProfile?.company_id) {
      Alert.alert('Please Wait', 'Your company profile is still loading.');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Missing Field', 'Please enter a title.');
      return;
    }

    // Validate customer
    if (!customerForm.customerId) {
      // New customer mode
      if (!customerForm.customerName.trim()) {
        Alert.alert('Missing Field', 'Customer Name is required.');
        return;
      }
      if (!isQuickEntry && (!customerForm.addressLine1.trim() || !customerForm.postCode.trim())) {
        Alert.alert('Missing Field', 'Address Line 1 and Post Code are required in Full Mode.');
        return;
      }
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

      let customerId = customerForm.customerId || '';
      let finalSnapshot: any;

      if (!customerForm.customerId) {
        // Create new customer
        const insertPayload = buildCustomerInsert(customerForm, userProfile.company_id);

        // In quick mode, override address with the single field
        if (isQuickEntry) {
          insertPayload.address = customerForm.addressLine1.trim() || 'No address provided';
          insertPayload.address_line_1 = customerForm.addressLine1.trim();
        }

        const { data: newCust, error: custError } = await supabase
          .from('customers')
          .insert(insertPayload)
          .select()
          .single();

        if (custError) throw custError;
        customerId = newCust.id;
        finalSnapshot = buildCustomerSnapshot(customerForm);
      } else {
        finalSnapshot = buildCustomerSnapshot(customerForm);
      }

      const finalAssignedTo = assignedTo.length > 0 ? assignedTo : user?.id ? [user.id] : [];

      const { data: newJob, error: jobError } = await supabase
        .from('jobs')
        .insert({
          company_id: userProfile.company_id,
          reference,
          title: title.trim(),
          customer_id: customerId,
          customer_snapshot: finalSnapshot,
          assigned_to: finalAssignedTo,
          status: isQuoteMode ? 'Quote' : 'pending',
          scheduled_date: scheduledDate.getTime(),
          estimated_duration: estimatedDuration,
          price: price ? parseFloat(price) : null,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (jobError) throw jobError;

      await supabase
        .from('companies')
        .update({
          settings: { ...companyData?.settings, nextJobNumber: currentCount + 1 },
        })
        .eq('id', userProfile.company_id);

      if (isQuoteMode && newJob?.id) {
        router.replace({ pathname: '/(app)/jobs/[id]/quote', params: { id: newJob.id } });
      } else {
        Alert.alert('Success', 'Job created successfully.', [
          { text: 'OK', onPress: () => router.replace('/(app)/jobs') },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create job.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.quickToggleRow}>
          <View>
            <Text style={styles.modeTitle}>
              {isQuoteMode ? 'Start New Quote' : isQuickEntry ? 'Quick Add' : 'Detailed Job'}
            </Text>
            <Text style={styles.modeSubtitle}>
              {isQuoteMode
                ? 'Enter initial details to generate quote'
                : isQuickEntry
                ? 'Basic info only'
                : 'Full customer & job details'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.modeToggle, isQuickEntry && styles.modeToggleActive]}
            onPress={() => setIsQuickEntry(!isQuickEntry)}
          >
            <Ionicons name={isQuickEntry ? 'flash' : 'list'} size={20} color={isQuickEntry ? '#fff' : Colors.primary} />
            <Text style={[styles.modeToggleText, isQuickEntry && { color: '#fff' }]}>
              {isQuickEntry ? 'Quick' : 'Full'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ✅ SHARED CUSTOMER SELECTOR */}
        <CustomerSelector
          value={customerForm}
          onChange={setCustomerForm}
          mode="full"
          showQuickToggle={false}
          quickEntry={isQuickEntry}
          onQuickToggleChange={setIsQuickEntry}
          showJobAddress={!isQuickEntry}
        />

        {/* Job Details */}
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.card}>
          <Text style={styles.label}>{isQuoteMode ? 'Quote Title *' : 'Job Title *'}</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Boiler Repair"
            placeholderTextColor="#94a3b8"
            value={title}
            onChangeText={setTitle}
          />
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Details..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />
          {!isQuickEntry && (
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Price (£)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor="#94a3b8"
                  keyboardType="decimal-pad"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Duration</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => {
                    const idx = DURATIONS.indexOf(estimatedDuration);
                    setEstimatedDuration(DURATIONS[(idx + 1) % DURATIONS.length]);
                  }}
                >
                  <Text style={{ color: Colors.text }}>{estimatedDuration}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Schedule */}
        <Text style={styles.sectionTitle}>Schedule</Text>
        <View style={styles.card}>
          {isQuickEntry ? (
            <TouchableOpacity
              style={styles.dateDisplay}
              onPress={() => { setPickerMode('date'); setShowDatePicker(true); }}
            >
              <View style={styles.row}>
                <Ionicons name="calendar-outline" size={20} color={Colors.primary} style={{ marginRight: 10 }} />
                <Text style={[styles.dateText, { textAlign: 'left' }]}>
                  {scheduledDate.toLocaleString('en-GB', {
                    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.row}>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustDate(-1)}>
                  <Ionicons name="chevron-back" size={20} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateDisplay} onPress={() => { setPickerMode('date'); setShowDatePicker(true); }}>
                  <Text style={styles.dateText}>
                    {scheduledDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustDate(1)}>
                  <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={[styles.row, { marginTop: 12 }]}>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustHour(-1)}>
                  <Ionicons name="chevron-back" size={20} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateDisplay} onPress={() => { setPickerMode('time'); setShowDatePicker(true); }}>
                  <Text style={styles.dateText}>
                    {scheduledDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustHour(1)}>
                  <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Date/Time Picker Modal */}
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

        {/* Assign To */}
        {hasWorkers && !isQuoteMode && (
          <>
            <Text style={styles.sectionTitle}>Assign To (Optional)</Text>
            <View style={styles.card}>
              <WorkerPicker companyId={userProfile?.company_id || ''} selectedWorkerIds={assignedTo} onSelect={setAssignedTo} />
            </View>
          </>
        )}

        <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleCreateJob} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{isQuoteMode ? 'Next: Generate Quote' : 'Create Job'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  quickToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 },
  modeTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  modeSubtitle: { fontSize: 13, color: '#64748b' },
  modeToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, gap: 6 },
  modeToggleActive: { backgroundColor: Colors.primary },
  modeToggleText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 16, ...Colors.shadow, marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12, fontSize: 16, color: Colors.text },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', marginTop: 16, marginBottom: 8, textTransform: 'uppercase', paddingLeft: 4 },
  adjustBtn: { padding: 10, backgroundColor: '#f1f5f9', borderRadius: 10 },
  dateDisplay: { flex: 1, justifyContent: 'center' },
  dateText: { textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#0f172a' },
  submitBtn: { backgroundColor: Colors.primary, padding: 20, borderRadius: 16, alignItems: 'center', marginTop: 24, marginBottom: 40, ...Colors.shadow },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  pickerModalContent: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, alignItems: 'center' },
  confirmBtn: { marginTop: 20, backgroundColor: Colors.primary, padding: 12, borderRadius: 10, width: '100%', alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '700' },
});