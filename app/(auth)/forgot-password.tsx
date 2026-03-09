import {LinearGradient} from 'expo-linear-gradient';
import {router} from 'expo-router';
import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors, UI} from '../../constants/theme';
import {supabase} from '../../src/config/supabase';
import {useAppTheme} from '../../src/context/ThemeContext';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const {theme, isDark} = useAppTheme();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }

    setSending(true);
    try {
      // Always use the production scheme so the link works on real devices
      // and isn't broken by the Expo dev client URL format
      const redirectTo = 'pilotlight://reset-password';
      const {error} = await supabase.auth.resetPasswordForEmail(email.trim(), {redirectTo});
      if (error) {
        Alert.alert('Reset Failed', error.message);
      } else {
        Alert.alert('Check Your Email', 'We sent you a password reset link. Open it on this device to continue.');
        router.back();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send reset email.');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
      <LinearGradient colors={theme.gradients.appBackground} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={StyleSheet.absoluteFill} />
      <View
        style={[
          styles.container,
          isDark && {backgroundColor: 'transparent'},
          {paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20},
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, {color: theme.text.title}]}>Reset Password</Text>
          <Text style={[styles.subtitle, {color: theme.text.muted}]}>Enter your email and we will send a reset link.</Text>
        </View>

        <View style={[styles.form, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
          <Text style={[styles.label, {color: theme.text.body}]}>Email Address</Text>
          <TextInput
            style={[styles.input, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title}]}
            placeholder="you@example.com"
            placeholderTextColor={theme.text.placeholder}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TouchableOpacity style={styles.btn} onPress={handleSend} disabled={sending}>
            {sending ? <ActivityIndicator color={UI.text.white} /> : <Text style={styles.btnText}>Send Reset Link</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.linkBtn}>
            <Text style={[styles.linkText, {color: theme.brand.primary}]}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {marginBottom: 30, alignItems: 'center'},
  title: {fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 8},
  subtitle: {fontSize: 14, color: Colors.textLight, textAlign: 'center'},
  form: {gap: 16, borderWidth: 1, borderColor: 'transparent', borderRadius: 20, padding: 16},
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: -8,
  },
  input: {
    backgroundColor: UI.surface.base,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 16,
    color: Colors.text,
  },
  btn: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    ...Colors.shadow,
  },
  btnText: {color: UI.text.white, fontSize: 16, fontWeight: 'bold'},
  linkBtn: {alignItems: 'center', marginTop: 10},
  linkText: {color: Colors.primary, fontWeight: '600'},
});
