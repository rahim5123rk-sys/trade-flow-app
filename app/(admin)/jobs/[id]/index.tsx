import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { generateJobSheet } from '../../../../src/services/pdfGenerator';

const STATUS_FLOW = ['pending', 'in_progress', 'complete', 'paid'];

export default function AdminJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [job, setJob] = useState<any>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchJob();
  }, [id]);

  const fetchJob = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single();
    if (data) setJob(data);
  };

  const updateStatus = async (newStatus: string) => {
    if (!id) return;
    setUpdating(true);
    try {
      const updateData: any = { status: newStatus };
      // When marking as paid, also set payment_status
      if (newStatus === 'paid') {
        updateData.payment_status = 'paid';
      }
      await supabase.from('jobs').update(updateData).eq('id', id);
      fetchJob();
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

  if (!job)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );

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
            >
              <Ionicons name="create-outline" size={26} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.date}>
          {job.scheduled_date
            ? new Date(job.scheduled_date).toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })
            : 'No date set'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Customer</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="person" size={18} color={Colors.primary} />
            <Text style={styles.value}>
              {job.customer_snapshot?.name || 'Unknown'}
            </Text>
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            <Ionicons name="location" size={18} color={Colors.primary} />
            <Text style={styles.value}>
              {job.customer_snapshot?.address || 'No address'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Job Details</Text>
        <View style={styles.card}>
          <Text style={styles.subTitle}>{job.title}</Text>
          {job.notes ? <Text style={styles.notes}>{job.notes}</Text> : null}
          {job.price != null && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Price:</Text>
              <Text style={styles.priceValue}>£{job.price.toFixed(2)}</Text>
            </View>
          )}
          {job.payment_status && (
            <View style={styles.paymentRow}>
              <Text style={styles.priceLabel}>Payment:</Text>
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

      {job.photos?.length || job.signature ? (
        <View style={styles.section}>
          <Text style={styles.label}>Proof of Work</Text>
          <View style={styles.card}>
            {job.photos && job.photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {job.photos.map((p: string, i: number) => (
                  <Image
                    key={i}
                    source={{ uri: p }}
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: 8,
                      marginRight: 8,
                    }}
                  />
                ))}
              </ScrollView>
            )}
            {job.signature && (
              <View style={{ marginTop: 4 }}>
                <Text
                  style={{
                    fontSize: 10,
                    color: '#888',
                    marginBottom: 4,
                    textTransform: 'uppercase',
                    fontWeight: '700',
                  }}
                >
                  Customer Signature
                </Text>
                <Image
                  source={{ uri: job.signature }}
                  style={{
                    height: 60,
                    width: 150,
                    resizeMode: 'contain',
                    backgroundColor: '#f9fafb',
                    borderRadius: 6,
                  }}
                />
              </View>
            )}
          </View>
        </View>
      ) : null}

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
  notes: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    marginTop: 8,
  },
  paymentStatus: { fontSize: 14, fontWeight: '700' },
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