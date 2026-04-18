// ============================================
// FILE: app/(app)/forms/service-record/service.tsx
// Step 2 – Appliance Service Details (single appliance)
// Covers boilers, fires, cookers/hobs
// ============================================

import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router} from 'expo-router';
import React, {useEffect, useState} from 'react';
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
import Animated, {FadeIn, FadeInDown, FadeInUp} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AutocompleteSuggestions} from '../../../../components/forms/AutocompleteInput';
import {FgaReadingsGroup} from '../../../../components/forms/FgaReadingsGroup';
import {GlassIconButton} from '../../../../components/GlassIconButton';
import {UI} from '../../../../constants/theme';
import {useServiceRecord} from '../../../../src/context/ServiceRecordContext';
import {useAppTheme} from '../../../../src/context/ThemeContext';
import {getBrandsForCategory} from '../../../../src/data/applianceBrands';
import {ALL_FUEL_TYPES} from '../../../../src/types/gasForms';
import {
  ApplianceCategory,
  BoilerType,
  EMPTY_FGA,
  EMPTY_SERVICE_APPLIANCE,
  FlueType,
  FuelType,
  SafeUnsafe,
  ServiceAppliance,
  ServiceFinalInfo,
  YesNoNA
} from '../../../../src/types/serviceRecord';

const GLASS_BG = UI.glass.bg;
const GLASS_BORDER = UI.glass.border;
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;

const ACCENT = '#059669';

const APPLIANCE_CATEGORIES: ApplianceCategory[] = ['Boiler', 'Fire', 'Cooker', 'Hob', 'Other'];
const BOILER_TYPES: BoilerType[] = ['Combi', 'System', 'Regular (Heat Only)', 'Back Boiler'];
const FUEL_TYPES = ALL_FUEL_TYPES;
const FLUE_TYPES: FlueType[] = ['Balanced Flue', 'Room Sealed', 'Open Flue', 'Flu-less', 'Conventional Flue', 'Fanned Flue'];

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
                <Text style={[s.stepDotText, (isActive || isDone) && {color: UI.text.white}, isDark && !isActive && !isDone && {color: theme.text.muted}]}>
                  {step}
                </Text>
              )}
            </View>
            <Text style={[s.stepLabel, isActive ? {color: ACCENT} : isDark && {color: theme.text.muted}]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
};

// ─── Reusable chips ─────────────────────────────────────────────

