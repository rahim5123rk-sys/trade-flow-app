import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router'; // Added useFocusEffect
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';

export default function UnifiedJobList() {
  const { userProfile, user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filter, setFilter] = useState<'all' | 'mine'>('mine');
  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) setFilter('mine');
    else setFilter('all');
  }, [isAdmin]);

  // ✅ FIX: useFocusEffect ensures the list reloads when you navigate back to it
  useFocusEffect(
    useCallback(() => {
      if (userProfile?.company_id) {
        fetchJobs();
      }
    }, [userProfile, filter])
  );

  const fetchJobs = async () => {
    if (!userProfile?.company_id) return;
    // Don't set loading to true here to avoid flickering on every focus
    
    // ✅ FIX: Removed "customer_snapshot(name)" which was breaking the query.
    // Using "*" automatically fetches the customer_snapshot column.
    let query = supabase
      .from('jobs')
      .select('*') 
      .eq('company_id', userProfile.company_id)
      .neq('status', 'cancelled')
      .order('scheduled_date', { ascending: false });

    if (filter === 'mine' && user) {
        query = query.contains('assigned_to', [user.id]);
    }

    const { data, error } = await query;
    if (error) console.error("Error fetching jobs:", error);
    if (data) setJobs(data);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Jobs</Text>
        {isAdmin && (
            <View style={styles.toggleContainer}>
                <TouchableOpacity 
                    style={[styles.toggleBtn, filter === 'all' && styles.toggleActive]}
                    onPress={() => setFilter('all')}
                >
                    <Text style={[styles.toggleText, filter === 'all' && styles.activeText]}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.toggleBtn, filter === 'mine' && styles.toggleActive]}
                    onPress={() => setFilter('mine')}
                >
                    <Text style={[styles.toggleText, filter === 'mine' && styles.activeText]}>My Jobs</Text>
                </TouchableOpacity>
            </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); fetchJobs(); }} />}
          renderItem={({ item }) => (
            <TouchableOpacity 
                style={styles.card}
                onPress={() => router.push(`/(app)/jobs/${item.id}` as any)}
            >
                <View style={styles.cardHeader}>
                    <Text style={styles.ref}>{item.reference}</Text>
                    <Text style={[styles.status, { color: item.status === 'complete' ? Colors.success : Colors.primary }]}>
                        {item.status.replace('_', ' ').toUpperCase()}
                    </Text>
                </View>
                <Text style={styles.jobTitle}>{item.title}</Text>
                {/* Check if snapshot exists before accessing name */}
                <Text style={styles.customer}>{item.customer_snapshot?.name || 'Unknown Customer'}</Text>
                <View style={styles.cardFooter}>
                    <Ionicons name="calendar-outline" size={14} color={Colors.textLight} />
                    <Text style={styles.date}>
                        {new Date(item.scheduled_date).toLocaleDateString()}
                    </Text>
                </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No jobs found.</Text>}
        />
      )}

      {isAdmin && (
        <TouchableOpacity
            style={styles.fab}
            onPress={() => router.push('/(app)/jobs/create' as any)}
        >
            <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: 50 },
  header: { paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 8, padding: 2 },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  toggleActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2 },
  toggleText: { fontSize: 12, fontWeight: '600', color: Colors.textLight },
  activeText: { color: Colors.text },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, ...Colors.shadow },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  ref: { fontSize: 12, fontWeight: '700', color: Colors.textLight },
  status: { fontSize: 11, fontWeight: '800' },
  jobTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  customer: { fontSize: 14, color: Colors.text },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 },
  date: { fontSize: 12, color: Colors.textLight },
  empty: { textAlign: 'center', marginTop: 40, color: Colors.textLight },
  fab: { position: 'absolute', right: 20, bottom: 30, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', ...Colors.shadow },
});