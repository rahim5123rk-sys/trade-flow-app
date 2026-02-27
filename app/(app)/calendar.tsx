import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, UI } from '../../constants/theme';
import { useRealtimeJobs } from '../../hooks/useRealtime';
import { supabase } from '../../src/config/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { Job } from '../../src/types';
import { toDateString } from '../../src/utils/dates';
import { getStatusStyle } from '../../src/utils/formatting';

  const GLASS_BG = UI.glass.bg;
  const GLASS_BORDER = UI.glass.border;

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

    const selectedConfig = { selected: true, selectedColor: Colors.primary, selectedTextColor: UI.surface.card };
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

  const handleCreateJobFromCalendar = () => {
    router.push({
      pathname: '/(app)/jobs/create',
      params: { prefillDate: selectedDate },
    } as any);
  };

  const renderDayJob = ({ item, index }: { item: Job; index: number }) => {
    const status = getStatusStyle(item.status);
    const time = new Date(item.scheduled_date).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <Animated.View entering={FadeInRight.delay(Math.min(index * 40, 240)).springify()}>
        <TouchableOpacity
          style={styles.jobCard}
          activeOpacity={0.7}
          onPress={() => router.push(`/(app)/jobs/${item.id}` as any)}
        >
          <LinearGradient colors={[status.color, `${status.color}88`] as const} style={styles.jobStrip} />
          <View style={styles.jobBody}>
            <View style={styles.jobTopRow}>
              <View style={styles.timePill}>
                <Ionicons name="time-outline" size={12} color={UI.text.muted} />
                <Text style={styles.timeText}>{time}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: `${status.color}18` }]}>
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={[styles.statusText, { color: status.color }]}>
                  {String(item.status).replace('_', ' ')}
                </Text>
              </View>
            </View>

            <Text style={styles.jobTitle} numberOfLines={1}>
              {item.title}
            </Text>

            <View style={styles.jobMetaRow}>
              <Ionicons name="person-outline" size={13} color={UI.text.muted} />
              <Text style={styles.jobMetaText} numberOfLines={1}>
                {item.customer_snapshot?.name || 'Unknown customer'}
              </Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={18} color={UI.surface.border} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <LinearGradient
        colors={UI.gradients.appBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View entering={FadeInDown.delay(40).springify()} style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>Calendar</Text>
          <Text style={styles.screenSubtitle}>Plan and track your jobs</Text>
        </View>
        <TouchableOpacity style={styles.todayBtn} onPress={() => setSelectedDate(new Date().toISOString().split('T')[0])}>
          <Ionicons name="today-outline" size={14} color={UI.brand.primary} />
          <Text style={styles.todayBtnText}>Today</Text>
        </TouchableOpacity>
      </Animated.View>

      {loading && !refreshing ? (
        <ActivityIndicator style={{ marginTop: 28 }} color={UI.brand.primary} />
      ) : (
        <FlatList
          data={dayJobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchJobs(); }} tintColor={UI.brand.primary} />}
          ListHeaderComponent={
            <>
              <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.calendarCard}>
                <Calendar
                  onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
                  markedDates={markedDates}
                  markingType="multi-dot"
                  theme={{
                    todayTextColor: UI.brand.primary,
                    selectedDayBackgroundColor: UI.brand.primary,
                    arrowColor: UI.brand.primary,
                    dotColor: UI.brand.accent,
                  }}
                  style={{ borderRadius: 18 }}
                />
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.dayHeaderCard}>
                <View style={styles.dayHeaderRow}>
                  <Text style={styles.dayTitle}>{selectedDateFormatted}</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{dayJobs.length}</Text>
                  </View>
                </View>
                <Text style={styles.daySubtitle}>Jobs scheduled for this day</Text>
              </Animated.View>
            </>
          }
          renderItem={renderDayJob}
          ListEmptyComponent={
            <View style={styles.emptyDay}>
              <Ionicons name="calendar-clear-outline" size={34} color={UI.surface.border} />
              <Text style={styles.emptyText}>No jobs on this day</Text>
              {isAdmin && (
                <TouchableOpacity style={styles.addJobBtn} onPress={handleCreateJobFromCalendar}>
                  <Ionicons name="add" size={16} color={UI.brand.primary} />
                  <Text style={styles.addJobText}>Schedule Job</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {isAdmin && (
        <TouchableOpacity style={styles.fab} onPress={handleCreateJobFromCalendar} activeOpacity={0.85}>
          <LinearGradient colors={UI.gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradient}>
            <Ionicons name="add" size={28} color={UI.surface.card} />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenTitle: { fontSize: 30, fontWeight: '800', color: UI.text.title },
  screenSubtitle: { fontSize: 13, color: UI.text.muted, marginTop: 2 },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: GLASS_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  todayBtnText: { fontSize: 13, fontWeight: '700', color: UI.brand.primary },
  calendarCard: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
    ...Colors.shadow,
  },
  dayHeaderCard: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  dayHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayTitle: { fontSize: 16, fontWeight: '700', color: UI.text.title, flex: 1, marginRight: 10 },
  daySubtitle: { fontSize: 12, color: UI.text.muted, marginTop: 4 },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(99,102,241,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countText: { color: UI.brand.primary, fontWeight: '800', fontSize: 12 },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
    paddingRight: 12,
  },
  jobStrip: { width: 4, alignSelf: 'stretch' },
  jobBody: { flex: 1, paddingVertical: 12, paddingLeft: 8, paddingRight: 2 },
  jobTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.80)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  timeText: { fontSize: 11, color: UI.text.body, fontWeight: '600' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  jobTitle: { fontSize: 16, fontWeight: '700', color: UI.text.title },
  jobMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  jobMetaText: { fontSize: 13, color: UI.text.body, flex: 1 },
  emptyDay: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  emptyText: { fontSize: 14, color: UI.text.muted, fontWeight: '600' },
  addJobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  addJobText: { fontSize: 13, fontWeight: '700', color: UI.brand.primary },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    ...Colors.shadow,
  },
  fabGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});