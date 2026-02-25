import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { SignaturePad } from '../../../components/SignaturePad';
import { Colors } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { uploadImage } from '../../../src/services/storage';

export default function WorkerJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchJob();
  }, [id]);

  const fetchJob = async () => {
    const { data, error } = await supabase.from('jobs').select('*').eq('id', id).single();
    if (data) setJob(data);
  };

  const handleStartJob = async () => {
    setLoading(true);
    try {
      await supabase.from('jobs').update({ status: 'in_progress' }).eq('id', id);
      setJob({ ...job, status: 'in_progress' });
      Alert.alert('Job Started');
    } catch (e) {
      Alert.alert('Error', 'Could not start job.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });

    if (!result.canceled) {
      setLoading(true);
      try {
        const url = await uploadImage(result.assets[0].uri, 'job-photos');
        
        // Append to existing array
        const currentPhotos = job.photos || [];
        const newPhotos = [...currentPhotos, url];
        
        await supabase.from('jobs').update({ photos: newPhotos }).eq('id', id);
        setJob({ ...job, photos: newPhotos });

      } catch (e) {
        Alert.alert('Upload Failed', 'Could not save photo.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSignature = async (signature: string) => {
    setSignatureModalVisible(false);
    setLoading(true);
    try {
      // You could upload the signature as an image first if it's too large, 
      // but usually Base64 is okay for signatures in Supabase TEXT columns if not huge.
      await supabase.from('jobs').update({
        signature: signature,
        status: 'complete'
      }).eq('id', id);
      
      Alert.alert('Job Complete', 'Job has been signed off and finished.');
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Could not save signature.');
    } finally {
      setLoading(false);
    }
  };

  const openMaps = () => {
    const address = encodeURIComponent(job?.customer_snapshot?.address || '');
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${address}`);
  };

  if (!job) return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{job.customer_snapshot?.name}</Text>
          <Text style={styles.address}>{job.customer_snapshot?.address}</Text>
        </View>
        <TouchableOpacity style={styles.mapBtn} onPress={openMaps}>
          <Ionicons name="navigate-circle" size={48} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.actionContainer}>
        {job.status === 'pending' && (
          <TouchableOpacity style={styles.bigBtn} onPress={handleStartJob} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="play-circle" size={32} color="#fff" />
                <Text style={styles.bigBtnText}>START JOB</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {job.status === 'in_progress' && (
          <View style={styles.inProgressContainer}>
            <View style={styles.activeBadge}>
              <Text style={styles.activeText}>• IN PROGRESS</Text>
            </View>
            
            <View style={styles.toolRow}>
              <TouchableOpacity style={styles.toolBtn} onPress={handleAddPhoto}>
                <Ionicons name="camera" size={28} color={Colors.text} />
                <Text style={styles.toolText}>Add Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.toolBtn, { backgroundColor: Colors.primary }]} 
                onPress={() => setSignatureModalVisible(true)}
              >
                <Ionicons name="checkmark-done-circle" size={28} color="#fff" />
                <Text style={[styles.toolText, { color: '#fff' }]}>FINISH JOB</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {(job.status === 'complete' || job.status === 'paid') && (
            <View style={styles.completedBanner}>
                <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
                <Text style={styles.completedText}>JOB COMPLETED</Text>
            </View>
        )}
      </View>

      {job.photos && job.photos.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <ScrollView horizontal style={{ flexDirection: 'row' }}>
            {job.photos.map((url: string, i: number) => (
              <Image key={i} source={{ uri: url }} style={styles.thumbnail} />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Job Details</Text>
        <Text style={styles.body}>{job.title}</Text>
        <Text style={styles.notes}>{job.notes || 'No notes.'}</Text>
      </View>

      <SignaturePad 
        visible={signatureModalVisible} 
        onClose={() => setSignatureModalVisible(false)}
        onOK={handleSignature} 
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', padding: 20, backgroundColor: '#fff', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  address: { fontSize: 14, color: '#64748b', marginTop: 4 },
  mapBtn: { marginLeft: 16 },
  actionContainer: { padding: 16 },
  bigBtn: { backgroundColor: Colors.success, padding: 20, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, elevation: 4 },
  bigBtnText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  inProgressContainer: { gap: 12 },
  activeBadge: { backgroundColor: '#dcfce7', padding: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#16a34a' },
  activeText: { color: '#16a34a', fontWeight: '800', fontSize: 12 },
  toolRow: { flexDirection: 'row', gap: 12 },
  toolBtn: { flex: 1, backgroundColor: '#fff', padding: 20, borderRadius: 12, alignItems: 'center', gap: 8, elevation: 2 },
  toolText: { fontWeight: '700', fontSize: 12 },
  completedBanner: { backgroundColor: '#f0fdf4', padding: 20, borderRadius: 12, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#bbf7d0' },
  completedText: { color: '#15803d', fontWeight: '900', fontSize: 16 },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 8 },
  thumbnail: { width: 80, height: 80, borderRadius: 8, marginRight: 8, backgroundColor: '#cbd5e1' },
  card: { margin: 16, padding: 16, backgroundColor: '#fff', borderRadius: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 16, marginBottom: 8 },
  notes: { fontSize: 14, color: '#475569', backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 },
});