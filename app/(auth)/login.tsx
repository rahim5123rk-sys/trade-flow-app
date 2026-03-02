import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
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

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        Alert.alert('Login Failed', error.message);
      } else {
        router.replace('/(app)/dashboard');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <LinearGradient
        colors={theme.gradients.appBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.container,
          isDark && { backgroundColor: 'transparent' },
          {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 20,
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.brand, { color: theme.brand.primary }]}>TradeFlow</Text>
          <Text style={[styles.title, { color: theme.text.title }]}>Welcome Back</Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]}>Sign in to access your dashboard.</Text>
        </View>

        <View style={[styles.form, isDark && { backgroundColor: theme.glass.bg, borderColor: theme.glass.border }]}> 
          <Text style={[styles.label, { color: theme.text.body }]}>Email Address</Text>
          <TextInput
            style={[styles.input, isDark && { backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title }]}
            placeholder="john@example.com"
            placeholderTextColor={theme.text.placeholder}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={[styles.label, { color: theme.text.body }]}>Password</Text>
          <TextInput
            style={[styles.input, isDark && { backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title }]}
            placeholder="••••••••"
            placeholderTextColor={theme.text.placeholder}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={styles.btn}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={UI.text.white} />
            ) : (
              <Text style={styles.btnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/register')}
            style={styles.linkBtn}
          >
            <Text style={[styles.linkText, { color: theme.brand.primary }]}>Don’t have an account? Create one</Text>
          </TouchableOpacity>
          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={() => router.push('/(auth)/privacy-policy' as any)}>
              <Text style={[styles.legalText, { color: theme.text.muted }]}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={[styles.legalDot, { color: theme.surface.border }]}>•</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/terms-of-service' as any)}>
              <Text style={[styles.legalText, { color: theme.text.muted }]}>Terms of Service</Text>
            </TouchableOpacity>
          </View>
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
  header: { marginBottom: 40, alignItems: 'center' },
  brand: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 16, color: Colors.textLight },
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
  legalLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, gap: 8 },
  legalText: { fontSize: 12, color: UI.text.muted, textDecorationLine: 'underline' },
  legalDot: { fontSize: 12, color: UI.surface.border },

});