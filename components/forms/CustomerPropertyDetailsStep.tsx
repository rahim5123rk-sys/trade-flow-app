import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import React from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppTheme} from '../../src/context/ThemeContext';
import {CustomerFormData, CustomerSelector} from '../CustomerSelector';
import {Input} from '../Input';
import {Button} from '../ui/Button';
import {FormHeader} from './FormHeader';
import {FormStepIndicator} from './FormStepIndicator';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;

interface CustomerPropertyDetailsStepProps {
  title: string;
  subtitle: string;
  stepLabels: string[];
  nextButtonLabel: string;
  customerForm: CustomerFormData;
  onCustomerFormChange: (value: CustomerFormData) => void;
  propertyAddressLine1: string;
  onPropertyAddressLine1Change: (value: string) => void;
  propertyAddressLine2: string;
  onPropertyAddressLine2Change: (value: string) => void;
  propertyCity: string;
  onPropertyCityChange: (value: string) => void;
  propertyPostCode: string;
  onPropertyPostCodeChange: (value: string) => void;
  propertyAddress: string;
  onUseCustomerAddress: () => void;
  onNext: () => void;
}

export function CustomerPropertyDetailsStep({
  title,
  subtitle,
  stepLabels,
  nextButtonLabel,
  customerForm,
  onCustomerFormChange,
  propertyAddressLine1,
  onPropertyAddressLine1Change,
  propertyAddressLine2,
  onPropertyAddressLine2Change,
  propertyCity,
  onPropertyCityChange,
  propertyPostCode,
  onPropertyPostCodeChange,
  propertyAddress,
  onUseCustomerAddress,
  onNext,
}: CustomerPropertyDetailsStepProps) {
  const insets = useSafeAreaInsets();
  const {theme, isDark} = useAppTheme();

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

          <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, borderColor: theme.surface.border}]}>
            <Text style={[styles.sectionTitle, {color: theme.text.title}]}>Property Address</Text>
            <Text style={[styles.helpText, {color: theme.text.muted}]}>Address where the appliance was worked on. Line 1, city and postcode are required.</Text>

            <Input label="Address Line 1" required value={propertyAddressLine1} onChangeText={onPropertyAddressLine1Change} placeholder="Street address" />
            <Input label="Address Line 2" value={propertyAddressLine2} onChangeText={onPropertyAddressLine2Change} placeholder="Flat, floor, building" />
            <View style={styles.row}>
              <View style={{flex: 1}}>
                <Input label="City / Town" required value={propertyCity} onChangeText={onPropertyCityChange} placeholder="City" />
              </View>
              <View style={{flex: 1}}>
                <Input label="Postcode" required value={propertyPostCode} onChangeText={onPropertyPostCodeChange} placeholder="SW1A 1AA" autoCapitalize="characters" />
              </View>
            </View>

            <TouchableOpacity style={styles.copyBtn} onPress={onUseCustomerAddress} activeOpacity={0.75}>
              <Ionicons name="copy-outline" size={14} color={theme.brand.primary} />
              <Text style={[styles.copyText, {color: theme.brand.primary}]}>Use customer address</Text>
            </TouchableOpacity>

            {propertyAddress ? (
              <View style={[styles.preview, isDark && {backgroundColor: theme.surface.elevated}]}>
                <Ionicons name="location-outline" size={16} color={theme.brand.primary} />
                <Text style={[styles.previewText, {color: theme.text.body}]}>{propertyAddress}</Text>
              </View>
            ) : null}
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
  card: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  helpText: {fontSize: 13, marginBottom: 12},
  row: {flexDirection: 'row', gap: 12},
  copyBtn: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, alignSelf: 'flex-start'},
  copyText: {fontSize: 13, fontWeight: '700'},
  preview: {
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewText: {fontSize: 13, fontWeight: '500', flex: 1},
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
