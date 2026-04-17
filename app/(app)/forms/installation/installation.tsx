import {LinearGradient} from 'expo-linear-gradient';
import {router} from 'expo-router';
import React, {useEffect, useState} from 'react';
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
import {useInstallationCert} from '../../../../src/context/InstallationCertContext';
import {useAppTheme} from '../../../../src/context/ThemeContext';
import {ApplianceCategory, BoilerType, EMPTY_FGA, EMPTY_INSTALLATION_CERT_APPLIANCE, FlueType, FuelType, InstallationCertAppliance, InstallationType, PassFailNA, SafeUnsafe, YesNoNA} from '../../../../src/types/installationCert';
import {ALL_FUEL_TYPES} from '../../../../src/types/gasForms';

const STEPS = ['Details', 'Installation', 'Review'];
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;
const APPLIANCE_CATEGORIES: ApplianceCategory[] = ['Boiler', 'Fire', 'Cooker', 'Hob', 'Other'];
const BOILER_TYPES: BoilerType[] = ['Combi', 'System', 'Regular (Heat Only)', 'Back Boiler'];
const INSTALLATION_TYPES: InstallationType[] = ['New Installation', 'Replacement'];
const FUEL_TYPES = ALL_FUEL_TYPES;
const FLUE_TYPES: FlueType[] = ['Balanced Flue', 'Room Sealed', 'Open Flue', 'Flu-less', 'Conventional Flue', 'Fanned Flue'];
const YES_NO_NA: YesNoNA[] = ['Yes', 'No', 'N/A'];
const PASS_FAIL_NA: PassFailNA[] = ['Pass', 'Fail', 'N/A'];
const SAFE_UNSAFE: SafeUnsafe[] = ['Safe', 'Unsafe'];

const joinNotes = (...parts: Array<string | null | undefined>) => parts.map((part) => part?.trim()).filter(Boolean).join('\n\n');

