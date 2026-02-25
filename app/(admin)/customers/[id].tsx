import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
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
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    if (!id || !userProfile?.company_id) return;
    setLoading(true);

    // Scope to company for security
    const { data: custData } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .single();

    if (custData) {
      setCustomer(custData);
      setName(custData.name);
      setAddress(custData.address);
      setPhone(custData.phone || '');
      setEmail(custData.email || '');
    }

    const { data: jobsData } = await supabase
      .from('jobs')
      .select('*')
      .eq('customer_id', id)
      .eq('company_id', userProfile.company_id)
      .order('scheduled_date', { ascending: false });

    if (jobsData) setJobs(jobsData);
    setLoading(false);
  };

  const handleUpdate = async () => {
    if (!name.trim() || !address.trim()) {
      Alert.alert('Missing Info', 'Name and address are required.');
      return;
    }
    const { error } = await supabase
      .from('customers')
      .update({ name: name.trim(), address: address.trim(), phone, email })
      .eq('id', id)
      .eq('company_id', userProfile?.company_id);

    if (!error) {
      Alert.alert('Success', 'Customer updated.');
      setEditing(false);
      fetchData();
    } else {
      Alert.alert('Error', 'Update failed.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
      case 'paid':
        return Colors.success;
      case 'in_progress':
        return Colors.primary;
      case 'cancelled':
        return Colors.danger;
      default:
        return Colors.warning;
    }
  };

  if (loading)
    return (
      <ActivityIndicator
        style={{ marginTop: 50 }}
        color={Colors.primary}
      />
    );

  if (editing) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Edit Customer</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              multiline
            />
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                style={[styles.btn, { flex: 1, backgroundColor: '#e2e8f0' }]}
                onPress={() => setEditing(false)}
              >
                <Text style={[styles.btnText, { color: Colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { flex: 1 }]}
                onPress={handleUpdate}
              >
                <Text style={styles.btnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{customer?.name}</Text>
            <Text style={styles.detail}>{customer?.address}</Text>
            {customer?.phone ? (
              <Text style={styles.detail}>{customer.phone}</Text>
            ) : null}
            {customer?.email ? (
              <Text style={styles.detail}>{customer.email}</Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Ionicons name="create-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        Job History ({jobs.length})
      </Text>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.jobRow}
            onPress={() => router.push(`/(admin)/jobs/${item.id}`)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.jobTitle}>{item.title}</Text>
              <Text style={styles.jobDate}>
                {item.scheduled_date
                  ? new Date(item.scheduled_date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'No date'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={[
                  styles.status,
                  { color: getStatusColor(item.status) },
                ]}
              >
                {item.status.toUpperCase().replace('_', ' ')}
              </Text>
              {item.price != null && (
                <Text style={styles.jobPrice}>£{item.price.toFixed(2)}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text
            style={{
              color: '#888',
              fontStyle: 'italic',
              textAlign: 'center',
              marginTop: 20,
            }}
          >
            No jobs for this customer yet.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    ...Colors.shadow,
  },
  name: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  detail: { fontSize: 14, color: '#666', marginBottom: 2 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  jobRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    ...Colors.shadow,
  },
  jobTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  jobDate: { fontSize: 12, color: '#888', marginTop: 2 },
  jobPrice: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  status: { fontSize: 11, fontWeight: '700' },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textLight,
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 16,
  },
  btn: {
    backgroundColor: Colors.primary,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});