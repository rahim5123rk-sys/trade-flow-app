// ============================================
// FILE: app/(app)/customers/add.tsx
// ============================================

import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { router } from 'expo-router';
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
import { Colors } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';

export default function AddCustomerScreen() {
  const { userProfile } = useAuth();

  const [customerName, setCustomerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postCode, setPostCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImportContact = async () => {
    // GDPR: Show disclosure before requesting contacts permission
    Alert.alert(
      'Import from Contacts',
      'TradeFlow will access your contacts to pre-fill the customer\'s name, phone, email, and address. Only the contact you select will be used — no data is uploaded until you save.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            try {
              const { status } = await Contacts.requestPermissionsAsync();

              if (status !== 'granted') {
                Alert.alert('Permission denied', 'Contacts permission is required to import.');
                return;
              }

              const contact = await Contacts.presentContactPickerAsync();

              if (contact) {
                if (contact.name) setCustomerName(contact.name);

                if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
                  setPhone(contact.phoneNumbers[0].number || '');
                }

                if (contact.emails && contact.emails.length > 0) {
                  setEmail(contact.emails[0].email || '');
                }

                if (contact.addresses && contact.addresses.length > 0) {
                  const addr = contact.addresses[0];
                  if (addr.street) setAddress1(addr.street);
                  if (addr.city) setCity(addr.city);
                  if (addr.region) setRegion(addr.region);
                  if (addr.postalCode) setPostCode(addr.postalCode);
                }
              }
            } catch (e) {
              console.log('Error picking contact');
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!customerName.trim() || !address1.trim() || !postCode.trim()) {
      Alert.alert('Missing Info', 'Contact Name, Address Line 1, and Post Code are required.');
      return;
    }

    setLoading(true);

    try {
      const combinedAddress = [address1, address2, city, region, postCode]
        .filter(Boolean)
        .join(', ');

      const { error } = await supabase.from('customers').insert({
        company_id: userProfile?.company_id,
        name: customerName.trim(),
        company_name: companyName.trim() || null,
        address_line_1: address1.trim(),
        address_line_2: address2.trim() || null,
        city: city.trim() || null,
        region: region.trim() || null,
        postal_code: postCode.trim().toUpperCase(),
        address: combinedAddress,
        phone: phone.trim() || null,
        email: email.trim() || null,
      });

      if (error) throw error;

      Alert.alert('Success', 'Customer added.');
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Could not add customer.');
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
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Import Button */}
        <TouchableOpacity style={styles.importBtn} onPress={handleImportContact}>
          <Ionicons name="cloud-download-outline" size={24} color={Colors.primary} />
          <Text style={styles.importBtnText}>Import from Contacts</Text>
        </TouchableOpacity>

        {/* Customer Details Card */}
        <View style={styles.card}>
          <Text style={styles.label}>Contact Name *</Text>
          <TextInput
            style={styles.input}
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="e.g. Sarah Jenkins"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>Company Name</Text>
          <TextInput
            style={styles.input}
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="e.g. Jenkins Plumbing Ltd"
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* Address Card */}
        <Text style={styles.sectionTitle}>Address</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Address Line 1 *</Text>
          <TextInput
            style={styles.input}
            value={address1}
            onChangeText={setAddress1}
            placeholder="Street address"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>Address Line 2</Text>
          <TextInput
            style={styles.input}
            value={address2}
            onChangeText={setAddress2}
            placeholder="Apt / Suite / Unit"
            placeholderTextColor="#94a3b8"
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="Worcester"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Post Code *</Text>
              <TextInput
                style={styles.input}
                value={postCode}
                onChangeText={setPostCode}
                placeholder="WR1 1PA"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
              />
            </View>
          </View>

          <Text style={styles.label}>Region / County</Text>
          <TextInput
            style={styles.input}
            value={region}
            onChangeText={setRegion}
            placeholder="Worcestershire"
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* Contact Info Card */}
        <Text style={styles.sectionTitle}>Contact Information</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="07700..."
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="email@..."
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Save Customer</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },

  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 8,
  },
  importBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    paddingLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    ...Colors.shadow,
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    fontSize: 16,
    color: Colors.text,
  },
  row: { flexDirection: 'row' },
  btn: {
    backgroundColor: Colors.primary,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
    ...Colors.shadow,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
});