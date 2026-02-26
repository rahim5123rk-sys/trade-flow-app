import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    fetchInviteCode();
  }, [userProfile]);

  const fetchInviteCode = async () => {
    if (!userProfile?.company_id) return;
    const { data } = await supabase
        .from('companies')
        .select('invite_code')
        .eq('id', userProfile.company_id)
        .single();
    if (data) setInviteCode(data.invite_code);
  };

  const copyToClipboard = async () => {
    if (inviteCode) {
      await Clipboard.setStringAsync(inviteCode);
      Alert.alert('Copied!', 'Invite code copied to clipboard.');
    }
  };

  const handleRegenerateCode = async () => {
    Alert.alert(
        'Regenerate Code', 
        'This will invalidate the old code. Future workers will need the new code to join.',
        [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Regenerate', 
                style: 'destructive',
                onPress: async () => {
                    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
                    const nums = '23456789';
                    let code = '';
                    for (let i = 0; i < 3; i++) code += letters.charAt(Math.floor(Math.random() * letters.length));
                    code += '-';
                    for (let i = 0; i < 3; i++) code += nums.charAt(Math.floor(Math.random() * nums.length));
                    
                    const { error } = await supabase
                        .from('companies')
                        .update({ invite_code: code })
                        .eq('id', userProfile!.company_id);
                    
                    if (!error) setInviteCode(code);
                }
            }
        ]
    );
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
        Alert.alert('Error', 'Could not create test worker.');
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
        <Text style={styles.title}>Invite Team Members</Text>
        <Text style={styles.subtitle}>
          Workers can join your company by entering this code during registration.
        </Text>

        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>INVITE CODE</Text>
          <TouchableOpacity style={styles.codeRow} onPress={copyToClipboard}>
            <Text style={styles.code}>{inviteCode || '...'}</Text>
            <Ionicons name="copy-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.button, styles.primaryBtn]} onPress={copyToClipboard}>
          <Text style={styles.primaryBtnText}>Copy Code</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.regenBtn} onPress={handleRegenerateCode}>
            <Text style={styles.regenText}>Regenerate Code</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dividerContainer}>
        <View style={styles.line} />
        <Text style={styles.orText}>DEVELOPER TOOLS</Text>
        <View style={styles.line} />
      </View>

      <TouchableOpacity style={styles.testBtn} onPress={handleCreateTestWorker} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={Colors.text} />
        ) : (
          <>
            <Ionicons name="flask" size={20} color={Colors.text} />
            <View style={{flex: 1}}>
              <Text style={styles.testBtnTitle}>Create Test Worker</Text>
              <Text style={styles.testBtnSub}>Adds a dummy profile to your team list.</Text>
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
  title: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  subtitle: { color: Colors.textLight, marginBottom: 20, fontSize: 14, lineHeight: 20 },
  codeBox: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
  codeLabel: { fontSize: 10, fontWeight: '700', color: Colors.textLight, marginBottom: 4, letterSpacing: 1 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 28, fontWeight: 'bold', color: Colors.text, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 2 },
  button: { padding: 16, borderRadius: 10, alignItems: 'center' },
  primaryBtn: { backgroundColor: Colors.primary, ...Colors.shadow },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  regenBtn: { alignItems: 'center', marginTop: 16 },
  regenText: { color: Colors.danger, fontWeight: '600', fontSize: 14 },
  
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: { marginHorizontal: 12, color: Colors.textLight, fontWeight: '600', fontSize: 10 },
  testBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 12, borderStyle: 'dashed' },
  testBtnTitle: { fontWeight: '700', color: Colors.text, fontSize: 15 },
  testBtnSub: { color: Colors.textLight, fontSize: 12 },
});