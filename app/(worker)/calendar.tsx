// ============================================
// FILE: app/(worker)/calendar.tsx
// ============================================

import { Ionicons } from '@expo/vector-icons';
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

export default function WorkerCalendarScreen() {
  const { userProfile, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const fetchJobs = useCallback(async () => {
    if (!userProfile?.company_id || !user) return;
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .contains('assigned_to', [user.id])
        .neq('status', 'cancelled')
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      if (data) setJobs(data as Job[]);
    } catch (e) {
      console.error('Worker calendar fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userProfile?.company_id, user?.id]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useRealtimeJobs(userProfile?.company_id, fetchJobs);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    jobs.forEach((job) => {
      const dateStr = toDateString(job.scheduled_date);
      if (!marks[dateStr]) {
        marks[dateStr] = { dots: [], marked: true };
      }
      const { color } = getStatusStyle(job.status);
      if (marks[dateStr].dots.length < 3) {
        marks[dateStr].dots.push({ key: job.id, color });
      }
    });

    if (marks[selectedDate]) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: Colors.primary,
        selectedTextColor: '#FFFFFF',
      };
    } else {
      marks[selectedDate] = {
        selected: true,
        selectedColor: Colors.primary,
        selectedTextColor: '#FFFFFF',
      };
    }

    return marks;
  }, [jobs, selectedDate]);

  const dayJobs = useMemo(() => {
    return jobs
      .filter((job) => toDateString(job.scheduled_date) === selectedDate)
      .sort((a, b) => a.scheduled_date - b.scheduled_date);
  }, [jobs, selectedDate]);

  const selectedDateFormatted = new Date(
    selectedDate + 'T00:00:00'
  ).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>My Calendar</Text>
        <TouchableOpacity
          style={styles.todayBtn}
          onPress={() =>
            setSelectedDate(new Date().toISOString().split('T')[0])
          }
        >
          <Ionicons name="today-outline" size={16} color={Colors.primary} />
          <Text style={styles.todayBtnText}>Today</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={dayJobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchJobs();
            }}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.calendarCard}>
              <Calendar
                onDayPress={(day: DateData) =>
                  setSelectedDate(day.dateString)
                }
                markedDates={markedDates}
                markingType="multi-dot"
                theme={{
                  backgroundColor: '#FFFFFF',
                  calendarBackground: '#FFFFFF',
                  todayTextColor: Colors.primary,
                  arrowColor: Colors.primary,
                  textDayFontWeight: '500',
                  textMonthFontWeight: '700',
                  selectedDayBackgroundColor: Colors.primary,
                  selectedDayTextColor: '#FFFFFF',
                }}
                style={styles.calendar}
              />
            </View>

            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{selectedDateFormatted}</Text>
              <Text style={styles.countText}>
                {dayJobs.length} {dayJobs.length === 1 ? 'job' : 'jobs'}
              </Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <JobCard
            job={item}
            routePrefix="/(worker)/jobs/"
            showTodayBadge={false}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyDay}>
            <Ionicons
              name="calendar-clear-outline"
              size={32}
              color={Colors.textLight}
            />
            <Text style={styles.emptyText}>No jobs on this day</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  screenTitle: { fontSize: 24, fontWeight: '800', color: Colors.text },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  todayBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    ...Colors.shadow,
  },
  calendar: { borderRadius: 16 },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  countText: { fontSize: 12, fontWeight: '600', color: Colors.textLight },
  emptyDay: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.textLight },
});