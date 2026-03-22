// ============================================
// FILE: app/(app)/cp12/index.tsx
// Step 1 – Landlord & Tenant details
// ============================================

import {Ionicons} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {LinearGradient} from 'expo-linear-gradient';
import {router} from 'expo-router';
import React, {useEffect} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {FadeIn, FadeInDown} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useState} from 'react';
import {CustomerSelector} from '../../../components/CustomerSelector';
import {SiteAddressSelector, SiteAddressData} from '../../../components/forms/SiteAddressSelector';
import ProPaywallModal from '../../../components/ProPaywallModal';
import {Colors, UI} from '../../../constants/theme';
import {supabase} from '../../../src/config/supabase';
import {useAuth} from '../../../src/context/AuthContext';
import {useCP12} from '../../../src/context/CP12Context';
import {useSubscription} from '../../../src/context/SubscriptionContext';
import {useAppTheme} from '../../../src/context/ThemeContext';

const STARTER_MONTHLY_CP12_LIMIT = 10;

const GLASS_BG = UI.glass.bg;
const GLASS_BORDER = UI.glass.border;
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;
const CP12_DUPLICATE_SEED_KEY = 'cp12_duplicate_seed_v1';
const CP12_EDIT_SEED_KEY = 'cp12_edit_seed_v1';

// ─── Step indicator ─────────────────────────────────────────────

