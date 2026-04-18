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
import {Button} from '../../../../components/ui/Button';
import {useDecommissioning} from '../../../../src/context/DecommissioningContext';
import {useAppTheme} from '../../../../src/context/ThemeContext';
import {getBrandsForCategory} from '../../../../src/data/applianceBrands';
import {
  ApplianceCategory,
  BoilerType,
  DecommissioningAppliance,
  DecommissioningFinalInfo,
  EMPTY_DECOMMISSIONING_APPLIANCE,
  FlueType,
  FuelType,
  PassFailNA,
  SafeUnsafe,
  YesNoNA,
} from '../../../../src/types/decommissioning';
import {ALL_FUEL_TYPES} from '../../../../src/types/gasForms';

const STEPS = ['Details', 'Decommission', 'Review'];
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;
const APPLIANCE_CATEGORIES: ApplianceCategory[] = ['Boiler', 'Fire', 'Cooker', 'Hob', 'Other'];
const BOILER_TYPES: BoilerType[] = ['Combi', 'System', 'Regular (Heat Only)', 'Back Boiler'];
const FUEL_TYPES = ALL_FUEL_TYPES;
const FLUE_TYPES: FlueType[] = ['Balanced Flue', 'Room Sealed', 'Open Flue', 'Flu-less', 'Conventional Flue', 'Fanned Flue'];
const YES_NO_NA: YesNoNA[] = ['Yes', 'No', 'N/A'];
const PASS_FAIL_NA: PassFailNA[] = ['Pass', 'Fail', 'N/A'];
const SAFE_UNSAFE: SafeUnsafe[] = ['Safe', 'Unsafe'];

