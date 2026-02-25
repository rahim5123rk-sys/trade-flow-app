import { router } from 'expo-router';
import {
    collection,
    doc,
    runTransaction,
    serverTimestamp
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
    View
} from 'react-native';
import { WorkerPicker } from '../../../components/WorkerPicker';
import { db } from '../../../src/config/firebase';
import { useAuth } from '../../../src/context/AuthContext';

export default function CreateJobScreen() {
  const { userProfile } = useAuth();
  
  // Form State
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleCreateJob = async () => {
    // 1. Validation
    if (!customerName || !address) {
      Alert.alert('Missing Fields', 'Please provide a customer name and address.');
      return;
    }

    if (!userProfile?.companyId) {
      Alert.alert('Error', 'Company context not found. Please log in again.');
      return;
    }

    setLoading(true);

    try {
      // 2. Execute Transaction to ensure unique Job Reference Number
      await runTransaction(db, async (transaction) => {
        const companyRef = doc(db, 'companies', userProfile.companyId);
        const companyDoc = await transaction.get(companyRef);

        if (!companyDoc.exists()) {
          throw new Error("Company profile not found in database.");
        }

        // Get and increment the job counter
        const currentCount = companyDoc.data().settings?.nextJobNumber || 1;
        const year = new Date().getFullYear();
        const reference = `TF-${year}-${String(currentCount).padStart(4, '0')}`;

        // Create new Job document reference (auto-id)
        const newJobRef = doc(collection(db, 'jobs'));

        // 3. Commit the Job Creation
        transaction.set(newJobRef, {
          companyId: userProfile.companyId,
          reference: reference,
          customerSnapshot: {
            name: customerName,
            address: address,
          },
          assignedTo: assignedTo, // IDs of workers from the picker
          status: 'pending',
          notes: notes,
          createdAt: serverTimestamp(),
          scheduledDate: Date.now(), // Defaulting to now for MVP
        });

        // 4. Update the Company counter
        transaction.update(companyRef, {
          'settings.nextJobNumber': currentCount + 1
        });
      });

      Alert.alert("Success", "Job has been created and assigned.", [
        { text: "View Jobs", onPress: () => router.back() }
      ]);

    } catch (error: any) {
      console.error("Job Creation Error:", error);
      Alert.alert("Error", error.message || "Failed to create job.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.form}>
          
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Customer Name</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. Sarah Jenkins" 
              value={customerName} 
              onChangeText={setCustomerName} 
            />

            <Text style={styles.label}>Site Address</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              placeholder="e.g. 123 High Street, London" 
              multiline
              numberOfLines={2}
              value={address} 
              onChangeText={setAddress} 
            />
          </View>

          <Text style={styles.sectionTitle}>Assignment</Text>
          <WorkerPicker 
            companyId={userProfile?.companyId || ''} 
            selectedWorkerIds={assignedTo} 
            onSelect={setAssignedTo} 
          />

          <Text style={styles.sectionTitle}>Job Details</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Notes / Description</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              placeholder="Describe the task..." 
              multiline 
              numberOfLines={4}
              value={notes}
              onChangeText={setNotes} 
            />
          </View>

          <TouchableOpacity 
            style={[styles.submitButton, loading && styles.disabledButton]} 
            onPress={handleCreateJob} 
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Create & Assign Job</Text>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  form: { padding: 20 },
  sectionTitle: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#6b7280', 
    textTransform: 'uppercase', 
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16
  },
  card: { 
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: { 
    backgroundColor: '#f9fafb', 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#e5e7eb', 
    fontSize: 16 
  },
  textArea: { textAlignVertical: 'top', minHeight: 60 },
  submitButton: { 
    backgroundColor: '#2563eb', 
    padding: 18, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 10,
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5
  },
  disabledButton: { backgroundColor: '#93c5fd' },
  submitButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});