import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
    collection,
    doc,
    runTransaction,
    serverTimestamp,
} from 'firebase/firestore';
import React, { useState } from 'react';
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
import { WorkerPicker } from '../../../components/WorkerPicker';
import { db } from '../../../src/config/firebase';
import { useAuth } from '../../../src/context/AuthContext';
import { JobCategory } from '../../../src/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: JobCategory[] = [
  'Gas & Heating',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Carpentry',
  'Building',
  'Roofing',
  'Other',
];

const DURATIONS = ['30 mins', '1 hour', '2 hours', '3 hours', '4 hours', 'Full day', 'Multi-day'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Simple pill selector used for category and duration
const PillSelector = ({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
}) => (
  <View style={styles.pillRow}>
    {options.map((opt) => (
      <TouchableOpacity
        key={opt}
        style={[styles.pill, selected === opt && styles.pillActive]}
        onPress={() => onSelect(opt)}
        activeOpacity={0.7}
      >
        <Text style={[styles.pillText, selected === opt && styles.pillTextActive]}>
          {opt}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

// Format a Date object to a readable string
const formatDate = (date: Date) =>
  date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const formatTime = (date: Date) =>
  date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreateJobScreen() {
  const { userProfile } = useAuth();

  // Customer fields
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Job fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<JobCategory>('Other');
  const [notes, setNotes] = useState('');
  const [price, setPrice] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('1 hour');

  // Scheduling — default to tomorrow 9am
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const [scheduledDate, setScheduledDate] = useState<Date>(tomorrow);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Assignment
  const [assignedTo, setAssignedTo] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

  // ── Date helpers ─────────────────────────────────────────────────────────

  // Nudge date forward/backward by days
  const adjustDate = (days: number) => {
    const d = new Date(scheduledDate);
    d.setDate(d.getDate() + days);
    setScheduledDate(d);
  };

  // Nudge time forward/backward by hours
  const adjustHour = (hours: number) => {
    const d = new Date(scheduledDate);
    d.setHours(d.getHours() + hours);
    setScheduledDate(d);
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleCreateJob = async () => {
    // Validation
    if (!customerName.trim()) {
      Alert.alert('Missing Field', 'Please enter a customer name.');
      return;
    }
    if (!customerAddress.trim()) {
      Alert.alert('Missing Field', 'Please enter a site address.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Missing Field', 'Please enter a job title.');
      return;
    }
    if (!userProfile?.companyId) {
      Alert.alert('Error', 'Company context missing. Please log in again.');
      return;
    }

    const priceValue = price ? parseFloat(price) : undefined;
    if (price && isNaN(priceValue!)) {
      Alert.alert('Invalid Price', 'Please enter a valid number for price.');
      return;
    }

    setLoading(true);

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Get company doc to read and increment job counter
        const companyRef = doc(db, 'companies', userProfile.companyId);
        const companyDoc = await transaction.get(companyRef);

        if (!companyDoc.exists()) {
          throw new Error('Company profile not found. Please contact support.');
        }

        const currentCount = companyDoc.data().settings?.nextJobNumber || 1;
        const year = new Date().getFullYear();
        const reference = `TF-${year}-${String(currentCount).padStart(4, '0')}`;

        // 2. Create job document
        const newJobRef = doc(collection(db, 'jobs'));

        transaction.set(newJobRef, {
          companyId: userProfile.companyId,
          reference,
          title: title.trim(),
          category,
          customerSnapshot: {
            name: customerName.trim(),
            address: customerAddress.trim(),
            phone: customerPhone.trim() || null,
          },
          assignedTo,
          status: 'pending',
          scheduledDate: scheduledDate.getTime(),
          estimatedDuration,
          price: priceValue ?? null,
          paymentStatus: 'unpaid',
          notes: notes.trim() || null,
          createdAt: serverTimestamp(),
        });

        // 3. Increment job counter on company doc
        transaction.update(companyRef, {
          'settings.nextJobNumber': currentCount + 1,
        });
      });

      Alert.alert('Job Created', `Job has been created and assigned.`, [
        { text: 'View Jobs', onPress: () => router.replace('/(admin)/jobs') },
      ]);
    } catch (error: any) {
      console.error('Job creation error:', error);
      Alert.alert('Error', error.message || 'Failed to create job. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>

          {/* ── Customer ── */}
          <Text style={styles.sectionTitle}>Customer</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Customer Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sarah Jenkins"
              autoCapitalize="words"
              value={customerName}
              onChangeText={setCustomerName}
            />

            <Text style={styles.label}>Site Address *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. 123 High Street, London, SW1A 1AA"
              multiline
              numberOfLines={2}
              value={customerAddress}
              onChangeText={setCustomerAddress}
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 07700 900000"
              keyboardType="phone-pad"
              value={customerPhone}
              onChangeText={setCustomerPhone}
            />
          </View>

          {/* ── Job Details ── */}
          <Text style={styles.sectionTitle}>Job Details</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Job Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Boiler service and repair"
              autoCapitalize="sentences"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>Category</Text>
            <PillSelector
              options={CATEGORIES}
              selected={category}
              onSelect={(val) => setCategory(val as JobCategory)}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>Notes / Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the task, any access info, parts needed..."
              multiline
              numberOfLines={4}
              value={notes}
              onChangeText={setNotes}
            />

            <Text style={styles.label}>Price (£)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 150.00"
              keyboardType="decimal-pad"
              value={price}
              onChangeText={setPrice}
            />
          </View>

          {/* ── Schedule ── */}
          <Text style={styles.sectionTitle}>Schedule</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Date</Text>
            <View style={styles.adjustRow}>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustDate(-1)}>
                <Ionicons name="chevron-back" size={18} color="#2563eb" />
              </TouchableOpacity>
              <Text style={styles.adjustValue}>{formatDate(scheduledDate)}</Text>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustDate(1)}>
                <Ionicons name="chevron-forward" size={18} color="#2563eb" />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>Time</Text>
            <View style={styles.adjustRow}>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustHour(-1)}>
                <Ionicons name="chevron-back" size={18} color="#2563eb" />
              </TouchableOpacity>
              <Text style={styles.adjustValue}>{formatTime(scheduledDate)}</Text>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustHour(1)}>
                <Ionicons name="chevron-forward" size={18} color="#2563eb" />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>Estimated Duration</Text>
            <PillSelector
              options={DURATIONS}
              selected={estimatedDuration}
              onSelect={setEstimatedDuration}
            />
          </View>

          {/* ── Assignment ── */}
          <Text style={styles.sectionTitle}>Assign To</Text>
          <View style={styles.card}>
            <WorkerPicker
              companyId={userProfile?.companyId || ''}
              selectedWorkerIds={assignedTo}
              onSelect={setAssignedTo}
            />
          </View>

          {/* ── Submit ── */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleCreateJob}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>Create & Assign Job</Text>
              </>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  form: { padding: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 15,
  },
  textArea: { textAlignVertical: 'top', minHeight: 64 },

  // Pills
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pillActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  pillText: { fontSize: 13, color: '#374151' },
  pillTextActive: { color: '#fff', fontWeight: '600' },

  // Date/time adjuster
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  adjustBtn: { padding: 12, backgroundColor: '#f3f4f6' },
  adjustValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },

  // Submit
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#2563eb',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  submitBtnDisabled: { backgroundColor: '#93c5fd' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});