import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
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
import { Colors } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return '#C2410C';
    case 'in_progress':
      return '#1D4ED8';
    case 'complete':
      return Colors.success;
    case 'paid':
      return '#047857';
    case 'cancelled':
      return Colors.danger;
    default:
      return Colors.textLight;
  }
};

export default function JobsListScreen() {
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'active' | 'history'>('active');

  useEffect(() => {
    fetchJobs();
  }, [userProfile]);

  const fetchJobs = async () => {
    if (!userProfile?.company_id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .order('scheduled_date', { ascending: false });

    if (data) setJobs(data);
    setLoading(false);
    setRefreshing(false);
  };

  const filteredJobs = useMemo(() => {
    let result = jobs;

    if (tab === 'active') {
      result = result.filter((j) =>
        ['pending', 'in_progress', 'on_the_way', 'accepted'].includes(j.status)
      );
    } else {
      result = result.filter((j) =>
        ['complete', 'paid', 'cancelled'].includes(j.status)
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (j) =>
          j.reference?.toLowerCase().includes(q) ||
          j.title?.toLowerCase().includes(q) ||
          j.customer_snapshot?.name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [jobs, search, tab]);

  const renderJob = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(admin)/jobs/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.ref}>{item.reference}</Text>
        <Text
          style={[styles.status, { color: getStatusColor(item.status) }]}
        >
          {item.status.toUpperCase().replace('_', ' ')}
        </Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.customer}>{item.customer_snapshot?.name}</Text>
      <View style={styles.footer}>
        <Text style={styles.date}>
          {item.scheduled_date
            ? new Date(item.scheduled_date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'No date'}
        </Text>
        {item.price != null && (
          <Text style={styles.price}>£{item.price.toFixed(2)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={Colors.textLight} />
        <TextInput
          style={styles.input}
          placeholder="Search jobs..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#94a3b8"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color={Colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, tab === 'active' && styles.activeTab]}
          onPress={() => setTab('active')}
        >
          <Text
            style={[styles.tabText, tab === 'active' && styles.activeTabText]}
          >
            Active Jobs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'history' && styles.activeTab]}
          onPress={() => setTab('history')}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'history' && styles.activeTabText,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator
          size="large"
          color={Colors.primary}
          style={{ marginTop: 20 }}
        />
      ) : (
        <FlatList
          data={filteredJobs}
          renderItem={renderJob}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchJobs();
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No jobs found.</Text>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(admin)/jobs/create')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: { marginLeft: 10, flex: 1, fontSize: 16, color: Colors.text },
  tabContainer: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    alignItems: 'center',
  },
  activeTab: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textLight },
  activeTabText: { color: Colors.primary },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    ...Colors.shadow,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ref: { fontSize: 12, fontWeight: '700', color: Colors.textLight },
  status: { fontSize: 10, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  customer: { fontSize: 14, color: Colors.text },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  date: { fontSize: 12, color: Colors.textLight },
  price: { fontSize: 14, fontWeight: '700', color: Colors.primary },
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