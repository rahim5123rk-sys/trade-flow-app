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
import { Colors, UI } from '../../constants/theme';
import { supabase } from '../../src/config/supabase';
import { useAuth } from '../../src/context/AuthContext';

// --- Utils ---

const TRADES = [
  'Plumber', 'Electrician', 'Gas Engineer', 'Builder', 'Carpenter',
  'Roofer', 'Painter & Decorator', 'HVAC', 'Landscaper', 'Locksmith',
  'Handyman', 'Other',
];

const generateInviteCode = () => {
  // Generates format: ABC-123
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '23456789';
  let code = '';
  for (let i = 0; i < 3; i++) code += letters.charAt(Math.floor(Math.random() * letters.length));
  code += '-';
  for (let i = 0; i < 3; i++) code += nums.charAt(Math.floor(Math.random() * nums.length));
  return code;
};

// --- Component ---

export default function RegisterScreen() {
  const { refreshProfile, setRegistering } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  // State: Mode Selection
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const progressAnim = useRef(new Animated.Value(1)).current;

  // Step 1: Personal Account (Shared)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2 (Create): Business Info
  const [companyName, setCompanyName] = useState('');
  const [trade, setTrade] = useState('');

  // Step 2 (Join): Invite Code
  const [inviteCode, setInviteCode] = useState('');
  const [foundCompany, setFoundCompany] = useState<{ id: string; name: string } | null>(null);

  // Step 3 (Create): Contact Details
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');

  // GDPR Consent
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  const TOTAL_STEPS = 3;

  const animateProgress = (toStep: number) => {
    Animated.timing(progressAnim, {
      toValue: toStep,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const validateStep1 = () => {
    if (!fullName.trim()) return 'Please enter your name.';
    if (!email.trim() || !email.includes('@')) return 'Please enter a valid email.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must contain a number.';
    return null;
  };

  const checkInviteCode = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .single();

      setLoading(false);

      if (error || !data) {
        Alert.alert('Invalid Code', 'No company found with this invite code.');
        return false;
      }
      setFoundCompany(data);
      return true;
    } catch (e) {
      setLoading(false);
      Alert.alert('Error', 'Failed to validate code.');
      return false;
    }
  };

  const goNext = async () => {
    // Validate Step 1
    if (step === 1) {
      const err = validateStep1();
      if (err) {
        Alert.alert('Missing Info', err);
        return;
      }
    }

    // Validate Step 2
    if (step === 2) {
      if (mode === 'create') {
        if (!companyName.trim()) { Alert.alert('Missing Info', 'Enter business name.'); return; }
        if (!trade) { Alert.alert('Missing Info', 'Select a trade.'); return; }
      } else {
        if (!inviteCode) { Alert.alert('Missing Info', 'Enter invite code.'); return; }
        const isValid = await checkInviteCode();
        if (!isValid) return; // Stop if code invalid
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
    if (loading) return;
    setLoading(true);
    setRegistering(true);

    try {
      const withTimeout = async <T,>(promise: PromiseLike<T>, ms: number, label: string) => {
        return await Promise.race([
          Promise.resolve(promise),
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
          ),
        ]);
      };

      // 1. Create Auth User (or recover existing orphaned auth user)
      let userId: string;
      console.log('[Register] Step 1: Creating auth user...');

      const { data: authData, error: authError } = await withTimeout(
        supabase.auth.signUp({
          email: email.trim(),
          password,
        }),
        15000,
        'signUp'
      );

      console.log('[Register] signUp result — error:', authError?.message ?? 'none',
        'user:', authData?.user?.id ?? 'null',
        'session:', authData?.session ? 'yes' : 'no');

      if (authError) {
        // If user already exists in auth.users, try signing in instead
        if (authError.message?.toLowerCase().includes('already registered')) {
          console.log('[Register] User exists in auth — trying sign-in to recover...');
          const { data: signInData, error: signInError } = await withTimeout(
            supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            }),
            10000,
            'signInWithPassword (recovery)'
          );

          if (signInError) {
            throw new Error(
              'An account with this email already exists. If this is your account, try logging in instead.'
            );
          }

          // Check if profile already exists
          const { data: existingAuthProfile } = await supabase
            .from('profiles')
            .select('id, company_id')
            .eq('id', signInData.user!.id)
            .maybeSingle();

          if (existingAuthProfile && existingAuthProfile.company_id) {
            throw new Error(
              'An account with this email already exists. Please log in instead.'
            );
          }
          // If profile exists but no company, we continue to Step 3 logic to fix it.

          userId = signInData.user!.id;
        } else {
          throw authError;
        }
      } else {
        // signUp returned no error but check if we actually got a real user
        // (Supabase can return a fake user with empty identities for existing emails)
        if (!authData.user) throw new Error('No user returned from sign up.');

        const identities = authData.user.identities ?? [];
        if (identities.length === 0) {
          // This means the email already exists — Supabase returns a fake user to prevent enumeration
          throw new Error(
            'An account with this email already exists. Please log in instead.'
          );
        }

        userId = authData.user.id;
        console.log('[Register] Auth user created:', userId);
      }

      // 2. Ensure we have an active session
      console.log('[Register] Step 2: Verifying session...');
      let currentSession = authData?.session ?? null;

      if (!currentSession) {
        console.log('[Register] No session from signUp — signing in...');
        const { data: signInData, error: loginError } = await withTimeout(
          supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          }),
          10000,
          'signInWithPassword (session)'
        );
        if (loginError) {
          throw new Error(
            'Account created but could not sign in. Please go back and log in with your email and password.'
          );
        }
        currentSession = signInData.session;
      }

      if (!currentSession) {
        console.log('[Register] Still no session — attempting refreshSession...');
        const { data: refreshData, error: refreshError } = await withTimeout(
          supabase.auth.refreshSession(),
          10000,
          'refreshSession'
        );
        if (refreshError) {
          throw new Error('Could not establish a session. Please try logging in manually.');
        }
        currentSession = refreshData.session ?? null;
      }

      if (!currentSession) {
        throw new Error('Could not establish a session. Please try logging in manually.');
      }

      console.log('[Register] Session active, token starts with:', currentSession.access_token.substring(0, 20) + '...');
      console.log('[Register] Step 3: Preparing to create company/profile...');

      // 3. Create Company/Profile via RPC to avoid hanging PostgREST inserts
      let companyId = '';
      let userRole = '';

      if (mode === 'create') {
        console.log('[Register] Step 3: Creating company + profile (RPC)...');
        const code = generateInviteCode();

        // --- CHECK EXISTING PROFILE FIRST ---
        // Prevents timeouts if a trigger on auth.users already created the profile
        console.log('[Register] Checking for existing profile (5s timeout)...');
        let existingProfile = null;
        try {
          const checkRes = await withTimeout<any>(
             supabase
              .from('profiles')
              .select('id, company_id')
              .eq('id', userId)
              .maybeSingle(),
             5000,
             'Profile Check'
          );
          existingProfile = checkRes.data;
          console.log('[Register] Profile check complete. Found:', !!existingProfile);
        } catch (e) {
          console.warn('[Register] Profile check timed out. Proceeding...');
        }

        let rpcResult;
        
        if (existingProfile) {
           console.log('[Register] NOTICE: Profile already exists (trigger likely fired). Handling manually...');
           // Simulate RPC success structure for downstream logic
           if (existingProfile.company_id) {
             console.log('[Register] Profile already linked to company:', existingProfile.company_id);
             rpcResult = { data: { company_id: existingProfile.company_id }, error: null };
           } else {
             console.log('[Register] Profile exists but no company. Creating company manually...');
             // 1. Create Company
             const manualCode = generateInviteCode();
             const { data: companyData, error: companyError } = await supabase
              .from('companies')
              .insert({
                name: companyName.trim(),
                address: businessAddress.trim(),
                phone: businessPhone.trim(),
                invite_code: manualCode,
              })
              .select('id')
              .single();

             if (companyError) throw new Error('Failed to create company manually: ' + companyError.message);
             const newCompanyId = companyData.id;

             // 2. Update Profile
             const { error: updateError } = await supabase
              .from('profiles')
              .update({
                company_id: newCompanyId,
                role: 'admin',
                display_name: fullName.trim(),
                email: email.trim(),
                trade: trade,
              })
              .eq('id', userId);

             if (updateError) throw new Error('Failed to update profile manually: ' + updateError.message);
             
             rpcResult = { data: { company_id: newCompanyId }, error: null };
           }
        } else {
            console.log('[Register] No existing profile. Calling RPC with 30s timeout...');
            rpcResult = await withTimeout<any>(
            supabase
                .rpc('create_company_and_profile', {
                p_user_id: userId,
                p_email: email.trim(),
                p_display_name: fullName.trim(),
                p_company_name: companyName.trim(),
                p_company_address: businessAddress.trim(),
                p_company_phone: businessPhone.trim(),
                p_trade: trade,
                p_invite_code: code,
                p_role: 'admin',
                p_consent_given_at: new Date().toISOString(),
                })
                .then((res) => res),
            30000,
            'Create company/profile RPC'
            );
        }

        if (rpcResult.error) {
          throw new Error('Failed to create company/profile: ' + rpcResult.error.message);
        }

        if (!rpcResult.data?.company_id) {
          throw new Error('Company/profile created but no company id returned.');
        }

        companyId = rpcResult.data.company_id;
        userRole = 'admin';
        console.log('[Register] Company created:', companyId);
      } else {
        if (!foundCompany) throw new Error('Company not confirmed');
        console.log('[Register] Step 3: Joining company + profile (RPC)...');
        const rpcResult = await withTimeout<any>(
          supabase
            .rpc('join_company_and_profile', {
              p_user_id: userId,
              p_company_id: foundCompany.id,
              p_email: email.trim(),
              p_display_name: fullName.trim(),
              p_role: 'worker',
              p_consent_given_at: new Date().toISOString(),
            })
            .then((res) => res),
          10000,
          'Join company/profile RPC'
        );

        if (rpcResult.error) {
          throw new Error('Failed to join company/profile: ' + rpcResult.error.message);
        }

        companyId = foundCompany.id;
        userRole = 'worker';
        console.log('[Register] Joined company:', companyId);
      }

      // 5. Complete
      console.log('[Register] Step 5: Finalising...');
      setRegistering(false);
      const refreshResult = await Promise.race([
        refreshProfile(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
      if (!refreshResult) {
        console.warn('[Register] refreshProfile timed out or returned null');
      }
      router.replace('/(app)/dashboard');

    } catch (error: any) {
      const msg = error?.message || 'An unknown error occurred';
      console.error('[Register] FAILED:', msg);
      setRegistering(false);
      // Sign out to clean up any partial session so user can retry
      try { await supabase.auth.signOut(); } catch (_) {}
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [1, TOTAL_STEPS],
    outputRange: ['33%', '100%'],
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#fff' }}>
      
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
        
        {/* STEP 1: Account & Mode */}
        {step === 1 && (
          <View>
            <Text style={styles.title}>Welcome to TradeFlow</Text>
            <Text style={styles.subtitle}>Create your account to get started.</Text>

            {/* Mode Selector */}
            <View style={styles.modeContainer}>
              <TouchableOpacity 
                style={[styles.modeBtn, mode === 'create' && styles.modeBtnActive]} 
                onPress={() => setMode('create')}>
                <Ionicons name="briefcase-outline" size={20} color={mode === 'create' ? '#fff' : Colors.text} />
                <Text style={[styles.modeText, mode === 'create' && { color: UI.text.white }]}>New Company</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modeBtn, mode === 'join' && styles.modeBtnActive]} 
                onPress={() => setMode('join')}>
                <Ionicons name="people-outline" size={20} color={mode === 'join' ? '#fff' : Colors.text} />
                <Text style={[styles.modeText, mode === 'join' && { color: UI.text.white }]}>Join Team</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="e.g. John Smith" placeholderTextColor="#94a3b8" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="john@example.com" placeholderTextColor="#94a3b8" autoCapitalize="none" keyboardType="email-address" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Min 8 chars, 1 uppercase, 1 number" placeholderTextColor="#94a3b8" secureTextEntry />
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
              <Text style={styles.nextBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color={UI.text.white} />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: Business Info OR Invite Code */}
        {step === 2 && (
          <View>
            {mode === 'create' ? (
              <>
                <Text style={styles.title}>About your business</Text>
                <Text style={styles.subtitle}>Tell us about what you do</Text>

                <View style={styles.field}>
                  <Text style={styles.label}>Business Name</Text>
                  <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} placeholder="e.g. Smith’s Plumbing Ltd" placeholderTextColor="#94a3b8" />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>What’s your trade?</Text>
                  <View style={styles.tradeGrid}>
                    {TRADES.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.tradeChip, trade === t && styles.tradeChipActive]}
                        onPress={() => setTrade(t)}
                      >
                        <Text style={[styles.tradeChipText, trade === t && styles.tradeChipTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.title}>Join your Team</Text>
                <Text style={styles.subtitle}>Enter the invite code provided by your manager.</Text>

                <View style={styles.field}>
                    <Text style={styles.label}>Invite Code</Text>
                    <TextInput 
                        style={[styles.input, styles.codeInput]} 
                        value={inviteCode} 
                        onChangeText={setInviteCode} 
                        placeholder="XXX-XXX" 
                        placeholderTextColor="#CBD5E1"
                        autoCapitalize="characters"
                        maxLength={8}
                    />
                </View>
              </>
            )}

            <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
              <Text style={styles.nextBtnText}>{mode === 'join' ? 'Verify Code' : 'Continue'}</Text>
              <Ionicons name="arrow-forward" size={20} color={UI.text.white} />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: Details OR Confirm */}
        {step === 3 && (
          <View>
            {mode === 'create' ? (
              <>
                <Text style={styles.title}>Business details</Text>
                <Text style={styles.subtitle}>These appear on your job sheets.</Text>

                <View style={styles.field}>
                  <Text style={styles.label}>Business Address</Text>
                  <TextInput style={[styles.input, styles.textArea]} value={businessAddress} onChangeText={setBusinessAddress} placeholder="123 High St..." placeholderTextColor="#94a3b8" multiline />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Business Phone</Text>
                  <TextInput style={styles.input} value={businessPhone} onChangeText={setBusinessPhone} placeholder="07700 900000" placeholderTextColor="#94a3b8" keyboardType="phone-pad" />
                </View>
              </>
            ) : (
              <View style={styles.confirmContainer}>
                <Ionicons name="business" size={64} color={Colors.primary} />
                <Text style={styles.confirmTitle}>Team Found!</Text>
                <Text style={styles.confirmCompany}>{foundCompany?.name}</Text>
                <Text style={styles.confirmText}>
                  You are joining this company as a Worker. You will see jobs assigned to you by the admin.
                </Text>
              </View>
            )}

            {/* GDPR Consent */}
            <TouchableOpacity
              style={styles.consentRow}
              onPress={() => setAcceptedTerms(!acceptedTerms)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms && <Ionicons name="checkmark" size={14} color={UI.text.white} />}
              </View>
              <Text style={styles.consentText}>
                I agree to the{' '}
                <Text style={styles.consentLink} onPress={() => router.push('/(auth)/privacy-policy' as any)}>Privacy Policy</Text>
                {' '}and{' '}
                <Text style={styles.consentLink} onPress={() => router.push('/(auth)/terms-of-service' as any)}>Terms of Service</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, (loading || !acceptedTerms) && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={loading || !acceptedTerms}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={UI.text.white} />
                  <Text style={styles.submitBtnText}>{mode === 'create' ? 'Creating Account...' : 'Joining Team...'}</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color={UI.text.white} />
                  <Text style={styles.submitBtnText}>{mode === 'create' ? 'Create My Account' : 'Join Team'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: UI.surface.elevated, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  stepLabel: { fontSize: 14, fontWeight: '600', color: Colors.textLight },
  progressTrack: { height: 4, backgroundColor: UI.surface.elevated, marginHorizontal: 24, borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  scrollContainer: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 24 },
  
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginTop: 32, marginBottom: 6 },
  subtitle: { fontSize: 15, color: Colors.textLight, lineHeight: 22, marginBottom: 28 },
  
  modeContainer: { flexDirection: 'row', backgroundColor: UI.surface.elevated, padding: 4, borderRadius: 12, marginBottom: 24 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, gap: 8 },
  modeBtnActive: { backgroundColor: Colors.primary, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  modeText: { fontWeight: '600', color: Colors.text },

  field: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  input: { backgroundColor: UI.surface.base, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, fontSize: 16, color: Colors.text },
  codeInput: { textAlign: 'center', fontSize: 24, letterSpacing: 3, fontWeight: '700', textTransform: 'uppercase' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  
  tradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tradeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: UI.surface.elevated, borderWidth: 1.5, borderColor: UI.surface.elevated },
  tradeChipActive: { backgroundColor: UI.surface.base, borderColor: Colors.primary },
  tradeChipText: { fontSize: 14, fontWeight: '500', color: Colors.textLight },
  tradeChipTextActive: { color: Colors.primary, fontWeight: '700' },
  
  nextBtn: { flexDirection: 'row', backgroundColor: Colors.primary, padding: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, ...Colors.shadow },
  nextBtnText: { color: UI.text.white, fontWeight: 'bold', fontSize: 16 },
  
  submitBtn: { flexDirection: 'row', backgroundColor: Colors.success, padding: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12, elevation: 4 },
  submitBtnText: { color: UI.text.white, fontWeight: 'bold', fontSize: 16 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16, paddingHorizontal: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: UI.surface.border, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  consentText: { flex: 1, fontSize: 13, color: Colors.textLight, lineHeight: 20 },
  consentLink: { color: Colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
  confirmContainer: { alignItems: 'center', backgroundColor: UI.surface.base, padding: 30, borderRadius: 20, marginBottom: 20 },
  confirmTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginTop: 16 },
  confirmCompany: { fontSize: 18, color: Colors.primary, fontWeight: '600', marginTop: 4, marginBottom: 12 },
  confirmText: { textAlign: 'center', color: Colors.textLight, lineHeight: 22 },
});