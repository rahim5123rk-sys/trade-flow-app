import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SignaturePad } from '../../../../components/SignaturePad';
import { Colors } from '../../../../constants/theme';
import { supabase } from '../../../../src/config/supabase';
import { useAuth } from '../../../../src/context/AuthContext';
import { generateJobSheet } from '../../../../src/services/pdfGenerator';
import { uploadImage } from '../../../../src/services/storage';
import { Job } from '../../../../src/types';

// Admin Status Flow
const STATUS_FLOW = ['pending', 'in_progress', 'complete', 'paid'];

export default function UnifiedJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user, userProfile } = useAuth();

  const [job, setJob] = useState<Job | any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);

  const isAdmin = userProfile?.role === 'admin';

  useFocusEffect(
    useCallback(() => {
      if (user && id) fetchJobData();
    }, [user, id])
  );

  const fetchJobData = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setJob(data);
    } catch (e) {
      console.error('Error fetching job:', e);
      Alert.alert('Error', 'Could not load job details.');
    } finally {
      setLoading(false);
    }
  };

  // --- ADMIN ACTIONS ---
  const adminUpdateStatus = async (newStatus: string) => {
    if (!job) return;
    setUpdating(true);
    try {
      // ✅ FIX: Only update the status column — no payment_status (doesn't exist in DB)
      const { error } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', job.id);

      if (error) {
        console.error('Status update error:', error);
        throw error;
      }
      fetchJobData();
    } catch (e: any) {
      console.error('Status update failed:', e);
      Alert.alert('Error', e?.message || 'Could not update status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleGeneratePdf = () => job && generateJobSheet(job);
  const handleCreateInvoice = () => job && router.push(`/(app)/jobs/${job.id}/invoice` as any);
  
  // --- WORKER ACTIONS ---
  const workerStartJob = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase.from('jobs').update({ status: 'in_progress' }).eq('id', id);
      if (error) throw error;
      setJob({ ...job, status: 'in_progress' });
      Alert.alert('Job Started');
    } catch (e) {
      Alert.alert('Error', 'Could not start job.');
    } finally {
      setUpdating(false);
    }
  };

  const workerAddPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
    });
    if (!result.canceled) {
      setUpdating(true);
      try {
        const url = await uploadImage(result.assets[0].uri, 'job-photos');
        const currentPhotos = job.photos || [];
        const newPhotos = [...currentPhotos, url];
        await supabase.from('jobs').update({ photos: newPhotos }).eq('id', id);
        setJob({ ...job, photos: newPhotos });
      } catch (e) {
        Alert.alert('Upload Failed', 'Could not save photo.');
      } finally {
        setUpdating(false);
      }
    }
  };

  const workerFinishJob = async (signature: string) => {
    setSignatureModalVisible(false);
    setUpdating(true);
    try {
      await supabase.from('jobs').update({ signature, status: 'complete' }).eq('id', id);
      Alert.alert('Job Complete', 'Job has been signed off.');
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Could not save signature.');
    } finally {
      setUpdating(false);
    }
  };

  const openMaps = () => {
    const address = encodeURIComponent(job?.customer_snapshot?.address || '');
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${address}`);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!job) return <View style={styles.center}><Text>Job not found.</Text></View>;

  const nextStatus = isAdmin 
    ? (STATUS_FLOW[STATUS_FLOW.indexOf(job.status) + 1] || null) 
    : null;

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  // Status badge color helper
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return { bg: '#F0FDF4', text: '#15803D' };
      case 'paid': return { bg: '#EFF6FF', text: '#2563EB' };
      case 'in_progress': return { bg: '#FFF7ED', text: '#C2410C' };
      case 'cancelled': return { bg: '#FEF2F2', text: '#DC2626' };
      default: return { bg: '#FFF7ED', text: '#C2410C' };
    }
  };

  const statusColor = getStatusColor(job.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
      
      {/* 1. Header (Shared) */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ref}>{job.reference}</Text>
            <Text style={styles.customerName}>{job.customer_snapshot?.name}</Text>
            <Text style={styles.date}>{formatDate(job.scheduled_date)}</Text>
          </View>
          
          {isAdmin ? (
            <TouchableOpacity onPress={() => router.push(`/(app)/jobs/${job.id}/edit` as any)}>
               <Ionicons name="create-outline" size={24} color={Colors.primary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={openMaps}>
               <Ionicons name="navigate-circle" size={42} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Status Badge */}
        <View style={[styles.badge, { alignSelf: 'flex-start', marginTop: 10, backgroundColor: statusColor.bg }]}>
           <Text style={[styles.badgeText, { color: statusColor.text }]}>
             {job.status.replace('_', ' ')}
           </Text>
        </View>
      </View>

      {/* 2. Worker Action Zone */}
      {!isAdmin && (
         <View style={styles.actionContainer}>
            {job.status === 'pending' && (
                <TouchableOpacity style={styles.bigBtn} onPress={workerStartJob} disabled={updating}>
                    <Ionicons name="play-circle" size={32} color="#fff" />
                    <Text style={styles.bigBtnText}>START JOB</Text>
                </TouchableOpacity>
            )}
            {job.status === 'in_progress' && (
                <View style={styles.toolRow}>
                    <TouchableOpacity style={styles.toolBtn} onPress={workerAddPhoto}>
                        <Ionicons name="camera" size={28} color={Colors.text} />
                        <Text style={styles.toolText}>Add Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.toolBtn, { backgroundColor: Colors.primary }]} onPress={() => setSignatureModalVisible(true)}>
                        <Ionicons name="checkmark-done-circle" size={28} color="#fff" />
                        <Text style={[styles.toolText, { color: '#fff' }]}>FINISH JOB</Text>
                    </TouchableOpacity>
                </View>
            )}
         </View>
      )}

      {/* 3. Job Details (Shared) */}
      <View style={styles.section}>
        <Text style={styles.label}>Job Details</Text>
        <View style={styles.card}>
           <Text style={styles.subTitle}>{job.title}</Text>
           <View style={styles.row}>
              <Ionicons name="location-outline" size={18} color={Colors.primary} />
              <Text style={styles.value}>{job.customer_snapshot?.address}</Text>
           </View>
           {job.notes && (
             <View style={styles.noteContainer}>
               <Text style={styles.noteLabel}>NOTES:</Text>
               <Text style={styles.notes}>{job.notes}</Text>
             </View>
           )}
           {isAdmin && job.price != null && (
             <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Price: £{job.price.toFixed(2)}</Text>
             </View>
           )}
        </View>
      </View>

      {/* 4. Proof of Work (Shared) */}
      {(job.photos?.length > 0 || job.signature) && (
        <View style={styles.section}>
          <Text style={styles.label}>Proof of Work</Text>
          <View style={styles.card}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {job.photos?.map((uri: string, idx: number) => (
                 <Image key={idx} source={{ uri }} style={styles.proofImage} />
              ))}
            </ScrollView>
            {job.signature && (
               <View style={styles.signatureContainer}>
                  <Text style={styles.signatureLabel}>Customer Signature</Text>
                  <Image source={{ uri: job.signature }} style={styles.signatureImage} />
               </View>
            )}
          </View>
        </View>
      )}

      {/* 5. Admin Footer Actions */}
      {isAdmin && (
        <View style={styles.footer}>
           {nextStatus && (
             <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={() => adminUpdateStatus(nextStatus)} disabled={updating}>
                {updating ? <ActivityIndicator color="#fff" /> : (
                   <Text style={styles.primaryBtnText}>Move to {nextStatus.replace('_', ' ')}</Text>
                )}
             </TouchableOpacity>
           )}
           <TouchableOpacity style={[styles.btn, styles.invoiceBtn]} onPress={handleCreateInvoice}>
              <Text style={styles.primaryBtnText}>Create Invoice</Text>
           </TouchableOpacity>
           <TouchableOpacity style={[styles.btn, styles.secondaryBtn]} onPress={handleGeneratePdf}>
              <Text style={styles.secondaryBtnText}>Generate PDF</Text>
           </TouchableOpacity>
        </View>
      )}

      <SignaturePad visible={signatureModalVisible} onClose={() => setSignatureModalVisible(false)} onOK={workerFinishJob} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, ...Colors.shadow, marginBottom: 8 },
  section: { marginTop: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ref: { fontSize: 12, fontWeight: '700', color: Colors.textLight },
  customerName: { fontSize: 20, fontWeight: '800', color: Colors.text, marginVertical: 4 },
  date: { fontSize: 14, color: Colors.textLight },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  
  actionContainer: { marginVertical: 10 },
  bigBtn: { backgroundColor: Colors.success, padding: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  bigBtnText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  toolRow: { flexDirection: 'row', gap: 12 },
  toolBtn: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 2 },
  toolText: { fontWeight: '700', fontSize: 12 },

  label: { fontSize: 12, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  subTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { fontSize: 15, color: Colors.text, flex: 1 },
  noteContainer: { backgroundColor: '#f9fafb', padding: 10, borderRadius: 8, marginTop: 12 },
  noteLabel: { fontSize: 10, fontWeight: 'bold', color: '#6b7280' },
  notes: { fontSize: 14, color: '#374151' },
  priceRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  priceLabel: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  
  proofImage: { width: 80, height: 80, borderRadius: 8, marginRight: 8, backgroundColor: '#f3f4f6' },
  signatureContainer: { marginTop: 12 },
  signatureLabel: { fontSize: 10, color: '#888', marginBottom: 4, textTransform: 'uppercase', fontWeight: '700' },
  signatureImage: { height: 60, width: 150, resizeMode: 'contain', backgroundColor: '#f9fafb', borderRadius: 6, borderWidth: 1, borderColor: '#e5e7eb' },
  
  footer: { marginTop: 24, gap: 12 },
  btn: { alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12 },
  primaryBtn: { backgroundColor: Colors.primary },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  invoiceBtn: { backgroundColor: Colors.success },
  secondaryBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border },
  secondaryBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 16 },
});