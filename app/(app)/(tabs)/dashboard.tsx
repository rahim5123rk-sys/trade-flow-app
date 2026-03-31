// ============================================
// FILE: app/(app)/dashboard.tsx
// Modern glassmorphism dashboard
// ============================================

import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router, useFocusEffect} from 'expo-router';
import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  SlideInRight,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import JobAcceptModal from '../../../components/JobAcceptModal';
import Onboarding, {OnboardingTip} from '../../../components/Onboarding';
import {Colors, UI} from '../../../constants/theme';
import {useRealtimeJobs} from '../../../hooks/useRealtime';
import {supabase} from '../../../src/config/supabase';
import {useAuth} from '../../../src/context/AuthContext';
import {useSubscription} from '../../../src/context/SubscriptionContext';
import {ThemeTokens, useAppTheme} from '../../../src/context/ThemeContext';
import {Document} from '../../../src/types';
import {withQueryTimeout} from '../../../src/utils/withTimeout';

// ─── Dashboard Onboarding Tips ─────────────
const ADMIN_TIPS: OnboardingTip[] = [
  {
    title: 'Welcome to GasPilot',
    description: 'Your all-in-one job management app. Let\'s take a quick tour of what you can do.',
    icon: 'rocket-outline',
    position: 'center',
    arrowDirection: 'none',
    accent: '#1D4ED8',
  },
  {
    title: 'Your Dashboard',
    description: 'See active jobs, pending work and revenue at a glance. Pull down to refresh anytime.',
    icon: 'grid-outline',
    position: 'top',
    arrowDirection: 'up',
    accent: '#1D4ED8',
  },
  {
    title: 'Quick Actions',
    description: 'Create new jobs, fill out forms, generate gas certs, send invoices and quotes — all from here.',
    icon: 'flash-outline',
    position: 'top',
    arrowDirection: 'down',
    accent: '#7C3AED',
  },
  {
    title: 'Upcoming Jobs',
    description: 'Your next upcoming jobs appear below. Tap any job to view details, update status or add photos.',
    icon: 'calendar-outline',
    position: 'center',
    arrowDirection: 'down',
    accent: '#059669',
  },
  {
    title: 'Bottom Navigation',
    description: 'Use the tabs at the bottom to switch between Home, Calendar, Docs and Jobs.',
    icon: 'compass-outline',
    position: 'bottom',
    arrowDirection: 'down',
    accent: '#D97706',
  },
  {
    title: 'Settings & Profile',
    description: 'Tap your avatar in the top right to manage company details, signature, invoice settings and invite workers.',
    icon: 'settings-outline',
    position: 'top',
    arrowDirection: 'up',
    accent: '#64748B',
  },
];

const WORKER_TIPS: OnboardingTip[] = [
  {
    title: 'Welcome to GasPilot',
    description: 'Your jobs, schedule and tasks in one place. Let\'s walk through the basics.',
    icon: 'rocket-outline',
    position: 'center',
    arrowDirection: 'none',
    accent: '#1D4ED8',
  },
  {
    title: 'Your Dashboard',
    description: 'See your active and pending jobs at a glance. Pull down to refresh.',
    icon: 'grid-outline',
    position: 'top',
    arrowDirection: 'up',
    accent: '#1D4ED8',
  },
  {
    title: 'Today\'s Jobs',
    description: 'Jobs assigned to you for today appear here. Tap a job to view details, update progress or add photos.',
    icon: 'briefcase-outline',
    position: 'center',
    arrowDirection: 'down',
    accent: '#059669',
  },
  {
    title: 'Bottom Navigation',
    description: 'Use the Calendar tab to see your upcoming schedule and the Jobs tab for a full list.',
    icon: 'calendar-outline',
    position: 'bottom',
    arrowDirection: 'down',
    accent: '#D97706',
  },
];

interface DashboardJob {
  id: string;
  company_id: string;
  title: string;
  status: string;
  payment_status?: string;
  scheduled_date: number;
  price?: number;
  assigned_to?: string[];
  customer_snapshot?: {
    name: string;
    address: string;
  };
}

interface DashboardRenewal {
  doc: Document;
  dueInDays: number | null;
  dueDate: string | null;
  dueTone: {color: string; urgent: boolean};
  typeLabel: string;
  referenceText: string;
}

const DASHBOARD_GAS_KINDS = new Set<string>([
  'cp12',
  'service_record',
  'warning_notice',
  'commissioning',
  'decommissioning',
  'breakdown_report',
  'installation_cert',
]);

const getPaymentInfoKind = (doc: Document): string | null => {
  if (!doc.payment_info) return null;
  try {
    return JSON.parse(doc.payment_info)?.kind ?? null;
  } catch {
    return null;
  }
};