export default function InstallationStepScreen() {
  const insets = useSafeAreaInsets();
  const {theme} = useAppTheme();
  const {appliances, addAppliance, updateAppliance, finalInfo, setFinalInfo} = useInstallationCert();
  const [form, setForm] = useState<Omit<InstallationCertAppliance, 'id'>>({...EMPTY_INSTALLATION_CERT_APPLIANCE, fgaLow: {...EMPTY_FGA}, fgaHigh: {...EMPTY_FGA}});

  useEffect(() => {
    if (appliances[0]) {
      const {id, ...rest} = appliances[0];
      setForm(rest);
    }
  }, [appliances]);

  const updateField = <K extends keyof Omit<InstallationCertAppliance, 'id'>>(key: K, value: Omit<InstallationCertAppliance, 'id'>[K]) => setForm((prev) => ({...prev, [key]: value}));

  const installationNotesValue = joinNotes(
    form.engineerNotes,
    form.defectsFound ? `Defects found:\n${form.defectsFound}` : '',
    form.remedialActionTaken ? `Work completed:\n${form.remedialActionTaken}` : '',
  );

  const outcomeNotesValue = joinNotes(
    finalInfo.installationOutcome,
    finalInfo.furtherWorkRequired ? `Further work required:\n${finalInfo.furtherWorkRequired}` : '',
  );

  const handleNext = () => {
    if (!form.category || !form.installationType || !form.location.trim()) {
      Alert.alert('Required', 'Appliance type, installation type and location are required.');
      return;
    }
    const nextAppliance = {...form, id: appliances[0]?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`};
    if (appliances[0]) updateAppliance(appliances[0].id, nextAppliance);
    else addAppliance(nextAppliance);
    router.push('/(app)/forms/installation/review-sign' as any);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: TAB_BAR_HEIGHT + 110}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <FormHeader title="Installation Certificate" subtitle="Step 2 of 3" />
          <FormStepIndicator steps={STEPS} current={2} />

          <FormSection title="Appliance Details" subtitle="Installation certificate for one appliance.">
            <DropdownField label="Appliance type" value={form.category} options={[...APPLIANCE_CATEGORIES]} onChange={(value) => updateField('category', value as ApplianceCategory)} />
            <DropdownField label="Installation type" value={form.installationType} options={[...INSTALLATION_TYPES]} onChange={(value) => updateField('installationType', value as InstallationType)} />
            <Input label="Location" required value={form.location} onChangeText={(value) => updateField('location', value)} placeholder="Kitchen, loft, utility room" />
            <View style={styles.row}><View style={{flex: 1}}><AutocompleteInput label="Make" value={form.make} onChangeText={(value) => updateField('make', value)} suggestions={getBrandsForCategory(form.category)} placeholder="Manufacturer" /></View><View style={{flex: 1}}><Input label="Model" value={form.model} onChangeText={(value) => updateField('model', value)} /></View></View>
            <View style={styles.row}><View style={{flex: 1}}><Input label="Serial number" value={form.serialNumber} onChangeText={(value) => updateField('serialNumber', value)} /></View><View style={{flex: 1}}><Input label="GC number" value={form.gcNumber} onChangeText={(value) => updateField('gcNumber', value)} /></View></View>
            {form.category === 'Boiler' ? <DropdownField label="Boiler type" value={form.boilerType} options={[...BOILER_TYPES]} onChange={(value) => updateField('boilerType', value as BoilerType)} /> : null}
            <View style={styles.row}><View style={{flex: 1}}><DropdownField label="Fuel type" value={form.fuelType} options={[...FUEL_TYPES]} onChange={(value) => updateField('fuelType', value as FuelType)} /></View><View style={{flex: 1}}><DropdownField label="Flue type" value={form.flueType} options={[...FLUE_TYPES]} onChange={(value) => updateField('flueType', value as FlueType)} /></View></View>
          </FormSection>

          <FormSection title="Readings & Checks">
            <View style={styles.row}><View style={{flex: 1}}><Input label="Operating pressure" value={form.operatingPressure} onChangeText={(value) => updateField('operatingPressure', value)} placeholder="mBar" /></View><View style={{flex: 1}}><Input label="Burner pressure" value={form.burnerPressure} onChangeText={(value) => updateField('burnerPressure', value)} placeholder="mBar" /></View></View>
            <View style={styles.row}><View style={{flex: 1}}><Input label="Gas rate" value={form.gasRate} onChangeText={(value) => updateField('gasRate', value)} placeholder="m³/h" /></View><View style={{flex: 1}}><Input label="Heat input" value={form.heatInput} onChangeText={(value) => updateField('heatInput', value)} placeholder="kW" /></View></View>
            <ChoiceChips label="Gas soundness" value={form.gasSoundness} options={PASS_FAIL_NA} onChange={(value) => updateField('gasSoundness', value as PassFailNA)} />
            <FgaReadingsGroup label="FGA low fire" value={form.fgaLow} onChange={(value) => updateField('fgaLow', value)} showNA={false} />
            <FgaReadingsGroup label="FGA high fire" value={form.fgaHigh} onChange={(value) => updateField('fgaHigh', value)} showNA={false} />
            <ChoiceChips label="Pipework pressure test" value={form.pipeworkPressureTest} options={YES_NO_NA} onChange={(value) => updateField('pipeworkPressureTest', value as YesNoNA)} />
            <ChoiceChips label="Ventilation adequate" value={form.ventilationAdequate} options={YES_NO_NA} onChange={(value) => updateField('ventilationAdequate', value as YesNoNA)} />
            <ChoiceChips label="Flue installed correctly" value={form.flueInstalledCorrectly} options={YES_NO_NA} onChange={(value) => updateField('flueInstalledCorrectly', value as YesNoNA)} />
            <ChoiceChips label="Condensate installed" value={form.condensateInstalled} options={YES_NO_NA} onChange={(value) => updateField('condensateInstalled', value as YesNoNA)} />
            <ChoiceChips label="Controls installed" value={form.controlsInstalled} options={YES_NO_NA} onChange={(value) => updateField('controlsInstalled', value as YesNoNA)} />
            <ChoiceChips label="Safety device operation" value={form.safetyDeviceOperation} options={PASS_FAIL_NA} onChange={(value) => updateField('safetyDeviceOperation', value as PassFailNA)} />
            <ChoiceChips label="Electrical polarity correct" value={form.electricalPolarityCorrect} options={YES_NO_NA} onChange={(value) => updateField('electricalPolarityCorrect', value as YesNoNA)} />
            <ChoiceChips label="Earth continuity" value={form.earthContinuity} options={YES_NO_NA} onChange={(value) => updateField('earthContinuity', value as YesNoNA)} />
            <ChoiceChips label="System flushed" value={form.systemFlushed} options={YES_NO_NA} onChange={(value) => updateField('systemFlushed', value as YesNoNA)} />
            <ChoiceChips label="Inhibitor added" value={form.inhibitorAdded} options={YES_NO_NA} onChange={(value) => updateField('inhibitorAdded', value as YesNoNA)} />
            <ChoiceChips label="Benchmark completed" value={form.benchmarkCompleted} options={YES_NO_NA} onChange={(value) => updateField('benchmarkCompleted', value as YesNoNA)} />
            <ChoiceChips label="Building regs notified" value={form.buildingRegsNotified} options={YES_NO_NA} onChange={(value) => updateField('buildingRegsNotified', value as YesNoNA)} />
            <ChoiceChips label="User demonstration completed" value={form.userDemonstrationCompleted} options={YES_NO_NA} onChange={(value) => updateField('userDemonstrationCompleted', value as YesNoNA)} />
            <ChoiceChips label="Manufacturer instructions left" value={form.manufacturerInstructionsLeft} options={YES_NO_NA} onChange={(value) => updateField('manufacturerInstructionsLeft', value as YesNoNA)} />
          </FormSection>

          <FormSection title="Outcome">
            <ChoiceChips label="Appliance condition" value={form.applianceCondition} options={SAFE_UNSAFE} onChange={(value) => updateField('applianceCondition', value as SafeUnsafe)} />
            <TextAreaField
              label="Installation notes"
              value={installationNotesValue}
              onChangeText={(value) => setForm((prev) => ({...prev, engineerNotes: value, defectsFound: '', remedialActionTaken: ''}))}
              placeholder="Defects found, work completed, and any engineer notes"
            />
            <ChoiceChips label="Tightness test performed" value={finalInfo.tightnessTestPerformed} options={YES_NO_NA} onChange={(value) => setFinalInfo({...finalInfo, tightnessTestPerformed: value as YesNoNA})} />
            <ChoiceChips label="Emergency control accessible" value={finalInfo.emergencyControlAccessible} options={YES_NO_NA} onChange={(value) => setFinalInfo({...finalInfo, emergencyControlAccessible: value as YesNoNA})} />
            <ChoiceChips label="Meter installation satisfactory" value={finalInfo.meterInstallationSatisfactory} options={YES_NO_NA} onChange={(value) => setFinalInfo({...finalInfo, meterInstallationSatisfactory: value as YesNoNA})} />
            <Input label="Notification reference" value={finalInfo.notificationReference} onChangeText={(value) => setFinalInfo({...finalInfo, notificationReference: value})} placeholder="Building regs / notification ref" />
            <TextAreaField
              label="Outcome / further work"
              value={outcomeNotesValue}
              onChangeText={(value) => setFinalInfo({...finalInfo, installationOutcome: value, furtherWorkRequired: ''})}
              placeholder="Overall installation outcome and any further work required"
            />
          </FormSection>
        </ScrollView>
        <View style={styles.bottomBar}><Button title="Next: Review & Sign" onPress={handleNext} icon="arrow-forward" /></View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  row: {flexDirection: 'row', gap: 12},
  fgaGroup: {marginBottom: 12},
  fgaTitle: {fontSize: 13, fontWeight: '700', marginBottom: 8, color: '#475569'},
  bottomBar: {position: 'absolute', left: 0, right: 0, bottom: TAB_BAR_HEIGHT, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.96)', borderTopWidth: 1, borderTopColor: '#E2E8F0'},
});
