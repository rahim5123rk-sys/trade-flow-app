import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';

export default function AddWorkerScreen() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const copyToClipboard = async () => {
    if (userProfile?.company_id) {
      await Clipboard.setStringAsync(userProfile.company_id);
      Alert.alert('Copied!', 'Company ID copied to clipboard.');
    }
  };

  const handleCreateTestWorker = async () => {
    if (!userProfile?.company_id) return;
    setLoading(true);

    try {
      const fakeId = Math.random().toString(36).substring(2, 15);
      
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: fakeId, 
          display_name: `Test Worker ${Math.floor(Math.random() * 100)}`,
          email: `worker${Date.now()}@test.com`,
          company_id: userProfile.company_id,
          role: 'worker',
          is_test_user: true
        });

      if (error) {
        console.error(error);
        Alert.alert('Database Error', 'Could not create test worker. Profile table may require a valid Auth ID.');
      } else {
        Alert.alert('Success', 'Test worker created.');
        router.back();
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to create test worker.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Invite Workers</Text>
        <Text style={styles.subtitle}>
          Workers must download the app and "Join Company" using your Company ID below.
        </Text>

        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>YOUR COMPANY ID</Text>
          <TouchableOpacity style={styles.codeRow} onPress={copyToClipboard}>
            <Text style={styles.code}>{userProfile?.company_id || 'Loading...'}</Text>
            <Ionicons name="copy-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.button, styles.primaryBtn]} onPress={copyToClipboard}>
          <Text style={styles.primaryBtnText}>Copy Company ID</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dividerContainer}>
        <View style={styles.line} />
        <Text style={styles.orText}>OR</Text>
        <View style={styles.line} />
      </View>

      <TouchableOpacity style={styles.testBtn} onPress={handleCreateTestWorker} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={Colors.text} />
        ) : (
          <>
            <Ionicons name="flask" size={20} color={Colors.text} />
            <View style={{flex: 1}}>
              <Text style={styles.testBtnTitle}>Generate Test Worker Profile</Text>
              <Text style={styles.testBtnSub}>Adds a dummy row to your team list for UI testing.</Text>
            </View>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: Colors.background },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, ...Colors.shadow },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  subtitle: { color: Colors.textLight, marginBottom: 20, fontSize: 14, lineHeight: 20 },
  codeBox: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
  codeLabel: { fontSize: 10, fontWeight: '700', color: Colors.textLight, marginBottom: 4, letterSpacing: 1 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 18, fontWeight: 'bold', color: Colors.text, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  button: { padding: 16, borderRadius: 10, alignItems: 'center' },
  primaryBtn: { backgroundColor: Colors.primary, ...Colors.shadow },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: { marginHorizontal: 12, color: Colors.textLight, fontWeight: '600', fontSize: 12 },
  testBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 12, borderStyle: 'dashed' },
  testBtnTitle: { fontWeight: '700', color: Colors.text, fontSize: 15 },
  testBtnSub: { color: Colors.textLight, fontSize: 12 },
});