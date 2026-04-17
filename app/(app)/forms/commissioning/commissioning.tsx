import {LinearGradient} from 'expo-linear-gradient';
import {router} from 'expo-router';
import React, {useEffect, useMemo, useState} from 'react';
import {Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Input} from '../../../../components/Input';
import {AutocompleteInput} from '../../../../components/forms/AutocompleteInput';
import {FormHeader} from '../../../../components/forms/FormHeader';
import {FormStepIndicator} from '../../../../components/forms/FormStepIndicator';
import {FgaReadingsGroup} from '../../../../components/forms/FgaReadingsGroup';
import {ChoiceChips, DropdownField, FormSection, TextAreaField} from '../../../../components/forms/GasFormFields';
import {getBrandsForCategory} from '../../../../src/data/applianceBrands';
import {Button} from '../../../../components/ui/Button';
import {useCommissioning} from '../../../../src/context/CommissioningContext';
import {useAppTheme} from '../../../../src/context/ThemeContext';
import {
  ApplianceCategory,
  BoilerType,
  CommissioningAppliance,
  CommissioningFinalInfo,
  EMPTY_COMMISSIONING_APPLIANCE,
  EMPTY_FGA,
  FlueType,
  FuelType,
  PassFailNA,
  SafeUnsafe,
  YesNoNA
} from '../../../../src/types/commissioning';

const STEPS = ['Details', 'Commissioning', 'Review'];
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;
const APPLIANCE_CATEGORIES: ApplianceCategory[] = ['Boiler', 'Fire', 'Cooker', 'Hob', 'Other'];
const BOILER_TYPES: BoilerType[] = ['Combi', 'System', 'Regular (Heat Only)', 'Back Boiler'];
const FUEL_TYPES: FuelType[] = ['Natural Gas', 'LPG'];
const FLUE_TYPES: FlueType[] = ['Balanced Flue', 'Room Sealed', 'Open Flue', 'Flu-less', 'Conventional Flue', 'Fanned Flue'];
const YES_NO_NA: YesNoNA[] = ['Yes', 'No', 'N/A'];
const PASS_FAIL_NA: PassFailNA[] = ['Pass', 'Fail', 'N/A'];
const SAFE_UNSAFE: SafeUnsafe[] = ['Safe', 'Unsafe'];

const joinNotes = (...parts: Array<string | null | undefined>) => parts.map((part) => part?.trim()).filter(Boolean).join('\n\n');