const StepIndicator = ({current}: {current: number}) => {
  const {isDark, theme} = useAppTheme();
  return (
    <View style={[s.stepRow, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
      {['Details', 'Appliances', 'Checks', 'Review'].map((label, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <View key={label} style={s.stepItem}>
            <View
              style={[
                s.stepDot,
                isActive && s.stepDotActive,
                isDone && s.stepDotDone,
              ]}
            >
              {isDone ? (
                <Ionicons name="checkmark" size={12} color={UI.text.white} />
              ) : (
                <Text
                  style={[
                    s.stepDotText,
                    (isActive || isDone) && {color: UI.text.white},
                    isDark && !isActive && !isDone && {color: theme.text.muted},
                  ]}
                >
                  {step}
                </Text>
              )}
            </View>
            <Text style={[s.stepLabel, isActive ? {color: theme.brand.primary} : isDark && {color: theme.text.muted}]}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

// ─── Main screen ────────────────────────────────────────────────

export default function CP12DetailsScreen() {
  const {theme, isDark} = useAppTheme();
  const {isPro} = useSubscription();
  const {userProfile} = useAuth();
  const insets = useSafeAreaInsets();
  const [showPaywall, setShowPaywall] = useState(false);

  // Check monthly CP12 count for Starter users on mount
  useEffect(() => {
    if (isPro || !userProfile?.company_id) return;
    const checkLimit = async () => {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', userProfile.company_id)
        .eq('type', 'cp12')
        .gte('created_at', firstOfMonth);
      if (count !== null && count >= STARTER_MONTHLY_CP12_LIMIT) {
        setShowPaywall(true);
      }
    };
    checkLimit();
  }, [isPro, userProfile?.company_id]);
  const {
    landlordForm,
    setLandlordForm,
    tenantTitle,
    setTenantTitle,
    tenantName,
    setTenantName,
    tenantEmail,
    setTenantEmail,
    tenantPhone,
    setTenantPhone,
    tenantAddressLine1,
    setTenantAddressLine1,
    tenantAddressLine2,
    setTenantAddressLine2,
    tenantCity,
    setTenantCity,
    tenantPostCode,
    setTenantPostCode,
    propertyAddress,
    hydrateFromDuplicate,
    hydrateForEdit,
    editingDocumentId,
  } = useCP12();

  const siteAddress: SiteAddressData = {
    tenantTitle, tenantName, tenantEmail, tenantPhone,
    addressLine1: tenantAddressLine1, addressLine2: tenantAddressLine2,
    city: tenantCity, postCode: tenantPostCode,
  };

  const handleSiteAddressChange = (data: SiteAddressData) => {
    setTenantTitle(data.tenantTitle);
    setTenantName(data.tenantName);
    setTenantEmail(data.tenantEmail);
    setTenantPhone(data.tenantPhone);
    setTenantAddressLine1(data.addressLine1);
    setTenantAddressLine2(data.addressLine2);
    setTenantCity(data.city);
    setTenantPostCode(data.postCode);
  };

  useEffect(() => {
    const loadSeed = async () => {
      try {
        // Check for edit seed first (takes priority over duplicate)
        const editRaw = await AsyncStorage.getItem(CP12_EDIT_SEED_KEY);
        if (editRaw) {
          const parsed = JSON.parse(editRaw);
          hydrateForEdit({
            propertyAddress: parsed?.propertyAddress,
            appliances: parsed?.appliances,
            landlordForm: parsed?.landlordForm,
            tenantName: parsed?.tenantName,
            tenantEmail: parsed?.tenantEmail,
            tenantPhone: parsed?.tenantPhone,
            nextDueDate: parsed?.nextDueDate,
            renewalReminderEnabled: parsed?.renewalReminderEnabled,
            inspectionDate: parsed?.inspectionDate,
            finalChecks: parsed?.finalChecks,
            customerSignature: parsed?.customerSignature,
            certRef: parsed?.certRef,
            documentId: parsed?.documentId,
          });
          await AsyncStorage.removeItem(CP12_EDIT_SEED_KEY);
          Alert.alert('Editing Certificate', 'All certificate details have been loaded. Make your changes and save on the Review page.');
          return;
        }

        // Otherwise check for duplicate seed
        const raw = await AsyncStorage.getItem(CP12_DUPLICATE_SEED_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        hydrateFromDuplicate({
          propertyAddress: parsed?.propertyAddress,
          appliances: parsed?.appliances,
          landlordForm: parsed?.landlordForm,
          tenantName: parsed?.tenantName,
          tenantEmail: parsed?.tenantEmail,
          tenantPhone: parsed?.tenantPhone,
          nextDueDate: parsed?.nextDueDate,
          renewalReminderEnabled: parsed?.renewalReminderEnabled,
        });
        await AsyncStorage.removeItem(CP12_DUPLICATE_SEED_KEY);
        Alert.alert('Certificate Duplicated', 'Previous landlord, tenant and property details have been prefilled. Review and update before saving.');
      } catch {
        await AsyncStorage.removeItem(CP12_DUPLICATE_SEED_KEY);
        await AsyncStorage.removeItem(CP12_EDIT_SEED_KEY);
      }
    };

    void loadSeed();
  }, [hydrateFromDuplicate, hydrateForEdit]);

  const handleNext = () => {
    if (!landlordForm.customerName.trim()) {
      Alert.alert('Missing Info', 'Please enter the landlord name.');
      return;
    }
    if (!tenantAddressLine1.trim() || !tenantCity.trim() || !tenantPostCode.trim()) {
      Alert.alert('Missing Info', 'Address Line 1, City and Postcode are required.');
      return;
    }
    router.push('/(app)/cp12/appliances');
  };

  return (
    <View style={s.root}>
      <ProPaywallModal
        visible={showPaywall}
        onDismiss={() => { setShowPaywall(false); router.back(); }}
        featureTitle="Unlimited Gas Certificates"
        featureDescription="You've reached your monthly limit of 10 gas safety certificates on the Starter plan. Upgrade to Pro for unlimited."
      />
      <LinearGradient
        colors={theme.gradients.appBackground}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            s.scroll,
            {paddingTop: insets.top + 8, paddingBottom: TAB_BAR_HEIGHT + 100},
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(50).springify()} style={s.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[s.backBtn, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={theme.text.title} />
            </TouchableOpacity>
            <View style={{flex: 1}}>
              <Text style={[s.title, {color: theme.text.title}]}>Landlord Gas Safety Record</Text>
            </View>
          </Animated.View>

          <StepIndicator current={1} />

          {/* Landlord Details */}
          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <View style={s.sectionHeader}>
              <LinearGradient
                colors={UI.gradients.primary}
                style={s.sectionIcon}
              >
                <Ionicons name="person" size={16} color={UI.text.white} />
              </LinearGradient>
              <Text style={s.sectionTitle}>Landlord Details</Text>
            </View>

            <CustomerSelector
              value={landlordForm}
              onChange={setLandlordForm}
              mode="full"
              showJobAddress={false}
              hideTabs={false}
              showActions={true}
            />
          </Animated.View>

          {/* Tenant & Property Address */}
          <Animated.View entering={FadeInDown.delay(250).springify()}>
            <View style={[s.sectionHeader, {marginTop: 24}]}>
              <LinearGradient
                colors={UI.gradients.successLight}
                style={s.sectionIcon}
              >
                <Ionicons name="home" size={16} color={UI.text.white} />
              </LinearGradient>
              <Text style={[s.sectionTitle, {color: theme.text.title}]}>Tenant & Property</Text>
            </View>

            <SiteAddressSelector
              value={siteAddress}
              onChange={handleSiteAddressChange}
              customerAddress={{
                addressLine1: landlordForm.addressLine1,
                addressLine2: landlordForm.addressLine2,
                city: landlordForm.city,
                postCode: landlordForm.postCode,
              }}
            />
          </Animated.View>
        </ScrollView>

        {/* Bottom CTA */}
        <Animated.View
          entering={FadeIn.delay(500)}
          style={[s.bottomBar, {bottom: TAB_BAR_HEIGHT, paddingBottom: 12}, isDark && {backgroundColor: 'rgba(28,28,30,0.97)', borderTopColor: 'rgba(255,255,255,0.08)'}]}
        >
          <TouchableOpacity
            style={s.nextBtn}
            activeOpacity={0.85}
            onPress={handleNext}
          >
            <LinearGradient
              colors={UI.gradients.primaryDark}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={s.nextGradient}
            >
              <Text style={s.nextText}>Next: Add Appliances</Text>
              <Ionicons name="arrow-forward" size={20} color={UI.text.white} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {flex: 1},
  scroll: {paddingHorizontal: 20},

  // Header
  header: {flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12},
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {fontSize: 24, fontWeight: '800', color: UI.text.title, letterSpacing: -0.5},
  subtitle: {fontSize: 13, color: UI.text.muted, fontWeight: '500', marginTop: 2},

  // Step indicator
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 24,
    paddingVertical: 14,
    backgroundColor: GLASS_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  stepItem: {alignItems: 'center', gap: 6},
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: UI.surface.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {backgroundColor: UI.brand.primary},
  stepDotDone: {backgroundColor: UI.status.complete},
  stepDotText: {fontSize: 12, fontWeight: '700', color: UI.text.muted},
  stepLabel: {fontSize: 11, fontWeight: '600', color: UI.text.muted},
  stepLabelActive: {color: UI.brand.primary},

  // Sections
  sectionHeader: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12},
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {fontSize: 17, fontWeight: '700', color: UI.text.title},

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: 'rgba(248,250,252,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  nextBtn: {borderRadius: 16, overflow: 'hidden'},
  nextGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  nextText: {fontSize: 16, fontWeight: '700', color: UI.text.white},
});
