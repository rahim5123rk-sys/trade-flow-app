// ============================================
// FILE: components/CustomerSelector.tsx
// Shared customer selection/creation component
// ============================================

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors } from '../constants/theme';
import { supabase } from '../src/config/supabase';
import { useAuth } from '../src/context/AuthContext';
import { Customer } from '../src/types';

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
  jobCity: string;
  jobPostCode: string;
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
  jobCity: '',
  jobPostCode: '',
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
  // NEW PROPS FOR STANDALONE EDITING
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
  hideTabs = false,    // Default to showing tabs
  showActions = true,  // Default to showing internal "Done" buttons
}: CustomerSelectorProps) {
  const { userProfile } = useAuth();

  const [customerMode, setCustomerMode] = useState<'new' | 'existing'>(
    value.customerId ? 'existing' : 'new'
  );
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isQuick, setIsQuick] = useState(quickEntry);

  const [isEditing, setIsEditing] = useState(false);
  const [originalData, setOriginalData] = useState<CustomerFormData | null>(null);

  useEffect(() => {
    if (value.customerId) {
      setCustomerMode('existing');
    } else {
      setCustomerMode('new');
    }
  }, [value.customerId]);

  useEffect(() => { fetchCustomers(); }, [userProfile?.company_id]);

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

  const hasChanged = originalData ? (
    value.customerName !== originalData.customerName ||
    value.customerCompany !== originalData.customerCompany ||
    value.addressLine1 !== originalData.addressLine1 ||
    value.addressLine2 !== originalData.addressLine2 ||
    value.city !== originalData.city ||
    value.region !== originalData.region ||
    value.postCode !== originalData.postCode ||
    value.phone !== originalData.phone ||
    value.email !== originalData.email
  ) : false;

  const handleUpdateExisting = async () => {
    try {
      await updateExistingCustomer(value.customerId!, value);
      await fetchCustomers();
      Alert.alert('Success', 'Customer details updated permanently.');
      setIsEditing(false);
      setOriginalData(null);
    } catch (e) {
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
    } catch (e) {
      Alert.alert('Error', 'Could not create customer.');
    }
  };

  const filteredCustomers = existingCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchText.toLowerCase()) ||
      c.address.toLowerCase().includes(searchText.toLowerCase())
  );

  const isLocked = prefillMode === 'locked' && !isEditing;

  // Logic to determine if we show inputs or the picker
  const showInputs = hideTabs || isEditing || customerMode === 'new';

  return (
    <View>
      {showQuickToggle && (
        <View style={styles.quickToggleRow}>
          <Text style={styles.quickLabel}>Quick Entry</Text>
          <Switch value={isQuick} onValueChange={handleToggleQuick} trackColor={{ false: '#e2e8f0', true: Colors.primary }} />
        </View>
      )}

      {isLocked && value.customerName ? (
        <View style={styles.prefillCard}>
          <View style={styles.prefillHeader}>
            <View style={styles.prefillIconBox}>
              <Ionicons name="person-circle" size={28} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefillName}>{value.customerName}</Text>
              {value.customerCompany ? <Text style={styles.prefillCompany}>{value.customerCompany}</Text> : null}
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={startEditing}>
              <Ionicons name="create-outline" size={18} color={Colors.primary} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {isEditing && (
        <View style={styles.editingBanner}>
          <Text style={styles.editingTitle}>Editing Details</Text>
          <Text style={styles.editingSub}>Update this record or split it into a new customer.</Text>
        </View>
      )}

      {(!isLocked) && (
        <>
          {/* Tabs - Only show if not hidden and not currently in mid-edit */}
          {!hideTabs && !isEditing && prefillMode === 'none' && (
            <View style={styles.tabContainer}>
              <TouchableOpacity style={[styles.tab, customerMode === 'new' && styles.activeTab]} onPress={() => { setCustomerMode('new'); onChange({ ...EMPTY_CUSTOMER_FORM, sameAsBilling: value.sameAsBilling }); }}>
                <Text style={[styles.tabText, customerMode === 'new' && styles.activeTabText]}>New Customer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, customerMode === 'existing' && styles.activeTab]} onPress={() => setCustomerMode('existing')}>
                <Text style={[styles.tabText, customerMode === 'existing' && styles.activeTabText]}>Existing</Text>
              </TouchableOpacity>
            </View>
          )}

          {!showInputs ? (
            /* EXISTING mode picker */
            <View style={styles.card}>
              <Text style={styles.label}>Select Customer *</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowPicker(true)}>
                <Text style={value.customerName ? styles.pickerText : styles.placeholderText}>{value.customerName || 'Tap to search...'}</Text>
                <Ionicons name="chevron-down" size={20} color="#94a3b8" />
              </TouchableOpacity>
              {value.customerName && (
                <View style={styles.selectedInfo}>
                  <Text style={styles.selectedName}>{value.customerName}</Text>
                  {value.customerCompany && <Text style={styles.selectedDetail}>{value.customerCompany}</Text>}
                  <Text style={styles.selectedDetail}>{[value.addressLine1, value.city, value.postCode].filter(Boolean).join(', ')}</Text>
                  
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                    <TouchableOpacity style={styles.editSelectedBtn} onPress={startEditing}>
                      <Ionicons name="create-outline" size={14} color={Colors.primary} />
                      <Text style={styles.editSelectedText}>Edit Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.clearBtn} onPress={() => { onChange({ ...EMPTY_CUSTOMER_FORM, sameAsBilling: value.sameAsBilling }); setCustomerMode('new'); }}>
                      <Ionicons name="close-circle" size={14} color={Colors.danger} />
                      <Text style={styles.clearText}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ) : (
            /* Input fields (Standalone Edit or New Mode) */
            <View style={styles.card}>
              <Text style={styles.label}>Contact Name *</Text>
              <TextInput style={styles.input} placeholder="e.g. Sarah Jenkins" placeholderTextColor="#94a3b8" value={value.customerName} onChangeText={(t) => update('customerName', t)} />

              {isQuick ? (
                <>
                  <Text style={styles.label}>Address / Location (Optional)</Text>
                  <TextInput style={styles.input} placeholder="e.g. 12 High St, WR1" placeholderTextColor="#94a3b8" value={value.addressLine1} onChangeText={(t) => update('addressLine1', t)} />
                </>
              ) : (
                <>
                  <Text style={styles.label}>Company Name</Text>
                  <TextInput style={styles.input} placeholder="e.g. Jenkins Plumbing Ltd" placeholderTextColor="#94a3b8" value={value.customerCompany} onChangeText={(t) => update('customerCompany', t)} />

                  <Text style={styles.label}>Address Line 1 *</Text>
                  <TextInput style={styles.input} placeholder="Street address" placeholderTextColor="#94a3b8" value={value.addressLine1} onChangeText={(t) => update('addressLine1', t)} />

                  {mode === 'full' && (
                    <>
                      <Text style={styles.label}>Address Line 2</Text>
                      <TextInput style={styles.input} placeholder="Apt / Suite / Unit" placeholderTextColor="#94a3b8" value={value.addressLine2} onChangeText={(t) => update('addressLine2', t)} />
                    </>
                  )}

                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.label}>City</Text>
                      <TextInput style={styles.input} placeholder="Worcester" placeholderTextColor="#94a3b8" value={value.city} onChangeText={(t) => update('city', t)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Post Code *</Text>
                      <TextInput style={styles.input} placeholder="WR1 1PA" placeholderTextColor="#94a3b8" autoCapitalize="characters" value={value.postCode} onChangeText={(t) => update('postCode', t)} />
                    </View>
                  </View>

                  {mode === 'full' && (
                    <>
                      <Text style={styles.label}>Region / County</Text>
                      <TextInput style={styles.input} placeholder="Worcestershire" placeholderTextColor="#94a3b8" value={value.region} onChangeText={(t) => update('region', t)} />
                    </>
                  )}
                </>
              )}

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Phone</Text>
                  <TextInput style={styles.input} placeholder="07700..." placeholderTextColor="#94a3b8" keyboardType="phone-pad" value={value.phone} onChangeText={(t) => update('phone', t)} />
                </View>
                {!isQuick && (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput style={styles.input} placeholder="email@..." placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" value={value.email} onChangeText={(t) => update('email', t)} />
                  </View>
                )}
              </View>

              {/* ACTION BUTTONS (Only if showActions is true) */}
              {showActions && isEditing && (
                <View style={{ marginTop: 10 }}>
                  {!hasChanged ? (
                    <View style={styles.editActions}>
                      <TouchableOpacity style={styles.cancelEditBtn} onPress={cancelEditing}>
                        <Text style={styles.cancelEditText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.confirmEditBtn} onPress={() => setIsEditing(false)}>
                        <Ionicons name="checkmark" size={18} color="#fff" />
                        <Text style={styles.confirmEditText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity style={styles.cancelEditBtn} onPress={cancelEditing}>
                          <Text style={styles.cancelEditText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.confirmEditBtn, { backgroundColor: Colors.primary }]} onPress={handleUpdateExisting}>
                          <Ionicons name="sync" size={18} color="#fff" />
                          <Text style={styles.confirmEditText}>Update Existing</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity style={[styles.confirmEditBtn, { backgroundColor: Colors.success, paddingVertical: 14 }]} onPress={handleCreateCustomerInDB}>
                        <Ionicons name="add-circle-outline" size={20} color="#fff" />
                        <Text style={styles.confirmEditText}>Save as New Customer</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {showActions && !isEditing && customerMode === 'new' && value.customerName.length > 0 && (
                <TouchableOpacity 
                  style={[styles.confirmEditBtn, { backgroundColor: Colors.success, marginTop: 16 }]} 
                  onPress={handleCreateCustomerInDB}
                >
                  <Ionicons name="save-outline" size={20} color="#fff" />
                  <Text style={styles.confirmEditText}>Save Customer to Database</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      )}

      {/* ─── JOB / SITE ADDRESS ─── */}
      {showJobAddress && !isQuick && !isLocked && !isEditing && (
        <View style={styles.jobAddressCard}>
          <View style={[styles.row, { alignItems: 'center', marginBottom: 10 }]}>
            <Text style={styles.jobAddressLabel}>Job / Site Address</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 12, color: Colors.textLight }}>Same as billing</Text>
              <Switch value={value.sameAsBilling} onValueChange={(val) => update('sameAsBilling', val)} trackColor={{ false: '#e2e8f0', true: Colors.primary }} />
            </View>
          </View>
          {!value.sameAsBilling && (
            <>
              <TextInput style={styles.input} placeholder="Site Address Line 1" placeholderTextColor="#94a3b8" value={value.jobAddressLine1} onChangeText={(t) => update('jobAddressLine1', t)} />
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1, marginRight: 5 }]} placeholder="City" placeholderTextColor="#94a3b8" value={value.jobCity} onChangeText={(t) => update('jobCity', t)} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Postcode" placeholderTextColor="#94a3b8" autoCapitalize="characters" value={value.jobPostCode} onChangeText={(t) => update('jobPostCode', t)} />
              </View>
            </>
          )}
        </View>
      )}

      {/* ─── CUSTOMER PICKER MODAL ─── */}
      <Modal visible={showPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}><Ionicons name="close" size={24} /></TouchableOpacity>
            </View>
            <View style={styles.modalSearchBox}>
              <Ionicons name="search" size={18} color={Colors.textLight} />
              <TextInput style={styles.modalSearchInput} placeholder="Search..." placeholderTextColor="#94a3b8" value={searchText} onChangeText={setSearchText} />
            </View>
            <FlatList
              data={filteredCustomers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.customerItem} onPress={() => handleSelectCustomer(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName}>{item.name}</Text>
                    <Text style={styles.customerAddr}>{item.address}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

export function buildCustomerSnapshot(form: CustomerFormData) {
  const combinedAddress = [form.addressLine1, form.addressLine2, form.city, form.region, form.postCode].filter(Boolean).join(', ');
  return {
    name: form.customerName.trim(),
    company_name: form.customerCompany.trim(),
    address_line_1: form.addressLine1.trim(),
    address_line_2: form.addressLine2.trim(),
    city: form.city.trim(),
    region: form.region.trim(),
    postal_code: form.postCode.trim().toUpperCase(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    address: combinedAddress || 'No address provided',
  };
}

export function buildCustomerInsert(form: CustomerFormData, companyId: string) {
  const snapshot = buildCustomerSnapshot(form);
  return {
    company_id: companyId, name: snapshot.name, company_name: snapshot.company_name || null,
    address_line_1: snapshot.address_line_1, address_line_2: snapshot.address_line_2 || null,
    city: snapshot.city || null, region: snapshot.region || null, postal_code: snapshot.postal_code,
    address: snapshot.address, phone: snapshot.phone || null, email: snapshot.email || null,
  };
}

export function getJobAddress(form: CustomerFormData) {
  if (form.sameAsBilling) return { jobAddress1: form.addressLine1, jobCity: form.city, jobPostcode: form.postCode };
  return { jobAddress1: form.jobAddressLine1, jobCity: form.jobCity, jobPostcode: form.jobPostCode };
}

export function prefillFromJob(job: any): CustomerFormData {
  const snap = job.customer_snapshot || {};
  return {
    customerId: job.customer_id || null, customerName: snap.name || '', customerCompany: snap.company_name || '',
    addressLine1: snap.address_line_1 || '', addressLine2: snap.address_line_2 || '', city: snap.city || '',
    region: snap.region || '', postCode: snap.postal_code || '', phone: snap.phone || '', email: snap.email || '',
    sameAsBilling: true, jobAddressLine1: '', jobCity: '', jobPostCode: '',
  };
}

export async function updateExistingCustomer(customerId: string, form: CustomerFormData) {
  const snapshot = buildCustomerSnapshot(form);
  const { error } = await supabase.from('customers').update({
    name: snapshot.name, company_name: snapshot.company_name || null,
    address_line_1: snapshot.address_line_1, address_line_2: snapshot.address_line_2 || null,
    city: snapshot.city || null, region: snapshot.region || null, postal_code: snapshot.postal_code,
    address: snapshot.address, phone: snapshot.phone || null, email: snapshot.email || null,
  }).eq('id', customerId);
  if (error) throw error;
}

// ─── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  quickToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  quickLabel: { fontSize: 13, fontWeight: '600', color: Colors.textLight },
  tabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, marginBottom: 16 },
  tab: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: '#fff', elevation: 2 },
  tabText: { fontWeight: '600', color: '#64748b' },
  activeTabText: { color: '#0f172a', fontWeight: '700' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 16, shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12, fontSize: 16, color: '#0f172a' },
  row: { flexDirection: 'row' },
  pickerBtn: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerText: { fontSize: 16, color: '#0f172a', fontWeight: '600' },
  placeholderText: { fontSize: 16, color: '#94a3b8' },
  selectedInfo: { marginTop: 12, padding: 12, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  selectedName: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  selectedDetail: { fontSize: 13, color: '#64748b', marginBottom: 1 },
  editSelectedBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  editSelectedText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  clearText: { fontSize: 12, fontWeight: '600', color: '#DC2626' },
  prefillCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: Colors.primary, shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  prefillHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prefillIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  prefillName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  prefillCompany: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
  prefillDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  prefillRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  prefillText: { fontSize: 14, color: '#334155' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  editBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  editingBanner: { backgroundColor: '#FFFBEB', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' },
  editingTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  editingSub: { fontSize: 12, color: '#B45309', marginTop: 2 },
  editActions: { flexDirection: 'row', gap: 10 },
  cancelEditBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelEditText: { fontWeight: '600', color: '#64748b' },
  confirmEditBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  confirmEditText: { fontWeight: '700', color: '#fff' },
  jobAddressCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: Colors.primary, shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  jobAddressLabel: { fontSize: 12, fontWeight: '700', color: Colors.primary, flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, maxHeight: '80%', width: '100%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  modalSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, marginBottom: 12 },
  modalSearchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 15, color: '#0f172a' },
  customerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f8fafc', gap: 12 },
  customerName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  customerAddr: { fontSize: 13, color: '#64748b', marginTop: 2 },
});