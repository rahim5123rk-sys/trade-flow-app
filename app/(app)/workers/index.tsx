import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, UI} from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';

export default function WorkersListScreen() {
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchWorkers();
  }, [userProfile]);

  const fetchWorkers = async () => {
    if (!userProfile?.company_id) return;
    setLoading(true);

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .eq('role', 'worker');

    if (data) setWorkers(data);
    setLoading(false);
    setRefreshing(false);
  };

  const handleAddWorker = () => {
    // ✅ NAVIGATE TO THE INVITE SCREEN
    router.push('/(app)/workers/add');
  };

  const renderWorker = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.display_name?.[0]?.toUpperCase() || 'W'}
        </Text>
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Team</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={workers}
        keyExtractor={(item) => item.id}
        renderItem={renderWorker}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchWorkers();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>No workers found.</Text>
            <Text style={styles.emptySub}>Tap + to invite a worker.</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={handleAddWorker}>
        <Ionicons name="add" size={30} color={UI.text.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', ...Colors.shadow },
  screenTitle: { fontSize: 24, fontWeight: '800', color: Colors.text },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginBottom: 12, borderRadius: 16, ...Colors.shadow },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: UI.surface.base, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  info: { flex: 1 },
  name: { fontWeight: '700', fontSize: 16, color: Colors.text },
  email: { color: Colors.textLight, fontSize: 14 },
  testBadge: { backgroundColor: UI.surface.elevated, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  testBadgeText: { fontSize: 10, fontWeight: '700', color: UI.text.muted },
  actionBtn: { padding: 8 },
  fab: { position: 'absolute', right: 20, bottom: 30, backgroundColor: Colors.primary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', ...Colors.shadow },
  emptyState: { alignItems: 'center', marginTop: 80, gap: 10 },
  emptyText: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptySub: { color: Colors.textLight },
});