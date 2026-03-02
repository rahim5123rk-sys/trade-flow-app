import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors, UI } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';
import { useAppTheme } from '../../../src/context/ThemeContext';

export default function AddWorkerScreen() {
  const { userProfile } = useAuth();
  const { theme, isDark } = useAppTheme();
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

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface.base }}>
      <LinearGradient
        colors={theme.gradients.appBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={[styles.card, isDark && { backgroundColor: theme.glass.bg, borderColor: theme.glass.border }] }>
          <Text style={[styles.title, { color: theme.text.title }]}>Invite Team Members</Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }] }>
            Workers can join your company by entering this code during registration.
          </Text>

          <View style={[styles.codeBox, isDark && { backgroundColor: theme.surface.elevated, borderColor: theme.surface.border }] }>
            <Text style={[styles.codeLabel, { color: theme.text.muted }]}>INVITE CODE</Text>
            <TouchableOpacity style={styles.codeRow} onPress={copyToClipboard}>
              <Text style={[styles.code, { color: theme.text.title }]}>{inviteCode || '...'}</Text>
              <Ionicons name="copy-outline" size={24} color={theme.brand.primary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.button, styles.primaryBtn, { backgroundColor: theme.brand.primary }]} onPress={copyToClipboard}>
            <Text style={[styles.primaryBtnText, { color: theme.text.inverse }]}>Copy Code</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.regenBtn} onPress={handleRegenerateCode}>
              <Text style={styles.regenText}>Regenerate Code</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: Colors.background },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)', padding: 20, borderRadius: 12, ...Colors.shadow },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  subtitle: { color: Colors.textLight, marginBottom: 20, fontSize: 14, lineHeight: 20 },
  codeBox: { backgroundColor: UI.surface.base, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: UI.surface.divider, marginBottom: 20 },
  codeLabel: { fontSize: 10, fontWeight: '700', color: Colors.textLight, marginBottom: 4, letterSpacing: 1 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 28, fontWeight: 'bold', color: Colors.text, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 2 },
  button: { padding: 16, borderRadius: 10, alignItems: 'center' },
  primaryBtn: { backgroundColor: Colors.primary, ...Colors.shadow },
  primaryBtnText: { color: UI.text.white, fontWeight: 'bold', fontSize: 16 },
  regenBtn: { alignItems: 'center', marginTop: 16 },
  regenText: { color: Colors.danger, fontWeight: '600', fontSize: 14 },
});