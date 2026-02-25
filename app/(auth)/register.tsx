import { router } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
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
import { auth, db } from '../../src/config/firebase';

// ─── Screen ───────────────────────────────────────────────────────────────────
//
// This screen handles TWO cases:
//
// Case A — Admin registering a new company (role = 'admin')
//   • Creates company doc keyed by their UID
//   • Creates user doc with role 'admin'
//
// Case B — Worker joining via invite (role = 'worker')
//   • Looks up invites/{safeEmail}
//   • If found, creates user doc with the invite's companyId and role 'worker'
//   • If not found, shows an error (worker must be invited first)

export default function RegisterScreen() {
  const [mode, setMode] = useState<'admin' | 'worker'>('admin');
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (mode === 'admin' && !companyName.trim()) {
      Alert.alert('Missing Field', 'Please enter your company name.');
      return;
    }
    if (!name.trim() || !trimmedEmail || !password) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'admin') {
        await registerAdmin(trimmedEmail, name.trim(), companyName.trim());
      } else {
        await registerWorker(trimmedEmail, name.trim());
      }
    } catch (e: any) {
      console.error('Registration error:', e);
      Alert.alert('Registration Failed', e.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // ── Admin Registration ──────────────────────────────────────────────────────

  const registerAdmin = async (trimmedEmail: string, trimmedName: string, trimmedCompany: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
    const user = userCredential.user;

    // Company doc — use UID as company ID for simplicity in MVP
    await setDoc(doc(db, 'companies', user.uid), {
      name: trimmedCompany,
      ownerId: user.uid,
      subscriptionStatus: 'trialing',
      createdAt: serverTimestamp(),
      settings: {
        nextJobNumber: 1,
        currency: 'GBP',
      },
    });

    // User doc
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: trimmedEmail,
      displayName: trimmedName,
      companyId: user.uid, // company ID == owner UID for MVP
      role: 'admin',
      createdAt: serverTimestamp(),
    });

    await updateProfile(user, { displayName: trimmedName });

    // AuthContext will detect the auth state change and redirect to dashboard
  };

  // ── Worker Registration ─────────────────────────────────────────────────────

  const registerWorker = async (trimmedEmail: string, trimmedName: string) => {
    // Look up the invite the admin created
    const safeEmailKey = trimmedEmail.replace('@', '_at_').replace(/\./g, '_dot_');
    const inviteRef = doc(db, 'invites', safeEmailKey);
    const inviteDoc = await getDoc(inviteRef);

    if (!inviteDoc.exists()) {
      throw new Error(
        "No invite found for this email address. Ask your admin to add you to their company first."
      );
    }

    const invite = inviteDoc.data();

    // Create the Firebase Auth account
    const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
    const user = userCredential.user;

    // Create user doc linked to the company from the invite
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: trimmedEmail,
      displayName: trimmedName,
      companyId: invite.companyId,
      role: 'worker',
      createdAt: serverTimestamp(),
    });

    await updateProfile(user, { displayName: trimmedName });

    // AuthContext will detect the auth state change and redirect to worker jobs
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>

        <Text style={styles.title}>Create Account</Text>

        {/* Toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'admin' && styles.toggleBtnActive]}
            onPress={() => setMode('admin')}
          >
            <Text style={[styles.toggleText, mode === 'admin' && styles.toggleTextActive]}>
              Company Admin
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'worker' && styles.toggleBtnActive]}
            onPress={() => setMode('worker')}
          >
            <Text style={[styles.toggleText, mode === 'worker' && styles.toggleTextActive]}>
              I have an Invite
            </Text>
          </TouchableOpacity>
        </View>

        {/* Context hint */}
        <Text style={styles.hint}>
          {mode === 'admin'
            ? 'Register your trade business and start managing jobs.'
            : 'Your admin must add you to their company first. Use the same email they entered.'}
        </Text>

        {/* Company Name (admin only) */}
        {mode === 'admin' && (
          <>
            <Text style={styles.label}>Company Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Smith Plumbing Ltd"
              autoCapitalize="words"
              value={companyName}
              onChangeText={setCompanyName}
            />
          </>
        )}

        <Text style={styles.label}>Your Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Full name"
          autoCapitalize="words"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          placeholder="your@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Minimum 6 characters"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === 'admin' ? 'Create Company' : 'Join Company'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Already have an account? Sign In</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#fff', paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 20, marginTop: 10 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  toggleText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  toggleTextActive: { color: '#111827', fontWeight: '700' },
  hint: { fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#f9fafb',
    padding: 14,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { backgroundColor: '#93c5fd' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  backLink: { alignItems: 'center', marginTop: 20 },
  backLinkText: { color: '#2563eb', fontSize: 14 },
});
