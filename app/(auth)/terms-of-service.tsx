import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors, UI} from '../../constants/theme';
import {LEGAL_LAST_UPDATED, TERMS_OF_SERVICE_SECTIONS} from '../../src/legal/legalContent';
import {useAppTheme} from '../../src/context/ThemeContext';

export default function TermsOfServiceScreen() {
  const insets = useSafeAreaInsets();
  const {theme, isDark} = useAppTheme();

  return (
    <View style={[styles.container, {paddingTop: insets.top, backgroundColor: theme.surface.base}]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, isDark && {backgroundColor: theme.surface.elevated}]}>
          <Ionicons name="arrow-back" size={24} color={theme.text.title} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: theme.text.title}]}>Terms of Service</Text>
        <View style={{width: 40}} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, {paddingBottom: insets.bottom + 40}]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lastUpdated, {color: theme.text.muted}]}>Last updated: {LEGAL_LAST_UPDATED}</Text>

        {TERMS_OF_SERVICE_SECTIONS.map((s, i) => (
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: UI.surface.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {paddingHorizontal: 20, paddingTop: 20},
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
