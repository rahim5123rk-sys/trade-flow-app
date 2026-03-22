import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, {useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
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
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors, UI} from '../../constants/theme';
import {supabase} from '../../src/config/supabase';
import {useAuth} from '../../src/context/AuthContext';
import {useAppTheme} from '../../src/context/ThemeContext';

export const PENDING_REGISTRATION_KEY = 'gaspilot_pending_registration';

// --- Utils ---

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
  const {refreshProfile, setRegistering} = useAuth();
  const {theme, isDark} = useAppTheme();
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
  const [gasSafeRegisterNumber, setGasSafeRegisterNumber] = useState('');
  const [isApprentice, setIsApprentice] = useState(false);
  const [acceptedGasSafeTerms, setAcceptedGasSafeTerms] = useState(false);

  const GAS_SAFE_REGEX = /^\d{6}$/;
  const gasSafeValid = gasSafeRegisterNumber.trim() === '' || GAS_SAFE_REGEX.test(gasSafeRegisterNumber.trim());
  const gasSafeEntered = gasSafeRegisterNumber.trim().length > 0;

  // Step 2 (Join): Invite Code
  const [inviteCode, setInviteCode] = useState('');
  const [foundCompany, setFoundCompany] = useState<{id: string; name: string} | null>(null);

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
      // 1. Find company by invite code
      const {data, error} = await supabase
        .from('companies')
        .select('id, name, worker_seat_limit')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .single();

      if (error || !data) {
        setLoading(false);
        Alert.alert('Invalid Code', 'No company found with this invite code.');
        return false;
      }

      // 2. Check company admin is Pro (using RPC to bypass RLS)
      const {data: isPro, error: proError} = await supabase
        .rpc('check_company_pro_status', {p_company_id: data.id});

      if (proError || !isPro) {
        setLoading(false);
        Alert.alert('Team Not Available', 'This company does not have an active Pro subscription. Ask the company admin to upgrade to Pro before inviting team members.');
        return false;
      }

      // 3. Check seat availability (using RPC to bypass RLS)
      const {data: currentWorkers, error: countError} = await supabase
        .rpc('get_company_worker_count', {p_company_id: data.id});

      const seatLimit = data.worker_seat_limit ?? 0;

      if (countError || (currentWorkers ?? 0) >= seatLimit) {
        setLoading(false);
        Alert.alert('No Seats Available', 'This company has used all its worker seats. Ask the company admin to purchase additional seats before you can join.');
        return false;
      }

      setLoading(false);
      setFoundCompany({id: data.id, name: data.name});
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
        if (!companyName.trim()) {Alert.alert('Missing Info', 'Enter business name.'); return;}
        if (!isApprentice) {
          if (!gasSafeEntered) {Alert.alert('Missing Info', 'Enter your Gas Safe Register Number, or check the apprentice box.'); return;}
          if (!gasSafeValid) {Alert.alert('Invalid Info', 'Gas Safe Register Number must be exactly 6 digits.'); return;}
          if (!acceptedGasSafeTerms) {Alert.alert('Missing Info', 'You must accept the Gas Safe Terms of Service to continue.'); return;}
        }
      } else {
        if (!inviteCode) {Alert.alert('Missing Info', 'Enter invite code.'); return;}
        const isValid = await checkInviteCode();
        if (!isValid) return; // Stop if code invalid
      }
    }

    const next = step + 1;
    setStep(next);
    animateProgress(next);
    scrollRef.current?.scrollTo({y: 0, animated: true});
  };

  const goBack = () => {
    if (step === 1) {
      router.back();
      return;
    }
    const prev = step - 1;
    setStep(prev);
    animateProgress(prev);
    scrollRef.current?.scrollTo({y: 0, animated: true});
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

      const emailRedirectTo = 'gaspilot://login';

      const {data: authData, error: authError} = await withTimeout(
        supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo,
          },
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
          const {data: signInData, error: signInError} = await withTimeout(
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

          // Check if profile already exists with a company
          const {data: existingAuthProfile} = await supabase
            .from('profiles')
            .select('id, company_id')
            .eq('id', signInData.user!.id)
            .maybeSingle();

          if (existingAuthProfile && existingAuthProfile.company_id) {
            throw new Error(
              'An account with this email already exists. Please log in instead.'
            );
          }

          userId = signInData.user!.id;
        } else {
          throw authError;
        }
      } else {
        if (!authData.user) throw new Error('No user returned from sign up.');

        const identities = authData.user.identities ?? [];
        if (identities.length === 0) {
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
        const {data: signInData, error: loginError} = await withTimeout(
          supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          }),
          10000,
          'signInWithPassword (session)'
        );
        if (loginError) {
          // Check if email confirmation is required
          const errMsg = loginError.message?.toLowerCase() || '';
          if (errMsg.includes('not confirmed') || errMsg.includes('confirm') || errMsg.includes('email_not_confirmed')) {
            console.log('[Register] Email confirmation required — saving pending registration data');
            const pendingData = {
              mode,
              fullName: fullName.trim(),
              email: email.trim(),
              ...(mode === 'create'
                ? {
                  companyName: companyName.trim(),
                  trade: 'Gas Engineer',
                  gasSafeRegisterNumber: isApprentice ? '' : gasSafeRegisterNumber.trim(),
                  acceptedGasSafeTerms: isApprentice ? false : acceptedGasSafeTerms,
                  isApprentice,
                  businessAddress: businessAddress.trim(),
                  businessPhone: businessPhone.trim(),
                  inviteCode: generateInviteCode(),
                }
                : {
                  companyId: foundCompany?.id,
                }),
              consentGivenAt: new Date().toISOString(),
            };
            await SecureStore.setItemAsync(PENDING_REGISTRATION_KEY, JSON.stringify(pendingData));

            setRegistering(false);
            setLoading(false);
            Alert.alert(
              'Confirm Your Email',
              'We\'ve sent a confirmation link to your email address. Please check your inbox (and spam folder), confirm your account, then come back and log in.',
              [{text: 'OK', onPress: () => router.replace('/(auth)/login')}]
            );
            return; // Exit early — registration will complete on first login
          }

          throw new Error(
            'Account created but could not sign in. Please go back and log in with your email and password.'
          );
        }
        currentSession = signInData.session;
      }

      if (!currentSession) {
        console.log('[Register] Still no session — attempting refreshSession...');
        const {data: refreshData, error: refreshError} = await withTimeout(
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

      console.log('[Register] Session active');

      // 3. Create Company/Profile via RPC
      let companyId = '';
      let userRole = '';

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      const rpcHeaders = {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${currentSession.access_token}`,
      };

      if (mode === 'create') {
        console.log('[Register] Step 3: Calling create RPC via raw fetch...');
        const code = generateInviteCode();

        const fetchResponse = await withTimeout(
          fetch(`${supabaseUrl}/rest/v1/rpc/create_company_and_profile`, {
            method: 'POST',
            headers: rpcHeaders,
            body: JSON.stringify({
              p_user_id: userId,
              p_email: email.trim(),
              p_display_name: fullName.trim(),
              p_company_name: companyName.trim(),
              p_company_address: businessAddress.trim(),
              p_company_phone: businessPhone.trim(),
              p_trade: 'Gas Engineer',
              p_invite_code: code,
              p_role: 'admin',
              p_consent_given_at: new Date().toISOString(),
            }),
          }),
          30000,
          'Create company/profile RPC (fetch)'
        );

        const response = fetchResponse as Response;
        console.log('[Register] Fetch status:', response.status);
        const rpcData = await response.json();
        console.log('[Register] Fetch response:', JSON.stringify(rpcData));

        if (response.status !== 200) {
          throw new Error('RPC failed: ' + JSON.stringify(rpcData));
        }

        companyId = rpcData.company_id;
        if (!companyId) {
          throw new Error('Company/profile created but no company id returned.');
        }
        userRole = 'admin';
        console.log('[Register] Company created:', companyId);

        if (!isApprentice && gasSafeValid && acceptedGasSafeTerms) {
          await supabase
            .from('companies')
            .update({
              settings: {
                userDetailsById: {
                  [userId]: {
                    gasSafeRegisterNumber: gasSafeRegisterNumber.trim(),
                    acceptedGasSafeTerms: true,
                  },
                },
              },
            })
            .eq('id', companyId);

          await supabase
            .from('profiles')
            .update({ accepted_gas_safe_terms: true })
            .eq('id', userId);
        }
      } else {
        if (!foundCompany) throw new Error('Company not confirmed');
        console.log('[Register] Step 3: Calling join RPC via raw fetch...');

        const fetchResponse = await withTimeout(
          fetch(`${supabaseUrl}/rest/v1/rpc/join_company_and_profile`, {
            method: 'POST',
            headers: rpcHeaders,
            body: JSON.stringify({
              p_user_id: userId,
              p_company_id: foundCompany.id,
              p_email: email.trim(),
              p_display_name: fullName.trim(),
              p_role: 'worker',
              p_consent_given_at: new Date().toISOString(),
            }),
          }),
          30000,
          'Join company/profile RPC (fetch)'
        );

        const response = fetchResponse as Response;
        console.log('[Register] Join fetch status:', response.status);
        const rpcData = await response.json();
        console.log('[Register] Join fetch response:', JSON.stringify(rpcData));

        if (response.status !== 200) {
          throw new Error('Join RPC failed: ' + JSON.stringify(rpcData));
        }

        companyId = foundCompany.id;
        userRole = 'worker';
        console.log('[Register] Joined company:', companyId);
      }

      // 4. Complete
      console.log('[Register] Step 4: Finalising...');
      setRegistering(false);
      const refreshResult = await Promise.race([
        refreshProfile(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
      if (!refreshResult) {
        console.warn('[Register] refreshProfile timed out or returned null');
      }
      router.replace('/(app)/dashboard' as any);

    } catch (error: any) {
      const msg = error?.message || 'An unknown error occurred';
      console.error('[Register] FAILED:', msg);
      setRegistering(false);
      // Sign out to clean up any partial session so user can retry
      try {await supabase.auth.signOut();} catch (_) { }
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1, backgroundColor: theme.surface.base}}>

      {/* Header */}
      <View style={[styles.header, isDark && {backgroundColor: theme.surface.base}, {paddingTop: insets.top + 10}]}>
        <TouchableOpacity onPress={goBack} style={[styles.backBtn, isDark && {backgroundColor: theme.surface.elevated}]}>
          <Ionicons name="arrow-back" size={24} color={theme.text.title} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.stepLabel, {color: theme.text.muted}]}>Step {step} of {TOTAL_STEPS}</Text>
        </View>
        <View style={{width: 40}} />
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressTrack, isDark && {backgroundColor: theme.surface.elevated}]}>
        <Animated.View style={[styles.progressBar, {width: progressWidth, backgroundColor: theme.brand.primary}]} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={[styles.scrollContainer, isDark && {backgroundColor: 'transparent'}]}
        contentContainerStyle={{paddingBottom: insets.bottom + 40}}
        keyboardShouldPersistTaps="handled"
      >

        {/* STEP 1: Account & Mode */}
        {step === 1 && (
          <View>
            <View style={styles.brandRow}>
              <Image source={require('../../assets/images/iconlogo.png')} style={styles.brandIcon} resizeMode="contain" />
              <Text style={[styles.brandTitle, {color: theme.text.title}]}>GasPilot</Text>
            </View>
            <Text style={[styles.title, {color: theme.text.title}]}>Create your account</Text>
            <Text style={[styles.subtitle, {color: theme.text.muted}]}>Create your account to get started.</Text>

            {/* Mode Selector */}
            <View style={[styles.modeContainer, isDark && {backgroundColor: theme.surface.elevated}]}>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'create' && styles.modeBtnActive]}
                onPress={() => setMode('create')}>
                <Ionicons name="briefcase-outline" size={20} color={mode === 'create' ? '#fff' : theme.text.title} />
                <Text style={[styles.modeText, mode === 'create' && {color: UI.text.white}]}>New Company</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'join' && styles.modeBtnActive]}
                onPress={() => setMode('join')}>
                <Ionicons name="people-outline" size={20} color={mode === 'join' ? '#fff' : theme.text.title} />
                <Text style={[styles.modeText, mode === 'join' && {color: UI.text.white}]}>Join Team</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, {color: theme.text.body}]}>Full Name</Text>
              <TextInput style={[styles.input, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title}]} value={fullName} onChangeText={setFullName} placeholder="e.g. John Smith" placeholderTextColor={theme.text.placeholder} />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, {color: theme.text.body}]}>Email Address</Text>
              <TextInput style={[styles.input, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title}]} value={email} onChangeText={setEmail} placeholder="john@example.com" placeholderTextColor={theme.text.placeholder} autoCapitalize="none" keyboardType="email-address" />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, {color: theme.text.body}]}>Password</Text>
              <TextInput style={[styles.input, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title}]} value={password} onChangeText={setPassword} placeholder="Min 8 chars, 1 uppercase, 1 number" placeholderTextColor={theme.text.placeholder} secureTextEntry />
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
                <Text style={[styles.title, {color: theme.text.title}]}>About your business</Text>
                <Text style={[styles.subtitle, {color: theme.text.muted}]}>Tell us about what you do</Text>

                <View style={styles.field}>
                  <Text style={[styles.label, {color: theme.text.body}]}>Business Name</Text>
                  <TextInput style={[styles.input, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title}]} value={companyName} onChangeText={setCompanyName} placeholder="e.g. Smith's Plumbing Ltd" placeholderTextColor={theme.text.placeholder} />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, {color: theme.text.body}]}>Gas Safe Register Number</Text>
                  <TextInput
                    style={[styles.input, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title}, isApprentice && {opacity: 0.5}]}
                    value={gasSafeRegisterNumber}
                    onChangeText={setGasSafeRegisterNumber}
                    placeholder="e.g. 123456"
                    placeholderTextColor={theme.text.placeholder}
                    keyboardType="numeric"
                    maxLength={6}
                    editable={!isApprentice}
                  />
                  {gasSafeEntered && !gasSafeValid && !isApprentice && (
                    <Text style={styles.errorHint}>Must be exactly 6 digits</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    setIsApprentice(!isApprentice);
                    if (!isApprentice) {
                      setGasSafeRegisterNumber('');
                      setAcceptedGasSafeTerms(false);
                    }
                  }}
                >
                  <View style={[styles.checkbox, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}, isApprentice && styles.checkboxChecked]}>
                    {isApprentice && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={[styles.checkboxLabel, {color: theme.text.body}]}>I am an apprentice (no Gas Safe number yet)</Text>
                </TouchableOpacity>

                {!isApprentice && gasSafeEntered && gasSafeValid && (
                  <TouchableOpacity
                    style={[styles.checkboxRow, {marginTop: 16}]}
                    activeOpacity={0.7}
                    onPress={() => setAcceptedGasSafeTerms(!acceptedGasSafeTerms)}
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
              </>
            ) : (
              <>
                <Text style={[styles.title, {color: theme.text.title}]}>Join your Team</Text>
                <Text style={[styles.subtitle, {color: theme.text.muted}]}>Enter the invite code provided by your manager.</Text>

                <View style={styles.field}>
                  <Text style={[styles.label, {color: theme.text.body}]}>Invite Code</Text>
                  <TextInput
                    style={[styles.input, styles.codeInput, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title}]}
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
                <Text style={[styles.title, {color: theme.text.title}]}>Business details</Text>
                <Text style={[styles.subtitle, {color: theme.text.muted}]}>These appear on your job sheets.</Text>

                <View style={styles.field}>
                  <Text style={[styles.label, {color: theme.text.body}]}>Business Address</Text>
                  <TextInput style={[styles.input, styles.textArea, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title}]} value={businessAddress} onChangeText={setBusinessAddress} placeholder="123 High St..." placeholderTextColor={theme.text.placeholder} multiline />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, {color: theme.text.body}]}>Business Phone</Text>
                  <TextInput style={[styles.input, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title}]} value={businessPhone} onChangeText={setBusinessPhone} placeholder="07700 900000" placeholderTextColor={theme.text.placeholder} keyboardType="phone-pad" />
                </View>
              </>
            ) : (
              <View style={[styles.confirmContainer, isDark && {backgroundColor: theme.surface.elevated}]}>
                <Ionicons name="business" size={64} color={Colors.primary} />
                <Text style={[styles.confirmTitle, {color: theme.text.title}]}>Team Found!</Text>
                <Text style={styles.confirmCompany}>{foundCompany?.name}</Text>
                <Text style={[styles.confirmText, {color: theme.text.muted}]}>
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
              <Text style={[styles.consentText, {color: theme.text.muted}]}>
                I agree to the{' '}
                <Text style={styles.consentLink} onPress={() => router.push('/(auth)/privacy-policy' as any)}>Privacy Policy</Text>
                {' '}and{' '}
                <Text style={styles.consentLink} onPress={() => router.push('/(auth)/terms-of-service' as any)}>Terms of Service</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, (loading || !acceptedTerms) && {opacity: 0.7}]}
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
  header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff'},
  backBtn: {width: 40, height: 40, borderRadius: 20, backgroundColor: UI.surface.elevated, justifyContent: 'center', alignItems: 'center'},
  headerCenter: {flex: 1, alignItems: 'center'},
  stepLabel: {fontSize: 14, fontWeight: '600', color: Colors.textLight},
  progressTrack: {height: 4, backgroundColor: UI.surface.elevated, marginHorizontal: 24, borderRadius: 2, overflow: 'hidden'},
  progressBar: {height: '100%', backgroundColor: Colors.primary, borderRadius: 2},
  scrollContainer: {flex: 1, backgroundColor: '#fff', paddingHorizontal: 24},

  brandRow: {flexDirection: 'row', alignItems: 'center', gap: 0, marginTop: 32, marginBottom: 4},
  brandIcon: {width: 34, height: 34, marginTop: -4},
  brandTitle: {fontSize: 32, fontFamily: 'ClashDisplay-Semibold', letterSpacing: -0.5},
  title: {fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 6},
  subtitle: {fontSize: 15, color: Colors.textLight, lineHeight: 22, marginBottom: 28},

  modeContainer: {flexDirection: 'row', backgroundColor: UI.surface.elevated, padding: 4, borderRadius: 12, marginBottom: 24},
  modeBtn: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, gap: 8},
  modeBtnActive: {backgroundColor: Colors.primary, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4},
  modeText: {fontWeight: '600', color: Colors.text},

  field: {marginBottom: 20},
  label: {fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 8},
  input: {backgroundColor: UI.surface.base, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, fontSize: 16, color: Colors.text},
  codeInput: {textAlign: 'center', fontSize: 24, letterSpacing: 3, fontWeight: '700', textTransform: 'uppercase'},
  textArea: {minHeight: 80, textAlignVertical: 'top'},

  errorHint: {color: UI.brand.danger, fontSize: 12, marginTop: 6, marginLeft: 4},
  checkboxRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8},
  checkboxLabel: {flex: 1, fontSize: 13, lineHeight: 20},
  linkText: {color: UI.brand.primary, textDecorationLine: 'underline', fontWeight: '600'},

  nextBtn: {flexDirection: 'row', backgroundColor: Colors.primary, padding: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, ...Colors.shadow},
  nextBtnText: {color: UI.text.white, fontWeight: 'bold', fontSize: 16},

  submitBtn: {flexDirection: 'row', backgroundColor: Colors.success, padding: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12, elevation: 4},
  submitBtnText: {color: UI.text.white, fontWeight: 'bold', fontSize: 16},
  loadingRow: {flexDirection: 'row', alignItems: 'center', gap: 10},

  consentRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16, paddingHorizontal: 4},
  checkbox: {width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: UI.surface.border, justifyContent: 'center', alignItems: 'center', marginTop: 1},
  checkboxChecked: {backgroundColor: Colors.primary, borderColor: Colors.primary},
  consentText: {flex: 1, fontSize: 13, color: Colors.textLight, lineHeight: 20},
  consentLink: {color: Colors.primary, fontWeight: '600', textDecorationLine: 'underline'},
  confirmContainer: {alignItems: 'center', backgroundColor: UI.surface.base, padding: 30, borderRadius: 20, marginBottom: 20},
  confirmTitle: {fontSize: 22, fontWeight: '800', color: Colors.text, marginTop: 16},
  confirmCompany: {fontSize: 18, color: Colors.primary, fontWeight: '600', marginTop: 4, marginBottom: 12},
  confirmText: {textAlign: 'center', color: Colors.textLight, lineHeight: 22},
});