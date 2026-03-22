// ============================================
// FILE: app/(app)/forms/service-record/index.tsx
// Step 1 – Customer & Property Details
// ============================================

import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router} from 'expo-router';
import React, {useState} from 'react';
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
import {CustomerSelector} from '../../../../components/CustomerSelector';
import {SiteAddressSelector, SiteAddressData} from '../../../../components/forms/SiteAddressSelector';
import {Colors, UI} from '../../../../constants/theme';
import {useServiceRecord} from '../../../../src/context/ServiceRecordContext';
import {useAppTheme} from '../../../../src/context/ThemeContext';

const GLASS_BG = UI.glass.bg;
const GLASS_BORDER = UI.glass.border;
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;

// ─── Step indicator ─────────────────────────────────────────────

const StepIndicator = ({current}: {current: number}) => {
  const {isDark, theme} = useAppTheme();
  return (
    <View style={[s.stepRow, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
      {['Details', 'Service', 'Review'].map((label, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <View key={label} style={s.stepItem}>
            <View style={[s.stepDot, isActive && s.stepDotActive, isDone && s.stepDotDone]}>
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

export default function ServiceRecordDetailsScreen() {
  const {theme, isDark} = useAppTheme();
  const insets = useSafeAreaInsets();
  const {
    customerForm,
    setCustomerForm,
    propertyAddressLine1,
    setPropertyAddressLine1,
    propertyAddressLine2,
    setPropertyAddressLine2,
    propertyCity,
    setPropertyCity,
    propertyPostCode,
    setPropertyPostCode,
    propertyAddress,
  } = useServiceRecord();

  const [tenantTitle, setTenantTitle] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');

  const siteAddress: SiteAddressData = {
    tenantTitle, tenantName, tenantEmail, tenantPhone,
    addressLine1: propertyAddressLine1, addressLine2: propertyAddressLine2,
    city: propertyCity, postCode: propertyPostCode,
  };

  const handleSiteAddressChange = (data: SiteAddressData) => {
    setPropertyAddressLine1(data.addressLine1);
    setPropertyAddressLine2(data.addressLine2);
    setPropertyCity(data.city);
    setPropertyPostCode(data.postCode);
    setTenantTitle(data.tenantTitle);
    setTenantName(data.tenantName);
    setTenantEmail(data.tenantEmail);
    setTenantPhone(data.tenantPhone);
  };

  const handleNext = () => {
    if (!customerForm.customerName.trim()) {
      Alert.alert('Missing Info', 'Please enter the customer name.');
      return;
    }
    if (!propertyAddressLine1.trim() || !propertyCity.trim() || !propertyPostCode.trim()) {
      Alert.alert('Missing Info', 'Address Line 1, City and Postcode are required.');
      return;
    }
    router.push('/(app)/forms/service-record/service' as any);
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
              <Text style={[s.title, {color: theme.text.title}]}>Service Record</Text>
              <Text style={[s.subtitle, {color: theme.text.muted}]}>Gas Appliance Service & Maintenance</Text>
            </View>
          </Animated.View>

          <StepIndicator current={1} />

          {/* Customer Details */}
          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <View style={s.sectionHeader}>
              <LinearGradient colors={['#059669', '#10B981']} style={s.sectionIcon}>
                <Ionicons name="person" size={16} color={UI.text.white} />
              </LinearGradient>
              <Text style={[s.sectionTitle, {color: theme.text.title}]}>Customer Details</Text>
            </View>

            <CustomerSelector
              value={customerForm}
              onChange={setCustomerForm}
              mode="full"
              showJobAddress={false}
              hideTabs={false}
              showActions={true}
            />
          </Animated.View>

          {/* Site Address & Tenant */}
          <Animated.View entering={FadeInDown.delay(250).springify()}>
            <View style={[s.sectionHeader, {marginTop: 24}]}>
              <LinearGradient colors={['#059669', '#10B981']} style={s.sectionIcon}>
                <Ionicons name="home" size={16} color={UI.text.white} />
              </LinearGradient>
              <Text style={[s.sectionTitle, {color: theme.text.title}]}>Site Address & Tenant</Text>
            </View>

            <SiteAddressSelector
              value={siteAddress}
              onChange={handleSiteAddressChange}
              customerAddress={{
                addressLine1: customerForm.addressLine1,
                addressLine2: customerForm.addressLine2,
                city: customerForm.city,
                postCode: customerForm.postCode,
              }}
            />
          </Animated.View>
        </ScrollView>

        {/* Bottom CTA */}
        <Animated.View
          entering={FadeIn.delay(500)}
          style={[s.bottomBar, {bottom: TAB_BAR_HEIGHT, paddingBottom: 12}, isDark && {backgroundColor: 'rgba(28,28,30,0.97)', borderTopColor: 'rgba(255,255,255,0.08)'}]}
        >
          <TouchableOpacity style={s.nextBtn} activeOpacity={0.85} onPress={handleNext}>
            <LinearGradient
              colors={['#059669', '#10B981']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={s.nextGradient}
            >
              <Text style={s.nextText}>Next: Service Details</Text>
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

  header: {flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12},
  backBtn: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: GLASS_BG, borderWidth: 1, borderColor: GLASS_BORDER,
    justifyContent: 'center', alignItems: 'center',
  },
  title: {fontSize: 24, fontWeight: '800', color: UI.text.title, letterSpacing: -0.5},
  subtitle: {fontSize: 13, color: UI.text.muted, fontWeight: '500', marginTop: 2},

  stepRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 24,
    paddingVertical: 14, backgroundColor: GLASS_BG, borderRadius: 16,
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  stepItem: {alignItems: 'center', gap: 6},
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: UI.surface.divider, justifyContent: 'center', alignItems: 'center',
  },
  stepDotActive: {backgroundColor: '#059669'},
  stepDotDone: {backgroundColor: UI.status.complete},
  stepDotText: {fontSize: 12, fontWeight: '700', color: UI.text.muted},
  stepLabel: {fontSize: 11, fontWeight: '600', color: UI.text.muted},

  sectionHeader: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12},
  sectionIcon: {
    width: 32, height: 32, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: {fontSize: 17, fontWeight: '700', color: UI.text.title},

  bottomBar: {
    position: 'absolute', left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: 'rgba(248,250,252,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  nextBtn: {borderRadius: 16, overflow: 'hidden'},
  nextGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 8,
  },
  nextText: {fontSize: 16, fontWeight: '700', color: UI.text.white},
});
