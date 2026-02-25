import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
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
import { db } from '../../../src/config/firebase';
import { useAuth } from '../../../src/context/AuthContext';

const PROPERTY_TYPES = ['Residential', 'Commercial'];

export default function AddCustomerScreen() {
  const { userProfile } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [propertyType, setPropertyType] = useState('Residential');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Field', 'Please enter a customer name.');
      return;
    }
    if (!userProfile?.companyId) {
      Alert.alert('Error', 'Company context missing.');
      return;
    }

    setLoading(true);
    try {
      const newRef = doc(collection(db, 'customers'));
      await setDoc(newRef, {
        companyId: userProfile.companyId,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim().toLowerCase() || null,
        address: address.trim() || null,
        propertyType,
        notes: notes.trim() || null,
        createdAt: serverTimestamp(),
      });

      Alert.alert('Customer Added', `${name.trim()} has been saved.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.error('Add customer error:', e);
      Alert.alert('Error', 'Could not save customer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.label}>Full Name / Company Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Sarah Jenkins or ABC Lettings"
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 07700 900000"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="customer@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Address</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Full site address"
            multiline
            numberOfLines={3}
            value={address}
            onChangeText={setAddress}
          />

          <Text style={styles.label}>Property Type</Text>
          <View style={styles.pillRow}>
            {PROPERTY_TYPES.map((pt) => (
              <TouchableOpacity
                key={pt}
                style={[styles.pill, propertyType === pt && styles.pillActive]}
                onPress={() => setPropertyType(pt)}
              >
                <Text style={[styles.pillText, propertyType === pt && styles.pillTextActive]}>
                  {pt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any useful info about this customer..."
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.submitBtnText}>Save Customer</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
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
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 15,
  },
  textArea: { textAlignVertical: 'top', minHeight: 64 },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pillActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  pillText: { fontSize: 14, color: '#374151' },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#2563eb',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  submitBtnDisabled: { backgroundColor: '#93c5fd' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});