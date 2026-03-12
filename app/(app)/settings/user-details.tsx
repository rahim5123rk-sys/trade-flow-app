import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Linking,
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
import { useAppTheme } from '../../../src/context/ThemeContext';

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
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  maxLength?: number;
}) => {
  const { theme, isDark } = useAppTheme();
  return (
    <View style={styles.inputContainer}>
      <Text style={[styles.inputLabel, { color: theme.text.body }]}>{label}</Text>
      <View style={[styles.inputWrapper, isDark && { backgroundColor: theme.surface.elevated, borderColor: theme.surface.border }]}>
        {icon ? <Ionicons name={icon} size={20} color={theme.text.muted} style={{ marginRight: 10 }} /> : null}
        <TextInput
          style={[styles.input, { color: theme.text.title }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.text.placeholder}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          maxLength={maxLength}
        />
      </View>
    </View>
  );
};

export default function UserDetailsScreen() {
  const { user, userProfile, refreshProfile } = useAuth();
  const { theme, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [gasSafeRegisterNumber, setGasSafeRegisterNumber] = useState('');
  const [gasLicenceNumber, setGasLicenceNumber] = useState('');
  const [oftecNumber, setOftecNumber] = useState('');
  const [acceptedGasSafeTerms, setAcceptedGasSafeTerms] = useState(false);

  const GAS_SAFE_REGEX = /^\d{6}$/;
  const LICENCE_REGEX = /^\d{7}$/;
  const gasSafeValid = gasSafeRegisterNumber.trim() === '' || GAS_SAFE_REGEX.test(gasSafeRegisterNumber.trim());
  const licenceValid = gasLicenceNumber.trim() === '' || LICENCE_REGEX.test(gasLicenceNumber.trim());
  const gasSafeEntered = gasSafeRegisterNumber.trim().length > 0;
  const licenceEntered = gasLicenceNumber.trim().length > 0;
  const canSave = !isSaving && !isLoading && (!gasSafeEntered || (gasSafeValid && acceptedGasSafeTerms)) && licenceValid;

  const userIdForSettings = user?.id || userProfile?.id || '';

  const getUserDetailsFromSettings = (settings: any, userId: string) => {
    const map = settings?.userDetailsById || settings?.user_details_by_id || {};
    return (userId && map?.[userId]) || (userProfile?.id && map?.[userProfile.id]) || {};
  };

  const readString = (v: any): string => {
    if (v === null || v === undefined) return '';
    return String(v);
  };

  const persistGasSafeSnapshot = async (nextAccepted: boolean) => {
    if (!userProfile?.company_id) return;
    if (!nextAccepted || !gasSafeEntered || !gasSafeValid || !licenceValid) return;
    if (!userIdForSettings) return;

    const { data: currentData, error: currentSettingsError } = await supabase
      .from('companies')
      .select('settings')
      .eq('id', userProfile.company_id)
      .single();
    if (currentSettingsError) throw currentSettingsError;

    const currentSettings = currentData?.settings || {};
    const { error: companyUpdateError } = await supabase
      .from('companies')
      .update({
        settings: {
          ...currentSettings,
          userDetailsById: {
            ...(currentSettings?.userDetailsById || {}),
            [userIdForSettings]: {
              gasSafeRegisterNumber: gasSafeRegisterNumber.trim(),
              gasLicenceNumber: gasLicenceNumber.trim(),
              oftecNumber: oftecNumber.trim(),
              acceptedGasSafeTerms: true,
            },
          },
        },
      })
      .eq('id', userProfile.company_id);
    if (companyUpdateError) throw companyUpdateError;

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ accepted_gas_safe_terms: true, gas_safe_terms_accepted_at: new Date().toISOString() })
      .eq('id', userIdForSettings);
    if (profileUpdateError) throw profileUpdateError;
  };

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        if (!userProfile) return;
        setIsLoading(true);

        setFullName(userProfile.display_name || '');
        setEmail(user?.email || userProfile.email || '');

        const uid = userIdForSettings || userProfile.id;

        if (userProfile.company_id) {
          // Step 1: load gas safe numbers from companies.settings
          try {
            const { data, error: settingsError } = await supabase
              .from('companies')
              .select('settings')
              .eq('id', userProfile.company_id)
              .single();

            if (cancelled) return;

            if (settingsError) {
              console.warn('[UserDetails] Could not load company settings:', settingsError.message);
            } else {
              const s = data?.settings || {};
              const ud = getUserDetailsFromSettings(s, uid);
              console.log('[UserDetails] Loaded ud for uid', uid, ':', JSON.stringify(ud));

              const gasSafe = ud.gasSafeRegisterNumber ?? ud.gasSafeNumber ?? ud.gas_safe_register_number;
              const licence = ud.gasLicenceNumber ?? ud.gasLicenseNumber ?? ud.gas_licence_number ?? ud.gas_licence_no;
              const oftec = ud.oftecNumber ?? ud.oftec_number;

              setGasSafeRegisterNumber(readString(gasSafe));
              setGasLicenceNumber(readString(licence));
              setOftecNumber(readString(oftec));

              // acceptedGasSafeTerms from settings (always available)
              const acceptedFromSettings = !!(ud.acceptedGasSafeTerms ?? ud.accepted_gas_safe_terms);
              if (acceptedFromSettings) setAcceptedGasSafeTerms(true);
            }
          } catch (e: any) {
            console.warn('[UserDetails] Company settings load error:', e?.message);
          }

          // Step 2: cross-check accepted_gas_safe_terms from profiles table
          // This column may not exist in all deployments — never throw here
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('accepted_gas_safe_terms')
              .eq('id', uid)
              .single();

            if (!cancelled && profileData?.accepted_gas_safe_terms) {
              setAcceptedGasSafeTerms(true);
            }
          } catch (e: any) {
            console.warn('[UserDetails] Profile terms check skipped:', e?.message);
          }
        }

        if (!cancelled) setIsLoading(false);
      };

      load().catch((error: any) => {
        if (!cancelled) {
          console.warn('[UserDetails] Unexpected load error:', error?.message);
          setIsLoading(false);
        }
      });

      return () => { cancelled = true; };
    }, [userProfile, user?.email, user?.id])
  );

  const handleSave = async () => {
    if (!userProfile) return;
    const uid = userIdForSettings || userProfile.id;

    if (gasSafeEntered && !gasSafeValid) {
      Alert.alert('Invalid Gas Safe Number', 'Gas Safe registration numbers must be exactly 6 digits.');
      return;
    }

    if (licenceEntered && !licenceValid) {
      Alert.alert('Invalid Licence Number', 'Gas engineer ID card / licence numbers must be exactly 7 digits.');
      return;
    }

    if (gasSafeEntered && !acceptedGasSafeTerms) {
      Alert.alert('Terms Required', 'Please accept the Gas Safe Terms of Service before saving.');
      return;
    }

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

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          display_name: fullName.trim(),
          email: email.trim(),
          ...(gasSafeEntered && acceptedGasSafeTerms
            ? { accepted_gas_safe_terms: true, gas_safe_terms_accepted_at: new Date().toISOString() }
            : {}),
        })
        .eq('id', uid);
      if (profileUpdateError) throw profileUpdateError;

      if (userProfile.company_id) {
        const { data: currentData, error: currentSettingsError } = await supabase
          .from('companies')
          .select('settings')
          .eq('id', userProfile.company_id)
          .single();
        if (currentSettingsError) throw currentSettingsError;

        const currentSettings = currentData?.settings || {};
        const { error: companyUpdateError } = await supabase
          .from('companies')
          .update({
            settings: {
              ...currentSettings,
              userDetailsById: {
                ...(currentSettings?.userDetailsById || {}),
                [uid]: {
                  gasSafeRegisterNumber: gasSafeRegisterNumber.trim(),
                  gasLicenceNumber: gasLicenceNumber.trim(),
                  oftecNumber: oftecNumber.trim(),
                  acceptedGasSafeTerms: acceptedGasSafeTerms,
                },
              },
            },
          })
          .eq('id', userProfile.company_id);
        if (companyUpdateError) throw companyUpdateError;
        console.log('[UserDetails] Saved gas safe for uid:', uid, 'gasSafe:', gasSafeRegisterNumber.trim());
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
      <LinearGradient colors={isDark ? theme.gradients.appBackground : UI.gradients.appBackground} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={[styles.backBtn, isDark && { backgroundColor: theme.glass.bg, borderColor: theme.glass.border }]} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={theme.text.title} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.screenTitle, { color: theme.text.title }]}>User Details</Text>
            <Text style={[styles.screenSubtitle, { color: theme.text.muted }]}>Personal and gas engineer details</Text>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator color={theme.brand.primary} style={{ marginTop: 24 }} />
        ) : (
          <View style={[styles.card, isDark && { backgroundColor: theme.glass.bg, borderColor: theme.glass.border }]}>
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
              keyboardType="numeric"
              maxLength={6}
            />
            {gasSafeEntered && !gasSafeValid && (
              <Text style={styles.errorHint}>Must be exactly 6 digits</Text>
            )}

            {gasSafeEntered && gasSafeValid && (
              <TouchableOpacity
                style={styles.checkboxRow}
                activeOpacity={0.7}
                onPress={async () => {
                  const nextAccepted = !acceptedGasSafeTerms;
                  setAcceptedGasSafeTerms(nextAccepted);
                  try {
                    await persistGasSafeSnapshot(nextAccepted);
                  } catch (error: any) {
                    Alert.alert('Save Error', error?.message || 'Failed to snapshot Gas Safe details.');
                  }
                }}
              >
                <View style={[styles.checkbox, isDark && { backgroundColor: theme.surface.elevated, borderColor: theme.surface.border }, acceptedGasSafeTerms && styles.checkboxChecked]}>
                  {acceptedGasSafeTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={[styles.checkboxLabel, { color: theme.text.body }]}>
                  I warrant that I hold a current, valid Gas Safe registration, that I am lawfully authorised to use the Gas Safe Register name and logo on certificates in the course of my registered gas work, and I agree to the{' '}
                  <Text
                    style={styles.linkText}
                    onPress={() => Linking.openURL('https://www.gaspilotapp.com/gas-safe-terms')}
                  >
                    Gas Safe Terms of Service
                  </Text>
                  . I accept full legal liability for all certificates I generate and indemnify the App developer against any claims arising from my use of Gas Safe branding.
                </Text>
              </TouchableOpacity>
            )}
            <View style={{ height: 16 }} />
            <InputField
              label="Gas Engineer ID Card Number"
              value={gasLicenceNumber}
              onChange={setGasLicenceNumber}
              icon="card-outline"
              placeholder="e.g. 1234567"
              keyboardType="numeric"
              maxLength={7}
            />
            {licenceEntered && !licenceValid && (
              <Text style={styles.errorHint}>Must be exactly 7 digits</Text>
            )}
            <View style={{ height: 16 }} />
            <InputField
              label="OFTEC Number"
              value={oftecNumber}
              onChange={setOftecNumber}
              icon="shield-checkmark-outline"
              placeholder="Enter OFTEC number if registered"
              autoCapitalize="characters"
            />
            <Text style={[styles.hint, { color: theme.text.muted }]}>Enter your OFTEC number only if you are OFTEC registered.</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.saveBtn, !canSave && { opacity: 0.5 }]} onPress={handleSave} disabled={!canSave}>
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
  errorHint: { fontSize: 12, color: '#DC2626', marginTop: 4, marginLeft: 4, fontWeight: '600' },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12, paddingRight: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: UI.surface.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: UI.brand.primary, borderColor: UI.brand.primary },
  checkboxLabel: { flex: 1, fontSize: 12, lineHeight: 17, color: UI.text.body },
  linkText: { color: UI.brand.primary, textDecorationLine: 'underline' },
  saveBtn: { borderRadius: 14, overflow: 'hidden', ...Colors.shadow },
  saveBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: UI.text.white, fontSize: 16, fontWeight: '700' },
});
