import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
  Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ProPaywallModal from '../../../components/ProPaywallModal';
import { Colors, UI } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';
import { useSubscription } from '../../../src/context/SubscriptionContext';
import { useAppTheme } from '../../../src/context/ThemeContext';

export default function AddWorkerScreen() {
  const { userProfile } = useAuth();
  const { theme, isDark } = useAppTheme();
  const { isPro, seatLimit } = useSubscription();
  const [showSeatLimit, setShowSeatLimit] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [seatInfo, setSeatInfo] = useState<{ current: number; limit: number } | null>(null);

  const handleOpenTeamBilling = () => {
    Linking.openURL('https://gaspilotapp.com/team');
  };

  useEffect(() => {
    fetchInviteCode();
    checkSeatLimit();
  }, [userProfile, seatLimit]);

  const checkSeatLimit = async () => {
    if (!userProfile?.company_id || !isPro) return;
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', userProfile.company_id)
      .neq('role', 'admin');
    const current = count ?? 0;
    setSeatInfo({ current, limit: seatLimit });
    setShowSeatLimit(current >= seatLimit);
  };

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
      <ProPaywallModal
        visible={!isPro}
        onDismiss={() => router.back()}
        featureTitle="Team Management"
        featureDescription="Invite workers, assign jobs, and manage your team all from one place."
      />
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
          {showSeatLimit && (
            <View style={{ backgroundColor: isDark ? theme.surface.elevated : '#FEF3C7', padding: 12, borderRadius: 10, marginBottom: 16 }}>
              <Text style={{ color: isDark ? theme.text.body : '#92400E', fontSize: 13, lineHeight: 18, fontWeight: '600' }}>
                No seats available — new workers cannot join until you purchase more seats below.
              </Text>
            </View>
          )}

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
              <Text style={[styles.regenText, { color: theme.brand.danger }]}>Regenerate Code</Text>
          </TouchableOpacity>
        </View>

        {/* Seat usage info */}
        {isPro && seatInfo && (
          <View style={[styles.card, { marginTop: 16 }, isDark && { backgroundColor: theme.glass.bg, borderColor: theme.glass.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Ionicons name="people" size={20} color={theme.brand.primary} />
              <Text style={[styles.title, { color: theme.text.title, fontSize: 16, marginBottom: 0 }]}>Worker Seats</Text>
            </View>
            <Text style={[styles.subtitle, { color: theme.text.muted, marginBottom: 12 }]}>
              {seatInfo.current} of {seatInfo.limit} seats used
            </Text>
            <View style={{ backgroundColor: isDark ? theme.surface.elevated : '#F1F5F9', padding: 12, borderRadius: 10 }}>
              <Text style={{ color: isDark ? theme.text.body : '#475569', fontSize: 13, lineHeight: 18 }}>
                {showSeatLimit
                  ? 'All worker seats are in use. Manage your team plan at gaspilotapp.com to add more seats.'
                  : 'Need to add more team members? Manage your team plan at gaspilotapp.com.'}
              </Text>
              <TouchableOpacity onPress={handleOpenTeamBilling} style={{ marginTop: 10 }}>
                <Text style={{ color: theme.brand.primary, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' }}>
                  Open Team Billing
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)', padding: 20, borderRadius: 12, ...Colors.shadow },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  subtitle: { marginBottom: 20, fontSize: 14, lineHeight: 20 },
  codeBox: { backgroundColor: UI.surface.base, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: UI.surface.divider, marginBottom: 20 },
  codeLabel: { fontSize: 10, fontWeight: '700', marginBottom: 4, letterSpacing: 1 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 28, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 2 },
  button: { padding: 16, borderRadius: 10, alignItems: 'center' },
  primaryBtn: { ...Colors.shadow },
  primaryBtnText: { fontWeight: 'bold', fontSize: 16 },
  regenBtn: { alignItems: 'center', marginTop: 16 },
  regenText: { fontWeight: '600', fontSize: 14 },
});