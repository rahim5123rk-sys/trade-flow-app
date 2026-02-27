// ============================================
// FILE: components/CustomerSelector.tsx
// Shared customer selection/creation component
// ============================================

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { supabase } from '../src/config/supabase';
import { useAuth } from '../src/context/AuthContext';
import { Customer } from '../src/types';

// ─── Design tokens ──────────────────────────────────────────────────

const GLASS_BG =
  Platform.OS === 'ios' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.88)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

// ─── Types ──────────────────────────────────────────────────────────

export interface CustomerFormData {
  customerId: string | null;
  customerName: string;
  customerCompany: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postCode: string;
  phone: string;
  email: string;
  sameAsBilling: boolean;
  jobAddressLine1: string;
  jobAddressLine2: string;
  jobCity: string;
  jobPostCode: string;
  siteContactName: string;
  siteContactEmail: string;
}

export const EMPTY_CUSTOMER_FORM: CustomerFormData = {
  customerId: null,
  customerName: '',
  customerCompany: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  region: '',
  postCode: '',
  phone: '',
  email: '',
  sameAsBilling: true,
  jobAddressLine1: '',
  jobAddressLine2: '',
  jobCity: '',
  jobPostCode: '',
  siteContactName: '',
  siteContactEmail: '',
};

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

