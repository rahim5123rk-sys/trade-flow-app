// ============================================
// FILE: components/CustomerSelector.tsx
// Shared customer selection/creation component
// ============================================

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { UI } from '../constants/theme';
import { supabase } from '../src/config/supabase';
import { useAuth } from '../src/context/AuthContext';
import { useCustomers } from '../hooks/useCustomers';
import { Avatar } from './Avatar';
import { CustomerAddressForm } from './CustomerAddressForm';
import { CustomerPickerModal } from './CustomerPickerModal';
import { Input } from './Input';
import {
  CustomerFormData,
  EMPTY_CUSTOMER_FORM,
  buildCustomerInsert,
  buildCustomerSnapshot,
  getJobAddress,
  prefillFromJob,
  updateExistingCustomer,
} from './customerUtils';

// ─── Re-export types & helpers so existing callers aren't broken ─────
export type { CustomerFormData };
export {
  EMPTY_CUSTOMER_FORM,
  buildCustomerSnapshot,
  buildCustomerInsert,
  getJobAddress,
  prefillFromJob,
  updateExistingCustomer,
};

// ─── Props ──────────────────────────────────────────────────────────

interface CustomerSelectorProps {
  value: CustomerFormData;
  onChange: (data: CustomerFormData) => void;
  mode?: 'full' | 'compact';
  showQuickToggle?: boolean;
  quickEntry?: boolean;
  onQuickToggleChange?: (isQuick: boolean) => void;
  showJobAddress?: boolean;
  prefillMode?: 'none' | 'locked';
  hideTabs?: boolean;
  showActions?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────

export function CustomerSelector({
  value,
  onChange,
  mode = 'full',
  showQuickToggle = false,
  quickEntry = false,
  onQuickToggleChange,
  showJobAddress = true,
  prefillMode = 'none',
  hideTabs = false,
  showActions = true,
}: CustomerSelectorProps) {
  const { userProfile } = useAuth();
  const { filteredCustomers, search, setSearch, fetchCustomers } = useCustomers();

  const [customerMode, setCustomerMode] = useState<'new' | 'existing'>(
    value.customerId ? 'existing' : 'new',
  );
  const [showPicker, setShowPicker] = useState(false);
  const [isQuick, setIsQuick] = useState(quickEntry);
  const [isEditing, setIsEditing] = useState(false);
  const [originalData, setOriginalData] = useState<CustomerFormData | null>(null);

  useEffect(() => {
    if (value.customerId) setCustomerMode('existing');
    else setCustomerMode('new');
  }, [value.customerId]);

  const update = (field: keyof CustomerFormData, val: any) =>
    onChange({ ...value, [field]: val });

  const handleSelectCustomer = (cust: any) => {
    onChange({
      ...value,
      customerId: cust.id,
      customerName: cust.name,
      customerCompany: cust.company_name || '',
      addressLine1: cust.address_line_1 || cust.address || '',
      addressLine2: cust.address_line_2 || '',
      city: cust.city || '',
      region: cust.region || '',
      postCode: cust.postal_code || '',
      phone: cust.phone || '',
      email: cust.email || '',
    });
    setShowPicker(false);
  };

  const handleToggleQuick = (val: boolean) => {
    setIsQuick(val);
    onQuickToggleChange?.(val);
  };

  const startEditing = () => {
    setOriginalData({ ...value });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (originalData) onChange(originalData);
    setIsEditing(false);
    setOriginalData(null);
  };

  const hasChanged = originalData
    ? value.customerName !== originalData.customerName ||
      value.customerCompany !== originalData.customerCompany ||
      value.addressLine1 !== originalData.addressLine1 ||
      value.addressLine2 !== originalData.addressLine2 ||
      value.city !== originalData.city ||
      value.region !== originalData.region ||
      value.postCode !== originalData.postCode ||
      value.phone !== originalData.phone ||
      value.email !== originalData.email
    : false;

  const handleUpdateExisting = async () => {
    try {
      await updateExistingCustomer(value.customerId!, value);
      await fetchCustomers();
      Alert.alert('Success', 'Customer details updated permanently.');
      setIsEditing(false);
      setOriginalData(null);
    } catch {
      Alert.alert('Error', 'Could not update customer.');
    }
  };

  const handleCreateCustomerInDB = async () => {
    if (!value.customerName || !value.addressLine1 || !value.postCode) {
      Alert.alert('Missing Info', 'Name, Address, and Post Code are required.');
      return;
    }
    try {
      const insertData = buildCustomerInsert(value, userProfile?.company_id!);
      const { data: newCust, error } = await supabase
        .from('customers')
        .insert(insertData)
        .select('id')
        .single();

      if (error) throw error;
      onChange({ ...value, customerId: newCust.id });
      setCustomerMode('existing');
      await fetchCustomers();
      Alert.alert('Success', 'Customer saved to database.');
      setIsEditing(false);
      setOriginalData(null);
    } catch {
      Alert.alert('Error', 'Could not create customer.');
    }
  };

  const isLocked = prefillMode === 'locked' && !isEditing;
  const showInputs = hideTabs || isEditing || customerMode === 'new';

  return (
    <View>
      {/* ─── Quick-entry toggle ─── */}
      {showQuickToggle && (
        <Animated.View entering={FadeIn.duration(300)} style={s.quickRow}>
          <View style={s.quickLeft}>
            <Ionicons name="flash" size={16} color={UI.status.pending} />
            <Text style={s.quickLabel}>Quick Entry</Text>
          </View>
          <Switch
            value={isQuick}
            onValueChange={handleToggleQuick}
            trackColor={{ false: UI.surface.divider, true: UI.brand.accent }}
            thumbColor={isQuick ? UI.brand.primary : '#f4f4f5'}
          />
        </Animated.View>
      )}

      {/* ─── Locked / Prefill card ─── */}
      {isLocked && value.customerName ? (
        <Animated.View entering={FadeInDown.duration(350).springify()} style={s.prefillCard}>
          <LinearGradient
            colors={UI.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={s.prefillAccent}
          />
          <View style={s.prefillBody}>
            <View style={s.prefillRow}>
              <Avatar name={value.customerName} size="md" />
              <View style={{ flex: 1 }}>
                <Text style={s.prefillName}>{value.customerName}</Text>
                {value.customerCompany ? (
                  <Text style={s.prefillCompany}>{value.customerCompany}</Text>
                ) : null}
              </View>
              <TouchableOpacity style={s.editPill} onPress={startEditing}>
                <Ionicons name="create-outline" size={15} color={UI.brand.primary} />
                <Text style={s.editPillText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      ) : null}

      {/* ─── Editing banner ─── */}
      {isEditing && (
        <Animated.View entering={FadeInDown.duration(300)} style={s.editBanner}>
          <View style={s.editBannerIcon}>
            <Ionicons name="pencil" size={16} color={UI.status.pending} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.editBannerTitle}>Editing Details</Text>
            <Text style={s.editBannerSub}>
              Update this record or save as a new customer.
            </Text>
          </View>
        </Animated.View>
      )}

      {!isLocked && (
        <>
          {/* ─── New / Existing tabs ─── */}
          {!hideTabs && !isEditing && prefillMode === 'none' && (
            <Animated.View entering={FadeInDown.delay(50).duration(350)} style={s.tabBar}>
              {(['new', 'existing'] as const).map((tab) => {
                const active = customerMode === tab;
                const label = tab === 'new' ? 'New Customer' : 'Existing';
                const icon = tab === 'new' ? 'person-add-outline' : 'people-outline';
                return (
                  <TouchableOpacity
                    key={tab}
                    activeOpacity={0.7}
                    style={[s.tab, active && s.tabActive]}
                    onPress={() => {
                      setCustomerMode(tab);
                      if (tab === 'new')
                        onChange({
                          ...EMPTY_CUSTOMER_FORM,
                          sameAsBilling: value.sameAsBilling,
                        });
                    }}
                  >
                    {active ? (
                      <LinearGradient
                        colors={UI.gradients.primary}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={s.tabGradient}
                      >
                        <Ionicons name={icon as any} size={16} color={UI.text.white} />
                        <Text style={s.tabTextActive}>{label}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={s.tabInner}>
                        <Ionicons name={icon as any} size={16} color={UI.text.muted} />
                        <Text style={s.tabText}>{label}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          )}

          {!showInputs ? (
            /* ─── EXISTING MODE PICKER ─── */
            <Animated.View
              entering={FadeInDown.delay(100).duration(350).springify()}
              style={s.card}
            >
              <Text style={s.label}>Select Customer *</Text>
              <TouchableOpacity
                style={s.pickerBtn}
                activeOpacity={0.7}
                onPress={() => setShowPicker(true)}
              >
                <View style={s.pickerLeft}>
                  <View style={s.pickerIconWrap}>
                    <Ionicons name="search" size={18} color={UI.brand.primary} />
                  </View>
                  <Text style={value.customerName ? s.pickerText : s.placeholderText}>
                    {value.customerName || 'Search customers…'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={UI.text.muted} />
              </TouchableOpacity>

              {value.customerName ? (
                <Animated.View entering={FadeIn.duration(300)} style={s.selectedCard}>
                  <View style={s.selectedRow}>
                    <Avatar name={value.customerName} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.selectedName}>{value.customerName}</Text>
                      {value.customerCompany ? (
                        <Text style={s.selectedCompany}>{value.customerCompany}</Text>
                      ) : null}
                      <Text style={s.selectedAddr}>
                        {[value.addressLine1, value.city, value.postCode]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    </View>
                  </View>
                  <View style={s.selectedActions}>
                    <TouchableOpacity style={s.actionChip} onPress={startEditing}>
                      <Ionicons name="create-outline" size={14} color={UI.brand.primary} />
                      <Text style={[s.actionChipText, { color: UI.brand.primary }]}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.actionChip}
                      onPress={() => {
                        onChange({ ...EMPTY_CUSTOMER_FORM, sameAsBilling: value.sameAsBilling });
                        setCustomerMode('new');
                      }}
                    >
                      <Ionicons name="close-circle" size={14} color={UI.brand.danger} />
                      <Text style={[s.actionChipText, { color: UI.brand.danger }]}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              ) : null}
            </Animated.View>
          ) : (
            /* ─── INPUT FIELDS ─── */
            <Animated.View
              entering={FadeInDown.delay(100).duration(350).springify()}
              style={s.card}
            >
              <CustomerAddressForm
                value={value}
                onChange={onChange}
                mode={mode}
                isQuick={isQuick}
                showActions={showActions}
                isEditing={isEditing}
                hasChanged={hasChanged}
                customerMode={customerMode}
                onCancel={cancelEditing}
                onDone={() => setIsEditing(false)}
                onUpdateExisting={handleUpdateExisting}
                onCreateNew={handleCreateCustomerInDB}
              />
            </Animated.View>
          )}
        </>
      )}

      {/* ─── JOB / SITE ADDRESS ─── */}
      {showJobAddress && !isQuick && !isLocked && !isEditing && (
        <Animated.View
          entering={FadeInDown.delay(150).duration(350).springify()}
          style={s.jobCard}
        >
          <LinearGradient
            colors={UI.gradients.blueLight}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={s.jobAccent}
          />
          <View style={s.jobBody}>
            <View style={s.jobHeaderRow}>
              <View style={s.jobLabelRow}>
                <Ionicons name="location" size={16} color={UI.status.inProgress} />
                <Text style={s.jobLabel}>Job / Site Address</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 12, color: UI.text.muted }}>Same</Text>
                <Switch
                  value={value.sameAsBilling}
                  onValueChange={(val) => update('sameAsBilling', val)}
                  trackColor={{ false: UI.surface.divider, true: UI.brand.accent }}
                  thumbColor={value.sameAsBilling ? UI.brand.primary : '#f4f4f5'}
                />
              </View>
            </View>
            {!value.sameAsBilling && (
              <Animated.View entering={FadeInDown.duration(250)}>
                <Input placeholder="Site Address Line 1" value={value.jobAddressLine1} onChangeText={(t) => update('jobAddressLine1', t)} />
                <Input placeholder="Site Address Line 2" value={value.jobAddressLine2} onChangeText={(t) => update('jobAddressLine2', t)} />
                <View style={s.row}>
                  <Input placeholder="City" value={value.jobCity} onChangeText={(t) => update('jobCity', t)} containerStyle={s.flex} />
                  <Input placeholder="Postcode" value={value.jobPostCode} onChangeText={(t) => update('jobPostCode', t)} autoCapitalize="characters" containerStyle={s.flex} />
                </View>
                <View style={s.row}>
                  <Input placeholder="Site Contact Name (optional)" value={value.siteContactName} onChangeText={(t) => update('siteContactName', t)} containerStyle={s.flex} />
                  <Input placeholder="Site Contact Email (optional)" value={value.siteContactEmail} onChangeText={(t) => update('siteContactEmail', t)} keyboardType="email-address" autoCapitalize="none" containerStyle={s.flex} />
                </View>
              </Animated.View>
            )}
          </View>
        </Animated.View>
      )}

      {/* ─── CUSTOMER PICKER MODAL ─── */}
      <CustomerPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        customers={filteredCustomers}
        search={search}
        onSearch={setSearch}
        onSelect={handleSelectCustomer}
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Quick toggle
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  quickLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickLabel: { fontSize: 13, fontWeight: '600', color: UI.text.muted },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(241,245,249,0.8)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tab: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  tabActive: {},
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
  },
  tabText: { fontWeight: '600', color: UI.text.muted, fontSize: 14 },
  tabTextActive: { fontWeight: '700', color: UI.text.white, fontSize: 14 },

  // Glass card
  card: {
    backgroundColor: UI.glass.bg,
    borderWidth: 1,
    borderColor: UI.glass.border,
    padding: 16,
    borderRadius: 18,
    shadowColor: UI.text.muted,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 12,
  },

  // Label (used above picker button)
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: UI.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  // Picker button
  pickerBtn: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(248,250,252,0.8)' : UI.surface.base,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.surface.divider,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  pickerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(99,102,241,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerText: { fontSize: 16, color: UI.text.title, fontWeight: '600' },
  placeholderText: { fontSize: 16, color: UI.text.muted },

  // Selected customer card
  selectedCard: {
    marginTop: 14,
    padding: 14,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(248,250,252,0.7)' : UI.surface.base,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: UI.surface.divider,
  },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectedName: { fontSize: 16, fontWeight: '700', color: UI.text.title },
  selectedCompany: { fontSize: 13, color: UI.brand.primary, fontWeight: '500', marginTop: 1 },
  selectedAddr: { fontSize: 13, color: UI.text.muted, marginTop: 2 },
  selectedActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: UI.surface.elevated,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(99,102,241,0.06)',
  },
  actionChipText: { fontSize: 13, fontWeight: '600' },

  // Prefill locked card
  prefillCard: {
    backgroundColor: UI.glass.bg,
    borderWidth: 1,
    borderColor: UI.glass.border,
    borderRadius: 18,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: UI.text.muted,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  prefillAccent: { width: 4 },
  prefillBody: { flex: 1, padding: 14 },
  prefillRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prefillName: { fontSize: 16, fontWeight: '700', color: UI.text.title },
  prefillCompany: { fontSize: 13, color: UI.brand.primary, fontWeight: '500', marginTop: 1 },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99,102,241,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  editPillText: { fontSize: 13, fontWeight: '600', color: UI.brand.primary },

  // Editing banner
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  editBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBannerTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  editBannerSub: { fontSize: 12, color: '#B45309', marginTop: 1 },

  // Job address card
  jobCard: {
    backgroundColor: UI.glass.bg,
    borderWidth: 1,
    borderColor: UI.glass.border,
    borderRadius: 18,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: UI.text.muted,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  jobAccent: { width: 4 },
  jobBody: { flex: 1, padding: 14 },
  jobHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  jobLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  jobLabel: { fontSize: 13, fontWeight: '700', color: UI.status.inProgress },

  // Layout helpers
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
