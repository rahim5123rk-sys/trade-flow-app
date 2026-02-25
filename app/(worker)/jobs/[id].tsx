import { useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from './../../../src/config/firebase';
import { Job } from './../../../src/types';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams(); // Get the ID from the URL
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    if (!id) return;
    const docRef = doc(db, 'jobs', id as string);
    const unsub = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        setJob({ id: doc.id, ...doc.data() } as Job);
      }
    });
    return unsub;
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    try {
      await updateDoc(doc(db, 'jobs', id as string), { status: newStatus });
      Alert.alert('Updated', `Job marked as ${newStatus}`);
    } catch (error) {
      Alert.alert('Error', 'Could not update job');
    }
  };

  if (!job) return <View style={styles.container}><Text>Loading...</Text></View>;

  return (
    <ScrollView style={styles.container}>
      {/* Header Section */}
      <View style={styles.section}>
        <Text style={styles.ref}>{job.reference}</Text>
        <Text style={styles.status}>Status: {job.status}</Text>
      </View>

      {/* Customer Details */}
      <View style={styles.section}>
        <Text style={styles.label}>CUSTOMER</Text>
        <Text style={styles.value}>{job.customerSnapshot.name}</Text>
        <Text style={styles.value}>{job.customerSnapshot.address}</Text>
      </View>

      {/* Job Notes */}
      <View style={styles.section}>
        <Text style={styles.label}>NOTES</Text>
        <Text style={styles.value}>{job.notes || "No notes provided."}</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {job.status === 'pending' && (
          <TouchableOpacity 
            style={[styles.btn, styles.btnStart]} 
            onPress={() => updateStatus('in_progress')}
          >
            <Text style={styles.btnText}>Start Job</Text>
          </TouchableOpacity>
        )}

        {job.status === 'in_progress' && (
          <TouchableOpacity 
            style={[styles.btn, styles.btnComplete]} 
            onPress={() => updateStatus('complete')}
          >
            <Text style={styles.btnText}>Complete Job</Text>
          </TouchableOpacity>
        )}
        
        {job.status === 'complete' && (
             <Text style={styles.completedText}>Job Completed ✅</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  section: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 16 },
  ref: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  status: { fontSize: 16, color: '#666', marginTop: 4, textTransform: 'capitalize' },
  label: { fontSize: 12, fontWeight: 'bold', color: '#999', marginBottom: 8 },
  value: { fontSize: 16, color: '#333', marginBottom: 4 },
  actions: { marginTop: 20 },
  btn: { padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  btnStart: { backgroundColor: '#2563eb' },
  btnComplete: { backgroundColor: '#10b981' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  completedText: { textAlign: 'center', fontSize: 18, color: '#10b981', fontWeight: 'bold' }
});