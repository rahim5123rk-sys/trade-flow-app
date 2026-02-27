// ============================================
// FILE: app/(app)/customers/[id].tsx
// Customer Detail Hub with Unified Activity Timeline
// ============================================

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userProfile } = useAuth();
  
  const [customer, setCustomer] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postCode, setPostCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Automatically refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [id])
  );

  const fetchData = async () => {
    if (!id || !userProfile?.company_id) return;
    setLoading(true);

    // 1. Fetch Customer Info
    const { data: custData } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .single();

    if (custData) {
      setCustomer(custData);
      setName(custData.name || '');
      setCompanyName(custData.company_name || '');
      setAddress1(custData.address_line_1 || '');
      setAddress2(custData.address_line_2 || '');
      setCity(custData.city || '');
      setRegion(custData.region || '');
      setPostCode(custData.postal_code || '');
      setPhone(custData.phone || '');
      setEmail(custData.email || '');
    }

    // 2. Fetch Jobs
    const { data: jobsData } = await supabase
      .from('jobs')
      .select('*')
      .eq('customer_id', id)
      .order('scheduled_date', { ascending: false });

    // 3. Fetch Documents (Invoices & Quotes)
    const { data: docsData } = await supabase
      .from('documents')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false });

    // 4. Merge and Sort by Date
    const combined = [
      ...(jobsData || []).map(j => ({ ...j, activityType: 'job' })),
      ...(docsData || []).map(d => ({ ...d, activityType: 'document' }))
    ].sort((a, b) => {
      const dateA = new Date(a.activityType === 'job' ? a.scheduled_date : a.created_at).getTime();
      const dateB = new Date(b.activityType === 'job' ? b.scheduled_date : b.created_at).getTime();
      return dateB - dateA; // Newest first
    });

    setHistory(combined);
    setLoading(false);
  };

  const handleUpdate = async () => {
    if (!name.trim() || !address1.trim() || !postCode.trim()) {
      Alert.alert('Missing Info', 'Name, Address, and Post Code are required.');
      return;
    }
    const combinedAddress = [address1, address2, city, region, postCode].filter(Boolean).join(', ');
    const { error } = await supabase.from('customers').update({ 
      name: name.trim(), company_name: companyName.trim() || null,
      address_line_1: address1.trim(), address_line_2: address2.trim() || null,
      city: city.trim() || null, region: region.trim() || null,
      postal_code: postCode.trim().toUpperCase(), address: combinedAddress, 
      phone: phone.trim() || null, email: email.trim() || null 
    }).eq('id', id);

    if (!error) { Alert.alert('Success', 'Updated.'); setEditing(false); fetchData(); }
  };

  const handleDelete = () => {
    Alert.alert('Delete Customer', 'Cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('customers').delete().eq('id', id);
        router.back();
      }}
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

  const renderHistoryItem = ({ item }: { item: any }) => {
    const isJob = item.activityType === 'job';
    const date = new Date(isJob ? item.scheduled_date : item.created_at);
    const displayDate = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    return (
      <TouchableOpacity 
        style={styles.historyCard} 
        onPress={() => router.push(isJob ? `/(app)/jobs/${item.id}` : `/(app)/documents/${item.id}` as any)}
      >
        <View style={styles.historyLeft}>
          <View style={[styles.iconCircle, { backgroundColor: isJob ? '#EFF6FF' : (item.type === 'invoice' ? '#FFF7ED' : '#F5F3FF') }]}>
            <Ionicons 
              name={isJob ? 'briefcase' : (item.type === 'invoice' ? 'receipt' : 'document-text')} 
              size={18} 
              color={isJob ? Colors.primary : (item.type === 'invoice' ? '#C2410C' : '#7C3AED')} 
            />
          </View>
          <View>
            <Text style={styles.historyTitle}>{isJob ? item.title : `${item.type.toUpperCase()} #${String(item.number).padStart(4, '0')}`}</Text>
            <Text style={styles.historyDate}>{displayDate} • {isJob ? 'Job' : (item.type.charAt(0).toUpperCase() + item.type.slice(1))}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.historyStatus, { color: getStatusColor(item.status) }]}>{item.status.toUpperCase()}</Text>
          <Text style={styles.historyPrice}>£{(item.price || item.total || 0).toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !customer) return <ActivityIndicator style={{ marginTop: 50 }} color={Colors.primary} />;

  if (editing) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
          <Text style={styles.sectionTitle}>Editing Details</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Name</Text><TextInput style={styles.input} value={name} onChangeText={setName} />
            <Text style={styles.label}>Company</Text><TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} />
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Address Line 1</Text><TextInput style={styles.input} value={address1} onChangeText={setAddress1} />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}><Text style={styles.label}>City</Text><TextInput style={styles.input} value={city} onChangeText={setCity} /></View>
              <View style={{ flex: 1 }}><Text style={styles.label}>Post Code</Text><TextInput style={styles.input} value={postCode} onChangeText={setPostCode} autoCapitalize="characters" /></View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: '#e2e8f0' }]} onPress={() => setEditing(false)}><Text style={{ color: Colors.text }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={handleUpdate}><Text style={styles.btnText}>Save</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Profile Header */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{customer?.name}</Text>
            {customer?.company_name && <Text style={styles.companyText}>{customer.company_name}</Text>}
            <Text style={styles.detail}>{customer?.address}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TouchableOpacity onPress={handleDelete}><Ionicons name="trash-outline" size={22} color={Colors.danger} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setEditing(true)}><Ionicons name="create-outline" size={22} color={Colors.primary} /></TouchableOpacity>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Activity History ({history.length})</Text>

      <FlatList
        data={history}
        keyExtractor={(item) => `${item.activityType}-${item.id}`}
        renderItem={renderHistoryItem}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={styles.emptyText}>No activity recorded yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 16, ...Colors.shadow },
  name: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  companyText: { fontSize: 14, fontWeight: '600', color: Colors.primary, marginBottom: 4 },
  detail: { fontSize: 14, color: '#64748b', marginBottom: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#64748b', marginBottom: 12, textTransform: 'uppercase', paddingLeft: 4 },
  
  // History Cards
  historyCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 10, ...Colors.shadow },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  historyTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  historyDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  historyStatus: { fontSize: 10, fontWeight: '800' },
  historyPrice: { fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: 2 },

  emptyText: { color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row' },
  label: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 16, marginBottom: 12, color: Colors.text },
  btn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800' },
});