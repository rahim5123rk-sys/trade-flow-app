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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, UI } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';
import { useAppTheme } from '../../../src/context/ThemeContext';

export default function CustomersListScreen() {
  const { userProfile } = useAuth();
  const { theme, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
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

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase())
  );

  const renderCustomer = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surface.card }, isDark && { borderWidth: 1, borderColor: theme.glass.border }, theme.shadow]}
      onPress={() => router.push(`/(app)/customers/${item.id}`)}
    >
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: isDark ? theme.surface.elevated : UI.surface.base }]}>
          <Text style={[styles.avatarText, { color: theme.brand.primary }]}>
            {item.name[0]?.toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.text.title }]}>{item.name}</Text>
          <Text style={[styles.address, { color: theme.text.muted }]} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.text.muted} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.surface.base }]}>
      <Text style={[styles.screenTitle, { color: theme.text.title }]}>Customers</Text>

      <View style={[styles.searchBox, { backgroundColor: theme.surface.card, borderColor: isDark ? theme.surface.border : Colors.border }]}>
        <Ionicons name="search" size={20} color={theme.text.muted} />
        <TextInput
          style={[styles.input, { color: theme.text.title }]}
          placeholder="Search customers..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={theme.text.placeholder}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color={theme.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator
          size="large"
          color={theme.brand.primary}
          style={{ marginTop: 20 }}
        />
      ) : (
        <FlatList
          data={filteredCustomers}
          renderItem={renderCustomer}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchCustomers();
              }}
              tintColor={theme.brand.primary}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.text.muted }]}>No customers found.</Text>
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.brand.primary, shadowColor: isDark ? '#000' : Colors.primary }]}
        onPress={() => router.push('/(app)/customers/add')}
      >
        <Ionicons name="add" size={30} color={isDark ? '#000' : UI.text.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: { marginLeft: 10, flex: 1, fontSize: 16, color: Colors.text },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    ...Colors.shadow,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: UI.surface.base,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  name: { fontSize: 16, fontWeight: '700', color: Colors.text },
  address: { fontSize: 14, color: Colors.textLight },
  empty: { textAlign: 'center', marginTop: 40, color: Colors.textLight },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});