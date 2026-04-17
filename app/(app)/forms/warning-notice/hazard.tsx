import {LinearGradient} from 'expo-linear-gradient';
import {router} from 'expo-router';
import React, {useEffect, useState} from 'react';
import {Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Input} from '../../../../components/Input';
import {AutocompleteInput} from '../../../../components/forms/AutocompleteInput';
import {FormHeader} from '../../../../components/forms/FormHeader';
import {FormStepIndicator} from '../../../../components/forms/FormStepIndicator';
import {ChoiceChips, DropdownField, FormSection, TextAreaField} from '../../../../components/forms/GasFormFields';
import {getBrandsForCategory} from '../../../../src/data/applianceBrands';
import {Button} from '../../../../components/ui/Button';
import {useAppTheme} from '../../../../src/context/ThemeContext';
import {useWarningNotice} from '../../../../src/context/WarningNoticeContext';
import {ApplianceCategory, BoilerType, EMPTY_WARNING_NOTICE_APPLIANCE, FlueType, FuelType, SafeUnsafe, WarningClassification, YesNoNA} from '../../../../src/types/warningNotice';
import {ALL_FUEL_TYPES} from '../../../../src/types/gasForms';

const STEPS = ['Details', 'Hazard', 'Review'];
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;
const APPLIANCE_CATEGORIES: ApplianceCategory[] = ['Boiler', 'Fire', 'Cooker', 'Hob', 'Other'];
const BOILER_TYPES: BoilerType[] = ['Combi', 'System', 'Regular (Heat Only)', 'Back Boiler'];
const FUEL_TYPES = ALL_FUEL_TYPES;
const FLUE_TYPES: FlueType[] = ['Balanced Flue', 'Room Sealed', 'Open Flue', 'Flu-less', 'Conventional Flue', 'Fanned Flue'];
const CLASSIFICATIONS: WarningClassification[] = ['Not to Current Standards', 'At Risk', 'Immediately Dangerous'];
const YES_NO_NA: YesNoNA[] = ['Yes', 'No', 'N/A'];
const SAFE_UNSAFE: SafeUnsafe[] = ['Safe', 'Unsafe'];

const joinNotes = (...parts: Array<string | null | undefined>) => parts.map((part) => part?.trim()).filter(Boolean).join('\n\n');

