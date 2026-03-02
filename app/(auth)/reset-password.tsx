import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, UI } from '../../constants/theme';
import { supabase } from '../../src/config/supabase';
import { useAppTheme } from '../../src/context/ThemeContext';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useAppTheme();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) setHasSession(!!data.session);
    };

    syncSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setHasSession(!!session);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleReset = async () => {
    if (!hasSession) {
      Alert.alert('Open the Reset Link', 'Please open the reset password link from your email on this device.');
      return;
    }
    if (!password || password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        Alert.alert('Reset Failed', error.message);
      } else {
        await supabase.auth.signOut();
        Alert.alert('Password Updated', 'You can now sign in with your new password.');
        router.replace('/(auth)/login');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <LinearGradient colors={theme.gradients.appBackground} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View
        style={[
          styles.container,
          isDark && { backgroundColor: 'transparent' },
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text.title }]}>Set New Password</Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]}>Create a new password for your account.</Text>
        </View>

        <View style={[styles.form, isDark && { backgroundColor: theme.glass.bg, borderColor: theme.glass.border }]}> 
          {!hasSession && (
            <Text style={[styles.notice, { color: theme.text.muted }]}>Open the reset link from your email on this device to continue.</Text>
          )}

          <Text style={[styles.label, { color: theme.text.body }]}>New Password</Text>
          <TextInput
            style={[styles.input, isDark && { backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title }]}
            placeholder="Minimum 8 characters"
            placeholderTextColor={theme.text.placeholder}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Text style={[styles.label, { color: theme.text.body }]}>Confirm Password</Text>
          <TextInput
            style={[styles.input, isDark && { backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title }]}
            placeholder="Re-enter password"
            placeholderTextColor={theme.text.placeholder}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
          />

          <TouchableOpacity style={styles.btn} onPress={handleReset} disabled={loading}>
            {loading ? <ActivityIndicator color={UI.text.white} /> : <Text style={styles.btnText}>Update Password</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.linkBtn}>
            <Text style={[styles.linkText, { color: theme.brand.primary }]}>Back to Sign In</Text>
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
  header: { marginBottom: 30, alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.textLight, textAlign: 'center' },
  notice: { fontSize: 12, textAlign: 'center', marginBottom: 8 },
  form: { gap: 16, borderWidth: 1, borderColor: 'transparent', borderRadius: 20, padding: 16 },
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
  btnText: { color: UI.text.white, fontSize: 16, fontWeight: 'bold' },
  linkBtn: { alignItems: 'center', marginTop: 10 },
  linkText: { color: Colors.primary, fontWeight: '600' },
});
