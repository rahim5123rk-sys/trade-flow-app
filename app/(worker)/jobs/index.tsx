import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
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

const StatusBadge = ({ status }: { status: string }) => {
  let bg = '#f3f4f6';
  let text = '#374151';
  let icon: any = 'time-outline';

  switch (status) {
    case 'pending':
      bg = '#FFF7ED'; text = '#C2410C'; icon = 'time-outline';
      break;
    case 'in_progress':
      bg = '#EFF6FF'; text = '#1D4ED8'; icon = 'play-circle-outline';
      break;
    case 'complete':
      bg = '#F0FDF4'; text = '#15803D'; icon = 'checkmark-circle-outline';
      break;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={12} color={text} style={{ marginRight: 4 }} />
      <Text style={[styles.badgeText, { color: text }]}>
        {status.replace('_', ' ')}
      </Text>
    </View>
  );
};

export default function WorkerJobList() {
  const { userProfile, user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, [userProfile]);

  const fetchJobs = async () => {
    if (!userProfile?.company_id || !user) return;
    setLoading(true);

    let query = supabase
      .from('jobs')
      .select('*')
      .order('scheduled_date', { ascending: false });

    // Logic: If Admin, show ALL company jobs. If Worker, show only assigned.
    if (userProfile.role === 'admin') {
      query = query.eq('company_id', userProfile.company_id);
    } else {
      query = query.contains('assigned_to', [user.id]);
    }

    const { data, error } = await query;
    if (data) setJobs(data);
    
    setLoading(false);
    setRefreshing(false);
  };

  const renderJob = ({ item }: { item: any }) => {
    const scheduledStr = item.scheduled_date
      ? new Date(item.scheduled_date).toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      : null;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push(`/(worker)/jobs/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.ref}>{item.reference}</Text>
          <StatusBadge status={item.status} />
        </View>
        
        <Text style={styles.jobTitle}>{item.title}</Text>
        
        <View style={styles.row}>
          <Ionicons name="person-outline" size={14} color={Colors.textLight} />
          <Text style={styles.customer}>{item.customer_snapshot?.name}</Text>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
             <Ionicons name="location-outline" size={14} color={Colors.primary} />
             <Text style={styles.footerText} numberOfLines={1}>{item.customer_snapshot?.address}</Text>
          </View>
          {scheduledStr && (
            <View style={[styles.footerItem, { justifyContent: 'flex-end' }]}>
               <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
               <Text style={styles.footerText}>{scheduledStr}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Schedule</Text>
        <Text style={styles.headerSubtitle}>
            {userProfile?.role === 'admin' ? '👀 Viewing as Admin (All Jobs)' : 'Your assigned jobs'}
        </Text>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={jobs}
          renderItem={renderJob}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
             <RefreshControl refreshing={refreshing} onRefresh={fetchJobs} tintColor={Colors.primary}/>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-clear-outline" size={40} color={Colors.textLight} />
              </View>
              <Text style={styles.emptyTitle}>No jobs found</Text>
              <Text style={styles.emptyText}>You have no active jobs assigned at the moment.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 20, paddingBottom: 10, backgroundColor: '#fff' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text },
  headerSubtitle: { fontSize: 13, color: Colors.textLight, marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    ...Colors.shadow,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  ref: { fontWeight: '700', fontSize: 12, color: Colors.textLight, letterSpacing: 0.5 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  jobTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 6 },
  customer: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  footerText: { fontSize: 13, color: Colors.textLight, fontWeight: '500' },
  emptyContainer: { alignItems: 'center', marginTop: 60, padding: 20 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: Colors.textLight, lineHeight: 22 },
});