export default function CommissioningStepScreen() {
  const insets = useSafeAreaInsets();
  const {theme} = useAppTheme();
  const {appliances, addAppliance, updateAppliance, finalInfo, setFinalInfo} = useCommissioning();
  const [form, setForm] = useState<Omit<CommissioningAppliance, 'id'>>({...EMPTY_COMMISSIONING_APPLIANCE, fgaLow: {...EMPTY_FGA}, fgaHigh: {...EMPTY_FGA}});

  useEffect(() => {
    if (appliances[0]) {
      const {id, ...rest} = appliances[0];
      setForm(rest);
    }
  }, [appliances]);

  const updateField = <K extends keyof Omit<CommissioningAppliance, 'id'>>(key: K, value: Omit<CommissioningAppliance, 'id'>[K]) => {
    setForm((prev) => ({...prev, [key]: value}));
  };

  const updateFinal = <K extends keyof CommissioningFinalInfo>(key: K, value: CommissioningFinalInfo[K]) => {
    setFinalInfo({...finalInfo, [key]: value});
  };

  const applianceNotesValue = joinNotes(
    form.engineerNotes,
    form.defectsFound ? `Defects found:\n${form.defectsFound}` : '',
    form.remedialActionTaken ? `Remedial action taken:\n${form.remedialActionTaken}` : '',
  );

  const outcomeNotesValue = joinNotes(
    finalInfo.commissioningOutcome,
    finalInfo.additionalWorkRequired ? `Further work required:\n${finalInfo.additionalWorkRequired}` : '',
  );

  const showBoilerFields = useMemo(() => form.category === 'Boiler', [form.category]);

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

    router.push('/(app)/forms/commissioning/review-sign' as any);
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
          <FormHeader title="Commissioning" subtitle="Step 2 of 3" />
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
            {showBoilerFields ? <DropdownField label="Boiler type" value={form.boilerType} options={[...BOILER_TYPES]} onChange={(value) => updateField('boilerType', value as BoilerType)} /> : null}
            <View style={styles.row}>
              <View style={{flex: 1}}><DropdownField label="Fuel type" value={form.fuelType} options={[...FUEL_TYPES]} onChange={(value) => updateField('fuelType', value as FuelType)} /></View>
              <View style={{flex: 1}}><DropdownField label="Flue type" value={form.flueType} options={[...FLUE_TYPES]} onChange={(value) => updateField('flueType', value as FlueType)} /></View>
            </View>
          </FormSection>

          <FormSection title="Readings & Analysis">
            <View style={styles.row}>
              <View style={{flex: 1}}><Input label="Inlet working pressure" value={form.inletWorkingPressure} onChangeText={(value) => updateField('inletWorkingPressure', value)} keyboardType="decimal-pad" placeholder="mBar" /></View>
              <View style={{flex: 1}}><Input label="Burner pressure" value={form.burnerPressure} onChangeText={(value) => updateField('burnerPressure', value)} keyboardType="decimal-pad" placeholder="mBar" /></View>
            </View>
            <View style={styles.row}>
              <View style={{flex: 1}}><Input label="Gas rate" value={form.gasRate} onChangeText={(value) => updateField('gasRate', value)} keyboardType="decimal-pad" placeholder="m³/h" /></View>
              <View style={{flex: 1}}><Input label="Heat input" value={form.heatInput} onChangeText={(value) => updateField('heatInput', value)} keyboardType="decimal-pad" placeholder="kW" /></View>
            </View>
            <View style={styles.row}>
              <View style={{flex: 1}}><Input label="Operating pressure" value={form.operatingPressure} onChangeText={(value) => updateField('operatingPressure', value)} keyboardType="decimal-pad" placeholder="mBar" /></View>
              <View style={{flex: 1}}><Input label="Standing pressure" value={form.standingPressure} onChangeText={(value) => updateField('standingPressure', value)} keyboardType="decimal-pad" placeholder="mBar" /></View>
            </View>
            <ChoiceChips label="Gas soundness" value={form.gasSoundness} options={PASS_FAIL_NA} onChange={(value) => updateField('gasSoundness', value as PassFailNA)} />
            <FgaReadingsGroup label="Low fire" value={form.fgaLow} onChange={(value) => updateField('fgaLow', value)} showNA={false} />
            <FgaReadingsGroup label="High fire" value={form.fgaHigh} onChange={(value) => updateField('fgaHigh', value)} showNA={false} />
          </FormSection>

          <FormSection title="Commissioning Checks">
            <ChoiceChips label="Ventilation adequate" value={form.ventilationAdequate} options={YES_NO_NA} onChange={(value) => updateField('ventilationAdequate', value as YesNoNA)} />
            <ChoiceChips label="Controls operational" value={form.controlsOperational} options={YES_NO_NA} onChange={(value) => updateField('controlsOperational', value as YesNoNA)} />
            <ChoiceChips label="Safety device operation" value={form.safetyDeviceOperation} options={PASS_FAIL_NA} onChange={(value) => updateField('safetyDeviceOperation', value as PassFailNA)} />
            <ChoiceChips label="Electrical polarity correct" value={form.electricalPolarityCorrect} options={YES_NO_NA} onChange={(value) => updateField('electricalPolarityCorrect', value as YesNoNA)} />
            <ChoiceChips label="Earth continuity" value={form.earthContinuity} options={YES_NO_NA} onChange={(value) => updateField('earthContinuity', value as YesNoNA)} />
            <ChoiceChips label="Flue integrity" value={form.flueIntegrity} options={YES_NO_NA} onChange={(value) => updateField('flueIntegrity', value as YesNoNA)} />
            <ChoiceChips label="Condensate installed" value={form.condensateInstalled} options={YES_NO_NA} onChange={(value) => updateField('condensateInstalled', value as YesNoNA)} />
            <ChoiceChips label="System flushed" value={form.systemFlushed} options={YES_NO_NA} onChange={(value) => updateField('systemFlushed', value as YesNoNA)} />
            <ChoiceChips label="Inhibitor added" value={form.inhibitorAdded} options={YES_NO_NA} onChange={(value) => updateField('inhibitorAdded', value as YesNoNA)} />
            <ChoiceChips label="System balanced" value={form.systemBalanced} options={YES_NO_NA} onChange={(value) => updateField('systemBalanced', value as YesNoNA)} />
            <ChoiceChips label="Benchmark completed" value={form.benchmarkCompleted} options={YES_NO_NA} onChange={(value) => updateField('benchmarkCompleted', value as YesNoNA)} />
            <ChoiceChips label="Instructions left" value={form.manufacturerInstructionsLeft} options={YES_NO_NA} onChange={(value) => updateField('manufacturerInstructionsLeft', value as YesNoNA)} />
            <ChoiceChips label="User demonstration completed" value={form.userDemonstrationCompleted} options={YES_NO_NA} onChange={(value) => updateField('userDemonstrationCompleted', value as YesNoNA)} />
          </FormSection>

          <FormSection title="Final Outcome">
            <ChoiceChips label="Appliance condition" value={form.applianceCondition} options={SAFE_UNSAFE} onChange={(value) => updateField('applianceCondition', value as SafeUnsafe)} />
            <ChoiceChips label="Tightness test performed" value={finalInfo.tightnessTestPerformed} options={YES_NO_NA} onChange={(value) => updateFinal('tightnessTestPerformed', value as YesNoNA)} />
            <ChoiceChips label="Emergency control accessible" value={finalInfo.emergencyControlAccessible} options={YES_NO_NA} onChange={(value) => updateFinal('emergencyControlAccessible', value as YesNoNA)} />
            <ChoiceChips label="Pipework condition satisfactory" value={finalInfo.pipeworkCondition} options={YES_NO_NA} onChange={(value) => updateFinal('pipeworkCondition', value as YesNoNA)} />
            <ChoiceChips label="Meter installation satisfactory" value={finalInfo.meterInstallationSatisfactory} options={YES_NO_NA} onChange={(value) => updateFinal('meterInstallationSatisfactory', value as YesNoNA)} />
            <ChoiceChips label="CO alarm fitted" value={finalInfo.coAlarmFitted} options={YES_NO_NA} onChange={(value) => updateFinal('coAlarmFitted', value as YesNoNA)} />
            <TextAreaField
              label="Outcome / further work"
              value={outcomeNotesValue}
              onChangeText={(value) => setFinalInfo({...finalInfo, commissioningOutcome: value, additionalWorkRequired: ''})}
              placeholder="Successful set-up, benchmark completed, and any follow-up work required"
            />
            <TextAreaField
              label="Work notes"
              value={applianceNotesValue}
              onChangeText={(value) => setForm((prev) => ({...prev, engineerNotes: value, defectsFound: '', remedialActionTaken: ''}))}
              placeholder="Defects found, remedial action taken, and any engineer notes"
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
  fgaGroup: {marginBottom: 12},
  fgaTitle: {fontSize: 13, fontWeight: '700', marginBottom: 8, color: '#475569'},
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
