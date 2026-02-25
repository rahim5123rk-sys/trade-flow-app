import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    updateDoc,
    where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { db } from '../../../src/config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  companyId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  propertyType?: string;
  notes?: string;
}

interface Job {
  id: string;
  reference: string;
  title: string;
  status: string;
  scheduledDate: number;
  price?: number;
}

const STATUS_COLOURS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#fef3c7', text: '#92400e' },
  accepted: { bg: '#fff7ed', text: '#9a3412' },
  on_the_way: { bg: '#fce7f3', text: '#9d174d' },
  in_progress: { bg: '#dbeafe', text: '#1e40af' },
  complete: { bg: '#dcfce7', text: '#166534' },
  invoiced: { bg: '#ede9fe', text: '#5b21b6' },
  paid: { bg: '#d1fae5', text: '#065f46' },
};

const PROPERTY_TYPES = ['Residential', 'Commercial'];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPropertyType, setEditPropertyType] = useState('Residential');
  const [editNotes, setEditNotes] = useState('');

  // Load customer
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'customers', id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Customer;
        setCustomer(data);
        setEditName(data.name);
        setEditPhone(data.phone || '');
        setEditEmail(data.email || '');
        setEditAddress(data.address || '');
        setEditPropertyType(data.propertyType || 'Residential');
        setEditNotes(data.notes || '');
      }
    });
    return unsub;
  }, [id]);

  // Load jobs for this customer
  useEffect(() => {
    if (!customer) return;
    const q = query(
      collection(db, 'jobs'),
      where('companyId', '==', customer.companyId),
      where('customerSnapshot.name', '==', customer.name)
    );
    const unsub = onSnapshot(q, (snap) => {
      setJobs(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Job))
          .sort((a, b) => b.scheduledDate - a.scheduledDate)
      );
    });
    return unsub;
  }, [customer]);

  const handleSave = async () => {
    if (!id || !editName.trim()) {
      Alert.alert('Error', 'Customer name is required.');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'customers', id), {
        name: editName.trim(),
        phone: editPhone.trim() || null,
        email: editEmail.trim().toLowerCase() || null,
        address: editAddress.trim() || null,
        propertyType: editPropertyType,
        notes: editNotes.trim() || null,
      });
      setEditing(false);
    } catch (e) {
      Alert.alert('Error', 'Could not update customer.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete ${customer?.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'customers', id!));
              router.back();
            } catch (e) {
              Alert.alert('Error', 'Could not delete customer.');
            }
          },
        },
      ]
    );
  };

  if (!customer) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // ── Edit Mode ─────────────────────────────────────────────────────────────

  if (editing) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.section}>
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName} autoCapitalize="words" />

            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" />

            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.label}>Address</Text>
            <TextInput style={[styles.input, styles.textArea]} value={editAddress} onChangeText={setEditAddress} multiline />

            <Text style={styles.label}>Property Type</Text>
            <View style={styles.pillRow}>
              {PROPERTY_TYPES.map((pt) => (
                <TouchableOpacity
                  key={pt}
                  style={[styles.pill, editPropertyType === pt && styles.pillActive]}
                  onPress={() => setEditPropertyType(pt)}
                >
                  <Text style={[styles.pillText, editPropertyType === pt && styles.pillTextActive]}>{pt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>Notes</Text>
            <TextInput style={[styles.input, styles.textArea]} value={editNotes} onChangeText={setEditNotes} multiline />
          </View>

          <View style={styles.editActions}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── View Mode ─────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {customer.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName}>{customer.name}</Text>
            {customer.propertyType && (
              <Text style={styles.propertyType}>{customer.propertyType}</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
            <Ionicons name="create-outline" size={18} color="#2563eb" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Contact */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact</Text>
        {customer.phone && (
          <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(`tel:${customer.phone}`)}>
            <Ionicons name="call-outline" size={18} color="#2563eb" style={{ marginRight: 10 }} />
            <Text style={styles.infoValue}>{customer.phone}</Text>
          </TouchableOpacity>
        )}
        {customer.email && (
          <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(`mailto:${customer.email}`)}>
            <Ionicons name="mail-outline" size={18} color="#2563eb" style={{ marginRight: 10 }} />
            <Text style={styles.infoValue}>{customer.email}</Text>
          </TouchableOpacity>
        )}
        {customer.address && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color="#6b7280" style={{ marginRight: 10 }} />
            <Text style={styles.infoValue}>{customer.address}</Text>
          </View>
        )}
        {!customer.phone && !customer.email && !customer.address && (
          <Text style={styles.emptyText}>No contact details added yet.</Text>
        )}
      </View>

      {/* Notes */}
      {customer.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notesText}>{customer.notes}</Text>
        </View>
      )}

      {/* Job History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Job History ({jobs.length})</Text>
        {jobs.length === 0 ? (
          <Text style={styles.emptyText}>No jobs for this customer yet.</Text>
        ) : (
          jobs.map((job) => {
            const colours = STATUS_COLOURS[job.status] || { bg: '#f3f4f6', text: '#374151' };
            return (
              <TouchableOpacity
                key={job.id}
                style={styles.jobCard}
                onPress={() => router.push(`/(admin)/jobs/${job.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.jobRef}>{job.reference}</Text>
                  <Text style={styles.jobDate}>
                    {new Date(job.scheduledDate).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: colours.bg }]}>
                  <Text style={[styles.statusText, { color: colours.text }]}>
                    {job.status.replace('_', ' ')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Delete */}
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={18} color="#dc2626" />
        <Text style={styles.deleteBtnText}>Delete Customer</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },

  headerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#2563eb' },
  customerName: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  propertyType: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  editBtn: { padding: 8, borderRadius: 8, backgroundColor: '#eff6ff' },

  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  infoValue: { fontSize: 15, color: '#111827', flex: 1 },
  notesText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', paddingVertical: 16 },

  jobCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  jobRef: { fontSize: 14, fontWeight: '600', color: '#111827' },
  jobDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  // Edit mode
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 14,
    borderWidth: 1, borderColor: '#e5e7eb', fontSize: 15,
  },
  textArea: { textAlignVertical: 'top', minHeight: 64 },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
  },
  pillActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  pillText: { fontSize: 14, color: '#374151' },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  editActions: { paddingHorizontal: 16, marginTop: 16 },
  saveBtn: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  cancelBtnText: { color: '#6b7280', fontWeight: '600', fontSize: 15 },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 16, marginTop: 20, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#fca5a5', backgroundColor: '#fef2f2', gap: 8,
  },
  deleteBtnText: { color: '#dc2626', fontWeight: '600', fontSize: 15 },
});