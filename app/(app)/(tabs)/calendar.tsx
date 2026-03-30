import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router, useFocusEffect} from 'expo-router';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {Calendar, DateData} from 'react-native-calendars';
import Animated, {FadeInDown, FadeInRight} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import ProPaywallModal from '../../../components/ProPaywallModal';
import {UI} from '../../../constants/theme';
import {useRealtimeJobs} from '../../../hooks/useRealtime';
import {supabase} from '../../../src/config/supabase';
import {useAuth} from '../../../src/context/AuthContext';
import {useSubscription} from '../../../src/context/SubscriptionContext';
import {useAppTheme} from '../../../src/context/ThemeContext';
import {Job} from '../../../src/types';
import {formatLocalDateKey, toDateString} from '../../../src/utils/dates';
import {getStatusStyle} from '../../../src/utils/formatting';

const SCREEN_BG = '#F8F9FA';
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Get the week (Sun–Sat) containing `date`. */
function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return Array.from({length: 7}, (_, i) => {
    const dd = new Date(d);
    dd.setDate(d.getDate() + i);
    return dd;
  });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getPrimaryAddressLine(job: Job) {
  return job.customer_snapshot?.address_line_1 || job.customer_snapshot?.address?.split(',')[0]?.trim() || job.customer_snapshot?.name || 'Unknown location';
}

function formatGroupLabel(dateValue: number, today: Date) {
  const date = new Date(dateValue);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, tomorrow)) return 'Tomorrow';

  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

type CalendarListItem =
  | {id: string; type: 'header'; title: string}
  | {id: string; type: 'job'; job: Job; subtitle: string};

