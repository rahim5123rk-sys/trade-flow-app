import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { Colors } from '../../constants/theme';
import { supabase } from '../../src/config/supabase';
import { useAuth } from '../../src/context/AuthContext';

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

const TOTAL_STEPS = 3;

export default function RegisterScreen() {
  const { refreshProfile, setRegistering } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const progressAnim = useRef(new Animated.Value(1)).current;

  // Step 1: Account
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2: Business
  const [companyName, setCompanyName] = useState('');
  const [trade, setTrade] = useState('');

  // Step 3: Business Details
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');

  const animateProgress = (toStep: number) => {
    Animated.timing(progressAnim, {
      toValue: toStep,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const goNext = () => {
    if (step === 1) {
      if (!fullName.trim()) {
        Alert.alert('Missing Info', 'Please enter your name.');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        Alert.alert('Missing Info', 'Please enter a valid email.');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Missing Info', 'Password must be at least 6 characters.');
        return;
      }
    }
    if (step === 2) {
      if (!companyName.trim()) {
        Alert.alert('Missing Info', 'Please enter your business name.');
        return;
      }
      if (!trade) {
        Alert.alert('Missing Info', 'Please select your trade.');
        return;
      }
    }

    const next = step + 1;
    setStep(next);
    animateProgress(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const goBack = () => {
    if (step === 1) {
      router.back();
      return;
    }
    const prev = step - 1;
    setStep(prev);
    animateProgress(prev);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleRegister = async () => {
    if (loading) return; // Prevent double tap
    setLoading(true);

    try {
      console.log('=== REGISTRATION START ===');
      setRegistering(true);

      // 1. Create Auth User
      console.log('Step 1: Creating auth user...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      let userId = '';

      if (authError) {
        if (authError.message.includes('already registered')) {
          console.log('User exists, trying sign in...');
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (signInError) throw new Error('Email already registered. Try signing in.');
          if (!signInData.user) throw new Error('Sign in failed.');

          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', signInData.user.id)
            .single();

          if (existingProfile) {
            // Already fully registered — just go to dashboard
            setRegistering(false);
            await refreshProfile();
            router.replace('/(admin)/dashboard');
            return;
          }
          userId = signInData.user.id;
        } else {
          throw authError;
        }
      } else {
        if (!authData.user) throw new Error('Account creation failed.');
        userId = authData.user.id;
      }

      console.log('Step 2: Creating company...');
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyName.trim(),
          address: businessAddress.trim() || null,
          phone: businessPhone.trim() || null,
          email: businessEmail.trim() || email.trim(),
          trade: trade || null,
          settings: { nextJobNumber: 1 },
        })
        .select()
        .single();

      if (companyError) {
        console.error('Company error:', companyError);
        throw new Error('Failed to create company: ' + companyError.message);
      }
      console.log('Company created:', companyData.id);

      console.log('Step 3: Creating profile...');
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email.trim(),
          display_name: fullName.trim(),
          company_id: companyData.id,
          role: 'admin',
        });

      if (profileError) {
        console.error('Profile error:', profileError);
        throw new Error('Failed to create profile: ' + profileError.message);
      }
      console.log('Profile created');

      // Done registering — let auth context know
      setRegistering(false);

      // Load the profile into context
      const profile = await refreshProfile();
      console.log('=== REGISTRATION COMPLETE ===', profile?.role);

      // Navigate directly to dashboard
      router.replace('/(admin)/dashboard');

    } catch (error: any) {
      console.error('=== REGISTRATION FAILED ===', error.message);
      setRegistering(false);
      Alert.alert('Registration Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [1, TOTAL_STEPS],
    outputRange: ['33%', '100%'],
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#fff' }}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.stepLabel}>Step {step} of {TOTAL_STEPS}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollContainer}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* STEP 1: Account */}
        {step === 1 && (
          <View>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Let's start with your personal details
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. John Smith"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="john@example.com"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Min 6 characters"
                placeholderTextColor="#94a3b8"
                secureTextEntry
              />
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
              <Text style={styles.nextBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: Business Info */}
        {step === 2 && (
          <View>
            <Text style={styles.title}>About your business</Text>
            <Text style={styles.subtitle}>
              Tell us about what you do
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Business Name</Text>
              <TextInput
                style={styles.input}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="e.g. Smith's Plumbing Ltd"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>What's your trade?</Text>
              <View style={styles.tradeGrid}>
                {TRADES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.tradeChip,
                      trade === t && styles.tradeChipActive,
                    ]}
                    onPress={() => setTrade(t)}
                  >
                    <Text
                      style={[
                        styles.tradeChipText,
                        trade === t && styles.tradeChipTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
              <Text style={styles.nextBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: Business Details */}
        {step === 3 && (
          <View>
            <Text style={styles.title}>Business details</Text>
            <Text style={styles.subtitle}>
              These appear on your job sheets and invoices. You can update them later in Settings.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Business Address</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={businessAddress}
                onChangeText={setBusinessAddress}
                placeholder="123 High Street, London, SW1A 1AA"
                placeholderTextColor="#94a3b8"
                multiline
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Business Phone</Text>
              <TextInput
                style={styles.input}
                value={businessPhone}
                onChangeText={setBusinessPhone}
                placeholder="07700 900000"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Business Email</Text>
              <TextInput
                style={styles.input}
                value={businessEmail}
                onChangeText={setBusinessEmail}
                placeholder={email || 'office@example.com'}
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={styles.hint}>
                Leave blank to use your account email
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.submitBtnText}>Setting up your account...</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.submitBtnText}>Create My Account</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.skipHint}>
              You can always update these details later in Settings
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  stepLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textLight,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 24,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 32,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textLight,
    lineHeight: 22,
    marginBottom: 28,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 16,
    color: Colors.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 6,
    fontStyle: 'italic',
  },
  tradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tradeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
  },
  tradeChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: Colors.primary,
  },
  tradeChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textLight,
  },
  tradeChipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  nextBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    ...Colors.shadow,
  },
  nextBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.success,
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
    shadowColor: Colors.success,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  skipHint: {
    textAlign: 'center',
    color: Colors.textLight,
    fontSize: 13,
    marginTop: 16,
  },
});