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
import {useBreakdownReport} from '../../../../src/context/BreakdownReportContext';
import {useAppTheme} from '../../../../src/context/ThemeContext';
import {ApplianceCategory, BoilerType, BreakdownReportAppliance, EMPTY_BREAKDOWN_REPORT_APPLIANCE, FlueType, FuelType, PassFailNA, SafeUnsafe, YesNoNA} from '../../../../src/types/breakdownReport';

const STEPS = ['Details', 'Repair', 'Review'];
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;
const APPLIANCE_CATEGORIES: ApplianceCategory[] = ['Boiler', 'Fire', 'Cooker', 'Hob', 'Other'];
const BOILER_TYPES: BoilerType[] = ['Combi', 'System', 'Regular (Heat Only)', 'Back Boiler'];
const FUEL_TYPES: FuelType[] = ['Natural Gas', 'LPG'];
const FLUE_TYPES: FlueType[] = ['Balanced Flue', 'Room Sealed', 'Open Flue', 'Flu-less', 'Conventional Flue', 'Fanned Flue'];
const YES_NO_NA: YesNoNA[] = ['Yes', 'No', 'N/A'];
const PASS_FAIL_NA: PassFailNA[] = ['Pass', 'Fail', 'N/A'];
const SAFE_UNSAFE: SafeUnsafe[] = ['Safe', 'Unsafe'];

const joinNotes = (...parts: Array<string | null | undefined>) => parts.map((part) => part?.trim()).filter(Boolean).join('\n\n');

