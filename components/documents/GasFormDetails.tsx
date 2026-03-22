// ============================================
// FILE: components/documents/GasFormDetails.tsx
// Gas form detail sections for document detail screen
// ============================================

import {Ionicons} from '@expo/vector-icons';
import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {Colors, UI} from '../../constants/theme';
import type {CP12LockedPayload} from '../../src/services/cp12PdfGenerator';
import type {CommissioningLockedPayload} from '../../src/services/commissioningPdfGenerator';
import type {DecommissioningLockedPayload} from '../../src/services/decommissioningPdfGenerator';
import type {WarningNoticeLockedPayload} from '../../src/services/warningNoticePdfGenerator';
import type {BreakdownReportLockedPayload} from '../../src/services/breakdownReportPdfGenerator';
import type {InstallationCertLockedPayload} from '../../src/services/installationCertPdfGenerator';
import type {ServiceRecordLockedPayload} from '../../src/services/serviceRecordPdfGenerator';
import {combineNotes} from '../../src/services/documentActions';
import ReminderSection from '../ReminderSection';
import {styles} from './DocumentDetailStyles';

interface GasFormDetailsProps {
  isCp12: boolean;
  isSR: boolean;
  isCommissioning: boolean;
  isDecommissioning: boolean;
  isWarningNotice: boolean;
  isBreakdown: boolean;
  isInstallation: boolean;
  cp12Payload: CP12LockedPayload | null;
  srPayload: ServiceRecordLockedPayload | null;
  commissioningPayload: CommissioningLockedPayload | null;
  decommissioningPayload: DecommissioningLockedPayload | null;
  warningNoticePayload: WarningNoticeLockedPayload | null;
  breakdownPayload: BreakdownReportLockedPayload | null;
  installationPayload: InstallationCertLockedPayload | null;
  lockedPayload: any;
  savedEmails: string[];
  hasUnsavedEmails: boolean;
  isDark: boolean;
  theme: any;
  onReminderToggle: (enabled: boolean) => void;
  onOneTimeEmailsChange: (emails: string[]) => void;
  onSaveOneTimeEmails: () => void;
}

