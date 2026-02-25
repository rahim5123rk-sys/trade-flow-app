import { router } from 'expo-router';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../../src/config/firebase';
import { useAuth } from '../../../src/context/AuthContext';

// ─── Screen ───────────────────────────────────────────────────────────────────
//
// HOW THE INVITE FLOW WORKS:
//
// 1. Admin fills in worker's name + email here.
// 2. We write a placeholder doc to: invites/{email}
//    (keyed by email, NOT a random ID — this is the link between invite and real user)
// 3. The worker downloads the app, goes to Register, and enters the same email.
// 4. On registration, we look up invites/{email}, find the companyId + role,
//    and write their real UID to users/{uid} with the correct companyId.
//
// This works without Cloud Functions. The invite doc is the handshake.
//
// TODO (Phase 2): Send a real invite email via Firebase Extensions (Trigger Email).

export default function AddWorkerScreen() {
  const { userProfile } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddWorker = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!trimmedName || !trimmedEmail) {
      Alert.alert('Missing Fields', 'Please enter both a name and email address.');
      return;
    }

    // Basic email validation
    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!userProfile?.companyId) {
      Alert.alert('Error', 'Company context not found. Please log in again.');
      return;
    }

    setLoading(true);

    try {
      // Key the invite doc by email so we can look it up during worker registration.
      // Firestore doc IDs cannot contain '/' so we replace '@' with '_at_' and '.' with '_dot_'.
      const safeEmailKey = trimmedEmail.replace('@', '_at_').replace(/\./g, '_dot_');

      await setDoc(doc(db, 'invites', safeEmailKey), {
        displayName: trimmedName,
        email: trimmedEmail,
        companyId: userProfile.companyId,
        role: 'worker',
        status: 'pending',
        invitedBy: userProfile.uid,
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        'Worker Invited',
        `${trimmedName} has been added. Ask them to download TradeFlow and register with ${trimmedEmail}.`,
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (e: any) {
      console.error('Add worker error:', e);
      Alert.alert('Error', 'Could not save worker invite. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
        <Text style={styles.subtitle}>
          Enter the worker's details. They'll register in the app using this email address to be automatically linked to your company.
        </Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. John Doe"
          autoCapitalize="words"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          placeholder="john@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleAddWorker}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Add Worker</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  subtitle: { color: '#6b7280', marginBottom: 24, fontSize: 14, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#f9fafb',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { backgroundColor: '#93c5fd' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
