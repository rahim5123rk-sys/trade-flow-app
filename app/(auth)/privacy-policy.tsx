import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, UI} from '../../constants/theme';

const SECTIONS = [
  {
    title: '1. Data Controller',
    body: `TradeFlow is a trade management application. When you create a company account, your company acts as the data controller for customer and job data processed through the app. TradeFlow (the software) acts as a data processor on your behalf.`,
  },
  {
    title: '2. What Data We Collect',
    body: `We collect and process the following categories of personal data:

• Account Data: Name, email address, password (hashed), company name, business address, phone number, trade type.
• Professional Data: Gas Safe Register number, gas licence number, OFTEC number (where applicable).
• Customer Data: Customer name, company name, address, postcode, email, phone number.
• Tenant & Landlord Data: Name, address, email, phone number (for CP12 gas safety certificates).
• Job Data: Job descriptions, notes, photos, site addresses.
• Document Data: Invoices, quotes, CP12 certificates including customer/landlord/tenant details.
• Digital Signatures: Handwritten signatures captured digitally for certificates and documents.
• Device Data: Push notification tokens, device type (for notifications only).`,
  },
  {
    title: '3. Why We Process Your Data',
    body: `We process personal data for the following purposes and legal bases:

• Contract Performance: To provide the trade management service you signed up for — managing jobs, customers, invoices, quotes and gas safety certificates.
• Legal Obligation: Gas Safety (Installation & Use) Regulations 1998 require gas safety records to be retained for at least 2 years.
• Legitimate Interest: To send job-related push notifications, to maintain audit trails of work carried out.
• Consent: For any optional processing — you may withdraw consent at any time via Settings.`,
  },
  {
    title: '4. Data Sharing',
    body: `We share personal data with the following third parties:

• Supabase (Database & Authentication): Your data is stored securely in Supabase's cloud infrastructure. Supabase acts as our data processor under a Data Processing Agreement.
• Expo Push Notification Service: Device push tokens are sent to Expo's servers to deliver notifications. No personal data beyond the token and notification content is shared.
• PDF Recipients: When you share a PDF (invoice, quote, CP12 certificate) via the share sheet, the document may contain personal data. You control who receives these documents.

We do not sell your data to third parties. We do not use your data for advertising or profiling.`,
  },
  {
    title: '5. Data Retention',
    body: `• Account data is retained for as long as your account is active.
• Customer and job data is retained until you delete it or delete your account.
• CP12 gas safety certificates are retained for a minimum of 2 years as required by law (Regulation 36).
• When you delete your account, all personal data is permanently removed within 30 days, except where retention is required by law.
• Document snapshots (locked certificates) are anonymised when the associated customer is deleted.`,
  },
  {
    title: '6. Your Rights (GDPR)',
    body: `Under the General Data Protection Regulation, you have the right to:

• Access: Request a copy of all personal data we hold about you. Use "Export My Data" in Settings.
• Rectification: Correct inaccurate data via your profile or customer records.
• Erasure: Delete your account and all associated data via "Delete My Account" in Settings.
• Portability: Export your data in a machine-readable format (JSON).
• Restriction: Request that we limit processing of your data.
• Object: Object to processing based on legitimate interests.
• Withdraw Consent: Where processing is based on consent, withdraw at any time.

To exercise any of these rights, use the relevant feature in Settings or contact us.`,
  },
  {
    title: '7. Data Security',
    body: `We implement appropriate technical and organisational measures to protect your personal data:

• All data in transit is encrypted using TLS/SSL.
• Authentication tokens are stored in encrypted device storage (Secure Store).
• Passwords are hashed and never stored in plain text.
• Access to customer data is restricted by company membership.
• Row-level security policies are enforced at the database level.`,
  },
  {
    title: '8. Children\'s Privacy',
    body: `TradeFlow is not intended for use by anyone under the age of 16. We do not knowingly collect personal data from children.`,
  },
  {
    title: '9. Changes to This Policy',
    body: `We may update this privacy policy from time to time. We will notify you of significant changes via in-app notification or email. Continued use of the app after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: '10. Contact',
    body: `If you have questions about this privacy policy or wish to exercise your data rights, please contact us through the app's Settings page or email us at support@tradeflow.app.`,
  },
];

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark" size={18} color={UI.brand.primary} />
          <Text style={styles.badgeText}>GDPR Compliant</Text>
        </View>

        <Text style={styles.lastUpdated}>Last updated: 27 February 2026</Text>

        {SECTIONS.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
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
  content: { paddingHorizontal: 20, paddingTop: 20 },
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
  badgeText: { fontSize: 12, fontWeight: '700', color: UI.brand.primary },
  lastUpdated: {
    fontSize: 13,
    color: UI.text.muted,
    marginBottom: 24,
  },
  section: { marginBottom: 24 },
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
