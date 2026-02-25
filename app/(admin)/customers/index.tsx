import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';

export default function CustomersListScreen() {
  const { userProfile } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, [userProfile]);

  const fetchCustomers = async () => {
    if (!userProfile?.company_id) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .order('name', { ascending: true });

    if (data) setCustomers(data);
    setLoading(false);
    setRefreshing(false);
  };

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.address.toLowerCase().includes(search.toLowerCase())
  );

  const renderCustomer = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(admin)/customers/${item.id}`)}
    >
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={Colors.textLight} />
        <TextInput
          style={styles.input}
          placeholder="Search customers..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredCustomers}
          renderItem={renderCustomer}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchCustomers} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No customers found.</Text>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(admin)/customers/add')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, marginBottom: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  input: { marginLeft: 10, flex: 1, fontSize: 16 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, ...Colors.shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  name: { fontSize: 16, fontWeight: '700', color: Colors.text },
  address: { fontSize: 14, color: Colors.textLight },
  empty: { textAlign: 'center', marginTop: 40, color: Colors.textLight },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 5 },
});