// ─── Helpers ────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
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

  const [customerMode, setCustomerMode] = useState<'new' | 'existing'>(
    value.customerId ? 'existing' : 'new',
  );
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isQuick, setIsQuick] = useState(quickEntry);

  const [isEditing, setIsEditing] = useState(false);
  const [originalData, setOriginalData] = useState<CustomerFormData | null>(
    null,
  );

  useEffect(() => {
    if (value.customerId) setCustomerMode('existing');
    else setCustomerMode('new');
  }, [value.customerId]);

  useEffect(() => {
    fetchCustomers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.company_id]);

  const fetchCustomers = async () => {
    if (!userProfile?.company_id) return;
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .order('name', { ascending: true });
    if (data) setExistingCustomers(data as Customer[]);
  };

  const update = (field: keyof CustomerFormData, val: any) => {
    onChange({ ...value, [field]: val });
  };

  const handleSelectCustomer = (cust: Customer) => {
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

  const filteredCustomers = existingCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchText.toLowerCase()) ||
      c.address.toLowerCase().includes(searchText.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchText.toLowerCase()) ||
      c.phone?.includes(searchText),
  );

  const isLocked = prefillMode === 'locked' && !isEditing;
  const showInputs = hideTabs || isEditing || customerMode === 'new';

  // ──────────────────────────────────────────────────────────────────
  // Renders
  // ──────────────────────────────────────────────────────────────────

  const renderLabel = (text: string) => (
    <Text style={s.label}>{text}</Text>
  );

  const renderInput = (
    placeholder: string,
    fieldValue: string,
    field: keyof CustomerFormData,
    opts?: { keyboard?: 'phone-pad' | 'email-address'; autoCapitalize?: 'none' | 'characters' },
  ) => (
    <View style={s.inputWrap}>
      <TextInput
        style={s.input}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        value={fieldValue}
        onChangeText={(t) => update(field, t)}
        keyboardType={opts?.keyboard}
        autoCapitalize={opts?.autoCapitalize}
      />
    </View>
  );

  // ─── Avatar bubble ──────────────────────────────────────────────
  const renderAvatar = (name: string, size: number = 44) => (
    <LinearGradient
      colors={['#6366F1', '#818CF8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[s.avatarText, { fontSize: size * 0.36 }]}>
        {getInitials(name || '?')}
      </Text>
    </LinearGradient>
  );

  return (
    <View>
      {/* ─── Quick-entry toggle ─── */}
      {showQuickToggle && (
        <Animated.View entering={FadeIn.duration(300)} style={s.quickRow}>
          <View style={s.quickLeft}>
            <Ionicons name="flash" size={16} color="#F59E0B" />
            <Text style={s.quickLabel}>Quick Entry</Text>
          </View>
          <Switch
            value={isQuick}
            onValueChange={handleToggleQuick}
            trackColor={{ false: '#e2e8f0', true: '#818CF8' }}
            thumbColor={isQuick ? '#6366F1' : '#f4f4f5'}
          />
        </Animated.View>
      )}

      {/* ─── Locked / Prefill card ─── */}
      {isLocked && value.customerName ? (
        <Animated.View entering={FadeInDown.duration(350).springify()} style={s.prefillCard}>
          <LinearGradient
            colors={['#6366F1', '#818CF8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={s.prefillAccent}
          />
          <View style={s.prefillBody}>
            <View style={s.prefillRow}>
              {renderAvatar(value.customerName, 42)}
              <View style={{ flex: 1 }}>
                <Text style={s.prefillName}>{value.customerName}</Text>
                {value.customerCompany ? (
                  <Text style={s.prefillCompany}>{value.customerCompany}</Text>
                ) : null}
              </View>
              <TouchableOpacity style={s.editPill} onPress={startEditing}>
                <Ionicons name="create-outline" size={15} color="#6366F1" />
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
            <Ionicons name="pencil" size={16} color="#F59E0B" />
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
                        colors={['#6366F1', '#818CF8']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={s.tabGradient}
                      >
                        <Ionicons name={icon as any} size={16} color="#fff" />
                        <Text style={s.tabTextActive}>{label}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={s.tabInner}>
                        <Ionicons name={icon as any} size={16} color="#94a3b8" />
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
              {renderLabel('Select Customer *')}
              <TouchableOpacity
                style={s.pickerBtn}
                activeOpacity={0.7}
                onPress={() => setShowPicker(true)}
              >
                <View style={s.pickerLeft}>
                  <View style={s.pickerIconWrap}>
                    <Ionicons name="search" size={18} color="#6366F1" />
                  </View>
                  <Text
                    style={
                      value.customerName ? s.pickerText : s.placeholderText
                    }
                  >
                    {value.customerName || 'Search customers…'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color="#94a3b8" />
              </TouchableOpacity>

              {value.customerName ? (
                <Animated.View
                  entering={FadeIn.duration(300)}
                  style={s.selectedCard}
                >
                  <View style={s.selectedRow}>
                    {renderAvatar(value.customerName, 40)}
                    <View style={{ flex: 1 }}>
                      <Text style={s.selectedName}>{value.customerName}</Text>
                      {value.customerCompany ? (
                        <Text style={s.selectedCompany}>
                          {value.customerCompany}
                        </Text>
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
                      <Ionicons name="create-outline" size={14} color="#6366F1" />
                      <Text style={[s.actionChipText, { color: '#6366F1' }]}>
                        Edit
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.actionChip}
                      onPress={() => {
                        onChange({
                          ...EMPTY_CUSTOMER_FORM,
                          sameAsBilling: value.sameAsBilling,
                        });
                        setCustomerMode('new');
                      }}
                    >
                      <Ionicons
                        name="close-circle"
                        size={14}
                        color="#EF4444"
                      />
                      <Text style={[s.actionChipText, { color: '#EF4444' }]}>
                        Clear
                      </Text>
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
              {renderLabel('Contact Name *')}
              {renderInput('e.g. Sarah Jenkins', value.customerName, 'customerName')}

              {isQuick ? (
                <>
                  {renderLabel('Address / Location (Optional)')}
                  {renderInput(
                    'e.g. 12 High St, WR1',
                    value.addressLine1,
                    'addressLine1',
                  )}
                </>
              ) : (
                <>
                  {renderLabel('Company Name')}
                  {renderInput(
                    'e.g. Jenkins Plumbing Ltd',
                    value.customerCompany,
                    'customerCompany',
                  )}

                  {renderLabel('Address Line 1 *')}
                  {renderInput(
                    'Street address',
                    value.addressLine1,
                    'addressLine1',
                  )}

                  {renderLabel('Address Line 2')}
                  {renderInput(
                    'Apt / Suite / Unit',
                    value.addressLine2,
                    'addressLine2',
                  )}

                  <View style={s.row}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      {renderLabel('City')}
                      {renderInput('Worcester', value.city, 'city')}
                    </View>
                    <View style={{ flex: 1 }}>
                      {renderLabel('Post Code *')}
                      {renderInput('WR1 1PA', value.postCode, 'postCode', {
                        autoCapitalize: 'characters',
                      })}
                    </View>
                  </View>

                  {mode === 'full' && (
                    <>
                      {renderLabel('Region / County')}
                      {renderInput(
                        'Worcestershire',
                        value.region,
                        'region',
                      )}
                    </>
                  )}
                </>
              )}

              <View style={s.row}>
                <View style={{ flex: 1, marginRight: isQuick ? 0 : 8 }}>
                  {renderLabel('Phone')}
                  {renderInput('07700…', value.phone, 'phone', {
                    keyboard: 'phone-pad',
                  })}
                </View>
                {!isQuick && (
                  <View style={{ flex: 1 }}>
                    {renderLabel('Email')}
                    {renderInput('email@…', value.email, 'email', {
                      keyboard: 'email-address',
                      autoCapitalize: 'none',
                    })}
                  </View>
                )}
              </View>

              {/* ACTION BUTTONS */}
              {showActions && isEditing && (
                <Animated.View entering={FadeInUp.delay(100).duration(300)} style={{ marginTop: 10 }}>
                  {!hasChanged ? (
                    <View style={s.editActions}>
                      <TouchableOpacity style={s.cancelBtn} onPress={cancelEditing}>
                        <Text style={s.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.gradientBtnWrap}
                        activeOpacity={0.8}
                        onPress={() => setIsEditing(false)}
                      >
                        <LinearGradient
                          colors={['#6366F1', '#818CF8']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={s.gradientBtn}
                        >
                          <Ionicons name="checkmark" size={18} color="#fff" />
                          <Text style={s.gradientBtnText}>Done</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity style={s.cancelBtn} onPress={cancelEditing}>
                          <Text style={s.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.gradientBtnWrap}
                          activeOpacity={0.8}
                          onPress={handleUpdateExisting}
                        >
                          <LinearGradient
                            colors={['#6366F1', '#818CF8']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={s.gradientBtn}
                          >
                            <Ionicons name="sync" size={18} color="#fff" />
                            <Text style={s.gradientBtnText}>Update Existing</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={s.gradientBtnWrap}
                        activeOpacity={0.8}
                        onPress={handleCreateCustomerInDB}
                      >
                        <LinearGradient
                          colors={['#10B981', '#34D399']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[s.gradientBtn, { paddingVertical: 14 }]}
                        >
                          <Ionicons name="add-circle-outline" size={20} color="#fff" />
                          <Text style={s.gradientBtnText}>Save as New Customer</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  )}
                </Animated.View>
              )}

              {showActions &&
                !isEditing &&
                customerMode === 'new' &&
                value.customerName.length > 0 && (
                  <Animated.View entering={FadeInUp.delay(150).duration(300)}>
                    <TouchableOpacity
                      style={s.gradientBtnWrap}
                      activeOpacity={0.8}
                      onPress={handleCreateCustomerInDB}
                    >
                      <LinearGradient
                        colors={['#10B981', '#34D399']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[s.gradientBtn, { marginTop: 6 }]}
                      >
                        <Ionicons name="save-outline" size={20} color="#fff" />
                        <Text style={s.gradientBtnText}>
                          Save Customer to Database
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                )}
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
            colors={['#3B82F6', '#60A5FA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={s.jobAccent}
          />
          <View style={s.jobBody}>
            <View style={[s.row, { alignItems: 'center', marginBottom: 10 }]}>
              <View style={s.jobLabelRow}>
                <Ionicons name="location" size={16} color="#3B82F6" />
                <Text style={s.jobLabel}>Job / Site Address</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 12, color: '#94a3b8' }}>Same</Text>
                <Switch
                  value={value.sameAsBilling}
                  onValueChange={(val) => update('sameAsBilling', val)}
                  trackColor={{ false: '#e2e8f0', true: '#818CF8' }}
                  thumbColor={value.sameAsBilling ? '#6366F1' : '#f4f4f5'}
                />
              </View>
            </View>
            {!value.sameAsBilling && (
              <Animated.View entering={FadeInDown.duration(250)}>
                {renderInput('Site Address Line 1', value.jobAddressLine1, 'jobAddressLine1')}
                {renderInput('Site Address Line 2', value.jobAddressLine2, 'jobAddressLine2')}
                <View style={s.row}>
                  <View style={{ flex: 1, marginRight: 5 }}>
                    {renderInput('City', value.jobCity, 'jobCity')}
                  </View>
                  <View style={{ flex: 1 }}>
                    {renderInput('Postcode', value.jobPostCode, 'jobPostCode', {
                      autoCapitalize: 'characters',
                    })}
                  </View>
                </View>
                <View style={s.row}>
                  <View style={{ flex: 1, marginRight: 5 }}>
                    {renderInput('Site Contact Name (optional)', value.siteContactName, 'siteContactName')}
                  </View>
                  <View style={{ flex: 1 }}>
                    {renderInput('Site Contact Email (optional)', value.siteContactEmail, 'siteContactEmail', {
                      keyboard: 'email-address',
                      autoCapitalize: 'none',
                    })}
                  </View>
                </View>
              </Animated.View>
            )}
          </View>
        </Animated.View>
      )}

      {/* ─── CUSTOMER PICKER MODAL ─── */}
      <Modal visible={showPicker} animationType="slide" transparent>
        <View style={s.overlay}>
          <Animated.View
            entering={FadeInDown.duration(350).springify()}
            style={s.modal}
          >
            {/* Header */}
            <View style={s.modalHeader}>
              <View style={s.modalTitleRow}>
                <LinearGradient
                  colors={['#6366F1', '#818CF8']}
                  style={s.modalTitleIcon}
                >
                  <Ionicons name="people" size={18} color="#fff" />
                </LinearGradient>
                <Text style={s.modalTitle}>Select Customer</Text>
              </View>
              <TouchableOpacity
                style={s.modalClose}
                onPress={() => setShowPicker(false)}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={s.modalSearch}>
              <Ionicons name="search" size={18} color="#94a3b8" />
              <TextInput
                style={s.modalSearchInput}
                placeholder="Search by name, address, email…"
                placeholderTextColor="#94a3b8"
                value={searchText}
                onChangeText={setSearchText}
                autoFocus
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <Ionicons name="close-circle" size={18} color="#cbd5e1" />
                </TouchableOpacity>
              )}
            </View>

            {/* Count */}
            <Text style={s.modalCount}>
              {filteredCustomers.length} customer
              {filteredCustomers.length !== 1 ? 's' : ''}
              {searchText ? ' found' : ''}
            </Text>

            {/* List */}
            <FlatList
              data={filteredCustomers}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
              ListEmptyComponent={
                <View style={s.emptyList}>
                  <Ionicons name="search-outline" size={40} color="#cbd5e1" />
                  <Text style={s.emptyText}>No customers found</Text>
                  <Text style={s.emptySubText}>
                    Try a different search term
                  </Text>
                </View>
              }
              renderItem={({ item, index }) => (
                <Animated.View entering={FadeInDown.delay(index * 40).duration(250)}>
                  <TouchableOpacity
                    style={s.customerRow}
                    activeOpacity={0.6}
                    onPress={() => handleSelectCustomer(item)}
                  >
                    {renderAvatar(item.name, 40)}
                    <View style={{ flex: 1 }}>
                      <Text style={s.customerName}>{item.name}</Text>
                      {item.company_name ? (
                        <Text style={s.customerCompany}>
                          {item.company_name}
                        </Text>
                      ) : null}
                      <Text style={s.customerAddr} numberOfLines={1}>
                        {item.address}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                  </TouchableOpacity>
                </Animated.View>
              )}
            />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Exported helpers (unchanged logic) ─────────────────────────────

export function buildCustomerSnapshot(form: CustomerFormData) {
  const activeAddressLine1 = form.sameAsBilling
    ? form.addressLine1
    : form.jobAddressLine1 || form.addressLine1;
  const activeAddressLine2 = form.sameAsBilling
    ? form.addressLine2
    : form.jobAddressLine2 || '';
  const activeCity = form.sameAsBilling ? form.city : form.jobCity || form.city;
  const activePostCode = form.sameAsBilling
    ? form.postCode
    : form.jobPostCode || form.postCode;

  const combinedAddress = [
    activeAddressLine1,
    activeAddressLine2,
    activeCity,
    form.region,
    activePostCode,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    name: form.customerName.trim(),
    company_name: form.customerCompany.trim(),
    address_line_1: activeAddressLine1.trim(),
    address_line_2: activeAddressLine2.trim(),
    city: activeCity.trim(),
    region: form.region.trim(),
    postal_code: activePostCode.trim().toUpperCase(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    site_contact_name: form.sameAsBilling ? '' : form.siteContactName.trim(),
    site_contact_email: form.sameAsBilling ? '' : form.siteContactEmail.trim(),
    billing_address_line_1: form.addressLine1.trim(),
    billing_address_line_2: form.addressLine2.trim(),
    billing_city: form.city.trim(),
    billing_postal_code: form.postCode.trim().toUpperCase(),
    address: combinedAddress || 'No address provided',
  };
}

export function buildCustomerInsert(
  form: CustomerFormData,
  companyId: string,
) {
  const snapshot = buildCustomerSnapshot(form);
  return {
    company_id: companyId,
    name: snapshot.name,
    company_name: snapshot.company_name || null,
    address_line_1: snapshot.address_line_1,
    address_line_2: snapshot.address_line_2 || null,
    city: snapshot.city || null,
    region: snapshot.region || null,
    postal_code: snapshot.postal_code,
    address: snapshot.address,
    phone: snapshot.phone || null,
    email: snapshot.email || null,
  };
}

export function getJobAddress(form: CustomerFormData) {
  if (form.sameAsBilling) {
    return {
      jobAddress1: form.addressLine1,
      jobAddress2: form.addressLine2,
      jobCity: form.city,
      jobPostcode: form.postCode,
    };
  }
  return {
    jobAddress1: form.jobAddressLine1,
    jobAddress2: form.jobAddressLine2,
    jobCity: form.jobCity,
    jobPostcode: form.jobPostCode,
  };
}

export function prefillFromJob(job: any): CustomerFormData {
  const snap = job.customer_snapshot || {};
  return {
    customerId: job.customer_id || null,
    customerName: snap.name || '',
    customerCompany: snap.company_name || '',
    addressLine1: snap.address_line_1 || '',
    addressLine2: snap.address_line_2 || '',
    city: snap.city || '',
    region: snap.region || '',
    postCode: snap.postal_code || '',
    phone: snap.phone || '',
    email: snap.email || '',
    sameAsBilling: true,
    jobAddressLine1: snap.address_line_1 || '',
    jobAddressLine2: snap.address_line_2 || '',
    jobCity: snap.city || '',
    jobPostCode: snap.postal_code || '',
    siteContactName: snap.site_contact_name || '',
    siteContactEmail: snap.site_contact_email || '',
  };
}

export async function updateExistingCustomer(
  customerId: string,
  form: CustomerFormData,
) {
  const snapshot = buildCustomerSnapshot(form);
  const { error } = await supabase
    .from('customers')
    .update({
      name: snapshot.name,
      company_name: snapshot.company_name || null,
      address_line_1: snapshot.address_line_1,
      address_line_2: snapshot.address_line_2 || null,
      city: snapshot.city || null,
      region: snapshot.region || null,
      postal_code: snapshot.postal_code,
      address: snapshot.address,
      phone: snapshot.phone || null,
      email: snapshot.email || null,
    })
    .eq('id', customerId);
  if (error) throw error;
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
  quickLabel: { fontSize: 13, fontWeight: '600', color: '#64748b' },

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
  tabText: { fontWeight: '600', color: '#94a3b8', fontSize: 14 },
  tabTextActive: { fontWeight: '700', color: '#fff', fontSize: 14 },

  // Glass card
  card: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    borderRadius: 18,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 12,
  },

  // Labels & inputs
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputWrap: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(248,250,252,0.8)' : '#f8fafc',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 16,
    color: '#0f172a',
  },
  row: { flexDirection: 'row' },

  // Picker button
  pickerBtn: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(248,250,252,0.8)' : '#f8fafc',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
  pickerText: { fontSize: 16, color: '#0f172a', fontWeight: '600' },
  placeholderText: { fontSize: 16, color: '#94a3b8' },

  // Selected customer card
  selectedCard: {
    marginTop: 14,
    padding: 14,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(248,250,252,0.7)' : '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectedName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  selectedCompany: { fontSize: 13, color: '#6366F1', fontWeight: '500', marginTop: 1 },
  selectedAddr: { fontSize: 13, color: '#64748b', marginTop: 2 },
  selectedActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
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
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 18,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  prefillAccent: { width: 4 },
  prefillBody: { flex: 1, padding: 14 },
  prefillRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prefillName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  prefillCompany: { fontSize: 13, color: '#6366F1', fontWeight: '500', marginTop: 1 },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99,102,241,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  editPillText: { fontSize: 13, fontWeight: '600', color: '#6366F1' },

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

  // Action buttons
  editActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontWeight: '600', color: '#64748b', fontSize: 15 },
  gradientBtnWrap: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  gradientBtnText: { fontWeight: '700', color: '#fff', fontSize: 15 },

  // Job address card
  jobCard: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 18,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  jobAccent: { width: 4 },
  jobBody: { flex: 1, padding: 14 },
  jobLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  jobLabel: { fontSize: 13, fontWeight: '700', color: '#3B82F6' },

  // Avatar
  avatar: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal search
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  modalCount: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 8,
    paddingLeft: 4,
  },

  // Customer list item
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  customerName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  customerCompany: { fontSize: 12, color: '#6366F1', fontWeight: '500', marginTop: 1 },
  customerAddr: { fontSize: 13, color: '#94a3b8', marginTop: 2 },

  // Empty list
  emptyList: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#94a3b8' },
  emptySubText: { fontSize: 13, color: '#cbd5e1' },
});
