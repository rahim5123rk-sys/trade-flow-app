import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, UI } from '../constants/theme';
import { useAppTheme } from '../src/context/ThemeContext';
import { Job } from '../src/types';
import { formatCalendarDate, formatTime, isToday } from '../src/utils/dates';
import { formatCurrency, getStatusStyle } from '../src/utils/formatting';
import { StatusBadge } from './StatusBadge';

interface JobCardProps {
  job: Job;
  /** Route prefix for navigation. Default: '/(app)/jobs/' */
  routePrefix?: string;
  /** Show the date alongside time */
  showDate?: boolean;
  /** Show the today badge */
  showTodayBadge?: boolean;
  /** Compact layout for inline lists */
  compact?: boolean;
}

export function JobCard({
  job,
  routePrefix = '/(app)/jobs/',
  showDate = false,
  showTodayBadge = true,
  compact = false,
}: JobCardProps) {
  const { color: statusColor } = getStatusStyle(job.status);
  const { theme, isDark } = useAppTheme();
  const jobIsToday = isToday(job.scheduled_date);

  const handlePress = () => {
    router.push(`${routePrefix}${job.id}` as any);
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactCard, { backgroundColor: theme.surface.card }, isDark && { borderWidth: 1, borderColor: theme.glass.border }]}
        activeOpacity={0.7}
        onPress={handlePress}
      >
        <View style={[styles.indicator, { backgroundColor: isDark ? theme.text.title : statusColor }]} />
        <View style={styles.compactContent}>
          <Text style={[styles.compactTitle, { color: theme.text.title }]} numberOfLines={1}>
            {job.title}
          </Text>
          <Text style={[styles.compactSub, { color: theme.text.muted }]} numberOfLines={1}>
            {job.customer_snapshot?.name || 'Unknown'}
          </Text>
        </View>
        <Text style={[styles.compactTime, { color: theme.text.muted }]}>{formatTime(job.scheduled_date)}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surface.card, borderColor: isDark ? theme.glass.border : UI.surface.elevated }, isDark && theme.shadow]}
      activeOpacity={0.7}
      onPress={handlePress}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.ref, { color: theme.text.muted }]}>{job.reference}</Text>
        <StatusBadge status={job.status} compact />
      </View>

      <Text style={[styles.title, { color: theme.text.title }]} numberOfLines={1}>
        {job.title}
      </Text>

      <View style={styles.customerRow}>
        <Ionicons name="person-outline" size={14} color={theme.text.muted} />
        <Text style={[styles.customer, { color: theme.text.body }]} numberOfLines={1}>
          {job.customer_snapshot?.name || 'Unknown Client'}
        </Text>
      </View>

      <View style={[styles.footer, { borderTopColor: isDark ? theme.surface.divider : UI.surface.elevated }]}>
        <View style={styles.footerLeft}>
          {showDate && (
            <View style={styles.footerItem}>
              <Ionicons
                name="calendar-outline"
                size={14}
                color={theme.brand.primary}
              />
              <Text style={[styles.footerText, { color: theme.text.muted }]}>
                {formatCalendarDate(job.scheduled_date)}
              </Text>
            </View>
          )}
          <View style={styles.footerItem}>
            <Ionicons name="time-outline" size={14} color={theme.brand.primary} />
            <Text style={[styles.footerText, { color: theme.text.muted }]}>
              {formatTime(job.scheduled_date)}
            </Text>
          </View>
          {showTodayBadge && jobIsToday && (
            <View style={[styles.todayBadge, { backgroundColor: theme.brand.primary }]}>
              <Text style={[styles.todayText, { color: isDark ? '#000' : UI.surface.card }]}>TODAY</Text>
            </View>
          )}
        </View>
        {job.price != null && (
          <Text style={[styles.price, { color: theme.brand.primary }]}>{formatCurrency(job.price)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Full card
  card: {
    backgroundColor: UI.surface.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: UI.surface.elevated,
    ...Colors.shadow,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ref: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textLight,
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  customer: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: UI.surface.elevated,
    paddingTop: 12,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 13,
    color: Colors.textLight,
    fontWeight: '500',
  },
  todayBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  todayText: {
    color: UI.surface.card,
    fontSize: 9,
    fontWeight: '700',
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },

  // Compact card
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.surface.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    ...Colors.shadow,
  },
  indicator: {
    width: 4,
    height: 28,
    borderRadius: 2,
    marginRight: 12,
  },
  compactContent: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  compactSub: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  compactTime: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
    marginLeft: 8,
  },
});