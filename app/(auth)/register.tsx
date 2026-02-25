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
import { Colors } from '../../constants/theme';
import { supabase } from '../../src/config/supabase';

export default function RegisterScreen() {
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !name || !companyName) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    setLoading(true);

    try {
      // 1. Sign Up User (This generates a valid UUID)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('User creation failed.');

      // 2. Create Company
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyName.trim(),
          email: email.trim(),
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // 3. Create Profile (Using the UUID from authData.user.id)
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id, // CRITICAL: This must be the UUID from Auth
          email: email.trim(),
          display_name: name.trim(),
          company_id: companyData.id,
          role: 'admin',
        });

      if (profileError) throw profileError;

      Alert.alert('Success', 'Account created! Logging you in...');
      // Navigation is usually handled by the AuthListener in AuthContext
    } catch (error: any) {
      console.error(error);
      Alert.alert('Registration Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>TradeFlow</Text>
          <Text style={styles.subtitle}>Register your business</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Company Name</Text>
          <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} placeholder="Acme Ltd" />

          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="John Doe" />

          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#fff', padding: 20, justifyContent: 'center' },
  header: { marginBottom: 30, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '900', color: Colors.primary },
  subtitle: { fontSize: 16, color: Colors.textLight },
  form: { gap: 15 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase' },
  input: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  btn: { backgroundColor: Colors.primary, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});