import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../../src/config/firebase';
import { useAuth } from '../../../src/context/AuthContext';

export default function WorkersListScreen() {
  const { userProfile } = useAuth();
  const [workers, setWorkers] = useState<any[]>([]);

  useEffect(() => {
    if (!userProfile?.companyId) return;

    const q = query(
      collection(db, 'users'),
      where('companyId', '==', userProfile.companyId),
      where('role', '==', 'worker')
    );

    const unsub = onSnapshot(q, (snap) => {
      setWorkers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return unsub;
  }, [userProfile]);

  return (
    <View style={styles.container}>
      <FlatList 
        data={workers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View>
              <Text style={styles.name}>{item.displayName}</Text>
              <Text style={styles.email}>{item.email}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </View>
        )}
      />
      
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => router.push('/workers/add')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, marginHorizontal: 16, marginTop: 12, borderRadius: 8 },
  name: { fontWeight: 'bold', fontSize: 16 },
  email: { color: '#666', fontSize: 14 },
  fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#2563eb', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 4 }
});