export default function BreakdownStepScreen() {
  const insets = useSafeAreaInsets();
  const {theme} = useAppTheme();
  const {appliances, addAppliance, updateAppliance, finalInfo, setFinalInfo} = useBreakdownReport();
  const [form, setForm] = useState<Omit<BreakdownReportAppliance, 'id'>>({...EMPTY_BREAKDOWN_REPORT_APPLIANCE});

  useEffect(() => {
    if (appliances[0]) {
      const {id, ...rest} = appliances[0];
      setForm(rest);
    }
  }, [appliances]);

  const updateField = <K extends keyof Omit<BreakdownReportAppliance, 'id'>>(key: K, value: Omit<BreakdownReportAppliance, 'id'>[K]) => setForm((prev) => ({...prev, [key]: value}));

  const repairNotesValue = joinNotes(
    form.engineerNotes,
    form.remedialActionTaken ? `Work carried out:\n${form.remedialActionTaken}` : '',
  );

  const outcomeNotesValue = joinNotes(
    finalInfo.repairOutcome,
    finalInfo.faultFound ? `Fault found:\n${finalInfo.faultFound}` : '',
    finalInfo.furtherWorkRequired ? `Further work required:\n${finalInfo.furtherWorkRequired}` : '',
  );

  const handleNext = () => {
    if (!form.category || !form.location.trim() || !form.faultSymptoms.trim()) {
      Alert.alert('Required', 'Appliance type, location and fault symptoms are required.');
      return;
    }
    const nextAppliance = {...form, id: appliances[0]?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`};
    if (appliances[0]) updateAppliance(appliances[0].id, nextAppliance);
    else addAppliance(nextAppliance);
    router.push('/(app)/forms/breakdown/review-sign' as any);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: TAB_BAR_HEIGHT + 110}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <FormHeader title="Breakdown Report" subtitle="Step 2 of 3" />
          <FormStepIndicator steps={STEPS} current={2} />

          <FormSection title="Appliance Details" subtitle="Single appliance breakdown or repair visit.">
            <DropdownField label="Appliance type" value={form.category} options={[...APPLIANCE_CATEGORIES]} onChange={(value) => updateField('category', value as ApplianceCategory)} />
            <Input label="Location" required value={form.location} onChangeText={(value) => updateField('location', value)} placeholder="Kitchen, loft, utility room" />
            <View style={styles.row}><View style={{flex: 1}}><AutocompleteInput label="Make" value={form.make} onChangeText={(value) => updateField('make', value)} suggestions={getBrandsForCategory(form.category)} placeholder="Manufacturer" /></View><View style={{flex: 1}}><Input label="Model" value={form.model} onChangeText={(value) => updateField('model', value)} /></View></View>
            <View style={styles.row}><View style={{flex: 1}}><Input label="Serial number" value={form.serialNumber} onChangeText={(value) => updateField('serialNumber', value)} /></View><View style={{flex: 1}}><Input label="GC number" value={form.gcNumber} onChangeText={(value) => updateField('gcNumber', value)} /></View></View>
            {form.category === 'Boiler' ? <DropdownField label="Boiler type" value={form.boilerType} options={[...BOILER_TYPES]} onChange={(value) => updateField('boilerType', value as BoilerType)} /> : null}
            <View style={styles.row}><View style={{flex: 1}}><DropdownField label="Fuel type" value={form.fuelType} options={[...FUEL_TYPES]} onChange={(value) => updateField('fuelType', value as FuelType)} /></View><View style={{flex: 1}}><DropdownField label="Flue type" value={form.flueType} options={[...FLUE_TYPES]} onChange={(value) => updateField('flueType', value as FlueType)} /></View></View>
          </FormSection>

          <FormSection title="Fault Details">
            <TextAreaField label="Fault symptoms" value={form.faultSymptoms} onChangeText={(value) => updateField('faultSymptoms', value)} placeholder="Customer complaint or symptoms observed" />
            <Input label="Fault code" value={form.faultCode} onChangeText={(value) => updateField('faultCode', value)} placeholder="If shown on appliance" />
            <TextAreaField label="Diagnostic checks" value={form.diagnosticChecks} onChangeText={(value) => updateField('diagnosticChecks', value)} placeholder="Checks carried out on site" />
            <ChoiceChips label="Gas soundness" value={form.gasSoundness} options={PASS_FAIL_NA} onChange={(value) => updateField('gasSoundness', value as PassFailNA)} />
            <ChoiceChips label="Electrical supply safe" value={form.electricalSupplySafe} options={YES_NO_NA} onChange={(value) => updateField('electricalSupplySafe', value as YesNoNA)} />
            <View style={styles.row}><View style={{flex: 1}}><Input label="Water pressure" value={form.waterPressure} onChangeText={(value) => updateField('waterPressure', value)} placeholder="Bar" /></View><View style={{flex: 1}}><Input label="Operating pressure" value={form.operatingPressure} onChangeText={(value) => updateField('operatingPressure', value)} placeholder="mBar" /></View></View>
            <Input label="Burner pressure" value={form.burnerPressure} onChangeText={(value) => updateField('burnerPressure', value)} placeholder="mBar" />
          </FormSection>

          <FormSection title="Repair Outcome">
            <TextAreaField label="Parts required" value={form.partsRequired} onChangeText={(value) => updateField('partsRequired', value)} placeholder="Parts needed" />
            <TextAreaField label="Parts fitted" value={form.partsFitted} onChangeText={(value) => updateField('partsFitted', value)} placeholder="Parts replaced during visit" />
            <ChoiceChips label="Temporary repair made" value={form.temporaryRepairMade} options={YES_NO_NA} onChange={(value) => updateField('temporaryRepairMade', value as YesNoNA)} />
            <ChoiceChips label="Appliance condition" value={form.applianceCondition} options={SAFE_UNSAFE} onChange={(value) => updateField('applianceCondition', value as SafeUnsafe)} />
            <TextAreaField
              label="Repair notes"
              value={repairNotesValue}
              onChangeText={(value) => setForm((prev) => ({...prev, engineerNotes: value, remedialActionTaken: ''}))}
              placeholder="Work carried out and any engineer notes"
            />
            <TextAreaField
              label="Diagnosis / outcome"
              value={outcomeNotesValue}
              onChangeText={(value) => setFinalInfo({...finalInfo, repairOutcome: value, faultFound: '', furtherWorkRequired: ''})}
              placeholder="Diagnosis, repair outcome, and any further work required"
            />
            <ChoiceChips label="Appliance left operational" value={finalInfo.applianceLeftOperational} options={YES_NO_NA} onChange={(value) => setFinalInfo({...finalInfo, applianceLeftOperational: value as YesNoNA})} />
            <ChoiceChips label="Customer advised" value={finalInfo.customerAdvised} options={YES_NO_NA} onChange={(value) => setFinalInfo({...finalInfo, customerAdvised: value as YesNoNA})} />
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
  bottomBar: {position: 'absolute', left: 0, right: 0, bottom: TAB_BAR_HEIGHT, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.96)', borderTopWidth: 1, borderTopColor: '#E2E8F0'},
});
