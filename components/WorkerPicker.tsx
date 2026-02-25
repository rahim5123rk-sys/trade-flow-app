import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/theme'; // Ensure this path is correct
import { supabase } from '../src/config/supabase'; // Ensure this path is correct

interface Worker {
  id: string;
  display_name: string;
  email: string;
}

interface WorkerPickerProps {
  companyId: string;
  selectedWorkerIds: string[];
  onSelect: (ids: string[]) => void;
}

export const WorkerPicker = ({ companyId, selectedWorkerIds, onSelect }: WorkerPickerProps) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyId) {
      fetchWorkers();
    } else {
      // FIX: Ensure loading stops if no companyId is provided
      setLoading(false);
    }
  }, [companyId]);

  const fetchWorkers = async () => {
    setLoading(true);
    try {
      // Query the 'profiles' table for workers in this company
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .eq('company_id', companyId)
        .eq('role', 'worker');

      if (error) throw error;
      if (data) setWorkers(data);
    } catch (e) {
      console.error('Error fetching workers:', e);
    } finally {
      // FIX: Always set loading to false regardless of success or failure
      setLoading(false);
    }
  };

  const toggleWorker = (id: string) => {
    if (selectedWorkerIds.includes(id)) {
      onSelect(selectedWorkerIds.filter((wId) => wId !== id));
    } else {
      onSelect([...selectedWorkerIds, id]);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.loadingText}>Loading team...</Text>
      </View>
    );
  }

  if (workers.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No workers found.</Text>
        <Text style={styles.subText}>Invite workers in the "Team" tab.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {workers.map((worker) => {
        const isSelected = selectedWorkerIds.includes(worker.id);
        return (
          <TouchableOpacity
            key={worker.id}
            style={[styles.item, isSelected && styles.itemSelected]}
            onPress={() => toggleWorker(worker.id)}
          >
            <View style={styles.info}>
              <Text style={[styles.name, isSelected && styles.textSelected]}>
                {worker.display_name || worker.email}
              </Text>
              <Text style={[styles.email, isSelected && styles.textSelected]}>
                {worker.email}
              </Text>
            </View>
            {isSelected && (
              <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  loadingContainer: { padding: 20, alignItems: 'center' },
  loadingText: { marginTop: 8, fontSize: 12, color: Colors.textLight },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: Colors.primary,
  },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  email: { fontSize: 12, color: '#64748b' },
  textSelected: { color: Colors.primary },
  emptyContainer: { padding: 10, alignItems: 'center' },
  emptyText: { color: '#0f172a', fontWeight: '700' },
  subText: { color: '#64748b', fontSize: 12 },
});