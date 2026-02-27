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
import { Colors } from '../../../constants/theme';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: `By creating an account and using TradeFlow ("the App"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the App.`,
  },
  {
    title: '2. Description of Service',
    body: `TradeFlow is a trade management application that allows tradespeople to manage customers, jobs, invoices, quotes, workers, and gas safety certificates (CP12). The service is provided "as is" for business use by qualified tradespeople and their teams.`,
  },
  {
    title: '3. Account Responsibilities',
    body: `• You must provide accurate and complete registration information.
• You are responsible for maintaining the security of your account credentials.
• You are responsible for all activity that occurs under your account.
• You must notify us immediately of any unauthorised use of your account.
• You must be at least 16 years old to create an account.`,
  },
  {
    title: '4. Acceptable Use',
    body: `You agree to use TradeFlow only for lawful business purposes. You must not:

• Use the App to store or process data in violation of applicable laws.
• Share access credentials with unauthorised individuals.
• Attempt to reverse engineer, decompile, or hack the App.
• Use the App to harass, defame, or infringe on the rights of others.
• Upload malicious content, viruses, or harmful code.`,
  },
  {
    title: '5. Data & Privacy',
    body: `Your use of TradeFlow is also governed by our Privacy Policy. By using the App, you acknowledge that you have read and understood our Privacy Policy, which explains how we collect, use, and protect your personal data.

As a company administrator, you are responsible for ensuring that you have appropriate consent or legal basis to store customer, tenant, and landlord personal data in the App.`,
  },
  {
    title: '6. Gas Safety Certificates (CP12)',
    body: `CP12 gas safety certificates generated through TradeFlow are provided as a digital tool to assist qualified Gas Safe registered engineers. 

• You are solely responsible for the accuracy of all data entered into certificates.
• TradeFlow does not verify your Gas Safe registration or qualifications.
• Certificates must comply with the Gas Safety (Installation & Use) Regulations 1998.
• You must retain records for a minimum of 2 years as required by law.
• TradeFlow is not liable for any errors or omissions in certificates you generate.`,
  },
  {
    title: '7. Invoices & Documents',
    body: `Invoices, quotes, and other documents generated through TradeFlow are tools provided for your convenience. You are responsible for ensuring they comply with applicable tax and business regulations (e.g., HMRC requirements for VAT invoices).`,
  },
  {
    title: '8. Team & Worker Accounts',
    body: `• Company administrators can invite workers to join their team via invite codes.
• Administrators are responsible for managing worker access and permissions.
• Workers can access job data assigned to them by the administrator.
• Upon removal from a team, a worker's access to company data is revoked immediately.`,
  },
  {
    title: '9. Intellectual Property',
    body: `TradeFlow and all associated branding, logos, and software are the intellectual property of TradeFlow. You retain ownership of all data you enter into the App. By using the App, you grant us a limited licence to process your data solely for the purpose of providing the service.`,
  },
  {
    title: '10. Limitation of Liability',
    body: `To the maximum extent permitted by law:

• TradeFlow is provided "as is" without warranties of any kind.
• We are not liable for any loss of data, business interruption, or damages arising from your use of the App.
• We do not guarantee uninterrupted or error-free service.
• Our total liability shall not exceed the amount you have paid for the service in the 12 months preceding the claim.`,
  },
  {
    title: '11. Account Termination',
    body: `• You may delete your account at any time via Settings > Delete My Account.
• We may suspend or terminate accounts that violate these terms.
• Upon termination, your data will be deleted in accordance with our Privacy Policy.`,
  },
  {
    title: '12. Changes to Terms',
    body: `We may update these Terms of Service from time to time. We will notify you of material changes via in-app notification or email. Continued use after changes constitutes acceptance.`,
  },
  {
    title: '13. Governing Law',
    body: `These terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.`,
  },
  {
    title: '14. Contact',
    body: `For questions about these terms, contact us through the app's Settings page or email support@tradeflow.app.`,
  },
];

export default function TermsOfServiceScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
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
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
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
  lastUpdated: {
    fontSize: 13,
    color: '#94A3B8',
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
    color: '#475569',
    lineHeight: 22,
  },
});
