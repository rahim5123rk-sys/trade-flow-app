// ============================================
// FILE: app/(app)/documents/index.tsx
// Central Hub for Quotes, Invoices & Gas Forms
// ============================================

import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router} from 'expo-router';
import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {FadeInDown, FadeInRight} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GlassIconButton} from '../../../../components/GlassIconButton';
import {Colors, UI} from '../../../../constants/theme';
import {useDocuments} from '../../../../hooks/useDocuments';
import {supabase} from '../../../../src/config/supabase';
import {useAuth} from '../../../../src/context/AuthContext';
import {useAppTheme} from '../../../../src/context/ThemeContext';
import {Document} from '../../../../src/types';

// ─── Constants ──────────────────────────────────────────────────

const STATUS_COLORS: Record<string, {color: string; bg: string}> = {
  Draft: {color: UI.text.muted, bg: UI.surface.elevated},
  Sent: {color: UI.brand.accent, bg: '#eff6ff'},
  Accepted: {color: '#15803d', bg: '#f0fdf4'},
  Declined: {color: UI.brand.danger, bg: '#fef2f2'},
  Unpaid: {color: '#c2410c', bg: '#fff7ed'},
  Paid: {color: '#047857', bg: '#f0fdf4'},
  Overdue: {color: UI.brand.danger, bg: '#fef2f2'},
  Issued: {color: '#0284c7', bg: '#f0f9ff'},
};

const GAS_BADGE_STYLES = {
  default: {bg: '#F3F4F6', text: '#374151'},
  cp12: {bg: '#EEF5FF', text: '#1D4ED8'},
  service: {bg: '#ECFDF5', text: '#047857'},
  commissioning: {bg: '#F5F3FF', text: '#7C3AED'},
  decommissioning: {bg: '#F8FAFC', text: '#475569'},
  warning: {bg: '#FEF2F2', text: '#B91C1C'},
  breakdown: {bg: '#FFF7ED', text: '#C2410C'},
  install: {bg: '#EFF6FF', text: '#1D4ED8'},
} as const;

const DOC_TYPE_BADGE_STYLES = {
  invoice: {bg: '#FFF7ED', text: '#C2410C'},
  quote: {bg: '#F5F3FF', text: '#7C3AED'},
} as const;

const GLASS_BG = Platform.OS === 'ios' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.92)';
const GLASS_BORDER = 'rgba(255,255,255,0.80)';

type DocumentFilterKey =
  | 'invoice'
  | 'quote'
  | 'cp12'
  | 'service_record'
  | 'commissioning'
  | 'decommissioning'
  | 'warning_notice'
  | 'breakdown_report'
  | 'installation_cert';

const FILTER_OPTIONS: {key: DocumentFilterKey; label: string; icon: keyof typeof Ionicons.glyphMap}[] = [
  {key: 'invoice', label: 'Invoices', icon: 'receipt-outline'},
  {key: 'quote', label: 'Quotes', icon: 'document-text-outline'},
  {key: 'cp12', label: 'LGSRs', icon: 'shield-checkmark-outline'},
  {key: 'service_record', label: 'Service Records', icon: 'construct-outline'},
  {key: 'commissioning', label: 'Commissioning', icon: 'checkmark-circle-outline'},
  {key: 'decommissioning', label: 'Decommissioning', icon: 'close-circle-outline'},
  {key: 'warning_notice', label: 'Warning Notices', icon: 'warning-outline'},
  {key: 'breakdown_report', label: 'Breakdown Reports', icon: 'build-outline'},
  {key: 'installation_cert', label: 'Installation Certs', icon: 'home-outline'},
];

// ─── Helpers ────────────────────────────────────────────────────

// All known gas form kinds — covers both registered and future types.
// Any document whose payment_info.kind matches this set is treated as a gas form.
const GAS_FORM_KINDS = new Set<string>([
  'cp12',
  'service_record',
  'warning_notice',
  'commissioning',
  'decommissioning',
  'breakdown_report',
  'installation_cert',
]);

/**
 * Extract the site / property address for a document.
 * Gas forms: reads propertyAddress from the locked payload.
 * Invoices/Quotes: uses job_address, falling back to customer snapshot.
 */
const getSiteAddress = (doc: Document): string => {
  if (doc.payment_info) {
    try {
      const parsed = JSON.parse(doc.payment_info);
      if (parsed?.pdfData?.propertyAddress) return parsed.pdfData.propertyAddress as string;
    } catch { }
  }
  const j = (doc as any).job_address;
  if (j?.address_line_1) {
    return [j.address_line_1, j.city, j.postcode].filter(Boolean).join(', ');
  }
  const s = doc.customer_snapshot;
  return [s?.address_line_1, s?.city, s?.postal_code].filter(Boolean).join(', ') || (s as any)?.address || '';
};

