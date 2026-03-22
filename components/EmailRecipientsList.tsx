// components/EmailRecipientsList.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppTheme } from '../src/context/ThemeContext';

interface Props {
  defaultEmails: string[];
  additionalEmails: string[];
  onAdditionalEmailsChange: (emails: string[]) => void;
  title?: string;
  subtitle?: string;
}

export default function EmailRecipientsList({
  defaultEmails,
  additionalEmails,
  onAdditionalEmailsChange,
  title = "Email Recipients",
  subtitle = "Document will be sent to these addresses"
}: Props) {
  const { theme, isDark } = useAppTheme();
  const [inputValue, setInputValue] = useState('');

  const addEmail = () => {
    const trimmed = inputValue.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return;
    if (additionalEmails.includes(trimmed) || defaultEmails.map(e => e.toLowerCase()).includes(trimmed)) {
      setInputValue('');
      return;
    }
    const updated = [...additionalEmails, trimmed];
    onAdditionalEmailsChange(updated);
    setInputValue('');
  };

  const removeAdditional = (email: string) => {
    const updated = additionalEmails.filter((e) => e !== email);
    onAdditionalEmailsChange(updated);
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? theme.surface.elevated : '#F8F9FA', borderColor: isDark ? theme.surface.border : '#E5E7EB' }]}>
      <View style={styles.header}>
        <Ionicons name="mail-unread-outline" size={18} color={theme.brand.primary} />
        <View style={{ marginLeft: 10 }}>
          <Text style={[styles.title, { color: theme.text.title }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]}>{subtitle}</Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: isDark ? theme.surface.border : '#E5E7EB' }]} />

      {/* Default emails */}
      {defaultEmails.map((email) => (
        <View key={email} style={styles.emailRow}>
          <Ionicons name="person-outline" size={14} color={theme.text.muted} />
          <Text style={[styles.emailText, { color: theme.text.body }]}>{email}</Text>
        </View>
      ))}
      
      {defaultEmails.length === 0 && (
        <Text style={[styles.noEmailText, { color: theme.brand.danger }]}>No default email found.</Text>
      )}

      {/* Additional emails */}
      {additionalEmails.map((email) => (
        <View key={email} style={styles.emailRow}>
          <Ionicons name="mail-outline" size={14} color={theme.brand.primary} />
          <Text style={[styles.emailText, { color: theme.text.body }]}>{email}</Text>
          <TouchableOpacity onPress={() => removeAdditional(email)} style={{ marginLeft: 'auto' }}>
            <Ionicons name="close-circle" size={16} color={theme.text.muted} />
          </TouchableOpacity>
        </View>
      ))}

      {/* Add additional email input */}
      <View style={[styles.addRow, { borderColor: isDark ? theme.surface.border : '#D1D5DB' }]}>
        <TextInput
          style={[styles.emailInput, { color: theme.text.body }]}
          placeholder="+ Add another email address"
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 1 },
  divider: { height: 1, marginVertical: 12 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  emailText: { fontSize: 13, flex: 1 },
  noEmailText: { fontSize: 13, marginBottom: 8, fontStyle: 'italic' },
  addRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4 },
  emailInput: { flex: 1, fontSize: 13 },
});