const getSiteAddress = (doc: Document): string => {
  if (doc.payment_info) {
    try {
      const parsed = JSON.parse(doc.payment_info);
      if (parsed?.pdfData?.propertyAddress) return parsed.pdfData.propertyAddress as string;
    } catch { }
  }

  const jobAddress = (doc as any).job_address;
  if (jobAddress?.address_line_1) {
    return [jobAddress.address_line_1, jobAddress.city, jobAddress.postcode].filter(Boolean).join(', ');
  }

  const snapshot = doc.customer_snapshot;
  return [snapshot?.address_line_1, snapshot?.city, snapshot?.postal_code].filter(Boolean).join(', ') || snapshot?.address || '';
};

const getPrimaryJobAddressLine = (job: DashboardJob): string => {
  return job.customer_snapshot?.address?.split(',')[0]?.trim() || job.customer_snapshot?.name || 'Unknown location';
};

const isRenewalEligibleDocument = (doc: Document): boolean => {
  const type = doc.type as string;
  const kind = getPaymentInfoKind(doc);

  return (
    type === 'cp12' ||
    type === 'service_record' ||
    DASHBOARD_GAS_KINDS.has(type) ||
    doc.reference?.startsWith('CP12-') === true ||
    doc.reference?.startsWith('SR-') === true ||
    (!!kind && DASHBOARD_GAS_KINDS.has(kind))
  );
};

const formatDisplayDate = (value?: string | null): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getDaysUntil = (value?: string | null): number | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);

  return Math.ceil((parsed.getTime() - today.getTime()) / 86400000);
};

