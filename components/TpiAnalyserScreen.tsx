// ============================================
// FILE: components/TpiAnalyserScreen.tsx
// Full-screen TPI Analyser — opens when a DC710/DC711 connects.
//
// Displays all live FGA readings, device info, fuel type
// selector, pump start/stop, and a "Use Readings" action.
// ============================================

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UI } from '../constants/theme';
import { useAppTheme } from '../src/context/ThemeContext';
import { useTpiDevice } from '../src/context/TpiDeviceContext';
import { ALL_FUEL_TYPES } from '../src/types/gasForms';
import type { FuelType } from '../src/types/gasForms';
import {
  calculateExcessAir,
  estimateCombustionEfficiency,
} from '../src/utils/combustion';
import {
  TPI_FGA_SERVICE_UUID,
  TPI_CHAR_COMMAND,
  TPI_CHAR_PUMP_FLAG,
} from '../src/types/tpiDevice';

// ─── Props ──────────────────────────────────────────────────────

interface TpiAnalyserScreenProps {
  visible: boolean;
  onClose: () => void;
  /** Called when user taps "Use Readings" — passes current FGA values */
  onUseReadings?: () => void;
}

// ─── Component ──────────────────────────────────────────────────

export function TpiAnalyserScreen({
  visible,
  onClose,
  onUseReadings,
}: TpiAnalyserScreenProps) {
  const insets = useSafeAreaInsets();
  const { isDark, theme } = useAppTheme();
  const {
    connectedDevice,
    latestReading,
    deviceMetadata,
    fuelType,
    setFuelType,
    disconnect,
    writeChar,
    liveValues,
    monitorChar,
    stopMonitorChar,
    readChar,
  } = useTpiDevice();

  const [pumpSending, setPumpSending] = useState(false);
  const [pumpError, setPumpError] = useState<string | null>(null);
  const [fuelPickerOpen, setFuelPickerOpen] = useState(false);

  // Live pump-flag subscription drives the on/off indicator.
  useEffect(() => {
    if (!connectedDevice || !visible) return;
    monitorChar(TPI_FGA_SERVICE_UUID, TPI_CHAR_PUMP_FLAG);
    readChar(TPI_FGA_SERVICE_UUID, TPI_CHAR_PUMP_FLAG);
    return () => {
      stopMonitorChar(TPI_CHAR_PUMP_FLAG);
    };
  }, [connectedDevice, visible]);

  const pumpFlagRaw = liveValues[TPI_CHAR_PUMP_FLAG] ?? '';
  const pumpOn = pumpFlagRaw.includes('01') || pumpFlagRaw.includes('1');

  // ─── Derived values ─────────────────────────────────────────

  const o2 = latestReading?.o2 ?? null;
  const co = latestReading?.co ?? null;
  const co2 = latestReading?.co2 ?? null;
  const ratio = latestReading?.ratio ?? null;
  const flueTemp = latestReading?.flueTemp ?? null;
  const ambientTemp = latestReading?.ambientTemp ?? null;
  const efficiencyRaw = latestReading?.efficiency ?? null;

  const excessAir = useMemo(() => calculateExcessAir(o2), [o2]);

  const efficiencyCalc = useMemo(
    () => estimateCombustionEfficiency(co2, flueTemp, ambientTemp, fuelType),
    [co2, flueTemp, ambientTemp, fuelType],
  );

  const efficiency = efficiencyRaw != null && isFinite(efficiencyRaw)
    ? efficiencyRaw
    : efficiencyCalc;

  const tempDiff = useMemo(() => {
    if (flueTemp == null || ambientTemp == null) return null;
    return Math.round((flueTemp - ambientTemp) * 10) / 10;
  }, [flueTemp, ambientTemp]);

  const deviceLabel = useMemo(() => {
    const model = connectedDevice?.model ?? deviceMetadata?.modelNumber ?? 'TPI';
    const serial = deviceMetadata?.serialNumber ?? '';
    return serial ? `${model} · ${serial}` : model;
  }, [connectedDevice?.model, deviceMetadata]);

  // ─── Handlers ───────────────────────────────────────────────

  // TPI DC710 command protocol: ASCII "CMD*<KEY>=<VALUE>" written to the command char.
  const sendPumpCommand = useCallback(async (on: boolean) => {
    if (!connectedDevice || !writeChar) return;
    const cmd = on ? 'CMD*PUMP=ON' : 'CMD*PUMP=OFF';
    setPumpSending(true);
    setPumpError(null);
    try {
      const ok = await writeChar(TPI_FGA_SERVICE_UUID, TPI_CHAR_COMMAND, btoa(cmd));
      if (!ok) setPumpError(`Pump ${on ? 'start' : 'stop'} failed`);
    } catch (err: any) {
      setPumpError(err?.message ?? 'Command error');
    } finally {
      setPumpSending(false);
    }
  }, [connectedDevice, writeChar]);

  const handleDisconnect = useCallback(async () => {
    onClose();
    disconnect();
  }, [disconnect, onClose]);

  const handleUseReadings = useCallback(() => {
    // Turn off pump before closing
    if (pumpOn && connectedDevice && writeChar) {
      writeChar(TPI_FGA_SERVICE_UUID, TPI_CHAR_COMMAND, btoa('CMD*PUMP=OFF')).catch(() => {});
    }
    onUseReadings?.();
    onClose();
  }, [onUseReadings, onClose, pumpOn, connectedDevice, writeChar]);

  const handleSelectFuel = useCallback((ft: FuelType) => {
    setFuelType(ft);
    setFuelPickerOpen(false);
  }, [setFuelType]);

  // ─── Style tokens ──────────────────────────────────────────

  const bg = isDark ? theme.surface.base : '#F0F4F8';
  const cardBg = isDark ? theme.surface.card : '#FFFFFF';
  const border = isDark ? theme.surface.border : '#E2E8F0';
  const textTitle = isDark ? theme.text.title : '#0F172A';
  const textBody = isDark ? theme.text.body : '#334155';
  const textMuted = isDark ? theme.text.muted : '#94A3B8';
  const accent = UI.brand.primary;
  const green = '#10B981';
  const greenBg = isDark ? '#052E16' : '#F0FDF4';
  const greenBorder = isDark ? '#166534' : '#BBF7D0';
  const amberBg = isDark ? '#1C1917' : '#FFF7ED';
  const amberBorder = isDark ? '#78350F' : '#FDE68A';
  const amber = '#F59E0B';
  const red = '#EF4444';
  const tpiRed = '#E30613'; // TPI brand red

  // ─── Reading Card helper ────────────────────────────────────

  const ReadingRow = ({
    label,
    value,
    unit,
    icon,
    highlight,
  }: {
    label: string;
    value: string | number | null;
    unit: string;
    icon?: string;
    highlight?: boolean;
  }) => {
    const displayVal = value != null && value !== '' ? String(value) : '—';
    const isLive = displayVal !== '—';

    return (
      <View style={[styles.readingRow, { borderBottomColor: border }]}>
        <View style={styles.readingLabelWrap}>
          {icon && (
            <MaterialCommunityIcons
              name={icon as any}
              size={18}
              color={highlight ? amber : textMuted}
              style={{ marginRight: 8 }}
            />
          )}
          <Text style={[styles.readingLabel, { color: textBody }]}>{label}</Text>
        </View>
        <View style={styles.readingValueWrap}>
          <Text
            style={[
              styles.readingValue,
              { color: isLive ? (highlight ? amber : textTitle) : textMuted },
            ]}
          >
            {displayVal}
          </Text>
          {unit ? (
            <Text style={[styles.readingUnit, { color: textMuted }]}>{unit}</Text>
          ) : null}
        </View>
      </View>
    );
  };

  // ─── Render ─────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
        {/* ── Header ── */}
        <View style={[styles.header, { borderBottomColor: border }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.tpiBadge, { backgroundColor: tpiRed }]}>
              <Text style={styles.tpiBadgeText}>TPI</Text>
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: textTitle }]}>
                Flue Gas Analysis
              </Text>
              <Text style={[styles.headerSubtitle, { color: textMuted }]}>
                {deviceLabel}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={24} color={textBody} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Device Info Card ── */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={styles.deviceHeader}>
              <View style={styles.deviceTitleRow}>
                <View style={[styles.statusDot, { backgroundColor: green }]} />
                <Text style={[styles.deviceName, { color: textTitle }]}>
                  Connected
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleDisconnect}
                style={[styles.disconnectBtn, { borderColor: red }]}
              >
                <Text style={[styles.disconnectText, { color: red }]}>Disconnect</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.metaRow, { borderTopColor: border }]}>
              {deviceMetadata?.batteryLevel != null && (
                <View style={styles.metaItem}>
                  <Ionicons
                    name={
                      deviceMetadata.batteryLevel > 60
                        ? 'battery-full'
                        : deviceMetadata.batteryLevel > 20
                          ? 'battery-half'
                          : 'battery-dead'
                    }
                    size={14}
                    color={deviceMetadata.batteryLevel > 20 ? green : red}
                  />
                  <Text style={[styles.metaText, { color: textBody }]}>
                    {deviceMetadata.batteryLevel}%
                  </Text>
                </View>
              )}
              {deviceMetadata?.lastCalDate && (
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={14} color={textMuted} />
                  <Text style={[styles.metaText, { color: textBody }]}>
                    Cal: {deviceMetadata.lastCalDate}
                  </Text>
                </View>
              )}
              {deviceMetadata?.calDueDate && (
                <View style={styles.metaItem}>
                  <Ionicons name="alert-circle-outline" size={14} color={amber} />
                  <Text style={[styles.metaText, { color: textBody }]}>
                    Due: {deviceMetadata.calDueDate}
                  </Text>
                </View>
              )}
              {deviceMetadata?.firmwareRevision && (
                <View style={styles.metaItem}>
                  <Ionicons name="hardware-chip-outline" size={14} color={textMuted} />
                  <Text style={[styles.metaText, { color: textBody }]}>
                    FW {deviceMetadata.firmwareRevision}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Pump Control ── */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: textMuted }]}>PUMP</Text>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: pumpOn ? greenBg : amberBg,
                    borderColor: pumpOn ? greenBorder : amberBorder,
                  },
                ]}
              >
                <View style={[styles.statusPillDot, { backgroundColor: pumpOn ? green : amber }]} />
                <Text style={[styles.statusPillText, { color: pumpOn ? green : amber }]}>
                  {pumpOn ? 'RUNNING' : 'STOPPED'}
                </Text>
              </View>
            </View>

            <View style={styles.pumpBtnRow}>
              <TouchableOpacity
                onPress={() => sendPumpCommand(true)}
                disabled={pumpSending || pumpOn}
                activeOpacity={0.85}
                style={[
                  styles.pumpBtn,
                  {
                    backgroundColor: pumpOn ? (isDark ? '#1E293B' : '#F1F5F9') : green,
                    borderColor: pumpOn ? border : green,
                    opacity: pumpSending ? 0.6 : 1,
                  },
                ]}
              >
                <Ionicons name="play" size={16} color={pumpOn ? textMuted : '#FFFFFF'} />
                <Text style={[styles.pumpBtnText, { color: pumpOn ? textMuted : '#FFFFFF' }]}>
                  Start
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => sendPumpCommand(false)}
                disabled={pumpSending || !pumpOn}
                activeOpacity={0.85}
                style={[
                  styles.pumpBtn,
                  {
                    backgroundColor: !pumpOn ? (isDark ? '#1E293B' : '#F1F5F9') : red,
                    borderColor: !pumpOn ? border : red,
                    opacity: pumpSending ? 0.6 : 1,
                  },
                ]}
              >
                <Ionicons name="stop" size={16} color={!pumpOn ? textMuted : '#FFFFFF'} />
                <Text style={[styles.pumpBtnText, { color: !pumpOn ? textMuted : '#FFFFFF' }]}>
                  Stop
                </Text>
              </TouchableOpacity>
            </View>

            {pumpError && (
              <Text style={[styles.errorText, { color: red }]}>{pumpError}</Text>
            )}
          </View>

          {/* ── Fuel Type Selector ── */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.sectionLabel, { color: textMuted }]}>FUEL TYPE</Text>
            <TouchableOpacity
              onPress={() => setFuelPickerOpen(!fuelPickerOpen)}
              style={[
                styles.fuelSelector,
                {
                  borderColor: border,
                  backgroundColor: isDark ? theme.surface.elevated : '#F8FAFC',
                },
              ]}
            >
              <Text style={[styles.fuelText, { color: textTitle, flex: 1 }]}>
                {fuelType || 'Select Fuel Type'}
              </Text>
              <Ionicons
                name={fuelPickerOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={textMuted}
              />
            </TouchableOpacity>

            {fuelPickerOpen && (
              <View style={[styles.fuelList, { borderColor: border }]}>
                {ALL_FUEL_TYPES.map((ft) => (
                  <TouchableOpacity
                    key={ft}
                    onPress={() => handleSelectFuel(ft as FuelType)}
                    style={[
                      styles.fuelOption,
                      { borderBottomColor: border },
                      ft === fuelType && {
                        backgroundColor: isDark ? '#1E3A5F' : '#EFF6FF',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.fuelOptionText,
                        { color: ft === fuelType ? accent : textBody },
                      ]}
                    >
                      {ft}
                    </Text>
                    {ft === fuelType && (
                      <Ionicons name="checkmark" size={18} color={accent} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* ── Live Readings ── */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: textMuted }]}>
                LIVE READINGS
              </Text>
              <View style={[styles.statusPill, { backgroundColor: greenBg, borderColor: greenBorder }]}>
                <View style={[styles.statusPillDot, { backgroundColor: green }]} />
                <Text style={[styles.statusPillText, { color: green }]}>LIVE</Text>
              </View>
            </View>

            <ReadingRow
              label="Carbon Monoxide (CO)"
              value={co != null ? Math.round(co) : null}
              unit="ppm"
              icon="molecule-co"
              highlight={co != null && co > 100}
            />
            <ReadingRow
              label="Carbon Dioxide (CO₂)"
              value={co2 != null ? co2.toFixed(1) : null}
              unit="%"
              icon="molecule-co2"
            />
            <ReadingRow
              label="CO/CO₂ Ratio"
              value={ratio != null ? ratio.toFixed(4) : null}
              unit=""
              icon="scale-balance"
              highlight={ratio != null && ratio > 0.004}
            />
            <ReadingRow
              label="Oxygen (O₂)"
              value={o2 != null ? o2.toFixed(1) : null}
              unit="%"
              icon="gas-cylinder"
            />
            <ReadingRow
              label="Excess Air"
              value={excessAir != null ? excessAir.toFixed(1) : null}
              unit="%"
              icon="weather-windy"
            />
            <ReadingRow
              label="Flue Temp (T1)"
              value={flueTemp != null ? flueTemp.toFixed(1) : null}
              unit="°C"
              icon="thermometer-high"
            />
            <ReadingRow
              label="Ambient Temp (T2)"
              value={ambientTemp != null ? ambientTemp.toFixed(1) : null}
              unit="°C"
              icon="thermometer-low"
            />
            <ReadingRow
              label="Net Temp (T1 − T2)"
              value={tempDiff != null ? tempDiff.toFixed(1) : null}
              unit="°C"
              icon="thermometer-chevron-up"
            />
            <ReadingRow
              label="Efficiency (Net)"
              value={
                efficiency != null && isFinite(efficiency)
                  ? efficiency.toFixed(1)
                  : null
              }
              unit="%"
              icon="lightning-bolt"
            />
          </View>

          {/* ── Action Button ── */}
          <TouchableOpacity
            onPress={handleUseReadings}
            activeOpacity={0.9}
            style={[styles.useReadingsBtn, { backgroundColor: accent }]}
          >
            <Ionicons name="download-outline" size={20} color="#FFFFFF" />
            <Text style={styles.useReadingsBtnText}>Use Readings</Text>
          </TouchableOpacity>

          <Text style={[styles.footerNote, { color: textMuted }]}>
            Readings stream live from the analyser over Bluetooth.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  tpiBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  tpiBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },

  // Body
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // Card
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 12,
  },

  // Device info
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
  },
  disconnectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  disconnectText: {
    fontSize: 13,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 13,
  },

  // Section label
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // Status pill (LIVE / RUNNING / STOPPED)
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },

  // Fuel type selector
  fuelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  fuelText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  fuelList: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fuelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fuelOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Readings
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  readingLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  readingLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  readingValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  readingValue: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  readingUnit: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Pump buttons
  pumpBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pumpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  pumpBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 10,
  },

  // Use Readings
  useReadingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  useReadingsBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footerNote: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});

export default TpiAnalyserScreen;
