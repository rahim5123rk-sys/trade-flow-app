// ============================================
// FILE: app/(app)/customers/[id].tsx
// Customer Detail Hub with Unified Activity Timeline
// ============================================

import {Ionicons} from '@expo/vector-icons';
import {router, useFocusEffect, useLocalSearchParams} from 'expo-router';
import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CustomerFormData,
  CustomerSelector,
  EMPTY_CUSTOMER_FORM
} from '../../../components/CustomerSelector';
import {Colors, UI} from '../../../constants/theme';
import {supabase} from '../../../src/config/supabase';
import {useAuth} from '../../../src/context/AuthContext';
import {useAppTheme} from '../../../src/context/ThemeContext';

export default function CustomerDetailScreen() {
  const {id} = useLocalSearchParams<{id: string}>();
  const {userProfile} = useAuth();

  const [customer, setCustomer] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const {theme, isDark} = useAppTheme();

  const [formData, setFormData] = useState<CustomerFormData>(EMPTY_CUSTOMER_FORM);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [id])
  );

  const fetchData = async () => {
    if (!id || !userProfile?.company_id) return;
    setLoading(true);

    const {data: custData} = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .single();

    if (custData) {
      setCustomer(custData);
      setFormData({
        customerId: custData.id,
        customerName: custData.name || '',
        customerCompany: custData.company_name || '',
        addressLine1: custData.address_line_1 || '',
        addressLine2: custData.address_line_2 || '',
        city: custData.city || '',
        region: custData.region || '',
        postCode: custData.postal_code || '',
        phone: custData.phone || '',
        email: custData.email || '',
        sameAsBilling: true,
        jobAddressLine1: '',
        jobAddressLine2: '',
        jobCity: '',
        jobPostCode: '',
        siteContactName: '',
        siteContactEmail: '',
        siteContactPhone: '',
        siteContactTitle: '',
      });
    }

    const {data: jobsData} = await supabase
      .from('jobs')
      .select('*')
      .eq('customer_id', id)
      .order('scheduled_date', {ascending: false});

    const {data: docsData} = await supabase
      .from('documents')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', {ascending: false});

    const combined = [
      ...(jobsData || []).map(j => ({...j, activityType: 'job'})),
      ...(docsData || []).map(d => ({...d, activityType: 'document'}))
    ].sort((a, b) => {
      const dateA = new Date(a.activityType === 'job' ? a.scheduled_date : a.created_at).getTime();
      const dateB = new Date(b.activityType === 'job' ? b.scheduled_date : b.created_at).getTime();
      return dateB - dateA;
    });

    setHistory(combined);
    setLoading(false);
  };

  const handleUpdate = async () => {
    if (!formData.customerName.trim() || !formData.addressLine1.trim() || !formData.postCode.trim()) {
      Alert.alert('Missing Info', 'Name, Address, and Post Code are required.');
      return;
    }

    const combinedAddress = [
      formData.addressLine1, formData.addressLine2, formData.city, formData.region, formData.postCode
    ].filter(Boolean).join(', ');

    const {error} = await supabase.from('customers').update({
      name: formData.customerName.trim(),
      company_name: formData.customerCompany.trim() || null,
      address_line_1: formData.addressLine1.trim(),
      address_line_2: formData.addressLine2.trim() || null,
      city: formData.city.trim() || null,
      region: formData.region.trim() || null,
      postal_code: formData.postCode.trim().toUpperCase(),
      address: combinedAddress,
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null
    }).eq('id', id);

    if (error) {
      Alert.alert('Error', error.code === '23505' ? 'A customer with that name already exists.' : 'Failed to update customer.');
      return;
    }

    Alert.alert('Success', 'Customer details updated.');
    setEditing(false);
    fetchData();
  };

  const handleDelete = () => {
    Alert.alert('Delete Customer', 'This will permanently delete the customer and anonymise their data in existing jobs and documents.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const anonymised = {
              name: '[Deleted Customer]',
              company_name: null,
              address: '[Address removed]',
              address_line_1: '[Removed]',
              address_line_2: null,
              city: null,
              region: null,
              postal_code: null,
              email: null,
              phone: null,
            };

            // Anonymise customer_snapshot in jobs
            await supabase
              .from('jobs')
              .update({customer_snapshot: anonymised})
              .eq('customer_id', id);

            // Anonymise customer_snapshot in documents
            await supabase
              .from('documents')
              .update({customer_snapshot: anonymised})
              .eq('customer_id', id);

            // Delete the customer record
            await supabase.from('customers').delete().eq('id', id);
            router.back();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to delete customer.');
          }
        }
      }
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'complete': case 'paid': case 'accepted': return Colors.success;
      case 'in_progress': case 'sent': return Colors.primary;
      case 'cancelled': case 'declined': case 'overdue': return Colors.danger;
      default: return Colors.warning;
    }
  };

  const getDocLabel = (type: string) => {
    const labels: Record<string, string> = {
      invoice: 'Invoice',
      quote: 'Quote',
      cp12: 'Gas Certificate',
      service_record: 'Service Record',
      commissioning: 'Commissioning',
      decommissioning: 'Decommissioning',
      warning_notice: 'Warning Notice',
      breakdown_report: 'Breakdown Report',
      installation_cert: 'Installation Certificate',
    };
    return labels[type] || type;
  };

  const isGasForm = (type: string) => ['cp12', 'service_record', 'commissioning', 'decommissioning', 'warning_notice', 'breakdown_report', 'installation_cert'].includes(type);

  const renderHistoryItem = ({item}: {item: any}) => {
    const isJob = item.activityType === 'job';
    const date = new Date(isJob ? item.scheduled_date : item.created_at);
    const displayDate = date.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'});
    const gasForm = !isJob && isGasForm(item.type);
    const isInvoice = !isJob && item.type === 'invoice';

    const iconBg = isJob
      ? (isDark ? theme.surface.elevated : UI.surface.base)
      : isInvoice
        ? (isDark ? 'rgba(194,65,12,0.15)' : '#FFF7ED')
        : gasForm
          ? (isDark ? 'rgba(34,197,94,0.15)' : '#F0FDF4')
          : (isDark ? 'rgba(139,92,246,0.15)' : '#F5F3FF');

    const iconName = isJob ? 'briefcase' : isInvoice ? 'receipt' : gasForm ? 'shield-checkmark' : 'document-text';
    const iconColor = isJob ? Colors.primary : isInvoice ? '#C2410C' : gasForm ? '#16A34A' : UI.brand.secondary;

    return (
      <TouchableOpacity
        style={[styles.historyCard, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}
        onPress={() => router.push(isJob ? `/(app)/jobs/${item.id}` : `/(app)/documents/${item.id}` as any)}
      >
        <View style={styles.historyLeft}>
          <View style={[styles.iconCircle, {backgroundColor: iconBg}]}>
            <Ionicons name={iconName} size={18} color={iconColor} />
          </View>
          <View>
            <Text style={[styles.historyTitle, isDark && {color: theme.text.title}]}>{isJob ? item.title : `${getDocLabel(item.type)} #${String(item.number).padStart(4, '0')}`}</Text>
            <Text style={[styles.historyDate, isDark && {color: theme.text.muted}]}>{displayDate} • {isJob ? 'Job' : getDocLabel(item.type)}</Text>
          </View>
        </View>
        <View style={{alignItems: 'flex-end'}}>
          <Text style={[styles.historyStatus, {color: getStatusColor(item.status)}]}>{item.status.toUpperCase()}</Text>
          {(isJob ? item.price : (item.type === 'invoice' || item.type === 'quote') ? item.total : null) != null && (
            <Text style={[styles.historyPrice, isDark && {color: theme.text.title}]}>£{(isJob ? item.price : item.total || 0).toFixed(2)}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !customer) return <ActivityIndicator style={{marginTop: 50}} color={Colors.primary} />;

  if (editing) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <ScrollView style={[styles.container, isDark && {backgroundColor: theme.surface.base}]} contentContainerStyle={{paddingBottom: 60}}>
          <Text style={[styles.sectionTitle, isDark && {color: theme.text.muted}]}>Editing Details</Text>

          <CustomerSelector
            value={formData}
            onChange={setFormData}
            mode="full"
            showJobAddress={false}
            hideTabs={true}    // Hide "New/Existing" toggle
            showActions={false} // Hide selector's internal "Done" buttons
          />

          <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
            <TouchableOpacity style={[styles.btn, {flex: 1, backgroundColor: isDark ? theme.surface.elevated : UI.surface.divider}]} onPress={() => setEditing(false)}>
              <Text style={{color: isDark ? theme.text.title : Colors.text}}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, {flex: 1}]} onPress={handleUpdate}>
              <Text style={styles.btnText}>Save Customer</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, isDark && {backgroundColor: theme.surface.base}]}>
      {/* Profile Header */}
      <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
          <View style={{flex: 1}}>
            <Text style={[styles.name, isDark && {color: theme.text.title}]}>{customer?.name}</Text>
            {customer?.company_name && <Text style={[styles.companyText, isDark && {color: theme.brand.primary}]}>{customer.company_name}</Text>}
            <Text style={[styles.detail, isDark && {color: theme.text.muted}]}>{customer?.address}</Text>

            {/* EMAIL AND PHONE DISPLAY */}
            {customer?.email && (
              <Text style={[styles.detail, {marginTop: 4}]}>
                <Ionicons name="mail-outline" size={12} /> {customer.email}
              </Text>
            )}
            {customer?.phone && (
              <Text style={[styles.detail, {marginTop: 2}]}>
                <Ionicons name="call-outline" size={12} /> {customer.phone}
              </Text>
            )}
          </View>
          <View style={{flexDirection: 'row', gap: 16}}>
            <TouchableOpacity onPress={handleDelete}><Ionicons name="trash-outline" size={22} color={Colors.danger} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setEditing(true)}><Ionicons name="create-outline" size={22} color={Colors.primary} /></TouchableOpacity>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionTitle, isDark && {color: theme.text.muted}]}>Activity History ({history.length})</Text>

      <FlatList
        data={history}
        keyExtractor={(item) => `${item.activityType}-${item.id}`}
        renderItem={renderHistoryItem}
        contentContainerStyle={{paddingBottom: 40}}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={[styles.emptyText, isDark && {color: theme.text.muted}]}>No activity recorded yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background, padding: 16},
  card: {backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 16, ...Colors.shadow},
  name: {fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 4},
  companyText: {fontSize: 14, fontWeight: '600', color: Colors.primary, marginBottom: 4},
  detail: {fontSize: 14, color: UI.text.muted, marginBottom: 2},
  sectionTitle: {fontSize: 14, fontWeight: '700', color: UI.text.muted, marginBottom: 12, textTransform: 'uppercase', paddingLeft: 4},
  historyCard: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 10, ...Colors.shadow},
  historyLeft: {flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1},
  iconCircle: {width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center'},
  historyTitle: {fontSize: 15, fontWeight: '700', color: Colors.text},
  historyDate: {fontSize: 12, color: UI.text.muted, marginTop: 2},
  historyStatus: {fontSize: 10, fontWeight: '800'},
  historyPrice: {fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: 2},
  emptyText: {color: UI.text.muted, fontStyle: 'italic', textAlign: 'center', marginTop: 40},
  btn: {backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center'},
  btnText: {color: UI.text.white, fontWeight: '800'},
});