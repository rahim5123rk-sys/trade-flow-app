import { router } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from './../../../src/config/firebase'; // Adjust path if needed
import { Job } from './../../../src/types';

export default function WorkerJobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // QUERY: Get jobs assigned to ME
    // Note: In production, you also filter by 'companyId' for extra security
    const q = query(
      collection(db, 'jobs'),
      where('assignedTo', 'array-contains', user.uid) 
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
      // Sort locally for now (pending -> in_progress -> completed)
      jobsData.sort((a, b) => b.scheduledDate - a.scheduledDate);
      setJobs(jobsData);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const renderJob = ({ item }: { item: Job }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => router.push(`/(worker)/jobs/${item.id}`)}
    >
      <View style={styles.row}>
        <Text style={styles.ref}>{item.reference}</Text>
        <StatusBadge status={item.status} />
      </View>
      <Text style={styles.customer}>{item.customerSnapshot.name}</Text>
      <Text style={styles.address}>{item.customerSnapshot.address}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={jobs}
          renderItem={renderJob}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No active jobs assigned to you.</Text>
          }
        />
      )}
    </View>
  );
}

// Simple Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const colors: any = {
    pending: '#fef3c7',
    in_progress: '#dbeafe',
    complete: '#dcfce7',
  };
  return (
    <View style={[styles.badge, { backgroundColor: colors[status] || '#eee' }]}>
      <Text style={styles.badgeText}>{status.replace('_', ' ')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  ref: { fontWeight: 'bold', fontSize: 16 },
  customer: { fontSize: 15, color: '#333', marginBottom: 4 },
  address: { fontSize: 14, color: '#666' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  empty: { textAlign: 'center', marginTop: 50, color: '#888' },
});