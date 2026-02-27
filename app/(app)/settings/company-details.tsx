import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, UI } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';

const GLASS_BG = UI.glass.bg;
const GLASS_BORDER = UI.glass.border;

const TRADES = [
  'Plumber',
  'Electrician',
  'Gas Engineer',
  'Builder',
  'Carpenter',
  'Roofer',
  'Painter & Decorator',
  'HVAC',
  'Landscaper',
  'Locksmith',
  'Handyman',
  'Other',
];

const InputField = ({
  label,
  value,
  onChange,
  icon,
  placeholder,
  multiline = false,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
}) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={[styles.inputWrapper, multiline && { alignItems: 'flex-start' }]}>
      {icon ? <Ionicons name={icon} size={20} color={UI.text.muted} style={{ marginRight: 10, marginTop: multiline ? 8 : 0 }} /> : null}
      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  </View>
);

export default function CompanyDetailsScreen() {
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyTrade, setCompanyTrade] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!userProfile?.company_id) return;

      const { data } = await supabase
        .from('companies')
        .select('name, address, email, phone, trade')
        .eq('id', userProfile.company_id)
        .single();

      if (data) {
        setCompanyName(data.name || '');
        setCompanyAddress(data.address || '');
        setCompanyEmail(data.email || '');
        setCompanyPhone(data.phone || '');
        setCompanyTrade(data.trade || '');
      }
      setIsLoading(false);
    };

    load();
  }, [userProfile?.company_id]);

  const handleSave = async () => {
    if (!userProfile?.company_id) return;

    setIsSaving(true);
    try {
      await supabase
        .from('companies')
        .update({
          name: companyName.trim(),
          address: companyAddress.trim(),
          email: companyEmail.trim(),
          phone: companyPhone.trim(),
          trade: companyTrade,
        })
        .eq('id', userProfile.company_id);

      Alert.alert('Saved', 'Company details updated.');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save company details.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <LinearGradient colors={UI.gradients.appBackground} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={UI.text.title} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>Company Details</Text>
            <Text style={styles.screenSubtitle}>Business details used across documents</Text>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator color={UI.brand.primary} style={{ marginTop: 24 }} />
        ) : (
          <View style={styles.card}>
            <InputField
              label="Company Name"
              value={companyName}
              onChange={setCompanyName}
              icon="briefcase-outline"
              placeholder="e.g. Acme Plumbing"
            />
            <View style={{ height: 16 }} />
            <InputField
              label="Address"
              value={companyAddress}
              onChange={setCompanyAddress}
              icon="location-outline"
              placeholder="Full business address"
              multiline
            />
            <View style={{ height: 16 }} />
            <InputField
              label="Telephone"
              value={companyPhone}
              onChange={setCompanyPhone}
              icon="call-outline"
              placeholder="+44 7000 000000"
              keyboardType="phone-pad"
            />
            <View style={{ height: 16 }} />

            <Text style={styles.inputLabel}>Trade</Text>
            <View style={styles.tradeGrid}>
              {TRADES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tradeChip, companyTrade === t && styles.tradeChipActive]}
                  onPress={() => setCompanyTrade(t)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.tradeChipText, companyTrade === t && styles.tradeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 16 }} />
            <InputField
              label="Company Email"
              value={companyEmail}
              onChange={setCompanyEmail}
              icon="mail-open-outline"
              placeholder="contact@business.com"
              keyboardType="email-address"
            />
          </View>
        )}

        <TouchableOpacity style={[styles.saveBtn, isSaving && { opacity: 0.7 }]} onPress={handleSave} disabled={isSaving || isLoading}>
          <LinearGradient colors={UI.gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveBtnGradient}>
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Company Details</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.65)' : '#fff',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  screenTitle: { fontSize: 26, fontWeight: '800', color: UI.text.title },
  screenSubtitle: { fontSize: 13, color: UI.text.muted, marginTop: 2 },
  card: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    ...Colors.shadow,
  },
  inputContainer: { gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: UI.text.body, marginLeft: 4, marginBottom: 4 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(248,250,252,0.78)' : '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: UI.text.title, fontWeight: '500' },
  textArea: { minHeight: 86, textAlignVertical: 'top', paddingTop: 12 },

  tradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tradeChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(241,245,249,0.8)' : '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tradeChipActive: { backgroundColor: 'rgba(99,102,241,0.12)', borderColor: UI.brand.primary },
  tradeChipText: { fontSize: 13, fontWeight: '600', color: UI.text.muted },
  tradeChipTextActive: { color: UI.brand.primary, fontWeight: '700' },

  saveBtn: { borderRadius: 14, overflow: 'hidden', ...Colors.shadow },
  saveBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