export default function GasFormDetails({
  isCp12,
  isSR,
  isCommissioning,
  isDecommissioning,
  isWarningNotice,
  isBreakdown,
  isInstallation,
  cp12Payload,
  srPayload,
  commissioningPayload,
  decommissioningPayload,
  warningNoticePayload,
  breakdownPayload,
  installationPayload,
  lockedPayload,
  savedEmails,
  hasUnsavedEmails,
  isDark,
  theme,
  onReminderToggle,
  onOneTimeEmailsChange,
  onSaveOneTimeEmails,
}: GasFormDetailsProps) {
  if (isCp12 && cp12Payload) {
    return (
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        {/* Engineer info */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Engineer</Text>
          <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={16} color={UI.brand.primary} />
              <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{cp12Payload.engineer.name || 'Not specified'}</Text>
            </View>
            {cp12Payload.engineer.gasSafeNumber ? (
              <View style={styles.detailRow}>
                <Ionicons name="shield-outline" size={16} color={UI.status.complete} />
                <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>Gas Safe: {cp12Payload.engineer.gasSafeNumber}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Property & People */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Property & People</Text>
          <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
            <View style={styles.detailRow}>
              <Ionicons name="home-outline" size={16} color={UI.status.inProgress} />
              <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{cp12Payload.pdfData.propertyAddress || 'No address'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Ionicons name="business-outline" size={16} color={UI.status.pending} />
              <View>
                <Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Landlord</Text>
                <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{cp12Payload.pdfData.landlordName || '\u2014'}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="people-outline" size={16} color={UI.status.paid} />
              <View>
                <Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Tenant</Text>
                <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{cp12Payload.pdfData.tenantName || '\u2014'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Appliances summary */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Appliances ({cp12Payload.pdfData.appliances.length})</Text>
          <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
            {cp12Payload.pdfData.appliances.map((app, i) => (
              <View key={i} style={[styles.applianceRow, i > 0 && {borderTopWidth: 1, borderTopColor: isDark ? theme.surface.divider : UI.surface.elevated, paddingTop: 10}]}>
                <View style={styles.applianceNum}>
                  <Text style={styles.applianceNumText}>{i + 1}</Text>
                </View>
                <View style={{flex: 1}}>
                  <Text style={[styles.applianceName, isDark && {color: theme.text.title}]}>{app.make} {app.model}</Text>
                  <Text style={[styles.applianceLocation, isDark && {color: theme.text.muted}]}>{app.location} {'\u2022'} {app.type}</Text>
                </View>
                <View style={[
                  styles.safetyBadge,
                  {backgroundColor: app.applianceSafeToUse === 'Yes' ? '#F0FDF4' : app.applianceSafeToUse === 'No' ? '#FEF2F2' : UI.surface.elevated}
                ]}>
                  <Ionicons
                    name={app.applianceSafeToUse === 'Yes' ? 'checkmark-circle' : app.applianceSafeToUse === 'No' ? 'close-circle' : 'help-circle'}
                    size={14}
                    color={app.applianceSafeToUse === 'Yes' ? '#15803d' : app.applianceSafeToUse === 'No' ? UI.brand.danger : UI.text.muted}
                  />
                  <Text style={[
                    styles.safetyText,
                    {color: app.applianceSafeToUse === 'Yes' ? '#15803d' : app.applianceSafeToUse === 'No' ? UI.brand.danger : UI.text.muted}
                  ]}>
                    {app.applianceSafeToUse === 'Yes' ? 'Safe' : app.applianceSafeToUse === 'No' ? 'Unsafe' : 'N/A'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Inspection dates */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Inspection</Text>
          <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
            <View style={styles.dateRow}>
              <View style={styles.dateItem}>
                <Ionicons name="calendar" size={18} color={UI.brand.primary} />
                <View>
                  <Text style={[styles.dateLabel, isDark && {color: theme.text.muted}]}>Inspected</Text>
                  <Text style={[styles.dateValue, isDark && {color: theme.text.title}]}>{cp12Payload.pdfData.inspectionDate}</Text>
                </View>
              </View>
              <View style={styles.dateItem}>
                <Ionicons name="alarm" size={18} color={UI.status.pending} />
                <View>
                  <Text style={[styles.dateLabel, isDark && {color: theme.text.muted}]}>Next Due</Text>
                  <Text style={[styles.dateValue, {color: UI.status.pending}]}>{cp12Payload.pdfData.nextDueDate}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Renewal Reminder</Text>
          <ReminderSection
            enabled={!!cp12Payload.pdfData.renewalReminderEnabled}
            onToggle={onReminderToggle}
            savedEmails={savedEmails}
            initialOneTimeEmails={(lockedPayload as any)?.oneTimeReminderEmails ?? []}
            onOneTimeEmailsChange={(emails) => {
              onOneTimeEmailsChange(emails);
            }}
          />
          {hasUnsavedEmails && (
            <TouchableOpacity
              style={{backgroundColor: UI.brand.primary, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: -8, marginBottom: 8}}
              onPress={onSaveOneTimeEmails}
            >
              <Text style={{color: '#fff', fontWeight: '700', fontSize: 14}}>Save One-Time Emails</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  }

  if (isSR && srPayload) {
    return (
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        {/* Engineer info */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Engineer</Text>
          <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={16} color="#059669" />
              <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{srPayload.engineer.name || 'Not specified'}</Text>
            </View>
            {srPayload.engineer.gasSafeNumber ? (
              <View style={styles.detailRow}>
                <Ionicons name="shield-outline" size={16} color={UI.status.complete} />
                <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>Gas Safe: {srPayload.engineer.gasSafeNumber}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Customer & Property */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Customer & Property</Text>
          <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={16} color={UI.status.pending} />
              <View>
                <Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Customer</Text>
                <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{srPayload.pdfData.customerName || '\u2014'}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Ionicons name="home-outline" size={16} color={UI.status.inProgress} />
              <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{srPayload.pdfData.propertyAddress || 'No address'}</Text>
            </View>
          </View>
        </View>

        {/* Appliance summary */}
        {srPayload.pdfData.appliances.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Appliance</Text>
            <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
              {srPayload.pdfData.appliances.map((app, i) => (
                <View key={i} style={[styles.applianceRow, i > 0 && {borderTopWidth: 1, borderTopColor: isDark ? theme.surface.divider : UI.surface.elevated, paddingTop: 10}]}>
                  <View style={styles.applianceNum}>
                    <Text style={styles.applianceNumText}>{i + 1}</Text>
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={[styles.applianceName, isDark && {color: theme.text.title}]}>{app.make} {app.model}</Text>
                    <Text style={[styles.applianceLocation, isDark && {color: theme.text.muted}]}>{app.location} {'\u2022'} {app.category}</Text>
                  </View>
                  <View style={[
                    styles.safetyBadge,
                    {backgroundColor: app.applianceCondition === 'Safe' ? '#F0FDF4' : app.applianceCondition === 'Unsafe' ? '#FEF2F2' : UI.surface.elevated}
                  ]}>
                    <Ionicons
                      name={app.applianceCondition === 'Safe' ? 'checkmark-circle' : app.applianceCondition === 'Unsafe' ? 'close-circle' : 'help-circle'}
                      size={14}
                      color={app.applianceCondition === 'Safe' ? '#15803d' : app.applianceCondition === 'Unsafe' ? UI.brand.danger : UI.text.muted}
                    />
                    <Text style={[
                      styles.safetyText,
                      {color: app.applianceCondition === 'Safe' ? '#15803d' : app.applianceCondition === 'Unsafe' ? UI.brand.danger : UI.text.muted}
                    ]}>
                      {app.applianceCondition || 'N/A'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Service dates */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Service Dates</Text>
          <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
            <View style={styles.dateRow}>
              <View style={styles.dateItem}>
                <Ionicons name="calendar" size={18} color="#059669" />
                <View>
                  <Text style={[styles.dateLabel, isDark && {color: theme.text.muted}]}>Service Date</Text>
                  <Text style={[styles.dateValue, isDark && {color: theme.text.title}]}>{srPayload.pdfData.serviceDate}</Text>
                </View>
              </View>
              <View style={styles.dateItem}>
                <Ionicons name="alarm" size={18} color={UI.status.pending} />
                <View>
                  <Text style={[styles.dateLabel, isDark && {color: theme.text.muted}]}>Next Inspection</Text>
                  <Text style={[styles.dateValue, {color: UI.status.pending}]}>{srPayload.pdfData.nextInspectionDate || '\u2014'}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Renewal Reminder</Text>
          <ReminderSection
            enabled={!!srPayload.pdfData.renewalReminderEnabled}
            onToggle={onReminderToggle}
            savedEmails={savedEmails}
            initialOneTimeEmails={(lockedPayload as any)?.oneTimeReminderEmails ?? []}
            onOneTimeEmailsChange={(emails) => {
              onOneTimeEmailsChange(emails);
            }}
          />
          {hasUnsavedEmails && (
            <TouchableOpacity
              style={{backgroundColor: UI.brand.primary, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: -8, marginBottom: 8}}
              onPress={onSaveOneTimeEmails}
            >
              <Text style={{color: '#fff', fontWeight: '700', fontSize: 14}}>Save One-Time Emails</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  }

  if (isCommissioning && commissioningPayload) {
    return (
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Engineer</Text>
          <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={16} color="#7C3AED" />
              <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{commissioningPayload.engineer.name || 'Not specified'}</Text>
            </View>
            {commissioningPayload.engineer.gasSafeNumber ? (
              <View style={styles.detailRow}>
                <Ionicons name="shield-outline" size={16} color={UI.status.complete} />
                <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>Gas Safe: {commissioningPayload.engineer.gasSafeNumber}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Customer & Property</Text>
          <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={16} color={UI.status.pending} />
              <View>
                <Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Customer</Text>
                <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{commissioningPayload.pdfData.customerName || '\u2014'}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Ionicons name="home-outline" size={16} color={UI.status.inProgress} />
              <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{commissioningPayload.pdfData.propertyAddress || 'No address'}</Text>
            </View>
          </View>
        </View>

        {commissioningPayload.pdfData.appliances.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Appliance</Text>
            <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
              {commissioningPayload.pdfData.appliances.map((app, i) => (
                <View key={i} style={[styles.applianceRow, i > 0 && {borderTopWidth: 1, borderTopColor: isDark ? theme.surface.divider : UI.surface.elevated, paddingTop: 10}]}>
                  <View style={[styles.applianceNum, {backgroundColor: '#F5F3FF'}]}>
                    <Text style={[styles.applianceNumText, {color: '#7C3AED'}]}>{i + 1}</Text>
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={[styles.applianceName, isDark && {color: theme.text.title}]}>{app.make} {app.model}</Text>
                    <Text style={[styles.applianceLocation, isDark && {color: theme.text.muted}]}>{app.location} {'\u2022'} {app.category}</Text>
                  </View>
                  <View style={[styles.safetyBadge, {backgroundColor: app.applianceCondition === 'Safe' ? '#F0FDF4' : app.applianceCondition === 'Unsafe' ? '#FEF2F2' : UI.surface.elevated}]}>
                    <Text style={[styles.safetyText, {color: app.applianceCondition === 'Safe' ? '#15803d' : app.applianceCondition === 'Unsafe' ? UI.brand.danger : UI.text.muted}]}>{app.applianceCondition || 'N/A'}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Commissioning</Text>
          <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
            <View style={styles.dateRow}>
              <View style={styles.dateItem}>
                <Ionicons name="calendar" size={18} color="#7C3AED" />
                <View>
                  <Text style={[styles.dateLabel, isDark && {color: theme.text.muted}]}>Commissioned</Text>
                  <Text style={[styles.dateValue, isDark && {color: theme.text.title}]}>{commissioningPayload.pdfData.commissioningDate}</Text>
                </View>
              </View>
              <View style={styles.dateItem}>
                <Ionicons name="alarm" size={18} color={UI.status.pending} />
                <View>
                  <Text style={[styles.dateLabel, isDark && {color: theme.text.muted}]}>Next Service</Text>
                  <Text style={[styles.dateValue, {color: UI.status.pending}]}>{commissioningPayload.pdfData.nextServiceDate || '\u2014'}</Text>
                </View>
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Outcome</Text>
            <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{combineNotes(commissioningPayload.pdfData.finalInfo.commissioningOutcome, commissioningPayload.pdfData.finalInfo.additionalWorkRequired ? `Further work required:\n${commissioningPayload.pdfData.finalInfo.additionalWorkRequired}` : '') || '\u2014'}</Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  if (isDecommissioning && decommissioningPayload) {
    return (
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Engineer</Text>
          <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={16} color="#64748B" />
              <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{decommissioningPayload.engineer.name || 'Not specified'}</Text>
            </View>
            {decommissioningPayload.engineer.gasSafeNumber ? (
              <View style={styles.detailRow}>
                <Ionicons name="shield-outline" size={16} color={UI.status.complete} />
                <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>Gas Safe: {decommissioningPayload.engineer.gasSafeNumber}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Customer & Property</Text>
          <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={16} color={UI.status.pending} />
              <View>
                <Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Customer</Text>
                <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{decommissioningPayload.pdfData.customerName || '\u2014'}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Ionicons name="home-outline" size={16} color={UI.status.inProgress} />
              <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{decommissioningPayload.pdfData.propertyAddress || 'No address'}</Text>
            </View>
          </View>
        </View>

        {decommissioningPayload.pdfData.appliances.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Appliance</Text>
            <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
              {decommissioningPayload.pdfData.appliances.map((app, i) => (
                <View key={i} style={[styles.applianceRow, i > 0 && {borderTopWidth: 1, borderTopColor: isDark ? theme.surface.divider : UI.surface.elevated, paddingTop: 10}]}>
                  <View style={[styles.applianceNum, {backgroundColor: '#F8FAFC'}]}>
                    <Text style={[styles.applianceNumText, {color: '#64748B'}]}>{i + 1}</Text>
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={[styles.applianceName, isDark && {color: theme.text.title}]}>{app.make} {app.model}</Text>
                    <Text style={[styles.applianceLocation, isDark && {color: theme.text.muted}]}>{app.location} {'\u2022'} {app.category}</Text>
                  </View>
                  <View style={[styles.safetyBadge, {backgroundColor: app.applianceCondition === 'Safe' ? '#F0FDF4' : app.applianceCondition === 'Unsafe' ? '#FEF2F2' : UI.surface.elevated}]}>
                    <Text style={[styles.safetyText, {color: app.applianceCondition === 'Safe' ? '#15803d' : app.applianceCondition === 'Unsafe' ? UI.brand.danger : UI.text.muted}]}>{app.applianceCondition || 'N/A'}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Decommissioning</Text>
          <View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}>
            <View style={styles.dateRow}>
              <View style={styles.dateItem}>
                <Ionicons name="calendar" size={18} color="#64748B" />
                <View>
                  <Text style={[styles.dateLabel, isDark && {color: theme.text.muted}]}>Date</Text>
                  <Text style={[styles.dateValue, isDark && {color: theme.text.title}]}>{decommissioningPayload.pdfData.decommissionDate}</Text>
                </View>
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Reason</Text>
            <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{decommissioningPayload.pdfData.appliances[0]?.decommissionReason || '\u2014'}</Text>
            <View style={styles.divider} />
            <Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Completion notes</Text>
            <Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{combineNotes(decommissioningPayload.pdfData.finalInfo.certificateNotes, decommissioningPayload.pdfData.finalInfo.furtherWorkRequired ? `Further work required:\n${decommissioningPayload.pdfData.finalInfo.furtherWorkRequired}` : '') || '\u2014'}</Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  if (isWarningNotice && warningNoticePayload) {
    return (
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <View style={styles.section}><Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Engineer</Text><View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}><View style={styles.detailRow}><Ionicons name="person-outline" size={16} color="#DC2626" /><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{warningNoticePayload.engineer.name || 'Not specified'}</Text></View>{warningNoticePayload.engineer.gasSafeNumber ? <View style={styles.detailRow}><Ionicons name="shield-outline" size={16} color={UI.status.complete} /><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>Gas Safe: {warningNoticePayload.engineer.gasSafeNumber}</Text></View> : null}</View></View>
        <View style={styles.section}><Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Customer & Property</Text><View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}><View style={styles.detailRow}><Ionicons name="person-outline" size={16} color={UI.status.pending} /><View><Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Customer</Text><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{warningNoticePayload.pdfData.customerName || '\u2014'}</Text></View></View><View style={styles.divider} /><View style={styles.detailRow}><Ionicons name="home-outline" size={16} color={UI.status.inProgress} /><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{warningNoticePayload.pdfData.propertyAddress || 'No address'}</Text></View></View></View>
        <View style={styles.section}><Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Hazard</Text><View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}><Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Classification</Text><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{warningNoticePayload.pdfData.appliances[0]?.warningClassification || '\u2014'}</Text><View style={styles.divider} /><Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Unsafe Situation</Text><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{warningNoticePayload.pdfData.appliances[0]?.unsafeSituation || '\u2014'}</Text><View style={styles.divider} /><Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Actions Taken</Text><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{warningNoticePayload.pdfData.appliances[0]?.actionsTaken || '\u2014'}</Text><View style={styles.divider} /><Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Outcome / advice notes</Text><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{combineNotes(warningNoticePayload.pdfData.finalInfo.engineerOpinion, warningNoticePayload.pdfData.finalInfo.furtherActionRequired ? `Further action required:\n${warningNoticePayload.pdfData.finalInfo.furtherActionRequired}` : '', warningNoticePayload.pdfData.appliances[0]?.engineerNotes ? `Engineer notes:\n${warningNoticePayload.pdfData.appliances[0].engineerNotes}` : '') || '\u2014'}</Text></View></View>
      </Animated.View>
    );
  }

  if (isBreakdown && breakdownPayload) {
    return (
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <View style={styles.section}><Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Engineer</Text><View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}><View style={styles.detailRow}><Ionicons name="person-outline" size={16} color="#D97706" /><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{breakdownPayload.engineer.name || 'Not specified'}</Text></View>{breakdownPayload.engineer.gasSafeNumber ? <View style={styles.detailRow}><Ionicons name="shield-outline" size={16} color={UI.status.complete} /><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>Gas Safe: {breakdownPayload.engineer.gasSafeNumber}</Text></View> : null}</View></View>
        <View style={styles.section}><Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Customer & Property</Text><View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}><View style={styles.detailRow}><Ionicons name="person-outline" size={16} color={UI.status.pending} /><View><Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Customer</Text><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{breakdownPayload.pdfData.customerName || '\u2014'}</Text></View></View><View style={styles.divider} /><View style={styles.detailRow}><Ionicons name="home-outline" size={16} color={UI.status.inProgress} /><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{breakdownPayload.pdfData.propertyAddress || 'No address'}</Text></View></View></View>
        <View style={styles.section}><Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Breakdown</Text><View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}><Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Diagnosis / outcome</Text><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{combineNotes(breakdownPayload.pdfData.finalInfo.repairOutcome, breakdownPayload.pdfData.finalInfo.faultFound ? `Fault found:\n${breakdownPayload.pdfData.finalInfo.faultFound}` : '', breakdownPayload.pdfData.finalInfo.furtherWorkRequired ? `Further work required:\n${breakdownPayload.pdfData.finalInfo.furtherWorkRequired}` : '') || '\u2014'}</Text></View></View>
      </Animated.View>
    );
  }

  if (isInstallation && installationPayload) {
    return (
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <View style={styles.section}><Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Engineer</Text><View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}><View style={styles.detailRow}><Ionicons name="person-outline" size={16} color="#0284C7" /><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{installationPayload.engineer.name || 'Not specified'}</Text></View>{installationPayload.engineer.gasSafeNumber ? <View style={styles.detailRow}><Ionicons name="shield-outline" size={16} color={UI.status.complete} /><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>Gas Safe: {installationPayload.engineer.gasSafeNumber}</Text></View> : null}</View></View>
        <View style={styles.section}><Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Customer & Property</Text><View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}><View style={styles.detailRow}><Ionicons name="person-outline" size={16} color={UI.status.pending} /><View><Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Customer</Text><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{installationPayload.pdfData.customerName || '\u2014'}</Text></View></View><View style={styles.divider} /><View style={styles.detailRow}><Ionicons name="home-outline" size={16} color={UI.status.inProgress} /><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{installationPayload.pdfData.propertyAddress || 'No address'}</Text></View></View></View>
        <View style={styles.section}><Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>Installation</Text><View style={[styles.card, isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'}]}><View style={styles.dateRow}><View style={styles.dateItem}><Ionicons name="calendar" size={18} color="#0284C7" /><View><Text style={[styles.dateLabel, isDark && {color: theme.text.muted}]}>Installed</Text><Text style={[styles.dateValue, isDark && {color: theme.text.title}]}>{installationPayload.pdfData.installationDate}</Text></View></View><View style={styles.dateItem}><Ionicons name="alarm" size={18} color={UI.status.pending} /><View><Text style={[styles.dateLabel, isDark && {color: theme.text.muted}]}>Next Service</Text><Text style={[styles.dateValue, {color: UI.status.pending}]}>{installationPayload.pdfData.nextServiceDate || '\u2014'}</Text></View></View></View><View style={styles.divider} /><Text style={[styles.detailLabel, isDark && {color: theme.text.muted}]}>Outcome</Text><Text style={[styles.detailText, isDark && {color: theme.text.title}]}>{combineNotes(installationPayload.pdfData.finalInfo.installationOutcome, installationPayload.pdfData.finalInfo.furtherWorkRequired ? `Further work required:\n${installationPayload.pdfData.finalInfo.furtherWorkRequired}` : '') || '\u2014'}</Text></View></View>
      </Animated.View>
    );
  }

  return null;
}
