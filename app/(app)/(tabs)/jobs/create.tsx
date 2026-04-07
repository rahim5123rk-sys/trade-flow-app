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
} from '../../../../components/CustomerSelector';
import { WorkerPicker } from '../../../../components/WorkerPicker';
import { Colors, UI } from '../../../../constants/theme';
import { supabase } from '../../../../src/config/supabase';
import { useAuth } from '../../../../src/context/AuthContext';
import { useAppTheme } from '../../../../src/context/ThemeContext';
import { scheduleJobReminders } from '../../../../src/services/notifications';
import { resolveAssignedWorkerIds } from '../../../../src/utils/jobAssignments';

const DURATIONS = ['30 mins', '1 hour', '2 hours', '3 hours', '4 hours', 'Full day', 'Multi-day'];

export default function CreateJobScreen() {
  const { userProfile, user } = useAuth();
  const { mode, prefillDate } = useLocalSearchParams();
  const isQuoteMode = mode === 'quote';
  const isAdmin = userProfile?.role === 'admin';

  // ─── Customer State (shared component) ────────────────────────
  const [customerForm, setCustomerForm] = useState<CustomerFormData>(EMPTY_CUSTOMER_FORM);
  const [isQuickEntry, setIsQuickEntry] = useState(!isQuoteMode);

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
  const { theme, isDark } = useAppTheme();

  useEffect(() => {
    if (!userProfile?.company_id) return;
    checkForWorkers();
  }, [userProfile]);

  useEffect(() => {
    if (!isAdmin && user?.id) {
      setAssignedTo([user.id]);
    }
  }, [isAdmin, user?.id]);

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

        if (custError) {
          // If duplicate customer, find the existing one and reuse it
          if (custError.code === '23505') {
            const { data: existing } = await supabase
              .from('customers')
              .select('id')
              .eq('company_id', userProfile.company_id)
              .ilike('name', insertPayload.name)
              .limit(1)
              .single();
            if (existing) {
              customerId = existing.id;
            } else {
              throw custError;
            }
          } else {
            throw custError;
          }
        } else {
          customerId = newCust.id;
        }
        finalSnapshot = buildCustomerSnapshot(customerForm);
      } else {
        finalSnapshot = buildCustomerSnapshot(customerForm);
      }

      const finalAssignedTo = resolveAssignedWorkerIds({
        assignedTo,
        currentUserId: user?.id,
        isAdmin: Boolean(isAdmin),
      });

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

      await scheduleJobReminders(
        newJob.id,
        title.trim(),
        scheduledDate.getTime(),
      );

      await supabase
        .from('companies')
        .update({
          settings: { ...companyData?.settings, nextJobNumber: currentCount + 1 },
        })
        .eq('id', userProfile.company_id);

      if (isQuoteMode && newJob?.id) {
        router.replace({ pathname: '/(app)/quote', params: { id: newJob.id } });
      } else {
        Alert.alert('Success', 'Job created successfully.');
        router.replace('/(app)/jobs' as any);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create job.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={[styles.container, isDark && { backgroundColor: theme.surface.base }]} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.quickToggleRow}>
          <View>
            <Text style={[styles.modeTitle, isDark && { color: theme.text.title }]}>
              {isQuoteMode ? 'Start New Quote' : isQuickEntry ? 'Quick Add' : 'Detailed Job'}
            </Text>
            <Text style={[styles.modeSubtitle, isDark && { color: theme.text.muted }]}>
              {isQuoteMode
                ? 'Enter initial details to generate quote'
                : isQuickEntry
                ? 'Basic info only'
                : 'Full customer & job details'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.modeToggle, isDark && !isQuickEntry && { backgroundColor: theme.surface.elevated }, isQuickEntry && styles.modeToggleActive]}
            onPress={() => setIsQuickEntry(!isQuickEntry)}
          >
            <Ionicons name={isQuickEntry ? 'flash' : 'list'} size={20} color={isQuickEntry ? '#fff' : theme.brand.primary} />
            <Text style={[styles.modeToggleText, { color: theme.brand.primary }, isQuickEntry && { color: UI.text.white }]}>
              {isQuickEntry ? 'Quick' : 'Full'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Job Details — title first so user can type immediately */}
        <View style={[styles.card, isDark && { backgroundColor: theme.glass.bg, borderWidth: 1, borderColor: theme.glass.border }]}>
          <Text style={[styles.label, isDark && { color: theme.text.muted }]}>{isQuoteMode ? 'Quote Title *' : 'Job Title *'}</Text>
          <TextInput
            style={[styles.input, isDark && { backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title }]}
            placeholder="e.g. Boiler Repair"
            placeholderTextColor={isDark ? theme.text.placeholder : '#94a3b8'}
            value={title}
            onChangeText={setTitle}
            autoFocus={isQuickEntry}
          />
          {isQuickEntry ? (
            <TextInput
              style={[styles.input, isDark && { backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title }]}
              placeholder="Notes (optional)"
              placeholderTextColor={isDark ? theme.text.placeholder : '#94a3b8'}
              value={notes}
              onChangeText={setNotes}
            />
          ) : (
            <>
              <Text style={[styles.label, isDark && { color: theme.text.muted }]}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea, isDark && { backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title }]}
                placeholder="Details..."
                placeholderTextColor={isDark ? theme.text.placeholder : '#94a3b8'}
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.label, isDark && { color: theme.text.muted }]}>Price (£)</Text>
                  <TextInput
                    style={[styles.input, isDark && { backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title }]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? theme.text.placeholder : '#94a3b8'}
                    keyboardType="decimal-pad"
                    value={price}
                    onChangeText={setPrice}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, isDark && { color: theme.text.muted }]}>Duration</Text>
                  <TouchableOpacity
                    style={[styles.input, isDark && { backgroundColor: theme.surface.elevated, borderColor: theme.surface.border }]}
                    onPress={() => {
                      const idx = DURATIONS.indexOf(estimatedDuration);
                      setEstimatedDuration(DURATIONS[(idx + 1) % DURATIONS.length]);
                    }}
                  >
                    <Text style={{ color: isDark ? theme.text.title : Colors.text }}>{estimatedDuration}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
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

        {/* Schedule */}
        <Text style={[styles.sectionTitle, isDark && { color: theme.text.muted }]}>Schedule</Text>
        <View style={[styles.card, isDark && { backgroundColor: theme.glass.bg, borderWidth: 1, borderColor: theme.glass.border }]}>
          {isQuickEntry ? (
            <View>
              <TouchableOpacity
                style={styles.dateDisplay}
                onPress={() => { setPickerMode('date'); setShowDatePicker(true); }}
              >
                <View style={styles.row}>
                  <Ionicons name="calendar-outline" size={20} color={theme.brand.primary} style={{ marginRight: 10 }} />
                  <Text style={[styles.dateText, { textAlign: 'left' }, isDark && { color: theme.text.title }]}>
                    {scheduledDate.toLocaleDateString('en-GB', {
                      weekday: 'short', day: 'numeric', month: 'short',
                    })}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateDisplay, { marginTop: 8 }]}
                onPress={() => { setPickerMode('time'); setShowDatePicker(true); }}
              >
                <View style={styles.row}>
                  <Ionicons name="time-outline" size={20} color={theme.brand.primary} style={{ marginRight: 10 }} />
                  <Text style={[styles.dateText, { textAlign: 'left' }, isDark && { color: theme.text.title }]}>
                    {scheduledDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.adjustBtn, isDark && { backgroundColor: theme.surface.elevated }]} onPress={() => adjustDate(-1)}>
                  <Ionicons name="chevron-back" size={20} color={theme.brand.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateDisplay} onPress={() => { setPickerMode('date'); setShowDatePicker(true); }}>
                  <Text style={[styles.dateText, isDark && { color: theme.text.title }]}>
                    {scheduledDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.adjustBtn, isDark && { backgroundColor: theme.surface.elevated }]} onPress={() => adjustDate(1)}>
                  <Ionicons name="chevron-forward" size={20} color={theme.brand.primary} />
                </TouchableOpacity>
              </View>
              <View style={[styles.row, { marginTop: 12 }]}>
                <TouchableOpacity style={[styles.adjustBtn, isDark && { backgroundColor: theme.surface.elevated }]} onPress={() => adjustHour(-1)}>
                  <Ionicons name="chevron-back" size={20} color={theme.brand.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateDisplay} onPress={() => { setPickerMode('time'); setShowDatePicker(true); }}>
                  <Text style={[styles.dateText, isDark && { color: theme.text.title }]}>
                    {scheduledDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.adjustBtn, isDark && { backgroundColor: theme.surface.elevated }]} onPress={() => adjustHour(1)}>
                  <Ionicons name="chevron-forward" size={20} color={theme.brand.primary} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Date/Time Picker Modal */}
        <Modal transparent visible={showDatePicker} animationType="fade">
          <View style={[styles.modalOverlay]}>
            <View style={[styles.pickerModalContent, isDark && { backgroundColor: theme.surface.card }]}>
              <DateTimePicker
                value={scheduledDate}
                mode={pickerMode}
                is24Hour={true}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                minuteInterval={15}
                textColor={isDark ? '#ffffff' : '#000000'}
                themeVariant={isDark ? 'dark' : 'light'}
              />
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.brand.primary }]} onPress={() => setShowDatePicker(false)}>
                <Text style={[styles.confirmBtnText, { color: theme.text.inverse }]}>Confirm Selection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Assign To */}
        {hasWorkers && !isQuoteMode && isAdmin && (
          <>
            <Text style={[styles.sectionTitle, isDark && { color: theme.text.muted }]}>Assign To (Optional)</Text>
            <View style={[styles.card, isDark && { backgroundColor: theme.glass.bg, borderWidth: 1, borderColor: theme.glass.border }]}>
              <WorkerPicker companyId={userProfile?.company_id || ''} selectedWorkerIds={assignedTo} onSelect={setAssignedTo} />
            </View>
          </>
        )}

        {!isQuoteMode && !isAdmin && (
          <View style={[styles.card, isDark && { backgroundColor: theme.glass.bg, borderWidth: 1, borderColor: theme.glass.border }]}> 
            <Text style={[styles.label, isDark && { color: theme.text.muted }]}>Assigned To</Text>
            <Text style={[styles.workerAssignmentText, isDark && { color: theme.text.title }]}>This job will be assigned to you.</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.submitBtn, { backgroundColor: theme.brand.primary }, loading && { opacity: 0.7 }]} onPress={handleCreateJob} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={theme.text.inverse} />
          ) : (
            <Text style={[styles.submitText, { color: theme.text.inverse }]}>{isQuoteMode ? 'Next: Generate Quote' : 'Create Job'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.surface.base, padding: 16 },
  quickToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 },
  modeTitle: { fontSize: 20, fontWeight: '800', color: UI.text.title },
  modeSubtitle: { fontSize: 13, color: UI.text.muted },
  modeToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: UI.surface.divider, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, gap: 6 },
  modeToggleActive: { backgroundColor: Colors.primary },
  modeToggleText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 16, ...Colors.shadow, marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', color: UI.text.muted, textTransform: 'uppercase', marginBottom: 6 },
  input: { backgroundColor: UI.surface.base, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: UI.surface.divider, marginBottom: 12, fontSize: 16, color: Colors.text },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: UI.text.muted, marginTop: 16, marginBottom: 8, textTransform: 'uppercase', paddingLeft: 4 },
  adjustBtn: { padding: 10, backgroundColor: UI.surface.elevated, borderRadius: 10 },
  dateDisplay: { flex: 1, justifyContent: 'center' },
  dateText: { textAlign: 'center', fontSize: 16, fontWeight: '700', color: UI.text.title },
  submitBtn: { backgroundColor: Colors.primary, padding: 20, borderRadius: 16, alignItems: 'center', marginTop: 24, marginBottom: 40, ...Colors.shadow },
  submitText: { color: UI.text.white, fontWeight: '800', fontSize: 17 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  pickerModalContent: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, alignItems: 'center' },
  confirmBtn: { marginTop: 20, backgroundColor: Colors.primary, padding: 12, borderRadius: 10, width: '100%', alignItems: 'center' },
  confirmBtnText: { color: UI.text.white, fontWeight: '700' },
  workerAssignmentText: { fontSize: 15, fontWeight: '600', color: UI.text.title },
});