export default function UnifiedCalendarScreen() {
  const {userProfile, user} = useAuth();
  const {theme, isDark} = useAppTheme();
  const {isPro} = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!isPro) setShowPaywall(true);
    }, [isPro])
  );
  const insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(Boolean(userProfile?.company_id));
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => formatLocalDateKey(new Date()));
  const [listMode, setListMode] = useState<'day' | 'week' | 'month'>('day');
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [today, setToday] = useState(() => new Date());
  const weekScrollRef = useRef<ScrollView>(null);

  const isAdmin = userProfile?.role === 'admin';

  // Derived week state
  const selectedDateObj = useMemo(() => new Date(selectedDate + 'T00:00:00'), [selectedDate]);
  const weekDays = useMemo(() => getWeekDays(selectedDateObj), [selectedDateObj]);
  const monthLabel = selectedDateObj.toLocaleDateString('en-GB', {month: 'long'});
  const yearLabel = selectedDateObj.getFullYear().toString();
  const isToday = isSameDay(selectedDateObj, today);

  useFocusEffect(
    useCallback(() => {
      setToday(new Date());

      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const timeout = setTimeout(() => {
        setToday(new Date());
      }, Math.max(nextMidnight.getTime() - now.getTime() + 250, 250));

      return () => clearTimeout(timeout);
    }, [])
  );

  const navigateWeek = (dir: -1 | 1) => {
    const d = new Date(selectedDateObj);
    d.setDate(d.getDate() + dir * 7);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const monthCacheRef = useRef<Record<string, Job[]>>({});

  const fetchJobsForMonth = useCallback(async (year: number, month: number, force = false) => {
    if (!userProfile?.company_id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    if (!force && monthCacheRef.current[key]) {
      setJobs(monthCacheRef.current[key]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const monthStart = new Date(year, month, 1).getTime();
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

      let query = supabase
        .from('jobs')
        .select('id, title, status, scheduled_date, customer_snapshot, assigned_to')
        .eq('company_id', userProfile.company_id)
        .neq('status', 'cancelled')
        .gte('scheduled_date', monthStart)
        .lte('scheduled_date', monthEnd)
        .order('scheduled_date', {ascending: true});

      if (!isAdmin && user) {
        query = query.contains('assigned_to', [user.id]);
      }

      const {data, error} = await query;
      if (error) throw error;

      const rows = (data || []) as Job[];
      monthCacheRef.current[key] = rows;
      setJobs(rows);
    } catch (e) {
      console.error('Calendar fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userProfile?.company_id, isAdmin, user?.id]);

  useEffect(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    setLoading(true);
    fetchJobsForMonth(d.getFullYear(), d.getMonth());
  }, [selectedDate, fetchJobsForMonth]);

  useRealtimeJobs(userProfile?.company_id, () => {
    const d = new Date(selectedDate + 'T00:00:00');
    fetchJobsForMonth(d.getFullYear(), d.getMonth(), true);
  });

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    monthCacheRef.current = {};
    const d = new Date(selectedDate + 'T00:00:00');
    fetchJobsForMonth(d.getFullYear(), d.getMonth(), true);
  }, [selectedDate, fetchJobsForMonth]);

  const dayJobs = useMemo(() => {
    return jobs
      .filter((job) => toDateString(job.scheduled_date) === selectedDate)
      .sort((a, b) => a.scheduled_date - b.scheduled_date);
  }, [jobs, selectedDate]);

  const weekJobs = useMemo(() => {
    const start = new Date(selectedDateObj);
    start.setHours(0, 0, 0, 0);
    const end = new Date(weekDays[6]);
    end.setHours(23, 59, 59, 999);

    return jobs
      .filter((job) => {
        const when = new Date(job.scheduled_date).getTime();
        return when >= start.getTime() && when <= end.getTime();
      })
      .sort((a, b) => a.scheduled_date - b.scheduled_date);
  }, [jobs, selectedDateObj, weekDays]);

  const monthJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        const when = new Date(job.scheduled_date);
        return when.getMonth() === selectedDateObj.getMonth() && when.getFullYear() === selectedDateObj.getFullYear();
      })
      .sort((a, b) => a.scheduled_date - b.scheduled_date);
  }, [jobs, selectedDateObj]);

  // Count jobs per date for dot indicators
  const jobCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    jobs.forEach((j) => {
      const ds = toDateString(j.scheduled_date);
      map[ds] = (map[ds] || 0) + 1;
    });
    return map;
  }, [jobs]);

  // Marked dates for full calendar modal
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    jobs.forEach((job) => {
      const dateStr = toDateString(job.scheduled_date);
      if (!marks[dateStr]) marks[dateStr] = {dots: [], marked: true};
      const {color} = getStatusStyle(job.status);
      if (marks[dateStr].dots.length < 3) marks[dateStr].dots.push({key: job.id, color});
    });
    const selectedConfig = {selected: true, selectedColor: '#3B82F6', selectedTextColor: '#fff'};
    marks[selectedDate] = marks[selectedDate] ? {...marks[selectedDate], ...selectedConfig} : selectedConfig;
    return marks;
  }, [jobs, selectedDate]);

  const dateSummaryLabel = isToday
    ? `Today, ${selectedDateObj.toLocaleDateString('en-GB', {month: 'long', day: 'numeric'})}`
    : selectedDateObj.toLocaleDateString('en-GB', {weekday: 'long', month: 'long', day: 'numeric'});

  const listMeta = useMemo(() => {
    if (listMode === 'week') {
      return {
        title: 'This Week',
        jobs: weekJobs,
        emptyText: 'No jobs scheduled this week',
      };
    }

    if (listMode === 'month') {
      return {
        title: 'This Month',
        jobs: monthJobs,
        emptyText: 'No jobs scheduled this month',
      };
    }

    return {
      title: dateSummaryLabel,
      jobs: dayJobs,
      emptyText: 'No jobs on this day',
    };
  }, [dateSummaryLabel, dayJobs, listMode, monthJobs, weekJobs]);

  const listItems = useMemo<CalendarListItem[]>(() => {
    if (listMode === 'day') {
      return listMeta.jobs.map((job) => ({
        id: job.id,
        type: 'job',
        job,
        subtitle: getPrimaryAddressLine(job),
      }));
    }

    const items: CalendarListItem[] = [];
    let lastDate = '';

    listMeta.jobs.forEach((job) => {
      const dateKey = toDateString(job.scheduled_date);
      if (dateKey !== lastDate) {
        items.push({
          id: `header-${dateKey}`,
          type: 'header',
          title: formatGroupLabel(job.scheduled_date, today),
        });
        lastDate = dateKey;
      }

      items.push({
        id: job.id,
        type: 'job',
        job,
        subtitle: getPrimaryAddressLine(job),
      });
    });

    return items;
  }, [listMeta.jobs, listMode, today]);

  const handleCreateJobFromCalendar = () => {
    router.push({
      pathname: '/(app)/jobs/create',
      params: {prefillDate: selectedDate},
    } as any);
  };

  const renderJobCard = (item: Job, index: number, subtitle: string) => {
    const status = getStatusStyle(item.status);
    const time = new Date(item.scheduled_date).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <Animated.View entering={FadeInRight.delay(Math.min(index * 40, 240)).springify()}>
        <TouchableOpacity
          style={[styles.jobCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
          activeOpacity={0.7}
          onPress={() => router.push({pathname: '/(app)/jobs/[id]', params: {id: item.id, from: 'calendar'}} as any)}
        >
          <View style={styles.jobBody}>
            <View style={styles.jobRow}>
              <Text style={[styles.timeText, {color: theme.text.muted}]}>{time}</Text>
              <View style={styles.jobDivider} />
              <View style={styles.jobInfo}>
                <Text style={[styles.jobTitle, {color: theme.text.title}]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.jobCustomer, {color: theme.text.muted}]} numberOfLines={1}>
                  {subtitle}
                </Text>
              </View>
              <View style={[styles.statusPill, {backgroundColor: `${status.color}14`}]}>
                <Text style={[styles.statusText, {color: status.color}]}>
                  {String(item.status).replace('_', ' ')}
                </Text>
              </View>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={16} color={theme.surface.border} style={{marginRight: 14}} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderVisibleJob = ({item, index}: {item: CalendarListItem; index: number}) => {
    if (item.type === 'header') {
      return (
        <Animated.View entering={FadeInDown.delay(Math.min(index * 30, 180)).springify()}>
          <View style={styles.groupHeader}>
            <Text style={[styles.groupHeaderText, {color: theme.text.title}]}>{item.title}</Text>
          </View>
        </Animated.View>
      );
    }

    return renderJobCard(item.job, index, item.subtitle);
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <ProPaywallModal
        visible={showPaywall && !isPro}
        onDismiss={() => { setShowPaywall(false); router.replace('/(app)/dashboard' as any); }}
        featureTitle="Smart Scheduling"
        featureDescription="Plan your week with an interactive calendar. See all your jobs at a glance and never double-book."
      />
      {/* Subtle gradient background */}
      <LinearGradient
        colors={isDark ? [theme.surface.base, theme.surface.base, theme.surface.base] : theme.gradients.appBackground}
        start={{x: 0.5, y: 0}}
        end={{x: 0.5, y: 1}}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Top App Bar ── */}
      <View style={styles.appBar}>
        <View style={{width: 36}} />
        <Text style={[styles.appBarTitle, {color: theme.text.title}]}>Calendar</Text>
        <TouchableOpacity
          hitSlop={12}
          onPress={() => setShowFullCalendar(true)}
        >
          <Ionicons name="calendar-outline" size={22} color={theme.text.muted} />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator style={{marginTop: 28}} color={theme.brand.primary} />
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{paddingHorizontal: 16, paddingBottom: 120}}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.brand.primary} />}
          ListHeaderComponent={
            <>
              {/* ── Month/Year + Arrows (outside the white box) ── */}
              <Animated.View entering={FadeInDown.delay(40).springify()} style={styles.monthArrowRow}>
                <View style={styles.monthYearWrap}>
                  <Text style={[styles.monthText, {color: theme.text.title}]}>{monthLabel}</Text>
                  <Text style={[styles.yearText, {color: theme.text.muted}]}>{yearLabel}</Text>
                </View>
                <View style={styles.arrowsWrap}>
                  <TouchableOpacity hitSlop={12} onPress={() => navigateWeek(-1)} style={styles.arrowBtn}>
                    <Ionicons name="chevron-back" size={18} color={theme.text.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity hitSlop={12} onPress={() => navigateWeek(1)} style={styles.arrowBtn}>
                    <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* ── Week Strip inside white card ── */}
              <Animated.View entering={FadeInDown.delay(60).springify()} style={[styles.weekCard, isDark && {backgroundColor: theme.glass.bg}]}>
                <ScrollView
                  ref={weekScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.weekRow}
                >
                  {weekDays.map((d) => {
                    const ds = formatLocalDateKey(d);
                    const isSelected = ds === selectedDate;
                    const hasJobs = (jobCountByDate[ds] || 0) > 0;
                    return (
                      <TouchableOpacity
                        key={ds}
                        style={[styles.dayCell, isSelected && styles.dayCellActive]}
                        activeOpacity={0.7}
                        onPress={() => setSelectedDate(ds)}
                      >
                        <Text style={[styles.dayName, {color: isSelected ? '#fff' : theme.text.muted}]}>
                          {DAY_NAMES[d.getDay()]}
                        </Text>
                        <Text style={[styles.dayNum, {color: isSelected ? '#fff' : theme.text.title}]}>
                          {d.getDate()}
                        </Text>
                        {hasJobs && !isSelected && <View style={styles.dayDot} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </Animated.View>

              {/* ── Date Summary (directly on background) ── */}
              <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.dateSummary}>
                <Text style={[styles.dateSummaryTitle, {color: theme.text.title}]}>{listMeta.title}</Text>
                <Text style={[styles.dateSummaryCount, {color: theme.text.muted}]}>
                  {listMeta.jobs.length} {listMeta.jobs.length === 1 ? 'job' : 'jobs'}
                </Text>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(120).springify()} style={[styles.toggleWrap, isDark && {backgroundColor: theme.glass.bg}]}>
                <TouchableOpacity
                  style={[styles.toggleButton, listMode === 'day' && styles.toggleButtonActive]}
                  onPress={() => setListMode('day')}
                >
                  <Text style={[styles.toggleText, {color: listMode === 'day' ? UI.brand.primary : theme.text.muted}]}>Day</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleButton, listMode === 'week' && styles.toggleButtonActive]}
                  onPress={() => setListMode('week')}
                >
                  <Text style={[styles.toggleText, {color: listMode === 'week' ? UI.brand.primary : theme.text.muted}]}>Week</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleButton, listMode === 'month' && styles.toggleButtonActive]}
                  onPress={() => setListMode('month')}
                >
                  <Text style={[styles.toggleText, {color: listMode === 'month' ? UI.brand.primary : theme.text.muted}]}>Month</Text>
                </TouchableOpacity>
              </Animated.View>
            </>
          }
          renderItem={renderVisibleJob}
          ListEmptyComponent={
            <View style={[styles.emptyDay, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
              <Ionicons name="calendar-clear-outline" size={34} color={theme.surface.border} />
              <Text style={[styles.emptyText, {color: theme.text.muted}]}>{listMeta.emptyText}</Text>
              {listMode === 'day' && (
                <TouchableOpacity style={styles.addJobBtn} onPress={handleCreateJobFromCalendar}>
                  <Ionicons name="add" size={16} color={UI.brand.primary} />
                  <Text style={styles.addJobText}>{isAdmin ? 'Schedule Job' : 'Add Job'}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* ── Full Calendar Modal ── */}
      <Modal
        visible={showFullCalendar}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFullCalendar(false)}
      >
        <View style={[styles.modalContainer, {paddingTop: insets.top}]}>
          <LinearGradient
            colors={isDark ? [theme.surface.base, theme.surface.base, theme.surface.base] : theme.gradients.appBackground}
            start={{x: 0.5, y: 0}}
            end={{x: 0.5, y: 1}}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, {color: theme.text.title}]}>Select Date</Text>
            <TouchableOpacity hitSlop={12} onPress={() => setShowFullCalendar(false)}>
              <Ionicons name="close" size={24} color={theme.text.muted} />
            </TouchableOpacity>
          </View>
          <View style={[styles.fullCalendarCard, isDark && {backgroundColor: theme.glass.bg}]}>
            <Calendar
              current={selectedDate}
              onDayPress={(day: DateData) => {
                setSelectedDate(day.dateString);
                setShowFullCalendar(false);
              }}
              markedDates={markedDates}
              markingType="multi-dot"
              theme={{
                calendarBackground: 'transparent',
                dayTextColor: theme.text.title,
                monthTextColor: theme.text.title,
                textSectionTitleColor: theme.text.body,
                textDayHeaderFontWeight: '600' as const,
                textDisabledColor: isDark ? theme.text.placeholder : '#B0B8C4',
                todayTextColor: '#3B82F6',
                selectedDayBackgroundColor: '#3B82F6',
                selectedDayTextColor: '#fff',
                arrowColor: theme.text.muted,
                dotColor: '#3B82F6',
                textDayFontWeight: '500' as const,
                textMonthFontWeight: '700' as const,
              }}
              style={{borderRadius: 18}}
            />
          </View>
          <TouchableOpacity
            style={styles.todayModalBtn}
            onPress={() => {
              const nextToday = new Date();
              setToday(nextToday);
              setSelectedDate(formatLocalDateKey(nextToday));
              setShowFullCalendar(false);
            }}
          >
            <Ionicons name="today-outline" size={16} color="#3B82F6" />
            <Text style={styles.todayModalBtnText}>Go to Today</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},

  /* ── App Bar ── */
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  appBarTitle: {fontSize: 17, fontWeight: '600', color: UI.text.title},

  /* ── Month/Year + Arrows (outside the white box) ── */
  monthArrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  monthYearWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  monthText: {fontSize: 18, fontWeight: '800'},
  yearText: {fontSize: 16, fontWeight: '400'},
  arrowsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },

  /* ── Week strip in white card ── */
  weekCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: 64,
    borderRadius: 14,
  },
  dayCellActive: {
    backgroundColor: '#3B82F6',
  },
  dayName: {fontSize: 11, fontWeight: '600', marginBottom: 4},
  dayNum: {fontSize: 16, fontWeight: '700'},
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3B82F6',
    marginTop: 4,
  },

  /* ── Date summary (no card) ── */
  dateSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 14,
  },
  dateSummaryTitle: {fontSize: 18, fontWeight: '700', color: UI.text.title},
  dateSummaryCount: {fontSize: 13, fontWeight: '500', color: UI.text.muted},
  toggleWrap: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  toggleButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* ── Job Cards ── */
  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  jobBody: {flex: 1, paddingVertical: 18, paddingHorizontal: 18},
  jobRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  timeText: {fontSize: 14, fontWeight: '600', color: UI.text.muted, width: 42},
  jobDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(148,163,184,0.28)',
  },
  jobInfo: {flex: 1},
  jobTitle: {fontSize: 16, fontWeight: '700', color: UI.text.title},
  jobCustomer: {fontSize: 13, color: UI.text.muted, marginTop: 4},
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {fontSize: 11, fontWeight: '700', textTransform: 'capitalize'},
  groupHeader: {paddingTop: 8, paddingBottom: 10},
  groupHeaderText: {fontSize: 18, fontWeight: '800', letterSpacing: -0.2},

  /* ── Empty state ── */
  emptyDay: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyText: {fontSize: 14, color: UI.text.muted, fontWeight: '600'},
  addJobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    backgroundColor: 'rgba(59,130,246,0.06)',
  },
  addJobText: {fontSize: 13, fontWeight: '700', color: UI.brand.primary},

  /* ── Full Calendar Modal ── */
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalTitle: {fontSize: 20, fontWeight: '700'},
  fullCalendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginHorizontal: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  todayModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  todayModalBtnText: {fontSize: 14, fontWeight: '700', color: '#3B82F6'},
});