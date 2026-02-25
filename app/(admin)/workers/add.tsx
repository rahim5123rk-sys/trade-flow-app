import { router } from 'expo-router';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../../src/config/firebase';
import { useAuth } from '../../../src/context/AuthContext';

export default function AddWorkerScreen() {
  const { userProfile } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddWorker = async () => {
    if (!name || !email) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    // ARCHITECT'S NOTE:
    // In production, we'd call a Firebase Cloud Function here.
    // Why? Because 'createUserWithEmailAndPassword' would log out the Admin.
    // For now, we will simply create a "Placeholder" user document in Firestore.
    // The worker will "Join" via an invite link (Stage 6).
    
    try {
      const workerId = Math.random().toString(36).substring(7); // Temporary ID
      
      await setDoc(doc(db, 'users', workerId), {
        displayName: name,
        email: email.toLowerCase(),
        companyId: userProfile?.companyId,
        role: 'worker',
        status: 'pending_invite',
        createdAt: serverTimestamp(),
      });

      Alert.alert("Success", `${name} added to the team!`, [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert("Error", "Could not add worker.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>Add a worker to your company. They will be able to see assigned jobs.</Text>
      
      <TextInput 
        style={styles.input} 
        placeholder="Full Name (e.g. John Doe)" 
        value={name}
        onChangeText={setName}
      />
      
      <TextInput 
        style={styles.input} 
        placeholder="Email Address" 
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TouchableOpacity style={styles.button} onPress={handleAddWorker} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Invite Worker</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  subtitle: { color: '#666', marginBottom: 20 },
  input: { backgroundColor: '#f9fafb', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
  button: { backgroundColor: '#2563eb', padding: 16, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold' }
});