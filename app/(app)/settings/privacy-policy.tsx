import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GlassIconButton} from '../../../components/GlassIconButton';
import {Colors, UI} from '../../../constants/theme';
import {useAppTheme} from '../../../src/context/ThemeContext';
import {LEGAL_LAST_UPDATED, PRIVACY_POLICY_SECTIONS} from '../../../src/legal/legalContent';

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const {theme, isDark} = useAppTheme();

  return (
    <View style={[styles.container, {paddingTop: insets.top, backgroundColor: theme.surface.base}]}>
      {/* Header */}
      <View style={styles.header}>
        <GlassIconButton onPress={() => router.back()} />
        <Text style={[styles.headerTitle, {color: theme.text.title}]}>Privacy Policy</Text>
        <View style={{width: 40}} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, {paddingBottom: insets.bottom + 40}]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.badge, isDark && {backgroundColor: 'rgba(255,255,255,0.08)'}]}>
          <Ionicons name="shield-checkmark" size={18} color={UI.brand.primary} />
          <Text style={styles.badgeText}>GDPR Compliant</Text>
        </View>

        <Text style={[styles.lastUpdated, {color: theme.text.muted}]}>Last updated: {LEGAL_LAST_UPDATED}</Text>

        {PRIVACY_POLICY_SECTIONS.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={[styles.sectionTitle, {color: theme.text.title}]}>{s.title}</Text>
            <Text style={[styles.sectionBody, {color: theme.text.body}]}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: UI.surface.elevated,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {paddingHorizontal: 20, paddingTop: 20},
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: UI.surface.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  badgeText: {fontSize: 12, fontWeight: '700', color: UI.brand.primary},
  lastUpdated: {
    fontSize: 13,
    color: UI.text.muted,
    marginBottom: 24,
  },
  section: {marginBottom: 24},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 14,
    color: UI.text.secondary,
    lineHeight: 22,
  },
});
