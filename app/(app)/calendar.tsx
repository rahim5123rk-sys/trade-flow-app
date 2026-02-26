import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { JobCard } from '../../components/JobCard';
import { Colors } from '../../constants/theme';
import { useRealtimeJobs } from '../../hooks/useRealtime';
import { supabase } from '../../src/config/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { Job } from '../../src/types';
import { toDateString } from '../../src/utils/dates';
import { getStatusStyle } from '../../src/utils/formatting';

export default function UnifiedCalendarScreen() {
  const { userProfile, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const isAdmin = userProfile?.role === 'admin';

  const fetchJobs = useCallback(async () => {
    if (!userProfile?.company_id) return;
    try {
      let query = supabase
        .from('jobs')
        .select('*')
        .eq('company_id', userProfile.company_id)
        .neq('status', 'cancelled')
        .order('scheduled_date', { ascending: true });

      if (!isAdmin && user) {
        query = query.contains('assigned_to', [user.id]);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data) setJobs(data as Job[]);
    } catch (e) {
      console.error('Calendar fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userProfile?.company_id, isAdmin, user?.id]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useRealtimeJobs(userProfile?.company_id, fetchJobs);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    jobs.forEach((job) => {
      const dateStr = toDateString(job.scheduled_date);
      if (!marks[dateStr]) marks[dateStr] = { dots: [], marked: true };
      
      const { color } = getStatusStyle(job.status);
      if (marks[dateStr].dots.length < 3) marks[dateStr].dots.push({ key: job.id, color });
    });

    const selectedConfig = { selected: true, selectedColor: Colors.primary, selectedTextColor: '#FFFFFF' };
    marks[selectedDate] = marks[selectedDate] ? { ...marks[selectedDate], ...selectedConfig } : selectedConfig;
    return marks;
  }, [jobs, selectedDate]);

  const dayJobs = useMemo(() => {
    return jobs
      .filter((job) => toDateString(job.scheduled_date) === selectedDate)
      .sort((a, b) => a.scheduled_date - b.scheduled_date);
  }, [jobs, selectedDate]);

  const selectedDateFormatted = new Date(selectedDate + 'T00:00:00')
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  // ✅ NEW: Navigate to create job with the selected date pre-filled
  const handleCreateJobFromCalendar = () => {
    router.push({
      pathname: '/(app)/jobs/create',
      params: { prefillDate: selectedDate },
    } as any);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Calendar</Text>
        <TouchableOpacity style={styles.todayBtn} onPress={() => setSelectedDate(new Date().toISOString().split('T')[0])}>
          <Text style={styles.todayBtnText}>Today</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={Colors.primary} />
      ) : (
        <FlatList
          data={dayJobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchJobs(); }} tintColor={Colors.primary} />}
          ListHeaderComponent={
            <>
              <View style={styles.calendarCard}>
                <Calendar
                  onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
                  markedDates={markedDates}
                  markingType="multi-dot"
                  theme={{
                    todayTextColor: Colors.primary,
                    selectedDayBackgroundColor: Colors.primary,
                    arrowColor: Colors.primary,
                  }}
                  style={{ borderRadius: 16 }}
                />
              </View>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>{selectedDateFormatted}</Text>
                <Text style={styles.countText}>{dayJobs.length} jobs</Text>
              </View>
            </>
          }
          renderItem={({ item }) => (
             <JobCard job={item} routePrefix="/(app)/jobs/" showTodayBadge={false} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyDay}>
              <Text style={styles.emptyText}>No jobs on this day</Text>
              {isAdmin && (
                <TouchableOpacity style={styles.addJobBtn} onPress={handleCreateJobFromCalendar}>
                   <Ionicons name="add" size={16} color={Colors.primary} />
                   <Text style={styles.addJobText}>Schedule Job</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
      
      {isAdmin && (
        <TouchableOpacity style={styles.fab} onPress={handleCreateJobFromCalendar}>
           <Ionicons name="add" size={30} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  screenTitle: { fontSize: 24, fontWeight: '800', color: Colors.text },
  todayBtn: { backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  todayBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  calendarCard: { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 20, ...Colors.shadow, overflow: 'hidden' },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dayTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  countText: { fontSize: 12, color: Colors.textLight },
  emptyDay: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.textLight },
  addJobBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' },
  addJobText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  fab: { position: 'absolute', right: 20, bottom: 30, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 5 },
});