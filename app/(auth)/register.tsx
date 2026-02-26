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
    if (password.length < 6) return 'Password must be at least 6 characters.';
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
      // 1. Create Auth User
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("No user returned");

      const userId = authData.user.id;
      let companyId = '';
      let userRole = '';

      if (mode === 'create') {
        // --- FLOW A: Create Company ---
        const code = generateInviteCode();
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .insert({
            name: companyName.trim(),
            address: businessAddress.trim(),
            phone: businessPhone.trim(),
            email: email.trim(), // Default to user email
            trade: trade,
            invite_code: code,
            settings: { nextJobNumber: 1 },
          })
          .select()
          .single();

        if (companyError) throw companyError;
        companyId = company.id;
        userRole = 'admin';

      } else {
        // --- FLOW B: Join Company ---
        if (!foundCompany) throw new Error("Company not confirmed");
        companyId = foundCompany.id;
        userRole = 'worker';
      }

      // 2. Create Profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email.trim(),
          display_name: fullName.trim(),
          company_id: companyId,
          role: userRole as any,
        });

      if (profileError) throw profileError;

      // 3. Complete
      setRegistering(false);
      await refreshProfile();
      
      // Redirect based on role
      if (userRole === 'admin') {
        router.replace('/(admin)/dashboard');
      } else {
        // Assuming you have this route, or redirect to a worker waiting screen
        router.replace('/(worker)/jobs'); 
      }

    } catch (error: any) {
      console.error(error);
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
                <Text style={[styles.modeText, mode === 'create' && { color: '#fff' }]}>New Company</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modeBtn, mode === 'join' && styles.modeBtnActive]} 
                onPress={() => setMode('join')}>
                <Ionicons name="people-outline" size={20} color={mode === 'join' ? '#fff' : Colors.text} />
                <Text style={[styles.modeText, mode === 'join' && { color: '#fff' }]}>Join Team</Text>
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
              <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Min 6 characters" placeholderTextColor="#94a3b8" secureTextEntry />
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
              <Text style={styles.nextBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
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
                  <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} placeholder="e.g. Smith's Plumbing Ltd" placeholderTextColor="#94a3b8" />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>What's your trade?</Text>
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
              <Ionicons name="arrow-forward" size={20} color="#fff" />
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

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.submitBtnText}>{mode === 'create' ? 'Creating Account...' : 'Joining Team...'}</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
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
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  stepLabel: { fontSize: 14, fontWeight: '600', color: Colors.textLight },
  progressTrack: { height: 4, backgroundColor: '#f1f5f9', marginHorizontal: 24, borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  scrollContainer: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 24 },
  
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginTop: 32, marginBottom: 6 },
  subtitle: { fontSize: 15, color: Colors.textLight, lineHeight: 22, marginBottom: 28 },
  
  modeContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 4, borderRadius: 12, marginBottom: 24 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, gap: 8 },
  modeBtnActive: { backgroundColor: Colors.primary, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  modeText: { fontWeight: '600', color: Colors.text },

  field: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  input: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, fontSize: 16, color: Colors.text },
  codeInput: { textAlign: 'center', fontSize: 24, letterSpacing: 3, fontWeight: '700', textTransform: 'uppercase' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  
  tradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tradeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#f1f5f9' },
  tradeChipActive: { backgroundColor: '#EFF6FF', borderColor: Colors.primary },
  tradeChipText: { fontSize: 14, fontWeight: '500', color: Colors.textLight },
  tradeChipTextActive: { color: Colors.primary, fontWeight: '700' },
  
  nextBtn: { flexDirection: 'row', backgroundColor: Colors.primary, padding: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, ...Colors.shadow },
  nextBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  submitBtn: { flexDirection: 'row', backgroundColor: Colors.success, padding: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12, elevation: 4 },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  confirmContainer: { alignItems: 'center', backgroundColor: '#F8FAFC', padding: 30, borderRadius: 20, marginBottom: 20 },
  confirmTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginTop: 16 },
  confirmCompany: { fontSize: 18, color: Colors.primary, fontWeight: '600', marginTop: 4, marginBottom: 12 },
  confirmText: { textAlign: 'center', color: Colors.textLight, lineHeight: 22 },
});