import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Agenda, AgendaSchedule } from 'react-native-calendars';
import { Colors } from '../../constants/theme';
import { supabase } from '../../src/config/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { Job } from '../../src/types';

// 1. Theme Configuration (Stable)
const CALENDAR_THEME = {
  selectedDayBackgroundColor: Colors.primary,
  todayTextColor: Colors.primary,
  dotColor: Colors.primary,
  agendaKnobColor: Colors.border,
  agendaTodayColor: Colors.primary,
  backgroundColor: '#ffffff',
  calendarBackground: '#ffffff',
  dayTextColor: Colors.text,
  textDisabledColor: Colors.textLight,
  monthTextColor: Colors.text,
};

export default function CalendarScreen() {
  const { userProfile } = useAuth();
  
  // 2. Stable "Today" Date
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  const [items, setItems] = useState<AgendaSchedule>({});
  const [refreshing, setRefreshing] = useState(false);

  // 3. Fetch Jobs (Strict Snake Case)
  const fetchJobs = useCallback(async () => {
    // AuthContext uses 'company_id'
    if (!userProfile?.company_id) return;
    
    setRefreshing(true);

    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('company_id', userProfile.company_id);

      if (error) throw error;

      if (data) {
        const formattedItems: AgendaSchedule = {};
        
        data.forEach((rawJob: any) => {
          // Check for valid date
          if (!rawJob.scheduled_date) return;

          // DIRECT ASSIGNMENT: We assume rawJob matches the 'Job' type (snake_case)
          // We cast it to 'Job' to satisfy TypeScript
          const job = rawJob as Job;

          // Safe Date Parsing
          let dateStr;
          try {
             // Handle both number (timestamp) or string (ISO)
             dateStr = new Date(job.scheduled_date).toISOString().split('T')[0];
          } catch (e) {
             return; 
          }

          if (!formattedItems[dateStr]) {
            formattedItems[dateStr] = [];
          }
          (formattedItems[dateStr] as any[]).push(job);
        });

        setItems(formattedItems);
      }
    } catch (e) {
      console.log('Error fetching jobs:', e);
    } finally {
      setRefreshing(false);
    }
  }, [userProfile?.company_id]);

  // Initial Fetch
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // 4. Callbacks
  const loadItemsForMonth = useCallback(() => {}, []);

  const rowHasChanged = useCallback((r1: any, r2: any) => {
    return r1.id !== r2.id;
  }, []);

  const renderItem = useCallback((item: any, firstItemInDay: boolean) => {
    const job = item as Job;
    
    // ACCESS PROPERTIES VIA SNAKE_CASE
    const isPaid = job.status === 'paid' || job.payment_status === 'paid';
    
    let statusColor = Colors.secondary;
    if (job.status === 'in_progress') statusColor = Colors.primary;
    else if (isPaid) statusColor = Colors.success;
    else if (job.status === 'pending') statusColor = Colors.warning;
    else if (job.status === 'complete') statusColor = '#10B981';

    return (
      <TouchableOpacity 
        style={[styles.item, { borderLeftColor: statusColor }]} 
        onPress={() => router.push(`/(admin)/jobs/${job.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.itemHeader}>
             <Text style={styles.itemTime}>
                {new Date(job.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
             </Text>
             <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>
                    {job.status.replace('_', ' ')}
                </Text>
             </View>
        </View>
        <Text style={styles.itemTitle}>{job.title}</Text>
        <Text style={styles.itemCustomer}>
            {job.customer_snapshot?.name || 'Unknown Client'}
        </Text>
        <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color={Colors.textLight} />
            <Text style={styles.itemAddress} numberOfLines={1}>
                {job.customer_snapshot?.address || 'No address provided'}
            </Text>
        </View>
      </TouchableOpacity>
    );
  }, []);

  const renderEmptyDate = useCallback(() => {
    return (
      <View style={styles.emptyDate}>
        <View style={styles.line} />
      </View>
    );
  }, []);

  const renderEmptyData = useCallback(() => {
    return (
      <View style={styles.emptyData}>
          <Ionicons name="calendar-outline" size={48} color={Colors.textLight} />
          <Text style={{color: Colors.textLight, marginTop: 10}}>No jobs scheduled for this day.</Text>
      </View>
    );
  }, []);

  return (
    <View style={styles.container}>
      <Agenda
        items={items}
        selected={today} 
        loadItemsForMonth={loadItemsForMonth}
        onRefresh={fetchJobs}
        refreshing={refreshing}
        rowHasChanged={rowHasChanged}
        renderItem={renderItem}
        renderEmptyDate={renderEmptyDate}
        renderEmptyData={renderEmptyData}
        showClosingKnob={true}
        showOnlySelectedDayItems={false}
        theme={CALENDAR_THEME}
      />
      
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => router.push('/(admin)/jobs/create')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  item: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    marginRight: 10,
    marginTop: 17,
    borderLeftWidth: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    height: 100,
    justifyContent: 'center'
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  itemTime: { fontSize: 12, fontWeight: '700', color: Colors.textLight },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  itemTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  itemCustomer: { fontSize: 13, color: Colors.text, marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemAddress: { fontSize: 12, color: Colors.textLight },
  emptyDate: { height: 15, flex: 1, paddingTop: 30, paddingHorizontal: 20 },
  line: { height: 1, backgroundColor: '#E2E8F0' },
  emptyData: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});