export default function DecommissionStepScreen() {
  const insets = useSafeAreaInsets();
  const {theme} = useAppTheme();
  const {appliances, addAppliance, updateAppliance, finalInfo, setFinalInfo} = useDecommissioning();
  const [form, setForm] = useState<Omit<DecommissioningAppliance, 'id'>>({...EMPTY_DECOMMISSIONING_APPLIANCE});

  useEffect(() => {
    if (appliances[0]) {
      const {id, ...rest} = appliances[0];
      setForm(rest);
    }
  }, [appliances]);

  const updateField = <K extends keyof Omit<DecommissioningAppliance, 'id'>>(key: K, value: Omit<DecommissioningAppliance, 'id'>[K]) => {
    setForm((prev) => ({...prev, [key]: value}));
  };

  const updateFinal = <K extends keyof DecommissioningFinalInfo>(key: K, value: DecommissioningFinalInfo[K]) => {
    setFinalInfo({...finalInfo, [key]: value});
  };

  const handleNext = () => {
    if (!form.category) {
      Alert.alert('Required', 'Select the appliance type.');
      return;
    }
    if (!form.location.trim()) {
      Alert.alert('Required', 'Enter the appliance location.');
      return;
    }

    if (appliances.length) {
      updateAppliance(appliances[0].id, {...form, id: appliances[0].id});
    } else {
      addAppliance({...form, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`});
    }

    router.push('/(app)/forms/decommissioning/review-sign' as any);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: TAB_BAR_HEIGHT + 110}}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FormHeader title="Decommissioning" subtitle="Step 2 of 3" />
          <FormStepIndicator steps={STEPS} current={2} />

          <FormSection title="Appliance Details" subtitle="Exactly one appliance per certificate.">
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
            {form.category === 'Boiler' ? <DropdownField label="Boiler type" value={form.boilerType} options={[...BOILER_TYPES]} onChange={(value) => updateField('boilerType', value as BoilerType)} /> : null}
            <View style={styles.row}>
              <View style={{flex: 1}}><DropdownField label="Fuel type" value={form.fuelType} options={[...FUEL_TYPES]} onChange={(value) => updateField('fuelType', value as FuelType)} /></View>
              <View style={{flex: 1}}><DropdownField label="Flue type" value={form.flueType} options={[...FLUE_TYPES]} onChange={(value) => updateField('flueType', value as FlueType)} /></View>
            </View>
            <ChoiceChips label="Gas soundness" value={form.gasSoundness} options={PASS_FAIL_NA} onChange={(value) => updateField('gasSoundness', value as PassFailNA)} />
          </FormSection>

          <FormSection title="Isolation & Disconnection">
            <TextAreaField label="Reason for decommissioning" value={form.decommissionReason} onChangeText={(value) => updateField('decommissionReason', value)} placeholder="Why the appliance was taken out of service" />
            <ChoiceChips label="Gas supply isolated" value={form.gasSupplyIsolated} options={YES_NO_NA} onChange={(value) => updateField('gasSupplyIsolated', value as YesNoNA)} />
            <ChoiceChips label="Gas supply capped" value={form.gasSupplyCapped} options={YES_NO_NA} onChange={(value) => updateField('gasSupplyCapped', value as YesNoNA)} />
            <ChoiceChips label="Electrical supply isolated" value={form.electricalSupplyIsolated} options={YES_NO_NA} onChange={(value) => updateField('electricalSupplyIsolated', value as YesNoNA)} />
            <ChoiceChips label="Water supply isolated" value={form.waterSupplyIsolated} options={YES_NO_NA} onChange={(value) => updateField('waterSupplyIsolated', value as YesNoNA)} />
            <ChoiceChips label="Flue sealed" value={form.flueSealed} options={YES_NO_NA} onChange={(value) => updateField('flueSealed', value as YesNoNA)} />
            <ChoiceChips label="Ventilation made safe" value={form.ventilationMadeSafe} options={YES_NO_NA} onChange={(value) => updateField('ventilationMadeSafe', value as YesNoNA)} />
            <ChoiceChips label="Appliance removed" value={form.applianceRemoved} options={YES_NO_NA} onChange={(value) => updateField('applianceRemoved', value as YesNoNA)} />
            <ChoiceChips label="Left in situ and labelled" value={form.leftInSituLabelled} options={YES_NO_NA} onChange={(value) => updateField('leftInSituLabelled', value as YesNoNA)} />
            <ChoiceChips label="Warning notice issued" value={form.warningNoticeIssued} options={YES_NO_NA} onChange={(value) => updateField('warningNoticeIssued', value as YesNoNA)} />
          </FormSection>

          <FormSection title="Outcome">
            <ChoiceChips label="Appliance condition" value={form.applianceCondition} options={SAFE_UNSAFE} onChange={(value) => updateField('applianceCondition', value as SafeUnsafe)} />
            <ChoiceChips label="Tightness test performed" value={finalInfo.tightnessTestPerformed} options={YES_NO_NA} onChange={(value) => updateFinal('tightnessTestPerformed', value as YesNoNA)} />
            <ChoiceChips label="Emergency control accessible" value={finalInfo.emergencyControlAccessible} options={YES_NO_NA} onChange={(value) => updateFinal('emergencyControlAccessible', value as YesNoNA)} />
            <ChoiceChips label="Pipework condition satisfactory" value={finalInfo.pipeworkCondition} options={YES_NO_NA} onChange={(value) => updateFinal('pipeworkCondition', value as YesNoNA)} />
            <ChoiceChips label="Site left safe" value={finalInfo.siteLeftSafe} options={YES_NO_NA} onChange={(value) => updateFinal('siteLeftSafe', value as YesNoNA)} />
            <ChoiceChips label="Customer advised" value={finalInfo.customerAdvised} options={YES_NO_NA} onChange={(value) => updateFinal('customerAdvised', value as YesNoNA)} />
            <TextAreaField label="Further work required" value={finalInfo.furtherWorkRequired} onChangeText={(value) => updateFinal('furtherWorkRequired', value)} placeholder="Any follow-up work required" />
            <TextAreaField label="Certificate notes" value={finalInfo.certificateNotes} onChangeText={(value) => updateFinal('certificateNotes', value)} placeholder="Additional certificate notes" />
            <TextAreaField label="Defects found" value={form.defectsFound} onChangeText={(value) => updateField('defectsFound', value)} placeholder="Defects identified" />
            <TextAreaField label="Remedial action taken" value={form.remedialActionTaken} onChangeText={(value) => updateField('remedialActionTaken', value)} placeholder="Actions completed" />
            <TextAreaField label="Engineer notes" value={form.engineerNotes} onChangeText={(value) => updateField('engineerNotes', value)} placeholder="Additional notes" />
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
