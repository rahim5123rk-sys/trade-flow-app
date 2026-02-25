import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../../src/config/firebase';
import { useAuth } from '../../../src/context/AuthContext';
import { Job } from '../../../src/types';

export default function JobsListScreen() {
  const { userProfile } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.companyId) return;

    // Real-time listener
    const q = query(
      collection(db, 'jobs'),
      where('companyId', '==', userProfile.companyId),
      // Note: You need a composite index for 'companyId' + 'createdAt' in Firestore Console
      // orderBy('createdAt', 'desc') 
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
      setJobs(jobsData);
      setLoading(false);
    });

    return unsubscribe;
  }, [userProfile]);

  const renderJob = ({ item }: { item: Job }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.reference}>{item.reference}</Text>
        <View style={[styles.badge, { backgroundColor: item.status === 'pending' ? '#fef3c7' : '#dcfce7' }]}>
          <Text style={styles.badgeText}>{item.status}</Text>
        </View>
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
          ListEmptyComponent={<Text style={styles.empty}>No jobs found. Create one!</Text>}
        />
      )}
      
      {/* Floating Action Button */}
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
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, shadowOpacity: 0.05, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  reference: { fontWeight: 'bold', fontSize: 16, color: '#111827' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  customer: { fontSize: 14, color: '#374151', marginBottom: 4 },
  address: { fontSize: 13, color: '#6b7280' },
  empty: { textAlign: 'center', marginTop: 50, color: '#9ca3af' },
  fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#2563eb', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }
});