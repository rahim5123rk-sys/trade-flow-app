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
        <View style={styles.card}>
          <Text style={styles.label}>Customer Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Jane Smith" />

          <Text style={styles.label}>Address *</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="123 Main St..." multiline />

          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Customer</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, ...Colors.shadow },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textLight, marginBottom: 8, marginTop: 12, textTransform: 'uppercase' },
  input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, fontSize: 16 },
  btn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24, ...Colors.shadow },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});