/** Parse the payment_info kind without importing the full PDF registry */
const getPaymentInfoKind = (doc: Document): string | null => {
  if (!doc.payment_info) return null;
  try {
    return JSON.parse(doc.payment_info)?.kind ?? null;
  } catch {
    return null;
  }
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

const isCp12Document = (doc: Document): boolean =>
  (doc.type as string) === 'cp12' ||
  doc.reference?.startsWith('CP12-') === true ||
  getPaymentInfoKind(doc) === 'cp12';

const isServiceRecordDocument = (doc: Document): boolean =>
  (doc.type as string) === 'service_record' ||
  doc.reference?.startsWith('SR-') === true ||
  getPaymentInfoKind(doc) === 'service_record';

const isCommissioningDocument = (doc: Document): boolean =>
  (doc.type as string) === 'commissioning' ||
  getPaymentInfoKind(doc) === 'commissioning';

const isDecommissioningDocument = (doc: Document): boolean =>
  (doc.type as string) === 'decommissioning' ||
  getPaymentInfoKind(doc) === 'decommissioning';

const isWarningNoticeDocument = (doc: Document): boolean =>
  (doc.type as string) === 'warning_notice' ||
  getPaymentInfoKind(doc) === 'warning_notice';

const isBreakdownReportDocument = (doc: Document): boolean =>
  (doc.type as string) === 'breakdown_report' ||
  getPaymentInfoKind(doc) === 'breakdown_report';

const isInstallationCertDocument = (doc: Document): boolean =>
  (doc.type as string) === 'installation_cert' ||
  getPaymentInfoKind(doc) === 'installation_cert';

/** Returns true if the document is any gas form type (CP12, Service Record, or any future kind) */
const isGasFormDocument = (doc: Document): boolean => {
  if (GAS_FORM_KINDS.has(doc.type as string)) return true;
  if (doc.reference?.startsWith('CP12-') || doc.reference?.startsWith('SR-')) return true;
  const kind = getPaymentInfoKind(doc);
  return kind !== null && GAS_FORM_KINDS.has(kind);
};

const getDocumentReference = (doc: Document): string => {
  const isCp12 = isCp12Document(doc);
  const isSR = isServiceRecordDocument(doc);
  const isCommissioning = isCommissioningDocument(doc);
  const isDecommissioning = isDecommissioningDocument(doc);
  const isGasForm = isGasFormDocument(doc);
  const isInvoice = doc.type === 'invoice' && !isGasForm;

  return isCp12
    ? doc.reference || `CP12-${String(doc.number).padStart(4, '0')}`
    : isSR
      ? doc.reference || `SR-${String(doc.number).padStart(4, '0')}`
      : isCommissioning || isDecommissioning
        ? doc.reference || `REF-${String(doc.number).padStart(4, '0')}`
        : isGasForm
          ? doc.reference || `GAS-${String(doc.number).padStart(4, '0')}`
          : `${isInvoice ? 'INV' : 'QTE'}-${String(doc.number).padStart(4, '0')}`;
};

const getDocumentTypeLabel = (doc: Document): string => {
  const isCp12 = isCp12Document(doc);
  const isSR = isServiceRecordDocument(doc);
  const isCommissioning = isCommissioningDocument(doc);
  const isDecommissioning = isDecommissioningDocument(doc);
  const isWarningNotice = isWarningNoticeDocument(doc);
  const isBreakdown = isBreakdownReportDocument(doc);
  const isInstallation = isInstallationCertDocument(doc);
  const isGasForm = isGasFormDocument(doc);
  const isInvoice = doc.type === 'invoice' && !isGasForm;

  return isCp12
    ? 'Landlord Gas Safety Record'
    : isSR
      ? 'Service Record'
      : isCommissioning
        ? 'Commissioning'
        : isDecommissioning
          ? 'Decommissioning'
          : isWarningNotice
            ? 'Warning Notice'
            : isBreakdown
              ? 'Breakdown Report'
              : isInstallation
                ? 'Installation Certificate'
                : isGasForm
                  ? 'Gas Form'
                  : isInvoice
                    ? 'Invoice'
                    : 'Quote';
};

const getDocumentFilterKey = (doc: Document): DocumentFilterKey | null => {
  if (isCp12Document(doc)) return 'cp12';
  if (isServiceRecordDocument(doc)) return 'service_record';
  if (isCommissioningDocument(doc)) return 'commissioning';
  if (isDecommissioningDocument(doc)) return 'decommissioning';
  if (isWarningNoticeDocument(doc)) return 'warning_notice';
  if (isBreakdownReportDocument(doc)) return 'breakdown_report';
  if (isInstallationCertDocument(doc)) return 'installation_cert';
  if (doc.type === 'invoice' && !isGasFormDocument(doc)) return 'invoice';
  if (doc.type === 'quote' && !isGasFormDocument(doc)) return 'quote';
  return null;
};

// ─── Screen ─────────────────────────────────────────────────────

export default function DocumentsHubScreen() {
  const {userProfile, role} = useAuth();
  const {theme, isDark} = useAppTheme();
  const insets = useSafeAreaInsets();
  const glassBg = isDark ? theme.glass.bg : GLASS_BG;
  const glassBorder = isDark ? theme.glass.border : GLASS_BORDER;
  const [selectedFilters, setSelectedFilters] = useState<DocumentFilterKey[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedView, setSelectedView] = useState<'landing' | 'certificates' | 'invoices'>('landing');
  const {documents, loading, refreshing, loadingMore, hasMore, search: searchQuery, setSearch: setSearchQuery, refresh: fetchDocuments, onRefresh, loadMore, removeDocument} = useDocuments({
    typeFilters: selectedFilters.length > 0 ? selectedFilters : undefined,
  });

  const handleDelete = (doc: Document) => {
    const isCp12 = isCp12Document(doc);
    const isSR = isServiceRecordDocument(doc);
    const isCommissioning = isCommissioningDocument(doc);
    const isDecommissioning = isDecommissioningDocument(doc);
    const isWarningNotice = isWarningNoticeDocument(doc);
    const isBreakdown = isBreakdownReportDocument(doc);
    const isInstallation = isInstallationCertDocument(doc);
    const isGasForm = isGasFormDocument(doc);
    const label = isCp12 ? 'Landlord Gas Safety Record' : isSR ? 'Service Record' : isCommissioning ? 'Commissioning' : isDecommissioning ? 'Decommissioning' : isWarningNotice ? 'Warning Notice' : isBreakdown ? 'Breakdown Report' : isInstallation ? 'Installation Certificate' : isGasForm ? 'Gas Form' : doc.type === 'invoice' ? 'Invoice' : 'Quote';
    Alert.alert(
      `Delete ${label}`,
      `Are you sure you want to delete ${isGasForm ? `${doc.reference || label}` : `${doc.type === 'invoice' ? 'Invoice' : 'Quote'} #${doc.number}`}? This cannot be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const {error} = await supabase.from('documents').delete().eq('id', doc.id);
            if (error) {
              Alert.alert('Error', 'Could not delete document.');
            } else {
              removeDocument(doc.id);
            }
          },
        },
      ]
    );
  };

  // ─── Stats ──────────────────────────────────────────────────

  const stats = {
    invoices: documents.filter((d) => d.type === 'invoice' && !isGasFormDocument(d)).length,
    quotes: documents.filter((d) => d.type === 'quote' && !isGasFormDocument(d)).length,
    gasForms: documents.filter((d) => isGasFormDocument(d)).length,
  };

  const actionNeededCount = documents.filter((d) => ['Draft', 'Unpaid', 'Overdue', 'Declined'].includes(d.status)).length;
  const activeFilterLabels = FILTER_OPTIONS.filter((option) => selectedFilters.includes(option.key)).map((option) => option.label);

  // ─── Landing Stats ────────────────────────────────────────────

  const landingStats = useMemo(() => {
    const revenue = documents
      .filter((d) => d.type === 'invoice' && !isGasFormDocument(d) && d.status === 'Paid')
      .reduce((sum, d) => sum + (parseFloat(String(d.total)) || 0), 0);

    const unpaidCount = documents.filter(
      (d) => d.type === 'invoice' && !isGasFormDocument(d) && (d.status === 'Unpaid' || d.status === 'Overdue')
    ).length;

    const currentYear = new Date().getFullYear();
    const gasCertsYTD = documents.filter((d) => {
      if (!isGasFormDocument(d)) return false;
      const createdAt = d.created_at;
      if (!createdAt) return false;
      return new Date(createdAt).getFullYear() === currentYear;
    }).length;

    return {revenue, gasCertsYTD, outstanding: actionNeededCount};
  }, [documents]);

  // ─── View Navigation ─────────────────────────────────────────

  const handleViewSelect = (view: 'certificates' | 'invoices') => {
    if (view === 'certificates') {
      const certFilterKeys: DocumentFilterKey[] = ['cp12', 'service_record', 'commissioning', 'decommissioning', 'warning_notice', 'breakdown_report', 'installation_cert'];
      setSelectedFilters(certFilterKeys);
    } else {
      setSelectedFilters(['invoice', 'quote']);
    }
    setSelectedView(view);
  };

  const handleBackToLanding = () => {
    setSelectedView('landing');
    setSelectedFilters([]);
    setSearchQuery('');
  };

  // Documents are now filtered server-side via the useDocuments hook

  // ─── Render card ──────────────────────────────────────────────

  const renderDocument = ({item, index}: {item: Document; index: number}) => {
    const isCp12 = isCp12Document(item);
    const isSR = isServiceRecordDocument(item);
    const isCommissioning = isCommissioningDocument(item);
    const isDecommissioning = isDecommissioningDocument(item);
    const isWarningNotice = isWarningNoticeDocument(item);
    const isBreakdown = isBreakdownReportDocument(item);
    const isInstallation = isInstallationCertDocument(item);
    const isGasForm = isGasFormDocument(item);
    const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.Draft;
    const isInvoice = item.type === 'invoice' && !isGasForm;
    const referenceText = getDocumentReference(item);
    const typeLabel = getDocumentTypeLabel(item);
    const metadataParts = [item.customer_snapshot?.name, referenceText].filter(Boolean);
    const createdDate = formatDisplayDate((item as any).created_at || item.date);
    const dueDate = formatDisplayDate(item.expiry_date);
    const dueTone = getDueTone(item.expiry_date);

    const renderRightActions = () => (
      <TouchableOpacity style={st.deleteSwipeBtn} onPress={() => handleDelete(item)}>
        <Ionicons name="trash-outline" size={24} color={UI.text.white} />
        <Text style={st.deleteSwipeText}>Delete</Text>
      </TouchableOpacity>
    );

    const gasKind = getPaymentInfoKind(item);
    const gasFormBadge = isCp12
      ? {label: 'GAS CERT', style: GAS_BADGE_STYLES.cp12}
      : isSR
        ? {label: 'SERVICE', style: GAS_BADGE_STYLES.service}
        : isCommissioning
          ? {label: 'COMM', style: GAS_BADGE_STYLES.commissioning}
          : isDecommissioning
            ? {label: 'DECOMM', style: GAS_BADGE_STYLES.decommissioning}
            : isWarningNotice
              ? {label: 'WARNING', style: GAS_BADGE_STYLES.warning}
              : isBreakdown
                ? {label: 'REPAIR', style: GAS_BADGE_STYLES.breakdown}
                : isInstallation
                  ? {label: 'INSTALL', style: GAS_BADGE_STYLES.install}
                  : {label: (gasKind?.slice(0, 6).toUpperCase() || 'GAS'), style: GAS_BADGE_STYLES.default};
    const docTypeBadge = isInvoice
      ? DOC_TYPE_BADGE_STYLES.invoice
      : item.type === 'quote'
        ? DOC_TYPE_BADGE_STYLES.quote
        : null;
    const statusBg = isDark
      ? theme.surface.elevated
      : isGasForm
        ? gasFormBadge.style.bg
        : docTypeBadge
          ? docTypeBadge.bg
          : statusStyle.bg;
    const statusTextColor = isDark
      ? theme.text.bodyLight
      : isGasForm
        ? gasFormBadge.style.text
        : docTypeBadge
          ? docTypeBadge.text
          : statusStyle.color;

    const cardConfig = isCp12
      ? {
        icon: 'shield-checkmark-outline' as const,
      }
      : isSR
        ? {
          icon: 'construct-outline' as const,
        }
        : isCommissioning
          ? {
            icon: 'checkmark-circle-outline' as const,
          }
          : isDecommissioning
            ? {
              icon: 'close-circle-outline' as const,
            }
            : isWarningNotice
              ? {
                icon: 'warning-outline' as const,
              }
              : isBreakdown
                ? {
                  icon: 'build-outline' as const,
                }
                : isInstallation
                  ? {
                    icon: 'home-outline' as const,
                  }
                  : isGasForm
                    ? {
                      icon: 'flame-outline' as const,
                    }
                    : isInvoice
                      ? {
                        icon: 'receipt-outline' as const,
                      }
                      : {
                        icon: 'document-text-outline' as const,
                      };

    return (
      <Animated.View entering={FadeInRight.delay(Math.min(index * 50, 300)).springify()}>
        <ReanimatedSwipeable renderRightActions={renderRightActions} overshootRight={false}>
          <TouchableOpacity
            style={[st.card, {backgroundColor: isDark ? theme.glass.bg : '#FFFFFF', borderColor: isDark ? theme.glass.border : 'transparent'}]}
            activeOpacity={0.7}
            onPress={() => router.push(`/(app)/documents/${item.id}` as any)}
          >
            <View style={st.cardBody}>
              <View style={st.cardTopRow}>
                <View style={[st.typeIcon, {backgroundColor: isDark ? theme.surface.elevated : '#F3F4F6'}]}>
                  <Ionicons name={cardConfig.icon} size={18} color={isDark ? theme.text.bodyLight : '#4B5563'} />
                </View>
                <View style={st.cardContent}>
                  <Text style={[st.cardAddress, {color: theme.text.title}]} numberOfLines={1}>
                    {getSiteAddress(item) || item.customer_snapshot?.name || 'No address'}
                  </Text>
                  <Text style={[st.cardCustomerSub, {color: theme.text.muted}]} numberOfLines={1}>
                    {metadataParts.join(' • ') || typeLabel}
                  </Text>
                </View>
                <View style={st.cardStatusWrap}>
                  <View style={[st.statusBadge, {backgroundColor: statusBg}]}>
                    <Text style={[st.statusText, {color: statusTextColor}]}>
                      {isGasForm ? gasFormBadge.label : isInvoice ? 'INVOICE' : item.type === 'quote' ? 'QUOTE' : item.status}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[st.cardBottomRow, isDark && {borderTopColor: theme.surface.divider}]}>
                <Text style={[st.cardDate, {color: theme.text.muted}]}>
                  {createdDate || '—'}
                </Text>
                {dueDate ? (
                  <Text style={[st.cardDueDate, {color: isDark && !dueTone.urgent ? theme.text.bodyLight : dueTone.color}]}>
                    Due {dueDate}
                  </Text>
                ) : <View />}
              </View>
            </View>
          </TouchableOpacity>
        </ReanimatedSwipeable>
      </Animated.View>
    );
  };

  // ─── Screen ───────────────────────────────────────────────────

  const formatRevenue = (amount: number) => {
    if (amount >= 1000) {
      return `\u00A3${amount.toLocaleString('en-GB', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
    }
    return `\u00A3${amount.toFixed(0)}`;
  };

  // ─── Landing View ──────────────────────────────────────────────

  const renderLandingView = () => (
    <ScrollView
      style={{flex: 1}}
      contentContainerStyle={{paddingBottom: 100}}
      showsVerticalScrollIndicator={false}
    >
      {/* Stats Row */}
      <Animated.View entering={FadeInDown.delay(100).springify()} style={st.statsGrid}>
        <View style={[st.statCard, {backgroundColor: isDark ? theme.glass.bg : GLASS_BG, borderColor: isDark ? theme.glass.border : GLASS_BORDER}]}>
          <View style={[st.statIconWrap, {backgroundColor: isDark ? 'rgba(5,150,105,0.15)' : '#ECFDF5'}]}>
            <Ionicons name="cash-outline" size={18} color="#059669" />
          </View>
          <Text style={[st.statValue, {color: theme.text.title}]}>{formatRevenue(landingStats.revenue)}</Text>
          <Text style={[st.statLabel, {color: theme.text.muted}]}>Revenue</Text>
        </View>

        <View style={[st.statCard, {backgroundColor: isDark ? theme.glass.bg : GLASS_BG, borderColor: isDark ? theme.glass.border : GLASS_BORDER}]}>
          <View style={[st.statIconWrap, {backgroundColor: isDark ? 'rgba(5,150,105,0.15)' : '#ECFDF5'}]}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#059669" />
          </View>
          <Text style={[st.statValue, {color: theme.text.title}]}>{landingStats.gasCertsYTD} <Text style={st.statYtd}>YTD</Text></Text>
          <Text style={[st.statLabel, {color: theme.text.muted}]}>Gas Certs</Text>
        </View>

        <View style={[st.statCard, {backgroundColor: isDark ? theme.glass.bg : GLASS_BG, borderColor: isDark ? theme.glass.border : GLASS_BORDER}]}>
          <View style={[st.statIconWrap, {backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2'}]}>
            <Ionicons name="flag-outline" size={18} color={UI.brand.danger} />
          </View>
          <Text style={[st.statValue, {color: theme.text.title}]}>{landingStats.outstanding}</Text>
          <Text style={[st.statLabel, {color: theme.text.muted}]}>Outstanding</Text>
        </View>
      </Animated.View>

      {/* Navigation Cards */}
      <Animated.View entering={FadeInDown.delay(200).springify()} style={st.navCardsWrap}>
        <TouchableOpacity
          style={[st.navCard, {backgroundColor: isDark ? theme.glass.bg : '#FFFFFF', borderColor: isDark ? theme.glass.border : 'transparent'}]}
          activeOpacity={0.7}
          onPress={() => handleViewSelect('certificates')}
        >
          <View style={[st.navCardIcon, {backgroundColor: isDark ? 'rgba(5,150,105,0.15)' : '#ECFDF5'}]}>
            <Ionicons name="shield-checkmark-outline" size={28} color="#059669" />
          </View>
          <View style={st.navCardContent}>
            <Text style={[st.navCardTitle, {color: theme.text.title}]}>View Certificates</Text>
            <Text style={[st.navCardSubtitle, {color: theme.text.muted}]}>LGSRs, service records & gas forms</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={theme.text.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[st.navCard, {backgroundColor: isDark ? theme.glass.bg : '#FFFFFF', borderColor: isDark ? theme.glass.border : 'transparent'}]}
          activeOpacity={0.7}
          onPress={() => handleViewSelect('invoices')}
        >
          <View style={[st.navCardIcon, {backgroundColor: isDark ? 'rgba(0,102,255,0.15)' : '#EFF6FF'}]}>
            <Ionicons name="receipt-outline" size={28} color="#0066FF" />
          </View>
          <View style={st.navCardContent}>
            <Text style={[st.navCardTitle, {color: theme.text.title}]}>View Invoices & Quotes</Text>
            <Text style={[st.navCardSubtitle, {color: theme.text.muted}]}>Invoices, quotes & billing</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={theme.text.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[st.navCard, {backgroundColor: isDark ? theme.glass.bg : '#FFFFFF', borderColor: isDark ? theme.glass.border : 'transparent'}]}
          activeOpacity={0.7}
          onPress={() => router.push('/(app)/customers' as any)}
        >
          <View style={[st.navCardIcon, {backgroundColor: isDark ? 'rgba(139,92,246,0.15)' : '#F5F3FF'}]}>
            <Ionicons name="people-outline" size={28} color="#8B5CF6" />
          </View>
          <View style={st.navCardContent}>
            <Text style={[st.navCardTitle, {color: theme.text.title}]}>Customers</Text>
            <Text style={[st.navCardSubtitle, {color: theme.text.muted}]}>View & manage your customer list</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={theme.text.muted} />
        </TouchableOpacity>
      </Animated.View>

      {/* Quick Create */}
      <Animated.View entering={FadeInDown.delay(300).springify()} style={st.createRow}>
        <TouchableOpacity
          style={st.createBtn}
          activeOpacity={0.75}
          onPress={() => router.push('/(app)/invoice' as any)}
        >
          <View style={[st.createCircle, {backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : '#E7EEF9'}]}>
            <Ionicons name="receipt" size={20} color={isDark ? theme.text.title : '#111111'} />
          </View>
          <Text style={[st.createBtnText, {color: theme.text.body}]}>New Invoice</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={st.createBtn}
          activeOpacity={0.75}
          onPress={() => router.push('/(app)/quote' as any)}
        >
          <View style={[st.createCircle, {backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : '#F5EEDD'}]}>
            <Ionicons name="document-text" size={20} color={isDark ? theme.text.title : '#111111'} />
          </View>
          <Text style={[st.createBtnText, {color: theme.text.body}]}>New Quote</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={st.createBtn}
          activeOpacity={0.75}
          onPress={() => router.push('/(app)/forms' as any)}
        >
          <View style={[st.createCircle, {backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : '#E8F3EC'}]}>
            <Ionicons name="flame-outline" size={20} color={isDark ? theme.text.title : '#111111'} />
          </View>
          <Text style={[st.createBtnText, {color: theme.text.body}]}>New Gas Form</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );

  // ─── List View ─────────────────────────────────────────────────

  const listViewTitle = selectedView === 'certificates' ? 'Certificates' : 'Invoices & Quotes';

  const renderListView = () => (
    <>
      {/* List Header with Back */}
      <Animated.View entering={FadeInDown.delay(50).springify()} style={st.listHeader}>
        <GlassIconButton onPress={handleBackToLanding} />
        <Text style={[st.screenTitle, {color: theme.text.title}]}>{listViewTitle}</Text>
      </Animated.View>

      {/* Search */}
      <Animated.View entering={FadeInDown.delay(100).springify()} style={st.searchWrap}>
        <View style={[st.searchBar, {backgroundColor: glassBg, borderColor: glassBorder}]}>
          <Ionicons name="search" size={18} color={theme.text.muted} />
          <TextInput
            style={[st.searchInput, {color: theme.text.title}]}
            placeholder="Search by name, ref or number..."
            placeholderTextColor={theme.text.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).springify()} style={st.filterToolbar}>
        <TouchableOpacity
          style={[st.filterButton, {backgroundColor: glassBg, borderColor: glassBorder}]}
          activeOpacity={0.75}
          onPress={() => setShowFilterModal(true)}
        >
          <View style={st.filterButtonLeft}>
            <Ionicons name="options-outline" size={18} color={theme.text.title} />
            <Text style={[st.filterButtonText, {color: theme.text.title}]}>Filter document types</Text>
          </View>
          <View style={[st.filterCountPill, {backgroundColor: isDark ? theme.surface.elevated : UI.surface.elevated}]}>
            <Text style={[st.filterCountText, {color: theme.text.body}]}>
              {selectedFilters.length || 'All'}
            </Text>
          </View>
        </TouchableOpacity>

        {activeFilterLabels.length > 0 ? (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={activeFilterLabels}
            keyExtractor={(item) => item}
            contentContainerStyle={st.activeFilterRow}
            renderItem={({item}) => (
              <View style={[st.activeFilterChip, {backgroundColor: isDark ? theme.surface.elevated : 'rgba(148,163,184,0.12)'}]}>
                <Text style={[st.activeFilterText, {color: theme.text.body}]}>{item}</Text>
              </View>
            )}
          />
        ) : null}
      </Animated.View>

      {/* Document List */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{marginTop: 40}} />
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => item.id}
          renderItem={renderDocument}
          contentContainerStyle={{paddingHorizontal: 20, paddingBottom: 100, paddingTop: 8}}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 8, paddingVertical: 14, marginTop: 8, marginBottom: 20,
                  borderRadius: 14, backgroundColor: UI.surface.primaryLight,
                  borderWidth: 1, borderColor: '#C7D2FE',
                }}
                onPress={loadMore}
                activeOpacity={0.7}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={UI.brand.primary} />
                ) : (
                  <>
                    <Ionicons name="chevron-down-outline" size={18} color={UI.brand.primary} />
                    <Text style={{fontSize: 14, fontWeight: '600', color: UI.brand.primary}}>Load more</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : documents.length > 0 ? (
              <Text style={{textAlign: 'center', color: theme.text.muted, fontSize: 13, paddingVertical: 16}}>
                All documents loaded
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={[st.emptyCard, {backgroundColor: glassBg, borderColor: glassBorder}]}>
              <View style={[st.emptyIconWrap, {backgroundColor: isDark ? theme.surface.elevated : UI.surface.elevated, borderWidth: isDark ? 1 : 0, borderColor: isDark ? theme.surface.border : 'transparent'}]}>
                <Ionicons
                  name={selectedFilters.length > 0 ? 'options-outline' : 'documents-outline'}
                  size={28}
                  color={theme.text.muted} />
              </View>
              <Text style={[st.emptyTitle, {color: theme.text.body}]}>
                {selectedFilters.length > 0 ? 'No matching documents found' : 'No documents found'}
              </Text>
              <Text style={[st.emptySubtitle, {color: theme.text.muted}]}>
                {selectedFilters.length > 0
                  ? 'Try changing your selected document types.'
                  : 'Try adjusting your search or create one above.'}
              </Text>
            </View>
          }
        />
      )}
    </>
  );

  return (
    <View style={{flex: 1}}>
      <View style={[st.root, {backgroundColor: theme.surface.base}]}>
        <LinearGradient
          colors={theme.gradients.appBackground}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={StyleSheet.absoluteFill}
        />

        <View style={{flex: 1, paddingTop: insets.top}}>
          {/* Header - only shown on landing */}
          {selectedView === 'landing' && (
            <Animated.View entering={FadeInDown.delay(50).springify()} style={st.header}>
              <View>
                <Text style={[st.screenTitle, {color: theme.text.title}]}>Documents</Text>
                <Text style={[st.screenSubtitle, {color: theme.text.muted}]}>Certificates, invoices & quotes</Text>
              </View>
              <View style={[st.summaryBadge, {backgroundColor: isDark ? theme.surface.elevated : '#F3F4F6'}]}>
                <Text style={[st.summaryBadgeText, {color: theme.text.title}]}>
                  {actionNeededCount} Outstanding
                </Text>
              </View>
            </Animated.View>
          )}

          {selectedView === 'landing' ? renderLandingView() : renderListView()}

          <Modal
            visible={showFilterModal}
            animationType="fade"
            transparent
            onRequestClose={() => setShowFilterModal(false)}
          >
            <View style={st.modalOverlay}>
              <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowFilterModal(false)} />
              <View style={[st.filterModalCard, {backgroundColor: isDark ? theme.surface.card : '#FFFFFF', borderColor: isDark ? theme.surface.border : 'rgba(15,23,42,0.08)'}]}>
                <View style={st.filterModalHeader}>
                  <View>
                    <Text style={[st.filterModalTitle, {color: theme.text.title}]}>Filter Documents</Text>
                    <Text style={[st.filterModalSubtitle, {color: theme.text.muted}]}>Select one or more document types</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                    <Ionicons name="close" size={20} color={theme.text.muted} />
                  </TouchableOpacity>
                </View>

                <View style={st.filterOptionsList}>
                  {FILTER_OPTIONS.map((option) => {
                    const selected = selectedFilters.includes(option.key);
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[st.filterOptionRow, isDark && {borderBottomColor: theme.surface.divider}]}
                        activeOpacity={0.75}
                        onPress={() => {
                          setSelectedFilters((current) =>
                            current.includes(option.key)
                              ? current.filter((item) => item !== option.key)
                              : [...current, option.key],
                          );
                        }}
                      >
                        <View style={st.filterOptionInfo}>
                          <Ionicons name={option.icon} size={18} color={selected ? theme.brand.primary : theme.text.muted} />
                          <Text style={[st.filterOptionText, {color: theme.text.title}]}>{option.label}</Text>
                        </View>
                        <View style={[
                          st.checkbox,
                          selected
                            ? [st.checkboxActive, {backgroundColor: theme.brand.primary, borderColor: theme.brand.primary}]
                            : [st.checkboxInactive, isDark && {borderColor: theme.surface.border}],
                        ]}>
                          {selected ? <Ionicons name="checkmark" size={14} color={UI.text.white} /> : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={st.filterModalActions}>
                  <TouchableOpacity
                    style={[st.filterModalSecondaryBtn, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}
                    onPress={() => setSelectedFilters([])}
                  >
                    <Text style={[st.filterModalSecondaryText, {color: theme.text.body}]}>Clear All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.filterModalPrimaryBtn} onPress={() => setShowFilterModal(false)}>
                    <Text style={st.filterModalPrimaryText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#F0F4FF'},

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  screenTitle: {fontSize: 28, fontWeight: '800', color: UI.text.title, letterSpacing: -0.5},
  screenSubtitle: {fontSize: 13, color: UI.text.muted, fontWeight: '500', marginTop: 2},
  headerBadges: {flexDirection: 'row', gap: 6},
  summaryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  summaryBadgeText: {fontSize: 12, fontWeight: '700'},
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  countText: {fontSize: 12, fontWeight: '700'},

  // Quick Create
  createRow: {flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16, justifyContent: 'space-between'},
  createBtn: {
    flex: 1,
    paddingVertical: 2,
    alignItems: 'center',
  },
  createCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  createBtnText: {fontSize: 12, fontWeight: '700', color: UI.text.bodyLight, textAlign: 'center'},

  renewalSection: {marginBottom: 14},
  renewalHeader: {paddingHorizontal: 20, marginBottom: 10},
  renewalTitle: {fontSize: 18, fontWeight: '800'},
  renewalSubtitle: {fontSize: 13, marginTop: 2},
  renewalList: {paddingHorizontal: 20, paddingRight: 8, gap: 12},
  renewalCard: {
    width: 248,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  renewalTopRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12},
  renewalIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renewalPill: {paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999},
  renewalPillText: {fontSize: 11, fontWeight: '700'},
  renewalType: {fontSize: 11, fontWeight: '700', letterSpacing: 0.2, marginBottom: 4},
  renewalAddress: {fontSize: 16, fontWeight: '800', lineHeight: 21},
  renewalMeta: {fontSize: 12, marginTop: 6},
  renewalFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(241,245,249,0.8)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  renewalFooterText: {fontSize: 11, fontWeight: '600'},
  renewalDueDate: {fontSize: 12, fontWeight: '700'},

  // Search
  searchWrap: {paddingHorizontal: 20, marginBottom: 14},
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 14,
    shadowColor: UI.text.muted,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {flex: 1, marginLeft: 8, fontSize: 15, color: UI.text.title, height: '100%'},

  // Filters
  filterToolbar: {paddingHorizontal: 20, paddingBottom: 12, gap: 10},
  filterButton: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterButtonLeft: {flexDirection: 'row', alignItems: 'center', gap: 8},
  filterButtonText: {fontSize: 14, fontWeight: '700'},
  filterCountPill: {
    minWidth: 42,
    height: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: {fontSize: 12, fontWeight: '700'},
  activeFilterRow: {gap: 8},
  activeFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  activeFilterText: {fontSize: 12, fontWeight: '600'},

  // Cards
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  cardBody: {flex: 1, padding: 16},
  cardTopRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 12},
  typeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {flex: 1, paddingRight: 10},
  cardAddress: {fontSize: 17, fontWeight: '800', color: UI.text.title, marginTop: 1},
  cardCustomerSub: {fontSize: 13, fontWeight: '500', color: UI.text.muted, marginTop: 4},
  cardStatusWrap: {alignItems: 'flex-end', justifyContent: 'flex-start'},
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {fontSize: 10, fontWeight: '700', letterSpacing: 0.2},
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(241,245,249,0.8)',
  },
  cardDate: {fontSize: 12, color: UI.text.muted},
  cardDueDate: {fontSize: 12, fontWeight: '600'},

  // Swipe to Delete
  deleteSwipeBtn: {
    backgroundColor: UI.brand.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginBottom: 10,
    marginLeft: 10,
  },
  deleteSwipeText: {color: UI.text.white, fontSize: 11, fontWeight: '700', marginTop: 4},

  // Empty state
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: GLASS_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginTop: 40,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: UI.surface.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {fontSize: 15, fontWeight: '700', color: UI.text.bodyLight, marginBottom: 4},
  emptySubtitle: {fontSize: 13, color: UI.text.muted, textAlign: 'center'},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.30)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  filterModalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  filterModalTitle: {fontSize: 18, fontWeight: '800'},
  filterModalSubtitle: {fontSize: 13, marginTop: 4},
  filterOptionsList: {gap: 2},
  filterOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.35)',
  },
  filterOptionInfo: {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 10},
  filterOptionText: {fontSize: 14, fontWeight: '600'},
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {},
  checkboxInactive: {borderColor: 'rgba(148,163,184,0.7)'},
  filterModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  filterModalSecondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: UI.surface.elevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterModalSecondaryText: {fontSize: 13, fontWeight: '700'},
  filterModalPrimaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#111111',
  },
  filterModalPrimaryText: {fontSize: 13, fontWeight: '700', color: UI.text.white},

  // ─── Landing Stats Grid ─────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {fontSize: 22, fontWeight: '800', letterSpacing: -0.5},
  statLabel: {fontSize: 12, fontWeight: '600', marginTop: 2},
  statYtd: {fontSize: 12, fontWeight: '600', color: UI.text.muted},

  // ─── Navigation Cards ───────────────────────────────────────
  navCardsWrap: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
  },
  navCardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  navCardContent: {flex: 1},
  navCardTitle: {fontSize: 17, fontWeight: '800', letterSpacing: -0.3},
  navCardSubtitle: {fontSize: 13, fontWeight: '500', marginTop: 3},

  // ─── List Header ────────────────────────────────────────────
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
