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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {FadeIn, FadeInDown} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CustomerSelector} from '../../../components/CustomerSelector';
import {Colors, UI} from '../../../constants/theme';
import {useCP12} from '../../../src/context/CP12Context';
import {useAppTheme} from '../../../src/context/ThemeContext';

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

// ─── Input helper ───────────────────────────────────────────────

const FormInput = ({
  label,
  value,
  onChange,
  placeholder,
  icon,
  keyboardType,
  autoCapitalize,
  isDark,
  theme,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon?: keyof typeof Ionicons.glyphMap;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  isDark?: boolean;
  theme?: any;
}) => (
  <View style={s.inputContainer}>
    <Text style={[s.inputLabel, isDark && theme && {color: theme.text.bodyLight}]}>{label}</Text>
    <View style={[s.inputWrapper, isDark && theme && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}>
      {icon && (
        <Ionicons
          name={icon}
          size={18}
          color={isDark && theme ? theme.text.muted : UI.text.muted}
          style={{marginRight: 10}}
        />
      )}
      <TextInput
        style={[s.input, isDark && theme && {color: theme.text.title}]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        keyboardAppearance={isDark ? 'dark' : 'light'}
      />
    </View>
  </View>
);

// ─── Main screen ────────────────────────────────────────────────

export default function CP12DetailsScreen() {
  const {theme, isDark} = useAppTheme();
  const insets = useSafeAreaInsets();
  const {
    landlordForm,
    setLandlordForm,
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

  const autofillFromLandlord = () => {
    const hasAddr = landlordForm.addressLine1 || landlordForm.city || landlordForm.postCode;
    if (!hasAddr) {
      Alert.alert('No Address', 'Enter a landlord address first.');
      return;
    }
    setTenantAddressLine1(landlordForm.addressLine1);
    setTenantAddressLine2(landlordForm.addressLine2);
    setTenantCity(landlordForm.city);
    setTenantPostCode(landlordForm.postCode);
  };

  return (
    <View style={s.root}>
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

            <View style={[s.card, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
              <FormInput
                label="Tenant Name"
                value={tenantName}
                onChange={setTenantName}
                placeholder="Full name (optional)"
                icon="person-outline"
                autoCapitalize="words"
                isDark={isDark}
                theme={theme}
              />
              <FormInput
                label="Email"
                value={tenantEmail}
                onChange={setTenantEmail}
                placeholder="tenant@email.com (optional)"
                icon="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                isDark={isDark}
                theme={theme}
              />
              <FormInput
                label="Phone"
                value={tenantPhone}
                onChange={setTenantPhone}
                placeholder="Phone number (optional)"
                icon="call-outline"
                keyboardType="phone-pad"
                isDark={isDark}
                theme={theme}
              />

              <View style={s.sectionDivider} />

              <Text style={[s.hintText, {color: theme.text.muted}]}>
                Address of the property being inspected. Address Line 1, City and Postcode are required.
              </Text>

              <FormInput
                label="Address Line 1 *"
                value={tenantAddressLine1}
                onChange={setTenantAddressLine1}
                placeholder="Street address"
                autoCapitalize="words"
                isDark={isDark}
                theme={theme}
              />
              <FormInput
                label="Address Line 2"
                value={tenantAddressLine2}
                onChange={setTenantAddressLine2}
                placeholder="Flat, floor, building (optional)"
                autoCapitalize="words"
                isDark={isDark}
                theme={theme}
              />

              <View style={s.row}>
                <View style={{flex: 1}}>
                  <FormInput
                    label="City / Town *"
                    value={tenantCity}
                    onChange={setTenantCity}
                    placeholder="City"
                    autoCapitalize="words"
                    isDark={isDark}
                    theme={theme}
                  />
                </View>
                <View style={{flex: 1}}>
                  <FormInput
                    label="Postcode *"
                    value={tenantPostCode}
                    onChange={setTenantPostCode}
                    placeholder="e.g. SW1A 1AA"
                    autoCapitalize="none"
                    isDark={isDark}
                    theme={theme}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={s.autofillBtn}
                onPress={autofillFromLandlord}
                activeOpacity={0.7}
              >
                <Ionicons name="copy-outline" size={14} color={Colors.primary} />
                <Text style={s.autofillText}>Use landlord address</Text>
              </TouchableOpacity>

              {propertyAddress ? (
                <View style={s.previewRow}>
                  <Ionicons name="location" size={14} color={UI.status.complete} />
                  <Text style={s.previewText} numberOfLines={2}>
                    {propertyAddress}
                  </Text>
                </View>
              ) : null}
            </View>
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

  // Optional badge
  optionalBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  optionalText: {fontSize: 10, fontWeight: '700', color: UI.status.complete, textTransform: 'uppercase', letterSpacing: 0.5},

  // Card
  card: {
    backgroundColor: GLASS_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    shadowColor: UI.text.muted,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },

  // Inputs
  inputContainer: {marginBottom: 14},
  inputLabel: {fontSize: 13, fontWeight: '600', color: UI.text.bodyLight, marginBottom: 6},
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.surface.base,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.surface.divider,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  input: {flex: 1, fontSize: 15, color: UI.text.title, padding: 0},

  // Row (side-by-side fields)
  row: {flexDirection: 'row', gap: 10},

  // Section divider within card
  sectionDivider: {height: 1, backgroundColor: UI.surface.divider, marginVertical: 16},

  // Hint text
  hintText: {
    fontSize: 12,
    color: UI.text.muted,
    fontWeight: '500',
    marginBottom: 14,
    lineHeight: 18,
  },

  // Auto-fill button
  autofillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: UI.surface.primaryLight,
    marginTop: 2,
  },
  autofillText: {fontSize: 12, fontWeight: '600', color: Colors.primary},

  // Address preview
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: UI.surface.elevated,
  },
  previewText: {fontSize: 13, color: UI.text.bodyLight, fontWeight: '500', flex: 1},

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