function TriChips({
  options,
  value,
  onSelect,
}: {
  options: readonly string[];
  value: string;
  onSelect: (v: string) => void;
}) {
  const {isDark, theme} = useAppTheme();
  return (
    <View style={s.chipRow}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[s.chip, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}, active && s.chipActive]}
            onPress={() => onSelect(opt)}
            activeOpacity={0.7}
          >
            <Text style={[s.chipText, isDark && {color: theme.text.muted}, active && s.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Dropdown selector ──────────────────────────────────────────

function DropdownSelector({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const {isDark, theme} = useAppTheme();
  return (
    <View style={s.inputContainer}>
      <Text style={[s.inputLabel, isDark && {color: theme.text.bodyLight}]}>{label}</Text>
      <TouchableOpacity
        style={[s.dropdownTrigger, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Text style={[value ? s.dropdownText : s.dropdownPlaceholder, isDark && {color: value ? theme.text.title : theme.text.placeholder}]}>
          {value || 'Select…'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={isDark ? theme.text.muted : UI.text.muted} />
      </TouchableOpacity>
      {open && (
        <Animated.View entering={FadeInUp.duration(200)} style={[s.dropdownList, isDark && {backgroundColor: theme.surface.card, borderColor: theme.surface.border}]}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[s.dropdownOption, isDark && {borderBottomColor: theme.surface.divider}, value === opt && s.dropdownOptionActive]}
              onPress={() => {onSelect(opt); setOpen(false);}}
            >
              <Text style={[s.dropdownOptionText, isDark && {color: theme.text.body}, value === opt && s.dropdownOptionTextActive]}>
                {opt}
              </Text>
              {value === opt && <Ionicons name="checkmark" size={16} color={ACCENT} />}
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

// ─── Section divider ────────────────────────────────────────────

const SectionDivider = ({title}: {title: string}) => (
  <View style={s.divider}>
    <View style={s.dividerLine} />
    <Text style={s.dividerText}>{title}</Text>
    <View style={s.dividerLine} />
  </View>
);

// ─── Conditional checks based on appliance category ─────────────

function getComponentChecks(category: ApplianceCategory): [keyof Omit<ServiceAppliance, 'id'>, string][] {
  const common: [keyof Omit<ServiceAppliance, 'id'>, string][] = [
    ['burnerChecked', 'Burner Inspected/Cleaned'],
    ['gasValveChecked', 'Gas Valve Checked'],
    ['controlsChecked', 'Controls Checked'],
    ['flueChecked', 'Flue Inspected'],
    ['sealsGasketsChecked', 'Seals/Gaskets Checked'],
    ['ventilationAdequate', 'Ventilation Adequate'],
    ['expansionVesselChecked', 'Expansion Vessel Checked'],
    ['expansionVesselRecharged', 'Expansion Vessel Recharged'],
  ];

  if (category === 'Boiler') {
    return [
      ...common,
      ['electrodesChecked', 'Electrodes Inspected/Cleaned'],
      ['heatExchangerChecked', 'Heat Exchanger Inspected'],
      ['condenseTrapCleaned', 'Condense Trap Cleaned'],
      ['fanChecked', 'Fan Operation Checked'],
      ['sparkGeneratorChecked', 'Spark Generator Checked'],
      ['pcbChecked', 'PCB/Controls Checked'],
      ['thermistorChecked', 'Thermistor(s) Checked'],
      ['pumpChecked', 'Pump Operation Checked'],
    ];
  }

  if (category === 'Fire') {
    return [
      ...common,
      ['electrodesChecked', 'Pilot/Electrodes Checked'],
      ['heatExchangerChecked', 'Heat Exchanger / Radiants'],
      ['sparkGeneratorChecked', 'Spark Generator / Piezo'],
    ];
  }

  // Cooker / Hob / Other
  return [
    ...common,
    ['sparkGeneratorChecked', 'Ignition System Checked'],
  ];
}

function getSafetyTests(category: ApplianceCategory): [keyof Omit<ServiceAppliance, 'id'>, string][] {
  const tests: [keyof Omit<ServiceAppliance, 'id'>, string][] = [
    ['safetyDeviceOperation', 'Safety Device Operation'],
    ['gasSoundness', 'Gas Soundness'],
  ];

  if (category !== 'Cooker' && category !== 'Hob') {
    tests.push(
      ['spillageTest', 'Spillage Test'],
      ['flueFlowTest', 'Flue Flow Test'],
    );
  }

  return tests;
}

// ─── Main screen ────────────────────────────────────────────────

export default function ServiceScreen() {
  const {theme, isDark} = useAppTheme();
  const insets = useSafeAreaInsets();
  const {appliances, addAppliance, updateAppliance, finalInfo, setFinalInfo} = useServiceRecord();
  const [form, setForm] = useState<Omit<ServiceAppliance, 'id'>>({...EMPTY_SERVICE_APPLIANCE, fgaLow: {...EMPTY_FGA}, fgaHigh: {...EMPTY_FGA}});
  const [showMakeSuggestions, setShowMakeSuggestions] = useState(false);

  // If editing an existing record, load the saved appliance into form state
  useEffect(() => {
    if (appliances[0]) {
      const {id, ...rest} = appliances[0];
      setForm({...rest});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNext = () => {
    if (!form.location.trim()) {
      Alert.alert('Required', 'Please enter the appliance location.');
      return;
    }
    if (!form.category) {
      Alert.alert('Required', 'Please select the appliance type.');
      return;
    }

    if (appliances.length === 0) {
      const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
      addAppliance({...form, id});
    } else {
      updateAppliance(appliances[0].id, {...form, id: appliances[0].id});
    }

    router.push('/(app)/forms/service-record/review-sign' as any);
  };

  const updateField = <K extends keyof Omit<ServiceAppliance, 'id'>>(
    key: K, value: Omit<ServiceAppliance, 'id'>[K],
  ) => setForm((prev) => ({...prev, [key]: value}));

  const updateFinal = <K extends keyof ServiceFinalInfo>(key: K, val: ServiceFinalInfo[K]) =>
    setFinalInfo({...finalInfo, [key]: val});

  const componentChecks = getComponentChecks(form.category as ApplianceCategory);
  const safetyTests = getSafetyTests(form.category as ApplianceCategory);
  const showBoilerFields = form.category === 'Boiler';

  return (
    <View style={s.root}>
      <LinearGradient
        colors={theme.gradients.appBackground}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[s.scroll, {paddingTop: insets.top + 8, paddingBottom: TAB_BAR_HEIGHT + 120}]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(50).springify()} style={s.header}>
            <GlassIconButton onPress={() => router.back()} />
            <View style={{flex: 1}}>
              <Text style={[s.title, {color: theme.text.title}]}>Service Details</Text>
              <Text style={[s.subtitle, {color: theme.text.muted}]}>Step 2 of 3</Text>
            </View>
          </Animated.View>

          <StepIndicator current={2} />

          {/* ── Appliance form (always visible) ── */}
          <Animated.View entering={FadeInDown.delay(100).springify()} style={[s.formCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>

            {/* ── Appliance Identity ── */}
            <SectionDivider title="Appliance Details" />

            <DropdownSelector
              label="Appliance Type *"
              value={form.category}
              options={[...APPLIANCE_CATEGORIES]}
              onSelect={(v) => updateField('category', v as ApplianceCategory)}
            />

            <FormInput label="Location *" value={form.location} onChange={(v) => updateField('location', v)} placeholder="e.g. Kitchen" />
            <FormInput label="Make" value={form.make} onChange={(v) => {updateField('make', v); setShowMakeSuggestions(true);}} placeholder="e.g. Worcester" />
            <AutocompleteSuggestions value={form.make} suggestions={getBrandsForCategory(form.category)} visible={showMakeSuggestions} onSelect={(v) => {updateField('make', v); setShowMakeSuggestions(false);}} />
            <FormInput label="Model" value={form.model} onChange={(v) => updateField('model', v)} placeholder="e.g. Greenstar 30i" />
            <FormInput label="Serial Number" value={form.serialNumber} onChange={(v) => updateField('serialNumber', v)} placeholder="Serial number" />
            <FormInput label="GC Number" value={form.gcNumber} onChange={(v) => updateField('gcNumber', v)} placeholder="GC number" />

            {showBoilerFields && (
              <DropdownSelector
                label="Boiler Type"
                value={form.boilerType}
                options={[...BOILER_TYPES]}
                onSelect={(v) => updateField('boilerType', v as BoilerType)}
              />
            )}

            <DropdownSelector
              label="Fuel Type"
              value={form.fuelType}
              options={[...FUEL_TYPES]}
              onSelect={(v) => updateField('fuelType', v as FuelType)}
            />

            <DropdownSelector
              label="Flue Type"
              value={form.flueType}
              options={[...FLUE_TYPES]}
              onSelect={(v) => updateField('flueType', v as FlueType)}
            />

            {/* ── Readings ── */}
            <SectionDivider title="Readings & Pressures" />

            <FormInput
              label="Operating Pressure (mBar)"
              value={form.operatingPressure}
              onChange={(v) => updateField('operatingPressure', v)}
              placeholder="e.g. 20"
              keyboardType="decimal-pad"
            />
            {showBoilerFields && (
              <FormInput
                label="Burner Pressure (mBar)"
                value={form.burnerPressure}
                onChange={(v) => updateField('burnerPressure', v)}
                placeholder="e.g. 12"
                keyboardType="decimal-pad"
              />
            )}
            <FormInput
              label="Standing Pressure (mBar)"
              value={form.standingPressure}
              onChange={(v) => updateField('standingPressure', v)}
              placeholder="e.g. 21"
              keyboardType="decimal-pad"
            />
            <FormInput
              label="Heat Input (kW)"
              value={form.heatInput}
              onChange={(v) => updateField('heatInput', v)}
              placeholder="e.g. 30"
              keyboardType="decimal-pad"
            />

            {/* ── FGA Readings ── */}
            <SectionDivider title="FGA Readings" />

            <FgaReadingsGroup
              label="FGA Low Fire"
              value={form.fgaLow}
              onChange={(v) => updateField('fgaLow', v)}
            />
            <FgaReadingsGroup
              label="FGA High Fire"
              value={form.fgaHigh}
              onChange={(v) => updateField('fgaHigh', v)}
            />

            {/* ── Safety Tests ── */}
            <SectionDivider title="Safety Tests" />

            {safetyTests.map(([key, label]) => (
              <View key={key} style={s.inputContainer}>
                <Text style={s.inputLabel}>{label}</Text>
                <TriChips
                  options={key === 'gasSoundness' || key === 'safetyDeviceOperation' || key === 'spillageTest' || key === 'flueFlowTest' ? ['Pass', 'Fail', 'N/A'] : ['Yes', 'No', 'N/A']}
                  value={form[key] as string}
                  onSelect={(v) => updateField(key, v as any)}
                />
              </View>
            ))}

            {/* ── Component Checks ── */}
            <SectionDivider title="Components Inspected" />

            {componentChecks.map(([key, label]) => (
              <View key={key} style={s.inputContainer}>
                <Text style={s.inputLabel}>{label}</Text>
                <TriChips
                  options={['Yes', 'No', 'N/A']}
                  value={form[key] as string}
                  onSelect={(v) => updateField(key, v as YesNoNA)}
                />
              </View>
            ))}

            {/* ── Parts Replaced ── */}
            <SectionDivider title="Parts & Notes" />

            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>Parts Replaced</Text>
              <View style={[s.inputWrapper, s.textAreaWrapper]}>
                <TextInput
                  style={[s.input, s.textArea]}
                  value={form.partsReplaced}
                  onChangeText={(v) => updateField('partsReplaced', v)}
                  placeholder="List any parts replaced…"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>

            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>Defects Found</Text>
              <View style={[s.inputWrapper, s.textAreaWrapper]}>
                <TextInput
                  style={[s.input, s.textArea]}
                  value={form.defectsFound}
                  onChangeText={(v) => updateField('defectsFound', v)}
                  placeholder="Record any defects found during checks…"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>

            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>Remedial Action Taken</Text>
              <View style={[s.inputWrapper, s.textAreaWrapper]}>
                <TextInput
                  style={[s.input, s.textArea]}
                  value={form.remedialActionTaken}
                  onChangeText={(v) => updateField('remedialActionTaken', v)}
                  placeholder="Describe remedial action taken…"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>

            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>Recommended Work</Text>
              <View style={[s.inputWrapper, s.textAreaWrapper]}>
                <TextInput
                  style={[s.input, s.textArea]}
                  value={form.recommendedWork}
                  onChangeText={(v) => updateField('recommendedWork', v)}
                  placeholder="Any work recommended…"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>

            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>Engineer Notes</Text>
              <View style={[s.inputWrapper, s.textAreaWrapper]}>
                <TextInput
                  style={[s.input, s.textArea]}
                  value={form.engineerNotes}
                  onChangeText={(v) => updateField('engineerNotes', v)}
                  placeholder="Additional notes…"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* ── Condition & Outcome ── */}
            <SectionDivider title="Outcome" />

            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>Appliance Condition</Text>
              <TriChips
                options={['Safe', 'Unsafe']}
                value={form.applianceCondition}
                onSelect={(v) => updateField('applianceCondition', v as SafeUnsafe)}
              />
            </View>
          </Animated.View>

          {/* ── General Installation Checks ── */}
          <Animated.View entering={FadeInDown.delay(200).springify()} style={[s.formCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
            <SectionDivider title="General Installation Checks" />

            {([
              ['tightnessTestPerformed', 'Tightness Test Performed'],
              ['gasMeterCondition', 'Gas Meter in Good Condition'],
              ['emergencyControlAccessible', 'Emergency Control Accessible'],
              ['ventilationSatisfactory', 'Ventilation Satisfactory'],
              ['pipeworkCondition', 'Pipework Condition Satisfactory'],
              ['coAlarmFitted', 'CO Alarm Fitted'],
              ['coAlarmTested', 'CO Alarm Tested'],
              ['coAlarmInDate', 'CO Alarm Within Date'],
            ] as [keyof ServiceFinalInfo, string][]).map(([key, label]) => (
              <View key={key} style={s.inputContainer}>
                <Text style={s.inputLabel}>{label}</Text>
                <TriChips
                  options={['Yes', 'No', 'N/A']}
                  value={finalInfo[key] as string}
                  onSelect={(v) => updateFinal(key, v as any)}
                />
              </View>
            ))}

            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>Overall Faults / Defects Found</Text>
              <View style={[s.inputWrapper, s.textAreaWrapper]}>
                <TextInput
                  style={[s.input, s.textArea]}
                  value={finalInfo.overallFaults}
                  onChangeText={(v) => updateFinal('overallFaults', v)}
                  placeholder="Record any overall faults..."
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>

            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>Additional Work Required</Text>
              <View style={[s.inputWrapper, s.textAreaWrapper]}>
                <TextInput
                  style={[s.input, s.textArea]}
                  value={finalInfo.additionalWork}
                  onChangeText={(v) => updateFinal('additionalWork', v)}
                  placeholder="Describe any additional work needed..."
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Bottom CTA */}
        <Animated.View
          entering={FadeIn.delay(400)}
          style={[s.bottomBar, {bottom: TAB_BAR_HEIGHT, paddingBottom: 12}, isDark && {backgroundColor: 'rgba(28,28,30,0.97)', borderTopColor: 'rgba(255,255,255,0.08)'}]}
        >
          <TouchableOpacity
            style={s.nextBtn}
            activeOpacity={0.85}
            onPress={handleNext}
          >
            <LinearGradient
              colors={['#059669', '#10B981']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={s.nextGradient}
            >
              <Text style={s.nextText}>Next: Review & Sign</Text>
              <Ionicons name="arrow-forward" size={20} color={UI.text.white} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Tiny form input ────────────────────────────────────────────

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad' | 'numeric';
}) {
  const {isDark, theme} = useAppTheme();
  return (
    <View style={s.inputContainer}>
      <Text style={[s.inputLabel, isDark && {color: theme.text.bodyLight}]}>{label}</Text>
      <View style={[s.inputWrapper, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}>
        <TextInput
          style={[s.input, isDark && {color: theme.text.title}]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          keyboardType={keyboardType}
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>
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

  stepRow: {flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 24, paddingVertical: 14, backgroundColor: GLASS_BG, borderRadius: 16, borderWidth: 1, borderColor: GLASS_BORDER},
  stepItem: {alignItems: 'center', gap: 6},
  stepDot: {width: 28, height: 28, borderRadius: 14, backgroundColor: UI.surface.divider, justifyContent: 'center', alignItems: 'center'},
  stepDotActive: {backgroundColor: ACCENT},
  stepDotDone: {backgroundColor: UI.status.complete},
  stepDotText: {fontSize: 12, fontWeight: '700', color: UI.text.muted},
  stepLabel: {fontSize: 11, fontWeight: '600', color: UI.text.muted},

  formCard: {
    backgroundColor: GLASS_BG, borderRadius: 20, borderWidth: 1, borderColor: GLASS_BORDER,
    padding: 18, marginBottom: 12,
    shadowColor: UI.text.muted, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4,
  },

  inputContainer: {marginBottom: 14},
  inputLabel: {fontSize: 13, fontWeight: '600', color: UI.text.bodyLight, marginBottom: 6},
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: UI.surface.base, borderRadius: 12, borderWidth: 1, borderColor: UI.surface.divider,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  input: {flex: 1, fontSize: 15, color: UI.text.title, padding: 0},
  textAreaWrapper: {alignItems: 'flex-start', minHeight: 80},
  textArea: {minHeight: 68, textAlignVertical: 'top'},

  chipRow: {flexDirection: 'row', gap: 8, flexWrap: 'wrap'},
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: UI.surface.elevated, borderWidth: 1, borderColor: UI.surface.divider,
  },
  chipActive: {backgroundColor: '#ECFDF5', borderColor: ACCENT},
  chipText: {fontSize: 13, fontWeight: '600', color: UI.text.muted},
  chipTextActive: {color: ACCENT},

  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: UI.surface.base, borderRadius: 12, borderWidth: 1, borderColor: UI.surface.divider,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 12,
  },
  dropdownText: {fontSize: 15, color: UI.text.title, fontWeight: '500'},
  dropdownPlaceholder: {fontSize: 15, color: UI.text.muted},
  dropdownList: {
    marginTop: 4, borderRadius: 14, backgroundColor: '#fff',
    borderWidth: 1, borderColor: UI.surface.divider, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
  },
  dropdownOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: UI.surface.elevated,
  },
  dropdownOptionActive: {backgroundColor: '#ECFDF5'},
  dropdownOptionText: {fontSize: 14, fontWeight: '500', color: UI.text.bodyLight},
  dropdownOptionTextActive: {color: ACCENT, fontWeight: '600'},

  fgaSection: {marginBottom: 16},
  fgaLabel: {fontSize: 14, fontWeight: '700', color: UI.text.bodyLight, marginBottom: 8},
  fgaGrid: {flexDirection: 'row', gap: 8},
  fgaField: {flex: 1},
  fgaFieldLabel: {fontSize: 11, fontWeight: '600', color: UI.text.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5},
  fgaInputRow: {flexDirection: 'row', alignItems: 'center', gap: 4},
  fgaInput: {
    flex: 1, fontSize: 14, color: UI.text.title,
    backgroundColor: UI.surface.base, borderRadius: 10, borderWidth: 1, borderColor: UI.surface.divider,
    paddingHorizontal: 10, paddingVertical: Platform.OS === 'ios' ? 10 : 8, textAlign: 'center',
  },
  naBtn: {
    paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8,
    backgroundColor: UI.surface.elevated, borderWidth: 1, borderColor: UI.surface.divider,
  },
  naBtnActive: {backgroundColor: '#FEE2E2', borderColor: '#FECACA'},
  naBtnText: {fontSize: 10, fontWeight: '700', color: UI.text.muted},
  naBtnTextActive: {color: UI.brand.danger},

  divider: {flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16},
  dividerLine: {flex: 1, height: 1, backgroundColor: UI.surface.divider},
  dividerText: {fontSize: 12, fontWeight: '700', color: UI.text.muted, textTransform: 'uppercase', letterSpacing: 0.5},

  bottomBar: {
    position: 'absolute', left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: 'rgba(248,250,252,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  nextBtn: {borderRadius: 16, overflow: 'hidden'},
  nextGradient: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8},
  nextText: {fontSize: 16, fontWeight: '700', color: UI.text.white},
});
