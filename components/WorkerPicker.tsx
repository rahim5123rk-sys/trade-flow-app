import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/theme';
import { supabase } from '../src/config/supabase';

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
    if (!companyId) return;
    fetchWorkers();
  }, [companyId]);

  const fetchWorkers = async () => {
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

  if (loading) return <ActivityIndicator color={Colors.primary} />;

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
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: Colors.primary,
  },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: Colors.text },
  email: { fontSize: 12, color: Colors.textLight },
  textSelected: { color: Colors.primaryDark },
  emptyContainer: { padding: 10, alignItems: 'center' },
  emptyText: { color: Colors.text, fontWeight: '600' },
  subText: { color: Colors.textLight, fontSize: 12 },
});