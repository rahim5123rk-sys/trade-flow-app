// ============================================
// FILE: components/WorkerPicker.tsx
// ============================================

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors, UI} from '../constants/theme';
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

export const WorkerPicker = ({
  companyId,
  selectedWorkerIds,
  onSelect,
}: WorkerPickerProps) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyId) {
      fetchWorkers();
    } else {
      setLoading(false);
    }
  }, [companyId]);

  const fetchWorkers = async () => {
    setLoading(true);
    try {
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.loadingText}>Loading team...</Text>
      </View>
    );
  }

  // Sole trader: no workers at all — show friendly skip message
  if (workers.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="person-outline" size={24} color={Colors.textLight} />
        <Text style={styles.emptyTitle}>No team members yet</Text>
        <Text style={styles.emptyText}>
          This is optional. Jobs will be assigned to you by default.
          {'\n'}You can add workers later in the Team tab.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Optional — leave unselected to assign to yourself
      </Text>
      {workers.map((worker) => {
        const isSelected = selectedWorkerIds.includes(worker.id);
        return (
          <TouchableOpacity
            key={worker.id}
            style={[styles.item, isSelected && styles.itemSelected]}
            onPress={() => toggleWorker(worker.id)}
          >
            <View style={styles.info}>
              <Text
                style={[styles.name, isSelected && styles.textSelected]}
              >
                {worker.display_name || worker.email}
              </Text>
              <Text
                style={[styles.email, isSelected && styles.textSelected]}
              >
                {worker.email}
              </Text>
            </View>
            {isSelected && (
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={Colors.primary}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  hint: {
    fontSize: 12,
    color: Colors.textLight,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  loadingContainer: { padding: 20, alignItems: 'center' },
  loadingText: { marginTop: 8, fontSize: 12, color: Colors.textLight },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: UI.surface.base,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.surface.divider,
  },
  itemSelected: {
    backgroundColor: UI.surface.base,
    borderColor: Colors.primary,
  },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: UI.text.title },
  email: { fontSize: 12, color: UI.text.muted },
  textSelected: { color: Colors.primary },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyText: {
    color: Colors.textLight,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});