export default function WarningHazardScreen() {
  const insets = useSafeAreaInsets();
  const {theme} = useAppTheme();
  const {appliances, addAppliance, updateAppliance, finalInfo, setFinalInfo} = useWarningNotice();
  const [form, setForm] = useState({...EMPTY_WARNING_NOTICE_APPLIANCE});

  useEffect(() => {
    if (appliances[0]) {
      const {id, ...rest} = appliances[0];
      setForm(rest);
    }
  }, [appliances]);

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({...prev, [key]: value}));
  const showBoilerFields = form.category === 'Boiler';
  const outcomeNotesValue = joinNotes(
    finalInfo.engineerOpinion,
    finalInfo.furtherActionRequired ? `Further action required:\n${finalInfo.furtherActionRequired}` : '',
    form.engineerNotes ? `Engineer notes:\n${form.engineerNotes}` : '',
  );

  const handleNext = () => {
    if (!form.category || !form.location.trim() || !form.warningClassification) {
      Alert.alert('Required', 'Appliance type, location and warning classification are required.');
      return;
    }
    if (!form.unsafeSituation.trim()) {
      Alert.alert('Required', 'Describe the unsafe situation.');
      return;
    }
    const nextAppliance = {...form, id: appliances[0]?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`};
    if (appliances[0]) updateAppliance(appliances[0].id, nextAppliance);
    else addAppliance(nextAppliance);
    router.push('/(app)/forms/warning-notice/review-sign' as any);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: TAB_BAR_HEIGHT + 110}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <FormHeader title="Warning Notice" subtitle="Step 2 of 3" />
          <FormStepIndicator steps={STEPS} current={2} />

          <FormSection title="Appliance Details" subtitle="Record the single appliance involved.">
            <DropdownField label="Appliance type" value={form.category} options={[...APPLIANCE_CATEGORIES]} onChange={(value) => updateField('category', value as ApplianceCategory)} />
            <Input label="Location" required value={form.location} onChangeText={(value) => updateField('location', value)} placeholder="Kitchen, loft, utility room" />
            <View style={styles.row}>
              <View style={{flex: 1}}><AutocompleteInput label="Make" value={form.make} onChangeText={(value) => updateField('make', value)} suggestions={getBrandsForCategory(form.category)} placeholder="Manufacturer" /></View>
              <View style={{flex: 1}}><Input label="Model" value={form.model} onChangeText={(value) => updateField('model', value)} placeholder="Model" /></View>
            </View>
            <View style={styles.row}>
              <View style={{flex: 1}}><Input label="Serial number" value={form.serialNumber} onChangeText={(value) => updateField('serialNumber', value)} placeholder="Serial number" /></View>
              <View style={{flex: 1}}><Input label="GC number" value={form.gcNumber} onChangeText={(value) => updateField('gcNumber', value)} placeholder="GC number" /></View>
            </View>
            {showBoilerFields ? <DropdownField label="Boiler type" value={form.boilerType} options={[...BOILER_TYPES]} onChange={(value) => updateField('boilerType', value as BoilerType)} /> : null}
            <View style={styles.row}>
              <View style={{flex: 1}}><DropdownField label="Fuel type" value={form.fuelType} options={[...FUEL_TYPES]} onChange={(value) => updateField('fuelType', value as FuelType)} /></View>
              <View style={{flex: 1}}><DropdownField label="Flue type" value={form.flueType} options={[...FLUE_TYPES]} onChange={(value) => updateField('flueType', value as FlueType)} /></View>
            </View>
          </FormSection>

          <FormSection title="Hazard Assessment">
            <DropdownField label="Classification" value={form.warningClassification} options={[...CLASSIFICATIONS]} onChange={(value) => updateField('warningClassification', value as WarningClassification)} />
            <ChoiceChips label="Appliance condition" value={form.applianceCondition} options={SAFE_UNSAFE} onChange={(value) => updateField('applianceCondition', value as SafeUnsafe)} />
            <TextAreaField label="Unsafe situation" value={form.unsafeSituation} onChangeText={(value) => updateField('unsafeSituation', value)} placeholder="Describe what was found" />
            <TextAreaField label="Risk details" value={form.riskDetails} onChangeText={(value) => updateField('riskDetails', value)} placeholder="Why is it unsafe or non-compliant?" />
            <TextAreaField label="Actions taken" value={form.actionsTaken} onChangeText={(value) => updateField('actionsTaken', value)} placeholder="Isolation, capping off, warning given…" />
          </FormSection>

          <FormSection title="Immediate Actions">
            <ChoiceChips label="Appliance disconnected" value={form.applianceDisconnected} options={YES_NO_NA} onChange={(value) => updateField('applianceDisconnected', value as YesNoNA)} />
            <ChoiceChips label="Gas supply disconnected" value={form.gasSupplyDisconnected} options={YES_NO_NA} onChange={(value) => updateField('gasSupplyDisconnected', value as YesNoNA)} />
            <ChoiceChips label="Warning label attached" value={form.warningLabelAttached} options={YES_NO_NA} onChange={(value) => updateField('warningLabelAttached', value as YesNoNA)} />
            <ChoiceChips label="Responsible person informed" value={form.responsiblePersonInformed} options={YES_NO_NA} onChange={(value) => updateField('responsiblePersonInformed', value as YesNoNA)} />
            <ChoiceChips label="Warning notice issued" value={form.warningNoticeIssued} options={YES_NO_NA} onChange={(value) => updateField('warningNoticeIssued', value as YesNoNA)} />
          </FormSection>

          <FormSection title="Engineer Outcome">
            <ChoiceChips label="Customer refused permission" value={finalInfo.customerRefusedPermission} options={YES_NO_NA} onChange={(value) => setFinalInfo({...finalInfo, customerRefusedPermission: value as YesNoNA})} />
            <ChoiceChips label="Emergency service contacted" value={finalInfo.emergencyServiceContacted} options={YES_NO_NA} onChange={(value) => setFinalInfo({...finalInfo, emergencyServiceContacted: value as YesNoNA})} />
            <TextAreaField
              label="Outcome / advice notes"
              value={outcomeNotesValue}
              onChangeText={(value) => {
                setFinalInfo({...finalInfo, engineerOpinion: value, furtherActionRequired: ''});
                updateField('engineerNotes', '');
              }}
              placeholder="Overall opinion, customer advice, and any further action required"
            />
          </FormSection>
        </ScrollView>

        <View style={styles.bottomBar}>
          <Button title="Next: Review & Sign" onPress={handleNext} icon="arrow-forward" />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  row: {flexDirection: 'row', gap: 12},
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: TAB_BAR_HEIGHT,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
});
