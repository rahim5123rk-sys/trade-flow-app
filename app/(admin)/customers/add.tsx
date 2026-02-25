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
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // --- NEW: Handle Contact Import ---
  const handleImportContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Sorry, we need contacts permission to do this.');
        return;
      }

      // Open the native contact picker
      const contact = await Contacts.presentContactPickerAsync();

      if (contact) {
        // 1. Set Name
        if (contact.name) setName(contact.name);
        
        // 2. Set Phone (Pick the first mobile or any number)
        if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
          setPhone(contact.phoneNumbers[0].number || '');
        }

        // 3. Set Email
        if (contact.emails && contact.emails.length > 0) {
          setEmail(contact.emails[0].email || '');
        }

        // 4. Set Address (Try to format it nicely)
        if (contact.addresses && contact.addresses.length > 0) {
          const addr = contact.addresses[0];
          // Construct a single string from address components
          const fullAddress = [
            addr.street, 
            addr.city, 
            addr.region, 
            addr.postalCode
          ].filter(Boolean).join(', ');
          
          setAddress(fullAddress);
        }
      }
    } catch (e) {
      console.log('Error picking contact', e);
      // Fail silently or show generic error, mostly happens if user cancels
    }
  };
  // ----------------------------------

  const handleSave = async () => {
    if (!name.trim() || !address.trim()) {
      Alert.alert('Missing Info', 'Name and Address are required.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('customers').insert({
        company_id: userProfile?.company_id,
        name,
        address,
        phone,
        email,
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        
        {/* Import Button */}
        <TouchableOpacity style={styles.importBtn} onPress={handleImportContact}>
           <Ionicons name="cloud-download-outline" size={24} color={Colors.primary} />
           <Text style={styles.importBtnText}>Import from Contacts</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.label}>Customer Name *</Text>
          <TextInput 
            style={styles.input} 
            value={name} 
            onChangeText={setName} 
            placeholder="e.g. Jane Smith" 
          />

          <Text style={styles.label}>Address *</Text>
          <TextInput 
            style={styles.input} 
            value={address} 
            onChangeText={setAddress} 
            placeholder="123 Main St..." 
            multiline 
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput 
            style={styles.input} 
            value={phone} 
            onChangeText={setPhone} 
            keyboardType="phone-pad" 
          />

          <Text style={styles.label}>Email</Text>
          <TextInput 
            style={styles.input} 
            value={email} 
            onChangeText={setEmail} 
            keyboardType="email-address" 
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={loading}>
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
  
  // Import Button Styles
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

  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, ...Colors.shadow },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textLight, marginBottom: 8, marginTop: 12, textTransform: 'uppercase' },
  input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, fontSize: 16 },
  btn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24, ...Colors.shadow },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});