const getDueTone = (value?: string | null) => {
  if (!value) return {color: UI.text.muted, urgent: false};
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return {color: '#B45309', urgent: true};

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((parsed.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return {color: UI.brand.danger, urgent: true};
  if (diffDays <= 7) return {color: '#B45309', urgent: true};
  return {color: UI.text.muted, urgent: false};
};

const getDocumentTypeLabel = (doc: Document): string => {
  const type = doc.type as string;
  const kind = getPaymentInfoKind(doc);
  const resolvedType = DASHBOARD_GAS_KINDS.has(type) ? type : kind;

  switch (resolvedType) {
    case 'cp12':
      return 'Landlord Gas Safety Record';
    case 'service_record':
      return 'Service Record';
    case 'commissioning':
      return 'Commissioning';
    case 'decommissioning':
      return 'Decommissioning';
    case 'warning_notice':
      return 'Warning Notice';
    case 'breakdown_report':
      return 'Breakdown Report';
    case 'installation_cert':
      return 'Installation Certificate';
    case 'invoice':
      return 'Invoice';
    default:
      return 'Quote';
  }
};

const getDocumentReference = (doc: Document): string => {
  const type = doc.type as string;
  const kind = getPaymentInfoKind(doc);

  if (type === 'cp12' || kind === 'cp12' || doc.reference?.startsWith('CP12-')) {
    return doc.reference || `CP12-${String(doc.number).padStart(4, '0')}`;
  }
  if (type === 'service_record' || kind === 'service_record' || doc.reference?.startsWith('SR-')) {
    return doc.reference || `SR-${String(doc.number).padStart(4, '0')}`;
  }
  if (DASHBOARD_GAS_KINDS.has(type) || (kind && DASHBOARD_GAS_KINDS.has(kind))) {
    return doc.reference || `GAS-${String(doc.number).padStart(4, '0')}`;
  }

  return `${type === 'invoice' ? 'INV' : 'QTE'}-${String(doc.number).padStart(4, '0')}`;
};

// --- Greeting based on time of day ---
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// --- Quick Action Pill ---
const QuickAction = ({
  icon,
  label,
  backgroundColor,
  iconColor,
  onPress,
  delay = 0,
  isDark = false,
  theme: t,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  backgroundColor: string;
  iconColor: string;
  onPress: () => void;
  delay?: number;
  isDark?: boolean;
  theme?: ThemeTokens;
}) => {
  const resolvedTheme = t || UI;
  const resolvedButtonColor = isDark ? iconColor : backgroundColor;
  const resolvedIconColor = isDark ? '#FFFFFF' : iconColor;
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
      <TouchableOpacity style={s.quickAction} activeOpacity={0.75} onPress={onPress}>
        <View style={[s.quickButton, {backgroundColor: resolvedButtonColor}, isDark && {shadowColor: 'rgba(255,255,255,0.16)'}]}>
          <Ionicons name={icon} size={24} color={resolvedIconColor} />
        </View>
        <Text style={[s.quickLabel, {color: resolvedTheme.text.body}]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// --- Glassmorphic Stat Card ---
const GlassCard = ({
  label,
  value,
  icon,
  accent,
  delay = 0,
  isDark = false,
  theme: t,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  delay?: number;
  isDark?: boolean;
  theme?: ThemeTokens;
}) => {
  const resolvedTheme = t || UI;
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify()}
      style={s.glassOuter}
    >
      <View style={[s.glassCard, isDark && {backgroundColor: resolvedTheme.glass.bg, borderColor: resolvedTheme.glass.border}]}>
        <View style={[s.glassAccent, {backgroundColor: accent}]} />
        <View style={s.glassBody}>
          <View style={[s.glassIconCircle, {backgroundColor: `${accent}18`}]}>
            <Ionicons name={icon} size={18} color={accent} />
          </View>
          <Text style={[s.glassValue, {color: resolvedTheme.text.title}]}>{value}</Text>
          <Text style={[s.glassLabel, {color: resolvedTheme.text.muted}]}>{label}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

// --- Modern Job Card ---
const JobTile = ({
  job,
  isToday,
  delay = 0,
}: {
  job: DashboardJob;
  isToday?: boolean;
  delay?: number;
}) => {
  const {theme, isDark} = useAppTheme();
  const statusMap: Record<string, {color: string; label: string}> = {
    in_progress: {color: UI.status.inProgress, label: 'In Progress'},
    pending: {color: UI.status.pending, label: 'Pending'},
    complete: {color: UI.status.complete, label: 'Complete'},
    paid: {color: UI.status.paid, label: 'Paid'},
  };
  const st = statusMap[job.status] || {color: Colors.secondary, label: job.status};
  const time = new Date(job.scheduled_date).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const primaryAddress = getPrimaryJobAddressLine(job);
  const cardTitle = isToday ? primaryAddress : job.title;
  const cardSubtitle = isToday ? job.title : primaryAddress;

  return (
    <Animated.View entering={FadeInRight.delay(delay).springify()}>
      <TouchableOpacity
        style={[s.jobTile, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
        activeOpacity={0.7}
        onPress={() => router.push({pathname: '/(app)/jobs/[id]', params: {id: job.id, from: 'jobs'}} as any)}
      >
        <View style={s.jobBody}>
          <View style={s.jobTopRow}>
            <Text style={[s.jobTime, {color: theme.text.muted}]}>{time}</Text>
            <View style={s.jobDivider} />

            <View style={s.jobCopy}>
              <Text style={[s.jobTileTitle, {color: theme.text.title}]} numberOfLines={1}>
                {cardTitle}
              </Text>
              <Text style={[s.jobMetaText, {color: theme.text.muted}]} numberOfLines={1}>
                {cardSubtitle}
              </Text>
            </View>

            <View style={[s.statusPill, {backgroundColor: `${st.color}14`}]}>
              <Text style={[s.statusLabel, {color: st.color}]}>{st.label}</Text>
            </View>
          </View>
        </View>

        <View style={s.jobChevron}>
          <Ionicons name="chevron-forward" size={18} color={theme.surface.border} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const RenewalCard = ({
  item,
  delay = 0,
}: {
  item: DashboardRenewal;
  delay?: number;
}) => {
  const {theme, isDark} = useAppTheme();

  return (
    <Animated.View entering={FadeInRight.delay(delay).springify()}>
      <TouchableOpacity
        activeOpacity={0.78}
        style={[s.renewalCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
        onPress={() => router.push(`/(app)/documents/${item.doc.id}` as any)}
      >
        <View style={s.renewalTopRow}>
          <View style={[s.renewalIconWrap, {backgroundColor: isDark ? theme.surface.elevated : '#F3F4F6'}]}>
            <Ionicons name="time-outline" size={16} color={isDark ? theme.text.bodyLight : '#4B5563'} />
          </View>
          <View style={[s.renewalPill, {backgroundColor: isDark ? theme.surface.elevated : item.dueTone.urgent ? '#FFF7ED' : '#F3F4F6'}]}>
            <Text style={[s.renewalPillText, {color: isDark && !item.dueTone.urgent ? theme.text.bodyLight : item.dueTone.color}]}>
              {item.dueInDays === 0 ? 'Due today' : `${item.dueInDays} day${item.dueInDays === 1 ? '' : 's'}`}
            </Text>
          </View>
        </View>

        <Text style={[s.renewalType, {color: theme.text.muted}]} numberOfLines={1}>{item.typeLabel}</Text>
        <Text style={[s.renewalAddress, {color: theme.text.title}]} numberOfLines={2}>
          {getSiteAddress(item.doc) || item.doc.customer_snapshot?.name || 'No address'}
        </Text>
        <Text style={[s.renewalMeta, {color: theme.text.muted}]} numberOfLines={1}>
          {item.doc.customer_snapshot?.name || 'Unknown customer'} • {item.referenceText}
        </Text>

        <View style={s.renewalFooter}>
          <Text style={[s.renewalFooterLabel, {color: theme.text.muted}]}>Renewal date</Text>
          <Text style={[s.renewalFooterValue, {color: isDark && !item.dueTone.urgent ? theme.text.bodyLight : item.dueTone.color}]}>
            {item.dueDate}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// --- Upcoming Row (date + job) ---
const UpcomingRow = ({
  job,
  delay = 0,
}: {
  job: DashboardJob;
  delay?: number;
}) => {
  const d = new Date(job.scheduled_date);
  return (
    <Animated.View entering={SlideInRight.delay(delay).springify()} style={s.upRow}>
      <View style={s.upDatePill}>
        <Text style={s.upDay}>{d.getDate()}</Text>
        <Text style={s.upMonth}>
          {d.toLocaleDateString('en-GB', {month: 'short'}).toUpperCase()}
        </Text>
      </View>
      <View style={{flex: 1}}>
        <JobTile job={job} />
      </View>
    </Animated.View>
  );
};

// --- Nav Button (secondary grid) ---
const NavButton = ({
  icon,
  label,
  onPress,
  delay = 0,
  isDark = false,
  theme: t,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  delay?: number;
  isDark?: boolean;
  theme?: ThemeTokens;
}) => {
  const resolvedTheme = t || UI;
  return (
    <Animated.View entering={FadeIn.delay(delay)} style={s.navBtnWrap}>
      <TouchableOpacity style={s.navBtn} onPress={onPress} activeOpacity={0.7}>
        <Ionicons name={icon} size={20} color={resolvedTheme.text.secondary} />
        <Text style={[s.navLabel, {color: resolvedTheme.text.body}]}>{label}</Text>
        <Ionicons name="chevron-forward" size={14} color={resolvedTheme.surface.border} />
      </TouchableOpacity>
    </Animated.View>
  );
};

// --- Main Dashboard ---
export default function DashboardScreen() {
  const {userProfile, user, session} = useAuth();
  const {theme, colors, isDark} = useAppTheme();
  const {isPro} = useSubscription();
  const insets = useSafeAreaInsets();
  const [allJobs, setAllJobs] = useState<DashboardJob[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingJobs, setPendingJobs] = useState<{jobId: string; jobTitle: string; address: string}[]>([]);
  const [acceptJobId, setAcceptJobId] = useState<string | null>(null);

  const isAdmin = userProfile?.role === 'admin';

  useFocusEffect(
    useCallback(() => {
      if (session && userProfile?.company_id) {
        fetchDashboardData();
        // Safety: if fetch hangs for 10s, stop showing spinner
        const safety = setTimeout(() => {
          setLoading(false);
          setRefreshing(false);
        }, 10000);
        return () => clearTimeout(safety);
      } else {
        setLoading(false);
        setRefreshing(false);
      }
    }, [session, userProfile])
  );

  const fetchDashboardData = async () => {
    if (!userProfile?.company_id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      let query = supabase
        .from('jobs')
        .select('id, title, reference, status, scheduled_date, customer_snapshot, assigned_to, company_id')
        .eq('company_id', userProfile.company_id)
        .neq('status', 'cancelled')
        .order('scheduled_date', {ascending: true})
        .limit(50);

      if (!isAdmin && user?.id) {
        query = query.contains('assigned_to', [user.id]);
      }

      const documentsQuery = supabase
        .from('documents')
        .select('id, type, status, reference, created_at, expiry_date, customer_snapshot, company_id, user_id')
        .eq('company_id', userProfile.company_id)
        .not('expiry_date', 'is', null)
        .order('expiry_date', {ascending: true})
        .limit(24);

      const results = await withQueryTimeout(Promise.all([
        query,
        documentsQuery,
      ]), 10000);

      if (!results) throw new Error('Dashboard queries timed out');
      const [{data: jobsData, error: jobsError}, {data: documentsData, error: documentsError}] = results;

      if (jobsError) console.error('Error fetching dashboard jobs:', jobsError);
      if (documentsError) console.error('Error fetching dashboard renewals:', documentsError);

      if (jobsData) setAllJobs(jobsData as any);
      if (documentsData) setDocuments(documentsData as Document[]);

      // Pending jobs for workers
      if (userProfile?.role === 'worker' && user?.id) {
        const workerId = user.id;

        const {data: pendingRows} = await supabase
          .from('job_acceptance')
          .select('job_id, jobs(id, title, customer_snapshot)')
          .eq('worker_id', workerId)
          .eq('status', 'pending');

        let resolvedPending: {jobId: string; jobTitle: string; address: string}[] = (pendingRows ?? []).map((row: any) => ({
          jobId: row.job_id,
          jobTitle: row.jobs?.title ?? 'Job',
          address: (row.jobs?.customer_snapshot as any)?.address_line_1 ?? '',
        }));

        // Reconciliation: find jobs assigned to this worker with no acceptance row at all
        const {data: allAcceptances} = await supabase
          .from('job_acceptance')
          .select('job_id')
          .eq('worker_id', workerId);

        const allAcceptedJobIds = new Set((allAcceptances ?? []).map((r: any) => r.job_id));

        const {data: assignedJobs} = await supabase
          .from('jobs')
          .select('id, title, customer_snapshot')
          .contains('assigned_to', [workerId]);

        const gaps = (assignedJobs ?? []).filter((j: any) => !allAcceptedJobIds.has(j.id));

        if (gaps.length > 0) {
          await supabase.from('job_acceptance').upsert(
            gaps.map((j: any) => ({job_id: j.id, worker_id: workerId, status: 'pending'})),
            {onConflict: 'job_id,worker_id', ignoreDuplicates: true}
          );
          for (const j of gaps) {
            resolvedPending.push({
              jobId: j.id,
              jobTitle: j.title,
              address: (j.customer_snapshot as any)?.address_line_1 ?? '',
            });
          }
        }

        setPendingJobs(resolvedPending);
      } else {
        setPendingJobs([]);
      }
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Live updates when jobs change (from other devices / workers)
  useRealtimeJobs(userProfile?.company_id, fetchDashboardData);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();

    const upcomingJobs = allJobs
      .filter((j) => j.scheduled_date >= startOfDay)
      .sort((a, b) => a.scheduled_date - b.scheduled_date)
      .slice(0, 3);

    const upcomingRenewals = documents
      .filter((doc) => !!doc.expiry_date && isRenewalEligibleDocument(doc))
      .map((doc) => ({
        doc,
        dueInDays: getDaysUntil(doc.expiry_date),
        dueDate: formatDisplayDate(doc.expiry_date),
        dueTone: getDueTone(doc.expiry_date),
        typeLabel: getDocumentTypeLabel(doc),
        referenceText: getDocumentReference(doc),
      }))
      .filter((item) => item.dueInDays !== null && item.dueInDays >= 0 && item.dueInDays <= 60)
      .sort((a, b) => (a.dueInDays ?? 9999) - (b.dueInDays ?? 9999))
      .slice(0, 8);

    return {upcomingJobs, upcomingRenewals};
  }, [allJobs, documents]);

  if (loading && allJobs.length === 0) {
    return (
      <View style={[s.center, {backgroundColor: theme.surface.base}]}>
        <ActivityIndicator size="large" color={theme.brand.primary} />
      </View>
    );
  }

  const firstName = userProfile?.display_name?.split(' ')[0] || 'There';

  return (
    <View style={[s.root, {backgroundColor: isDark ? theme.surface.base : '#F8F9FA'}]}>
      <LinearGradient
        colors={isDark ? [theme.surface.base, theme.surface.base, theme.surface.base] : theme.gradients.appBackground}
        start={{x: 0.5, y: 0}}
        end={{x: 0.5, y: 1}}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={[s.scroll, {paddingTop: insets.top + 8}]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchDashboardData();
            }}
            tintColor={theme.brand.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={s.header}>
          <View style={{flex: 1}}>
            <View style={s.brandRow}>
              <Image source={require('../../../assets/images/iconlogo.png')} style={s.brandIcon} resizeMode="contain" />
              <Text style={[s.brandTitle, {color: theme.text.title}]}>GasPilot</Text>
              {isPro && (
                <View style={s.proBadge}>
                  <Text style={s.proBadgeText}>PRO</Text>
                </View>
              )}
            </View>
            <Text style={[s.headerGreeting, {color: theme.text.secondary}]}>
              {getGreeting()}
            </Text>
            <Text style={[s.headerDate, {color: theme.text.muted}]}>
              {new Date().toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(app)/settings')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={isDark ? theme.gradients.primary : UI.gradients.primary}
              style={[s.avatar, isDark && {shadowColor: '#000'}]}
            >
              <Text style={[s.avatarText, {color: isDark ? '#000' : UI.text.white}]}>{firstName.charAt(0).toUpperCase()}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Quick Actions */}
        {isAdmin ? (
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Text style={[s.sectionLabel, {color: theme.text.title}]}>Quick Actions</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.quickRow}
            >
              <QuickAction
                icon="add-circle"
                label="New Job"
                backgroundColor="#FFFFFF"
                iconColor="#111111"
                onPress={() => router.push('/(app)/jobs/create' as any)}
                delay={120}
                isDark={isDark}
                theme={theme}
              />
              <QuickAction
                icon="documents"
                label="Forms"
                backgroundColor="#FFFFFF"
                iconColor="#111111"
                onPress={() => router.push('/(app)/forms' as any)}
                delay={160}
                isDark={isDark}
                theme={theme}
              />
              <QuickAction
                icon="shield-checkmark"
                label="Gas Cert"
                backgroundColor="#FFFFFF"
                iconColor="#111111"
                onPress={() => router.push('/(app)/cp12' as any)}
                delay={200}
                isDark={isDark}
                theme={theme}
              />
              <QuickAction
                icon="hammer"
                label="Tools"
                backgroundColor="#FFFFFF"
                iconColor="#111111"
                onPress={() => router.push('/(app)/toolbox' as any)}
                delay={240}
                isDark={isDark}
                theme={theme}
              />
              <QuickAction
                icon="receipt"
                label="Invoice"
                backgroundColor="#FFFFFF"
                iconColor="#111111"
                onPress={() => router.push('/(app)/invoice' as any)}
                delay={280}
                isDark={isDark}
                theme={theme}
              />
              <QuickAction
                icon="document-text"
                label="Quote"
                backgroundColor="#FFFFFF"
                iconColor="#111111"
                onPress={() => router.push('/(app)/quote' as any)}
                delay={320}
                isDark={isDark}
                theme={theme}
              />
              <QuickAction
                icon="create"
                label="Notes"
                backgroundColor="#FFFFFF"
                iconColor="#111111"
                onPress={() => router.push('/(app)/notes' as any)}
                delay={360}
                isDark={isDark}
                theme={theme}
              />
              <QuickAction
                icon="person-add"
                label="Client"
                backgroundColor="#FFFFFF"
                iconColor="#111111"
                onPress={() => router.push('/(app)/customers/add' as any)}
                delay={360}
                isDark={isDark}
                theme={theme}
              />
            </ScrollView>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Text style={[s.sectionLabel, {color: theme.text.title}]}>Quick Actions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 0}}>
              <QuickAction
                icon="list"
                label="Schedule"
                backgroundColor="#FFFFFF"
                iconColor="#111111"
                onPress={() => router.push('/(app)/jobs' as any)}
                delay={120}
                isDark={isDark}
                theme={theme}
              />
              <QuickAction
                icon="calendar"
                label="Calendar"
                backgroundColor="#FFFFFF"
                iconColor="#255FCE"
                onPress={() => router.push('/(app)/calendar' as any)}
                delay={160}
                isDark={isDark}
                theme={theme}
              />
              <QuickAction
                icon="document-text"
                label="Forms"
                backgroundColor="#FFFFFF"
                iconColor="#059669"
                onPress={() => router.push('/(app)/forms' as any)}
                delay={200}
                isDark={isDark}
                theme={theme}
              />
              <QuickAction
                icon="flame"
                label="Gas Cert"
                backgroundColor="#FFFFFF"
                iconColor="#D97706"
                onPress={() => router.push('/(app)/cp12' as any)}
                delay={240}
                isDark={isDark}
                theme={theme}
              />
              <QuickAction
                icon="hammer"
                label="Tools"
                backgroundColor="#FFFFFF"
                iconColor="#0369A1"
                onPress={() => router.push('/(app)/toolbox')}
                delay={280}
                isDark={isDark}
                theme={theme}
              />
            </ScrollView>
          </Animated.View>
        )}

        {/* Needs Your Response (workers) */}
        {userProfile?.role === 'worker' && pendingJobs.length > 0 && (
          <Animated.View entering={FadeInDown.delay(280).duration(400)} style={{marginTop: 16, marginBottom: 20}}>
            <View style={s.sectionHeaderRow}>
              <Text style={[s.sectionLabel, {color: theme.text.title, marginBottom: 0}]}>Needs Your Response</Text>
              <View style={{backgroundColor: '#FF9500' + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2}}>
                <Text style={{color: '#FF9500', fontSize: 12, fontWeight: '800'}}>{pendingJobs.length}</Text>
              </View>
            </View>
            {pendingJobs.map((item) => (
              <TouchableOpacity
                key={item.jobId}
                onPress={() => setAcceptJobId(item.jobId)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1.5,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 8,
                  borderColor: '#FF9500',
                  backgroundColor: isDark ? 'rgba(255,149,0,0.1)' : '#FFF7ED',
                }}
              >
                <View style={{flex: 1}}>
                  <Text style={{fontSize: 15, fontWeight: '700', color: theme.text.title, marginBottom: 2}}>{item.jobTitle}</Text>
                  {item.address ? <Text style={{fontSize: 12, color: theme.text.muted}}>{item.address}</Text> : null}
                </View>
                <View style={{backgroundColor: '#FF9500', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6}}>
                  <Text style={{color: '#000', fontSize: 12, fontWeight: '800'}}>Respond</Text>
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}

        {/* Upcoming Jobs */}
        <Animated.View entering={FadeInDown.delay(320).springify()}>
          <View style={s.sectionHeaderRow}>
            <Text style={[s.sectionLabel, {color: theme.text.title}]}>{"Upcoming Jobs"}</Text>
            <View style={[s.countBadge, isDark && {backgroundColor: theme.surface.elevated}]}>
              <Text style={[s.countText, {color: theme.brand.primary}]}>{stats.upcomingJobs.length}</Text>
            </View>
          </View>

          {stats.upcomingJobs.length === 0 ? (
            <View style={[s.emptyCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
              <View style={[s.emptyIconWrap, isDark && {backgroundColor: theme.surface.divider}]}>
                <Ionicons name="sunny-outline" size={28} color={theme.text.muted} />
              </View>
              <Text style={[s.emptyTitle, {color: theme.text.body}]}>All clear!</Text>
              <Text style={[s.emptySubtitle, {color: theme.text.muted}]}>No upcoming jobs scheduled.</Text>
            </View>
          ) : (
            stats.upcomingJobs.map((job, i) => {
              const now = new Date();
              const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
              const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
              return (
                <JobTile key={job.id} job={job} isToday={job.scheduled_date >= dayStart && job.scheduled_date < dayEnd} delay={360 + i * 60} />
              );
            })
          )}
        </Animated.View>

        {/* Admin Quick Action Buttons */}
        {isAdmin && (
          <Animated.View entering={FadeInDown.delay(420).duration(400)} style={{flexDirection: 'row', gap: 12, marginBottom: 24}}>
            <TouchableOpacity
              style={{
                flex: 1,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                alignItems: 'flex-start',
                gap: 8,
                backgroundColor: isDark ? (theme.glass?.bg ?? 'rgba(255,255,255,0.05)') : '#FFFFFF',
                borderColor: isDark ? (theme.glass?.border ?? 'rgba(255,255,255,0.1)') : 'rgba(0,0,0,0.06)',
              }}
              onPress={() => router.push('/(app)/cp12' as any)}
              activeOpacity={0.85}
            >
              <View style={{width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: (theme.brand?.primary ?? '#0066FF') + '18', marginBottom: 4}}>
                <Ionicons name="document-text-outline" size={26} color={theme.brand?.primary ?? '#0066FF'} />
              </View>
              <Text style={{fontSize: 15, fontWeight: '800', lineHeight: 20, color: theme.text.title}}>{'New Gas\nCertificate'}</Text>
              <Text style={{fontSize: 11, color: theme.text.muted}}>LGSR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                alignItems: 'flex-start',
                gap: 8,
                backgroundColor: isDark ? (theme.glass?.bg ?? 'rgba(255,255,255,0.05)') : '#FFFFFF',
                borderColor: isDark ? (theme.glass?.border ?? 'rgba(255,255,255,0.1)') : 'rgba(0,0,0,0.06)',
              }}
              onPress={() => router.push('/(app)/jobs/create' as any)}
              activeOpacity={0.85}
            >
              <View style={{width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: (theme.brand?.primary ?? '#0066FF') + '18', marginBottom: 4}}>
                <Ionicons name="briefcase-outline" size={26} color={theme.brand?.primary ?? '#0066FF'} />
              </View>
              <Text style={{fontSize: 15, fontWeight: '800', lineHeight: 20, color: theme.text.title}}>{'Create\nNew Job'}</Text>
              <Text style={{fontSize: 11, color: theme.text.muted}}>Track & assign</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {stats.upcomingRenewals.length > 0 && (
          <Animated.View entering={FadeInDown.delay(420).springify()}>
            <View style={s.sectionHeaderRow}>
              <Text style={[s.sectionLabel, {color: theme.text.title, marginBottom: 0}]}>Upcoming Renewals</Text>
              <View style={[s.countBadge, isDark && {backgroundColor: theme.surface.elevated}]}>
                <Text style={[s.countText, {color: theme.brand.primary}]}>{stats.upcomingRenewals.length}</Text>
              </View>
            </View>
            <Text style={[s.sectionHint, {color: theme.text.muted}]}>Due in the next 60 days</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.renewalRow}>
              {stats.upcomingRenewals.map((item, index) => (
                <RenewalCard key={item.doc.id} item={item} delay={460 + index * 50} />
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Navigation Grid (admin) */}
        {isAdmin && (
          <Animated.View entering={FadeInDown.delay(520).springify()}>
            <Text style={[s.sectionLabel, {marginTop: 8, color: theme.text.title}]}>Navigate</Text>
            <View style={[s.navGrid, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
              <NavButton icon="briefcase-outline" label="All Jobs" onPress={() => router.push('/(app)/jobs' as any)} delay={700} isDark={isDark} theme={theme} />
              <NavButton icon="people-outline" label="Customers" onPress={() => router.push('/(app)/customers' as any)} delay={740} isDark={isDark} theme={theme} />
              <NavButton icon="person-outline" label="Team" onPress={() => router.push('/(app)/workers' as any)} delay={780} isDark={isDark} theme={theme} />
              <NavButton icon="documents-outline" label="Documents" onPress={() => router.push('/(app)/documents' as any)} delay={820} isDark={isDark} theme={theme} />
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* First-run onboarding */}
      <Onboarding
        screenKey="dashboard"
        tips={isAdmin ? ADMIN_TIPS : WORKER_TIPS}
      />

      <JobAcceptModal
        jobId={acceptJobId}
        visible={!!acceptJobId}
        onDismiss={() => {
          setAcceptJobId(null);
          fetchDashboardData();
        }}
      />
    </View>
  );
}

// --- Styles ---
const GLASS_BG = UI.glass.bg;
const GLASS_BORDER = UI.glass.border;

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#F8F9FA'},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  scroll: {paddingHorizontal: 20, paddingBottom: 120},

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 8,
  },
  brandRow: {flexDirection: 'row', alignItems: 'center', gap: 0, marginBottom: 4},
  brandIcon: {width: 30, height: 30, marginTop: -4},
  brandTitle: {fontSize: 28, fontFamily: 'ClashDisplay-Semibold', letterSpacing: -0.5},
  proBadge: {backgroundColor: UI.brand.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8},
  proBadgeText: {color: '#fff', fontSize: 11, fontWeight: '800'},
  headerGreeting: {fontSize: 28, fontWeight: '500', color: UI.text.secondary, letterSpacing: -0.4},
  headerNameInline: {fontSize: 30, fontWeight: '800', color: UI.text.title, letterSpacing: -0.6},
  headerDate: {fontSize: 14, color: UI.text.muted, marginTop: 4, fontWeight: '500'},
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: UI.brand.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarText: {fontSize: 20, fontWeight: '800', color: UI.text.white},

  // Stats
  statsRow: {flexDirection: 'row', gap: 10, marginBottom: 28},
  glassOuter: {flex: 1},
  glassCard: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  glassAccent: {height: 0},
  glassBody: {padding: 14},
  glassIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  glassValue: {fontSize: 22, fontWeight: '800', color: UI.text.title, letterSpacing: -0.3},
  glassLabel: {fontSize: 12, fontWeight: '700', color: UI.text.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5},

  // Quick actions
  quickRow: {flexDirection: 'row', gap: 14, marginBottom: 28, paddingRight: 8},
  quickAction: {alignItems: 'center', width: 80},
  quickButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  quickLabel: {fontSize: 13, fontWeight: '700', color: UI.text.body, textAlign: 'center'},

  // Section headers
  sectionLabel: {fontSize: 18, fontWeight: '700', color: UI.text.title, marginBottom: 14, letterSpacing: -0.2},
  sectionHeaderRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14},
  sectionHint: {fontSize: 13, fontWeight: '500', marginTop: -6, marginBottom: 14},
  countBadge: {backgroundColor: UI.surface.primaryLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12},
  countText: {fontSize: 13, fontWeight: '700', color: UI.brand.primary},
  seeAllBtn: {flexDirection: 'row', alignItems: 'center', gap: 4},
  seeAllText: {fontSize: 14, fontWeight: '600', color: UI.brand.primary},

  // Job tiles
  jobTile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  jobBody: {flex: 1, paddingVertical: 19, paddingHorizontal: 18},
  jobTopRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  jobTime: {fontSize: 14, fontWeight: '600', color: UI.text.muted, width: 42},
  jobDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(148,163,184,0.28)',
  },
  jobCopy: {flex: 1},
  statusPill: {borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4},
  statusLabel: {fontSize: 11, fontWeight: '700'},
  jobTileTitle: {fontSize: 16, fontWeight: '700', color: UI.text.title, marginBottom: 4},
  jobMetaText: {fontSize: 13, color: UI.text.muted, flex: 1, lineHeight: 18},
  jobChevron: {paddingRight: 14},

  // Renewals
  renewalRow: {paddingRight: 8, gap: 12, marginBottom: 24},
  renewalCard: {
    width: 264,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  renewalTopRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14},
  renewalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renewalPill: {paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999},
  renewalPillText: {fontSize: 12, fontWeight: '700'},
  renewalType: {fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8},
  renewalAddress: {fontSize: 17, fontWeight: '800', lineHeight: 22, marginBottom: 8},
  renewalMeta: {fontSize: 13, lineHeight: 18, marginBottom: 16},
  renewalFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.14)',
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  renewalFooterLabel: {fontSize: 12, fontWeight: '600'},
  renewalFooterValue: {fontSize: 13, fontWeight: '700'},

  // Upcoming
  upRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4},
  upDatePill: {
    width: 48,
    height: 56,
    borderRadius: 14,
    backgroundColor: UI.surface.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upDay: {fontSize: 20, fontWeight: '800', color: UI.brand.primaryDark},
  upMonth: {fontSize: 10, fontWeight: '700', color: UI.brand.accent, letterSpacing: 0.5},

  // Nav grid
  navGrid: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  navBtnWrap: {},
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  navLabel: {flex: 1, fontSize: 15, fontWeight: '600', color: UI.text.body},

  // Resource banner
  resourceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFF8EE',
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  resourceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resourceText: {flex: 1},
  resourceTitle: {fontSize: 15, fontWeight: '700', marginBottom: 2},
  resourceSubtitle: {fontSize: 12, fontWeight: '500'},

  // Empty state
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: UI.surface.divider,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {fontSize: 16, fontWeight: '700', color: UI.text.body, marginBottom: 4},
  emptySubtitle: {fontSize: 14, color: UI.text.muted},
});
