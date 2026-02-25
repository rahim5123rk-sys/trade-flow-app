import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/context/AuthContext';

export default function DashboardScreen() {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState({ activeJobs: 0, pending: 0 });

  useEffect(() => {
    if (!userProfile?.companyId) return;

    const fetchStats = async () => {
      // Example of Multi-Tenant Query: ALWAYS filter by companyId
      const q = query(
        collection(db, 'jobs'), 
        where('companyId', '==', userProfile.companyId)
      );
      
      const snapshot = await getCountFromServer(q);
      setStats({ activeJobs: snapshot.data().count, pending: 0 });
    };

    fetchStats();
  }, [userProfile]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {userProfile?.displayName}</Text>
        <Text style={styles.subtext}>Here is what's happening today.</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Active Jobs</Text>
          <Text style={styles.cardValue}>{stats.activeJobs}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pending</Text>
          <Text style={styles.cardValue}>-</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  header: { marginBottom: 24, marginTop: 10 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  subtext: { fontSize: 16, color: '#6b7280' },
  grid: { flexDirection: 'row', gap: 16 },
  card: { flex: 1, backgroundColor: '#fff', padding: 20, borderRadius: 12, shadowOpacity: 0.1, elevation: 2 },
  cardTitle: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  cardValue: { fontSize: 32, fontWeight: 'bold', color: '#2563eb', marginTop: 8 },
});