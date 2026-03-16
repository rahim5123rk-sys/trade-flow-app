// components/ReminderSection.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/ThemeContext';

interface Props {
  enabled: boolean;
  onToggle: (val: boolean) => void;
  /** Emails already on the form (customer, landlord, tenant — filtered for non-empty) */
  savedEmails: string[];
  /** Called whenever the one-time email list changes */
  onOneTimeEmailsChange: (emails: string[]) => void;
  /**
   * Pre-fill the one-time email list (document details use case — existing
   * `payment_info.oneTimeReminderEmails` from a previous save).
   * Omit or pass undefined for form screens (always starts empty).
   */
  initialOneTimeEmails?: string[];
}

export default function ReminderSection({ enabled, onToggle, savedEmails, onOneTimeEmailsChange, initialOneTimeEmails }: Props) {
  const { theme, isDark } = useAppTheme();
  const { reminderDaysBefore } = useAuth();
  const [oneTimeEmails, setOneTimeEmails] = useState<string[]>(
    (initialOneTimeEmails ?? []).map(e => e.toLowerCase())
  );
  const [inputValue, setInputValue] = useState('');

  const addEmail = () => {
    const trimmed = inputValue.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return;
    if (oneTimeEmails.includes(trimmed)) { setInputValue(''); return; }
    const updated = [...oneTimeEmails, trimmed];
    setOneTimeEmails(updated);
    onOneTimeEmailsChange(updated);
    setInputValue('');
  };

  const removeOneTime = (email: string) => {
    const updated = oneTimeEmails.filter((e) => e !== email);
    setOneTimeEmails(updated);
    onOneTimeEmailsChange(updated);
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? theme.surface.elevated : '#F8F9FA', borderColor: isDark ? theme.surface.border : '#E5E7EB' }]}>
      {/* Toggle row */}
      <TouchableOpacity style={styles.toggleRow} onPress={() => onToggle(!enabled)} activeOpacity={0.8}>
        <View style={styles.toggleLeft}>
          <Ionicons name="notifications-outline" size={18} color={enabled ? theme.brand.primary : theme.text.muted} />
          <View style={{ marginLeft: 10 }}>
            <Text style={[styles.toggleLabel, { color: theme.text.title }]}>Renewal Reminder</Text>
            <Text style={[styles.toggleSub, { color: theme.text.muted }]}>
              Email {reminderDaysBefore} days before expiry
            </Text>
          </View>
        </View>
        {/* Simple toggle indicator */}
        <View style={[styles.toggle, { backgroundColor: enabled ? theme.brand.primary : (isDark ? theme.surface.border : '#D1D5DB') }]}>
          <View style={[styles.toggleThumb, { transform: [{ translateX: enabled ? 18 : 2 }] }]} />
        </View>
      </TouchableOpacity>

      {enabled && (
        <>
          <View style={[styles.divider, { backgroundColor: isDark ? theme.surface.border : '#E5E7EB' }]} />

          {/* Saved emails */}
          {savedEmails.map((email) => (
            <View key={email} style={styles.emailRow}>
              <Ionicons name="mail-outline" size={14} color={theme.text.muted} />
              <Text style={[styles.emailText, { color: theme.text.body }]}>{email}</Text>
            </View>
          ))}

          {/* One-time emails */}
          {oneTimeEmails.map((email) => (
            <View key={email} style={styles.emailRow}>
              <Ionicons name="mail-outline" size={14} color={theme.brand.primary} />
              <Text style={[styles.emailText, { color: theme.text.body }]}>{email}</Text>
              <TouchableOpacity onPress={() => removeOneTime(email)} style={{ marginLeft: 'auto' }}>
                <Ionicons name="close-circle" size={16} color={theme.text.muted} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add one-time email input */}
          <View style={[styles.addRow, { borderColor: isDark ? theme.surface.border : '#D1D5DB' }]}>
            <TextInput
              style={[styles.emailInput, { color: theme.text.body }]}
              placeholder="+ Add one-time email address"
              placeholderTextColor={theme.text.muted}
              value={inputValue}
              onChangeText={setInputValue}
              onSubmitEditing={addEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="done"
            />
            {inputValue.length > 0 && (
              <TouchableOpacity onPress={addEmail}>
                <Ionicons name="add-circle" size={22} color={theme.brand.primary} />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 20 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: '700' },
  toggleSub: { fontSize: 12, marginTop: 1 },
  toggle: { width: 42, height: 24, borderRadius: 12, justifyContent: 'center' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  divider: { height: 1, marginVertical: 12 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  emailText: { fontSize: 13, flex: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4 },
  emailInput: { flex: 1, fontSize: 13 },
});
