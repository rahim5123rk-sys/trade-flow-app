import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../../../constants/theme';
import { supabase } from '../../../../src/config/supabase';
import { useAuth } from '../../../../src/context/AuthContext';
import { generateJobSheet } from '../../../../src/services/pdfGenerator';
import { Job } from '../../../../src/types';

const STATUS_FLOW = ['pending', 'in_progress', 'complete', 'paid'];

export default function AdminJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Reload data when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user && id) {
        fetchJobData();
      }
    }, [user, id])
  );

  const fetchJobData = async () => {
    try {
      if (!user) return;

      // 1. Get Company ID (Try metadata first, then fallback to DB profile)
      let companyId = user.user_metadata?.company_id;
      
      if (!companyId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();
        
        companyId = profile?.company_id;
      }

      if (!companyId) {
        console.error("No company_id found for user");
        Alert.alert("Error", "User organization not found.");
        return;
      }

      // 2. Fetch Job with strict tenant isolation
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId) 
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

  const updateStatus = async (newStatus: string) => {
    if (!job) return;
    setUpdating(true);
    try {
      const updateData: Partial<Job> = { status: newStatus as any };
      
      if (newStatus === 'paid') {
        updateData.payment_status = 'paid';
      }

      const { error } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', job.id); // RLS policies will handle the company_id check automatically here

      if (error) throw error;
      
      // Refresh local data
      fetchJobData();
    } catch (e) {
      Alert.alert('Error', 'Could not update status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleGeneratePdf = () => {
    if (!job) return;
    generateJobSheet(job);
  };

  // Safe Date Formatter (Handles Seconds vs Milliseconds)
  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'No date set';
    // Heuristic: If timestamp is small (e.g. < 10 billion), it's likely seconds.
    const date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.center}>
        <Text style={{ color: Colors.textLight }}>Job not found.</Text>
      </View>
    );
  }

  const currentIndex = STATUS_FLOW.indexOf(job.status);
  const nextStatus =
    currentIndex < STATUS_FLOW.length - 1
      ? STATUS_FLOW[currentIndex + 1]
      : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      {/* Header Card */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.ref}>{job.reference}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    job.status === 'complete' || job.status === 'paid'
                      ? '#F0FDF4'
                      : '#FFF7ED',
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color:
                      job.status === 'complete' || job.status === 'paid'
                        ? '#15803D'
                        : '#C2410C',
                  },
                ]}
              >
                {job.status.replace('_', ' ')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push(`/(admin)/jobs/${job.id}/edit`)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="create-outline" size={24} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.date}>{formatDate(job.scheduled_date)}</Text>
      </View>

      {/* Customer Snapshot */}
      <View style={styles.section}>
        <Text style={styles.label}>Customer (Snapshot)</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="person" size={18} color={Colors.primary} />
            <Text style={styles.value}>
              {job.customer_snapshot?.name || 'Unknown Customer'}
            </Text>
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            <Ionicons name="location" size={18} color={Colors.primary} />
            <Text style={styles.value}>
              {job.customer_snapshot?.address || 'No address provided'}
            </Text>
          </View>
          {job.customer_snapshot?.phone && (
            <View style={[styles.row, { marginTop: 8 }]}>
              <Ionicons name="call" size={18} color={Colors.primary} />
              <Text style={styles.value}>{job.customer_snapshot.phone}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Job Details */}
      <View style={styles.section}>
        <Text style={styles.label}>Job Details</Text>
        <View style={styles.card}>
          <Text style={styles.subTitle}>{job.title}</Text>
          
          {job.notes ? (
            <View style={styles.noteContainer}>
              <Text style={styles.noteLabel}>Notes:</Text>
              <Text style={styles.notes}>{job.notes}</Text>
            </View>
          ) : null}

          {job.price != null && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Price:</Text>
              <Text style={styles.priceValue}>£{job.price.toFixed(2)}</Text>
            </View>
          )}
          
          {job.payment_status && (
            <View style={styles.paymentRow}>
              <Text style={styles.priceLabel}>Payment Status:</Text>
              <Text
                style={[
                  styles.paymentStatus,
                  {
                    color:
                      job.payment_status === 'paid'
                        ? Colors.success
                        : Colors.warning,
                  },
                ]}
              >
                {job.payment_status.toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Proof of Work */}
      {((job.photos && job.photos.length > 0) || job.signature) && (
        <View style={styles.section}>
          <Text style={styles.label}>Proof of Work</Text>
          <View style={styles.card}>
            {job.photos && job.photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {job.photos.map((uri, index) => (
                  <Image
                    key={index}
                    source={{ uri }}
                    style={styles.proofImage}
                  />
                ))}
              </ScrollView>
            )}
            
            {job.signature && (
              <View style={styles.signatureContainer}>
                <Text style={styles.signatureLabel}>Customer Signature</Text>
                <Image
                  source={{ uri: job.signature }}
                  style={styles.signatureImage}
                />
              </View>
            )}
          </View>
        </View>
      )}

      {/* Footer Actions */}
      <View style={styles.footer}>
        {nextStatus && (
          <TouchableOpacity
            style={[styles.btn, styles.primaryBtn, updating && { opacity: 0.7 }]}
            onPress={() => updateStatus(nextStatus)}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.primaryBtnText}>
                  Move to {nextStatus.replace('_', ' ')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.btn, styles.secondaryBtn]}
          onPress={handleGeneratePdf}
        >
          <Ionicons
            name="document-text-outline"
            size={20}
            color={Colors.primary}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.secondaryBtnText}>Generate Job Sheet (PDF)</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    ...Colors.shadow,
    marginBottom: 8,
  },
  section: { marginTop: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ref: { fontSize: 20, fontWeight: '800', color: Colors.text },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  date: { marginTop: 4, color: Colors.textLight, fontSize: 14 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textLight,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { fontSize: 15, color: Colors.text, flex: 1 },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  noteContainer: {
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b7280',
    marginBottom: 2,
  },
  notes: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  priceLabel: { fontSize: 14, color: Colors.textLight },
  priceValue: { fontSize: 18, fontWeight: 'bold', color: Colors.primary },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  paymentStatus: { fontSize: 14, fontWeight: '700' },
  proofImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  signatureContainer: { marginTop: 12 },
  signatureLabel: {
    fontSize: 10,
    color: '#888',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  signatureImage: {
    height: 60,
    width: 150,
    resizeMode: 'contain',
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  footer: { marginTop: 24, gap: 12 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  primaryBtn: { backgroundColor: Colors.primary, ...Colors.shadow },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  secondaryBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 16 },
});