// ============================================
// FILE: app/(app)/cp12/appliances.tsx
// Step 2 – Add appliances (max 5)
// ============================================

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
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
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, UI } from '../../../constants/theme';
import { useCP12 } from '../../../src/context/CP12Context';
import {
    CP12Appliance,
    EMPTY_APPLIANCE,
    EMPTY_FGA,
    FlueType,
    HeatInputUnit,
    PassFailNA,
    YesNoNA,
} from '../../../src/types/cp12';

const GLASS_BG = UI.glass.bg;
const GLASS_BORDER = UI.glass.border;
const MAX_APPLIANCES = 5;
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;

const FLUE_TYPES: FlueType[] = [
  'Balanced Flue',
  'Room Sealed',
  'Open Flue',
  'Flu-less',
  'Conventional Flue',
  'Fanned Flue',
];

// ─── Step indicator (reused) ────────────────────────────────────

const StepIndicator = ({ current }: { current: number }) => (
  <View style={s.stepRow}>
    {['Details', 'Appliances', 'Checks', 'Review'].map((label, i) => {
      const step = i + 1;
      const isActive = step === current;
      const isDone = step < current;
      return (
        <View key={label} style={s.stepItem}>
          <View
            style={[s.stepDot, isActive && s.stepDotActive, isDone && s.stepDotDone]}
          >
            {isDone ? (
              <Ionicons name="checkmark" size={12} color="#fff" />
            ) : (
              <Text style={[s.stepDotText, (isActive || isDone) && { color: '#fff' }]}>
                {step}
              </Text>
            )}
          </View>
          <Text style={[s.stepLabel, isActive && s.stepLabelActive]}>{label}</Text>
        </View>
      );
    })}
  </View>
);

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
  return (
    <View style={s.chipRow}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[s.chip, active && s.chipActive]}
            onPress={() => onSelect(opt)}
            activeOpacity={0.7}
          >
            <Text style={[s.chipText, active && s.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── FGA Row ────────────────────────────────────────────────────

function FGARow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { co: string; co2: string; ratio: string };
  onChange: (v: { co: string; co2: string; ratio: string }) => void;
}) {
  return (
    <View style={s.fgaSection}>
      <Text style={s.fgaLabel}>{label}</Text>
      <View style={s.fgaGrid}>
        {(['co', 'co2', 'ratio'] as const).map((field) => {
          const labels = { co: 'CO', co2: 'CO₂', ratio: 'Ratio' };
          return (
            <View key={field} style={s.fgaField}>
              <Text style={s.fgaFieldLabel}>{labels[field]}</Text>
              <View style={s.fgaInputRow}>
                <TextInput
                  style={s.fgaInput}
                  value={value[field]}
                  onChangeText={(t) => onChange({ ...value, [field]: t })}
                  placeholder="–"
                  placeholderTextColor="#CBD5E1"
                  keyboardType="decimal-pad"
                  editable={value[field] !== 'N/A'}
                />
                <TouchableOpacity
                  style={[
                    s.naBtn,
                    value[field] === 'N/A' && s.naBtnActive,
                  ]}
                  onPress={() =>
                    onChange({
                      ...value,
                      [field]: value[field] === 'N/A' ? '' : 'N/A',
                    })
                  }
                >
                  <Text
                    style={[
                      s.naBtnText,
                      value[field] === 'N/A' && s.naBtnTextActive,
                    ]}
                  >
                    N/A
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
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
  return (
    <View style={s.inputContainer}>
      <Text style={s.inputLabel}>{label}</Text>
      <TouchableOpacity
        style={s.dropdownTrigger}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Text style={value ? s.dropdownText : s.dropdownPlaceholder}>
          {value || 'Select…'}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#94A3B8"
        />
      </TouchableOpacity>
      {open && (
        <Animated.View entering={FadeInUp.duration(200)} style={s.dropdownList}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[s.dropdownOption, value === opt && s.dropdownOptionActive]}
              onPress={() => {
                onSelect(opt);
                setOpen(false);
              }}
            >
              <Text
                style={[
                  s.dropdownOptionText,
                  value === opt && s.dropdownOptionTextActive,
                ]}
              >
                {opt}
              </Text>
              {value === opt && (
                <Ionicons name="checkmark" size={16} color="#6366F1" />
              )}
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

// ─── Section divider ────────────────────────────────────────────

const SectionDivider = ({ title }: { title: string }) => (
  <View style={s.divider}>
    <View style={s.dividerLine} />
    <Text style={s.dividerText}>{title}</Text>
    <View style={s.dividerLine} />
  </View>
);

// ─── Main screen ────────────────────────────────────────────────

export default function AppliancesScreen() {
  const insets = useSafeAreaInsets();
  const { appliances, addAppliance, updateAppliance, removeAppliance } = useCP12();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<CP12Appliance, 'id'>>({ ...EMPTY_APPLIANCE });

  const canAddMore = appliances.length < MAX_APPLIANCES;

  const resetForm = useCallback(() => {
    setForm({
      ...EMPTY_APPLIANCE,
      fgaLow: { ...EMPTY_FGA },
      fgaHigh: { ...EMPTY_FGA },
    });
    setEditingId(null);
  }, []);

  const handleStartAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (a: CP12Appliance) => {
    setForm({ ...a });
    setEditingId(a.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.location.trim()) {
      Alert.alert('Required', 'Please enter the appliance location.');
      return;
    }

    if (editingId) {
      updateAppliance(editingId, { ...form, id: editingId });
    } else {
      const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
      addAppliance({ ...form, id });
    }

    resetForm();
    setShowForm(false);
  };

  const handleRemove = (id: string) => {
    Alert.alert('Remove Appliance', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeAppliance(id) },
    ]);
  };

  const handleNext = () => {
    if (appliances.length === 0) {
      Alert.alert('No Appliances', 'Please add at least one appliance.');
      return;
    }
    router.push('/(app)/cp12/final-checks');
  };

  const updateField = <K extends keyof Omit<CP12Appliance, 'id'>>(
    key: K,
    value: Omit<CP12Appliance, 'id'>[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#EEF2FF', '#E0F2FE', '#F0FDFA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            s.scroll,
            { paddingTop: insets.top + 8, paddingBottom: TAB_BAR_HEIGHT + 120 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(50).springify()} style={s.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={s.backBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={Colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Appliances</Text>
              <Text style={s.subtitle}>
                {appliances.length}/{MAX_APPLIANCES} added
              </Text>
            </View>
          </Animated.View>

          <StepIndicator current={2} />

          {/* Existing appliances */}
          {appliances.map((a, idx) => (
            <Animated.View
              key={a.id}
              entering={FadeInDown.delay(100 + idx * 80).springify()}
              style={s.applianceCard}
            >
              <View style={s.applianceHeader}>
                <View style={s.applianceNum}>
                  <Text style={s.applianceNumText}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.applianceName} numberOfLines={1}>
                    {a.make} {a.model}
                  </Text>
                  <Text style={s.applianceLocation}>{a.location}</Text>
                </View>
                <TouchableOpacity onPress={() => handleEdit(a)} style={s.iconBtn}>
                  <Ionicons name="pencil-outline" size={18} color="#6366F1" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleRemove(a.id)} style={s.iconBtn}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
              <View style={s.applianceMeta}>
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>Type</Text>
                  <Text style={s.metaValue}>{a.type || '–'}</Text>
                </View>
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>Flue</Text>
                  <Text style={s.metaValue}>{a.flueType || '–'}</Text>
                </View>
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>Safe</Text>
                  <Text
                    style={[
                      s.metaValue,
                      a.applianceSafeToUse === 'Yes' && { color: '#10B981' },
                      a.applianceSafeToUse === 'No' && { color: '#EF4444' },
                    ]}
                  >
                    {a.applianceSafeToUse || '–'}
                  </Text>
                </View>
              </View>
            </Animated.View>
          ))}

          {/* Add button */}
          {!showForm && canAddMore && (
            <Animated.View entering={FadeIn.delay(200)}>
              <TouchableOpacity
                style={s.addBtn}
                activeOpacity={0.8}
                onPress={handleStartAdd}
              >
                <LinearGradient
                  colors={['#6366F1', '#818CF8']}
                  style={s.addBtnGradient}
                >
                  <Ionicons name="add-circle-outline" size={22} color="#fff" />
                  <Text style={s.addBtnText}>Add Appliance</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}

          {!canAddMore && !showForm && (
            <View style={s.maxNotice}>
              <Ionicons name="information-circle" size={16} color="#6366F1" />
              <Text style={s.maxNoticeText}>Maximum of {MAX_APPLIANCES} appliances reached</Text>
            </View>
          )}

          {/* ── Appliance form ── */}
          {showForm && (
            <Animated.View entering={FadeInDown.springify()} style={s.formCard}>
              <View style={s.formHeader}>
                <Text style={s.formTitle}>
                  {editingId ? 'Edit Appliance' : 'New Appliance'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  <Ionicons name="close-circle" size={26} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* ── Details ── */}
              <SectionDivider title="Appliance Details" />

              <FormInput label="Location" value={form.location} onChange={(v) => updateField('location', v)} placeholder="e.g. Kitchen" />
              <FormInput label="Make" value={form.make} onChange={(v) => updateField('make', v)} placeholder="e.g. Worcester" />
              <FormInput label="Model" value={form.model} onChange={(v) => updateField('model', v)} placeholder="e.g. Greenstar 30i" />
              <FormInput label="Type" value={form.type} onChange={(v) => updateField('type', v)} placeholder="e.g. Boiler" />
              <FormInput label="Serial Number" value={form.serialNumber} onChange={(v) => updateField('serialNumber', v)} placeholder="Serial number" />
              <FormInput label="GC Number" value={form.gcNumber} onChange={(v) => updateField('gcNumber', v)} placeholder="GC number" />

              <DropdownSelector
                label="Flue Type"
                value={form.flueType}
                options={[...FLUE_TYPES]}
                onSelect={(v) => updateField('flueType', v as FlueType)}
              />

              {/* ── Operating Pressure / Heat Input ── */}
              <SectionDivider title="Pressure & Heat Input" />

              <FormInput
                label="Operating Pressure (mBar)"
                value={form.operatingPressure}
                onChange={(v) => updateField('operatingPressure', v)}
                placeholder="e.g. 20"
                keyboardType="decimal-pad"
              />

              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <FormInput
                    label="Heat Input"
                    value={form.heatInput}
                    onChange={(v) => updateField('heatInput', v)}
                    placeholder="Value"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={s.unitToggle}>
                  <Text style={s.inputLabel}>Unit</Text>
                  <View style={s.chipRow}>
                    {(['kW/h', 'Btu/h'] as HeatInputUnit[]).map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[s.chip, form.heatInputUnit === u && s.chipActive]}
                        onPress={() => updateField('heatInputUnit', u)}
                      >
                        <Text
                          style={[s.chipText, form.heatInputUnit === u && s.chipTextActive]}
                        >
                          {u}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* ── Safety Tests ── */}
              <SectionDivider title="Safety Tests" />

              <View style={s.inputContainer}>
                <Text style={s.inputLabel}>Safety Devices</Text>
                <TriChips
                  options={['Yes', 'No', 'N/A']}
                  value={form.safetyDevices}
                  onSelect={(v) => updateField('safetyDevices', v as YesNoNA)}
                />
              </View>

              <View style={s.inputContainer}>
                <Text style={s.inputLabel}>Spillage Test</Text>
                <TriChips
                  options={['Pass', 'Fail', 'N/A']}
                  value={form.spillageTest}
                  onSelect={(v) => updateField('spillageTest', v as PassFailNA)}
                />
              </View>

              <View style={s.inputContainer}>
                <Text style={s.inputLabel}>Smoke Pellet Flue Test</Text>
                <TriChips
                  options={['Pass', 'Fail', 'N/A']}
                  value={form.smokePelletFlueTest}
                  onSelect={(v) => updateField('smokePelletFlueTest', v as PassFailNA)}
                />
              </View>

              {/* ── FGA Readings ── */}
              <SectionDivider title="FGA Readings" />

              <FGARow
                label="FGA Low"
                value={form.fgaLow}
                onChange={(v) => updateField('fgaLow', v)}
              />
              <FGARow
                label="FGA High"
                value={form.fgaHigh}
                onChange={(v) => updateField('fgaHigh', v)}
              />

              {/* ── Checks ── */}
              <SectionDivider title="Appliance Checks" />

              {([
                ['satisfactoryTermination', 'Satisfactory Termination'],
                ['flueVisualCondition', 'Flue Visual Condition'],
                ['adequateVentilation', 'Adequate Ventilation'],
                ['landlordsAppliance', "Landlord's Appliance"],
                ['inspected', 'Inspected'],
                ['applianceVisualCheck', 'Appliance Visual Check'],
                ['applianceServiced', 'Appliance Serviced'],
                ['applianceSafeToUse', 'Appliance Safe to Use'],
              ] as [keyof Omit<CP12Appliance, 'id'>, string][]).map(([key, label]) => (
                <View key={key} style={s.inputContainer}>
                  <Text style={s.inputLabel}>{label}</Text>
                  <TriChips
                    options={['Yes', 'No', 'N/A']}
                    value={form[key] as string}
                    onSelect={(v) => updateField(key, v as YesNoNA)}
                  />
                </View>
              ))}

              {/* ── Save ── */}
              <TouchableOpacity style={s.saveBtn} activeOpacity={0.85} onPress={handleSave}>
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.saveBtnGradient}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={s.saveBtnText}>
                    {editingId ? 'Update Appliance' : 'Save & Continue'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>

        {/* Bottom CTA */}
        {!showForm && (
          <Animated.View
            entering={FadeIn.delay(400)}
            style={[s.bottomBar, { bottom: TAB_BAR_HEIGHT, paddingBottom: 12 }]}
          >
            <TouchableOpacity
              style={[s.nextBtn, appliances.length === 0 && { opacity: 0.5 }]}
              activeOpacity={0.85}
              onPress={handleNext}
              disabled={appliances.length === 0}
            >
              <LinearGradient
                colors={['#6366F1', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.nextGradient}
              >
                <Text style={s.nextText}>Next: Final Checks</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
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
  return (
    <View style={s.inputContainer}>
      <Text style={s.inputLabel}>{label}</Text>
      <View style={s.inputWrapper}>
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  backBtn: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: GLASS_BG, borderWidth: 1, borderColor: GLASS_BORDER,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#64748B', fontWeight: '500', marginTop: 2 },

  // Step
  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 24, paddingVertical: 14, backgroundColor: GLASS_BG, borderRadius: 16, borderWidth: 1, borderColor: GLASS_BORDER },
  stepItem: { alignItems: 'center', gap: 6 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  stepDotActive: { backgroundColor: '#6366F1' },
  stepDotDone: { backgroundColor: '#10B981' },
  stepDotText: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  stepLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  stepLabelActive: { color: '#6366F1' },

  // Appliance card
  applianceCard: {
    backgroundColor: GLASS_BG, borderRadius: 18, borderWidth: 1, borderColor: GLASS_BORDER,
    padding: 16, marginBottom: 12,
    shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  applianceHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  applianceNum: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  applianceNumText: { fontSize: 14, fontWeight: '800', color: '#6366F1' },
  applianceName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  applianceLocation: { fontSize: 12, color: '#64748B', marginTop: 1 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  applianceMeta: { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  metaItem: {},
  metaLabel: { fontSize: 10, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  metaValue: { fontSize: 13, fontWeight: '600', color: '#334155' },

  // Add button
  addBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  addBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  addBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  maxNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 14 },
  maxNoticeText: { fontSize: 13, fontWeight: '600', color: '#6366F1' },

  // Form card
  formCard: {
    backgroundColor: GLASS_BG, borderRadius: 20, borderWidth: 1, borderColor: GLASS_BORDER,
    padding: 18, marginBottom: 12,
    shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4,
  },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  formTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },

  // Inputs
  inputContainer: { marginBottom: 14 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  input: { flex: 1, fontSize: 15, color: '#0F172A', padding: 0 },

  // Chips
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#6366F1' },

  // Dropdown
  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 12,
  },
  dropdownText: { fontSize: 15, color: '#0F172A', fontWeight: '500' },
  dropdownPlaceholder: { fontSize: 15, color: '#94A3B8' },
  dropdownList: {
    marginTop: 4, borderRadius: 14, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
  },
  dropdownOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9',
  },
  dropdownOptionActive: { backgroundColor: '#EEF2FF' },
  dropdownOptionText: { fontSize: 14, fontWeight: '500', color: '#334155' },
  dropdownOptionTextActive: { color: '#6366F1', fontWeight: '600' },

  // FGA
  fgaSection: { marginBottom: 16 },
  fgaLabel: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8 },
  fgaGrid: { flexDirection: 'row', gap: 8 },
  fgaField: { flex: 1 },
  fgaFieldLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  fgaInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fgaInput: {
    flex: 1, fontSize: 14, color: '#0F172A',
    backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 10, paddingVertical: Platform.OS === 'ios' ? 10 : 8, textAlign: 'center',
  },
  naBtn: {
    paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0',
  },
  naBtnActive: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  naBtnText: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
  naBtnTextActive: { color: '#EF4444' },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Row
  row: { flexDirection: 'row', gap: 12 },
  unitToggle: { width: 130 },

  // Save
  saveBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  saveBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Bottom bar
  bottomBar: {
    position: 'absolute', left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: 'rgba(248,250,252,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  nextBtn: { borderRadius: 16, overflow: 'hidden' },
  nextGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  nextText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
