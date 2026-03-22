import {LinearGradient} from 'expo-linear-gradient';
import React from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppTheme} from '../../src/context/ThemeContext';
import {CustomerFormData, CustomerSelector} from '../CustomerSelector';
import {Button} from '../ui/Button';
import {FormHeader} from './FormHeader';
import {FormStepIndicator} from './FormStepIndicator';
import {SiteAddressData, SiteAddressSelector} from './SiteAddressSelector';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;

interface CustomerPropertyDetailsStepProps {
  title: string;
  subtitle: string;
  stepLabels: string[];
  nextButtonLabel: string;
  customerForm: CustomerFormData;
  onCustomerFormChange: (value: CustomerFormData) => void;
  siteAddress: SiteAddressData;
  onSiteAddressChange: (value: SiteAddressData) => void;
  onNext: () => void;
}

export function CustomerPropertyDetailsStep({
  title,
  subtitle,
  stepLabels,
  nextButtonLabel,
  customerForm,
  onCustomerFormChange,
  siteAddress,
  onSiteAddressChange,
  onNext,
}: CustomerPropertyDetailsStepProps) {
  const insets = useSafeAreaInsets();
  const {theme, isDark} = useAppTheme();

  const customerAddress = (customerForm.addressLine1 || customerForm.city || customerForm.postCode)
    ? {
        addressLine1: customerForm.addressLine1,
        addressLine2: customerForm.addressLine2,
        city: customerForm.city,
        postCode: customerForm.postCode,
      }
    : undefined;

  return (
    <View style={styles.root}>
      <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: TAB_BAR_HEIGHT + 110}}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <FormHeader title={title} subtitle={subtitle} />
          <FormStepIndicator steps={stepLabels} current={1} />

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, {color: theme.text.title}]}>Customer Details</Text>
          </View>
          <CustomerSelector
            value={customerForm}
            onChange={onCustomerFormChange}
            mode="full"
            showJobAddress={false}
            hideTabs={false}
            showActions
          />

          <View style={{marginTop: 20}}>
            <SiteAddressSelector
              value={siteAddress}
              onChange={onSiteAddressChange}
              customerAddress={customerAddress}
            />
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, {bottom: TAB_BAR_HEIGHT}, isDark && {backgroundColor: theme.surface.base, borderTopColor: theme.surface.border}]}>
          <Button title={nextButtonLabel} onPress={onNext} icon="arrow-forward" />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  sectionHeader: {marginBottom: 8},
  sectionTitle: {fontSize: 18, fontWeight: '800', marginBottom: 6},
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
});
