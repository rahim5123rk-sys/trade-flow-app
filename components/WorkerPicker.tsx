import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { FlatList, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../src/config/firebase';

interface WorkerPickerProps {
  companyId: string;
  selectedWorkerIds: string[];
  onSelect: (workerIds: string[]) => void;
}

export const WorkerPicker = ({ companyId, selectedWorkerIds, onSelect }: WorkerPickerProps) => {
  const [workers, setWorkers] = useState<any[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const fetchWorkers = async () => {
      const q = query(
        collection(db, 'users'),
        where('companyId', '==', companyId),
        where('role', '==', 'worker')
      );
      const snap = await getDocs(q);
      setWorkers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchWorkers();
  }, [companyId]);

  const toggleWorker = (id: string) => {
    if (selectedWorkerIds.includes(id)) {
      onSelect(selectedWorkerIds.filter(wId => wId !== id));
    } else {
      onSelect([...selectedWorkerIds, id]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Assign To</Text>
      <TouchableOpacity style={styles.selector} onPress={() => setIsVisible(true)}>
        <Text style={styles.selectorText}>
          {selectedWorkerIds.length > 0 
            ? `${selectedWorkerIds.length} worker(s) selected` 
            : 'Select Workers'}
        </Text>
        <Ionicons name="people-outline" size={20} color="#666" />
      </TouchableOpacity>

      <Modal visible={isVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Team Members</Text>
            <TouchableOpacity onPress={() => setIsVisible(false)}>
              <Text style={styles.doneBtn}>Done</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={workers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = selectedWorkerIds.includes(item.id);
              return (
                <TouchableOpacity 
                  style={[styles.workerItem, isSelected && styles.workerSelected]} 
                  onPress={() => toggleWorker(item.id)}
                >
                  <Text style={[styles.workerName, isSelected && styles.textWhite]}>{item.displayName}</Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color="#fff" />}
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  selector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  selectorText: { color: '#374151', fontSize: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  doneBtn: { color: '#2563eb', fontWeight: 'bold', fontSize: 16 },
  workerItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  workerSelected: { backgroundColor: '#2563eb' },
  workerName: { fontSize: 16 },
  textWhite: { color: '#fff' },
});