import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';

export default function WorkersListScreen() {
  const { userProfile } = useAuth();
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchWorkers();
  }, [userProfile]);

  const fetchWorkers = async () => {
    if (!userProfile?.company_id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .eq('role', 'worker');

    if (data) setWorkers(data);
    setLoading(false);
    setRefreshing(false);
  };

  const renderWorker = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.display_name?.[0]?.toUpperCase() || 'W'}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.display_name}</Text>
        <Text style={styles.email}>{item.email}</Text>
        {item.is_test_user && (
          <View style={styles.testBadge}>
            <Text style={styles.testBadgeText}>TEST USER</Text>
          </View>
        )}
      </View>
      <TouchableOpacity style={styles.actionBtn}>
        <Ionicons name="ellipsis-vertical" size={20} color={Colors.textLight} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={workers}
        keyExtractor={(item) => item.id}
        renderItem={renderWorker}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchWorkers} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>No workers found.</Text>
            <Text style={styles.emptySub}>Tap '+' to invite or create a test worker.</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(admin)/workers/add')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    ...Colors.shadow
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  info: { flex: 1 },
  name: { fontWeight: '700', fontSize: 16, color: Colors.text },
  email: { color: Colors.textLight, fontSize: 14 },
  testBadge: {
    backgroundColor: '#f1f5f9',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4
  },
  testBadgeText: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  actionBtn: { padding: 8 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: Colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  emptyState: { alignItems: 'center', marginTop: 80, gap: 10 },
  emptyText: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptySub: { color: Colors.textLight },
});