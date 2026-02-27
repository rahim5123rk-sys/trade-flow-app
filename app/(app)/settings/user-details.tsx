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

const InputField = ({
  label,
  value,
  onChange,
  icon,
  placeholder,
  autoCapitalize = 'none',
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
}) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={styles.inputWrapper}>
      {icon ? <Ionicons name={icon} size={20} color={UI.text.muted} style={{ marginRight: 10 }} /> : null}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
      />
    </View>
  </View>
);

export default function UserDetailsScreen() {
  const { user, userProfile, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [gasSafeRegisterNumber, setGasSafeRegisterNumber] = useState('');
  const [gasLicenceNumber, setGasLicenceNumber] = useState('');
  const [oftecNumber, setOftecNumber] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!userProfile) return;

      setFullName(userProfile.display_name || '');
      setEmail(user?.email || userProfile.email || '');

      if (userProfile.company_id) {
        const { data } = await supabase
          .from('companies')
          .select('settings')
          .eq('id', userProfile.company_id)
          .single();

        const s = data?.settings || {};
        const ud = s.userDetailsById?.[userProfile.id] || {};
        setGasSafeRegisterNumber(ud.gasSafeRegisterNumber || '');
        setGasLicenceNumber(ud.gasLicenceNumber || '');
        setOftecNumber(ud.oftecNumber || '');
      }

      setIsLoading(false);
    };

    load();
  }, [userProfile, user?.email]);

  const handleSave = async () => {
    if (!userProfile) return;

    setIsSaving(true);
    try {
      if (email && user?.email && email.trim().toLowerCase() !== user.email.toLowerCase()) {
        const { error: authError } = await supabase.auth.updateUser({ email: email.trim() });
        if (authError) {
          Alert.alert('Cannot Update Email', authError.message);
          setIsSaving(false);
          return;
        }
        Alert.alert('Check your Inbox', `We sent a confirmation link to ${email}.`);
      }

      await supabase
        .from('profiles')
        .update({ display_name: fullName.trim(), email: email.trim() })
        .eq('id', userProfile.id);

      if (userProfile.company_id) {
        const { data: currentData } = await supabase
          .from('companies')
          .select('settings')
          .eq('id', userProfile.company_id)
          .single();

        const currentSettings = currentData?.settings || {};
        await supabase
          .from('companies')
          .update({
            settings: {
              ...currentSettings,
              userDetailsById: {
                ...(currentSettings?.userDetailsById || {}),
                [userProfile.id]: {
                  gasSafeRegisterNumber: gasSafeRegisterNumber.trim(),
                  gasLicenceNumber: gasLicenceNumber.trim(),
                  oftecNumber: oftecNumber.trim(),
                },
              },
            },
          })
          .eq('id', userProfile.company_id);
      }

      await refreshProfile();
      Alert.alert('Saved', 'User details updated.');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save user details.');
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
            <Text style={styles.screenTitle}>User Details</Text>
            <Text style={styles.screenSubtitle}>Personal and gas engineer details</Text>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator color={UI.brand.primary} style={{ marginTop: 24 }} />
        ) : (
          <View style={styles.card}>
            <InputField
              label="Full Name"
              value={fullName}
              onChange={setFullName}
              icon="person-outline"
              placeholder="e.g. Sarah Jenkins"
              autoCapitalize="words"
            />
            <View style={{ height: 16 }} />
            <InputField
              label="Email"
              value={email}
              onChange={setEmail}
              icon="mail-outline"
              placeholder="you@company.com"
              keyboardType="email-address"
            />
            <View style={{ height: 16 }} />
            <InputField
              label="Gas Safe Register Number"
              value={gasSafeRegisterNumber}
              onChange={setGasSafeRegisterNumber}
              icon="flame-outline"
              placeholder="e.g. 123456"
              autoCapitalize="characters"
            />
            <View style={{ height: 16 }} />
            <InputField
              label="Gas Licence Number"
              value={gasLicenceNumber}
              onChange={setGasLicenceNumber}
              icon="card-outline"
              placeholder="Enter licence number"
              autoCapitalize="characters"
            />
            <View style={{ height: 16 }} />
            <InputField
              label="OFTEC Number"
              value={oftecNumber}
              onChange={setOftecNumber}
              icon="shield-checkmark-outline"
              placeholder="Enter OFTEC number if registered"
              autoCapitalize="characters"
            />
            <Text style={styles.hint}>Enter your OFTEC number only if you are OFTEC registered.</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.saveBtn, isSaving && { opacity: 0.7 }]} onPress={handleSave} disabled={isSaving || isLoading}>
          <LinearGradient colors={UI.gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveBtnGradient}>
            {isSaving ? <ActivityIndicator color={UI.text.white} /> : <Text style={styles.saveBtnText}>Save User Details</Text>}
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
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.80)' : '#fff',
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
  inputLabel: { fontSize: 12, fontWeight: '700', color: UI.text.body, marginLeft: 4 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(248,250,252,0.78)' : UI.surface.base,
    borderWidth: 1,
    borderColor: UI.surface.divider,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: UI.text.title, fontWeight: '500' },
  hint: { fontSize: 12, color: UI.text.muted, marginTop: 10, marginLeft: 4 },
  saveBtn: { borderRadius: 14, overflow: 'hidden', ...Colors.shadow },
  saveBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: UI.text.white, fontSize: 16, fontWeight: '700' },
});
