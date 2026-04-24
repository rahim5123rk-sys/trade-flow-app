// ============================================
// FILE: components/BleConnectModal.tsx
// BLE Scanner & Explorer modal for TPI gas analysers
//
// Shows nearby BLE devices, allows connection,
// and explores services/characteristics.
// Works without known UUIDs (discovery mode).
// ============================================

import {Ionicons} from '@expo/vector-icons';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppTheme} from '../src/context/ThemeContext';
import {useTpiDevice} from '../src/context/TpiDeviceContext';
import type {DiscoveredService} from '../src/services/tpiBluetooth';
import type {BleDeviceInfo} from '../src/types/tpiDevice';
import {TpiAnalyserScreen} from './TpiAnalyserScreen';

interface BleConnectModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called when user wants to use a live value for a field */
  onSelectValue?: (value: string, charUUID: string) => void;
  /** Called when user taps "Use Readings" in the TPI Analyser — passes current FGA values */
  onUseReadings?: (values: {co: string; co2: string; ratio: string}) => void;
}

export function BleConnectModal({visible, onClose, onSelectValue, onUseReadings}: BleConnectModalProps) {
  const insets = useSafeAreaInsets();
  const {isDark, theme} = useAppTheme();
  const {
    connectionStatus,
    error,
    discoveredDevices,
    connectedDevice,
    services,
    liveValues,
    fgaValues,
    deviceMetadata,
    scan,
    cancelScan,
    connect,
    disconnect,
    readChar,
    monitorChar,
    stopMonitorChar,
  } = useTpiDevice();

  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [monitoredChars, setMonitoredChars] = useState<Set<string>>(new Set());
  const [showAnalyser, setShowAnalyser] = useState(false);

  const isScanning = connectionStatus === 'scanning';
  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';

  // Show only recognised TPI devices, sorted by signal strength
  const sortedDevices = useMemo(() => {
    return discoveredDevices
      .filter((d) => d.model != null)
      .sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
  }, [discoveredDevices]);

  // ─── Handlers ───────────────────────────────────────────────

  const handleScan = useCallback(() => {
    if (isScanning) {
      cancelScan();
    } else {
      scan();
    }
  }, [isScanning, scan, cancelScan]);

  const handleConnect = useCallback(async (device: BleDeviceInfo) => {
    await connect(device);
  }, [connect]);

  const handleDisconnect = useCallback(async () => {
    setMonitoredChars(new Set());
    setExpandedService(null);
    await disconnect();
  }, [disconnect]);

  const handleReadChar = useCallback(async (serviceUUID: string, charUUID: string) => {
    await readChar(serviceUUID, charUUID);
  }, [readChar]);

  const handleToggleMonitor = useCallback((serviceUUID: string, charUUID: string) => {
    setMonitoredChars((prev) => {
      const next = new Set(prev);
      if (next.has(charUUID)) {
        stopMonitorChar(charUUID);
        next.delete(charUUID);
      } else {
        monitorChar(serviceUUID, charUUID);
        next.add(charUUID);
      }
      return next;
    });
  }, [monitorChar, stopMonitorChar]);

  const handleSelectValue = useCallback((value: string, charUUID: string) => {
    onSelectValue?.(value, charUUID);
  }, [onSelectValue]);

  // Open TPI Analyser screen when a recognized TPI device connects.
  // Production mode subscriptions in TpiDeviceContext handle data streaming.
  useEffect(() => {
    if (isConnected && connectedDevice?.model && visible) {
      setShowAnalyser(true);
    }
  }, [isConnected, connectedDevice?.model, visible]);

  // Reset analyser flag when modal is closed by parent
  useEffect(() => {
    if (!visible) {
      setShowAnalyser(false);
    }
  }, [visible]);

  // ─── Styles ─────────────────────────────────────────────────

  const bg = isDark ? theme.surface.base : '#F8FAFC';
  const cardBg = isDark ? theme.surface.card : '#FFFFFF';
  const border = isDark ? theme.surface.border : '#E2E8F0';
  const textPrimary = isDark ? theme.text.title : '#0F172A';
  const textSecondary = isDark ? theme.text.body : '#475569';
  const textMuted = isDark ? theme.text.muted : '#94A3B8';
  const accent = '#3B82F6';
  const green = '#10B981';
  const red = '#EF4444';

  // ─── Render ─────────────────────────────────────────────────

  // If analyser is active, show the TPI Analyser screen instead.
  // Keep showing it even during 'disconnecting' to avoid a flash of the scanner.
  if (showAnalyser && connectedDevice?.model) {
    return (
      <TpiAnalyserScreen
        visible={visible}
        onClose={() => {
          // Close parent modal first (hides everything), then reset flag
          onClose();
          setShowAnalyser(false);
        }}
        onUseReadings={() => {
          // Pass current FGA values to the specific FgaReadingsGroup that opened this modal
          if (onUseReadings) {
            onUseReadings({
              co: fgaValues.co,
              co2: fgaValues.co2,
              ratio: fgaValues.ratio,
            });
          }
          onClose();
          setShowAnalyser(false);
        }}
      />
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, {backgroundColor: bg, paddingTop: insets.top}]}>
        {/* Header */}
        <View style={[styles.header, {borderBottomColor: border}]}>
          <View style={styles.headerLeft}>
            <Ionicons name="bluetooth" size={22} color={accent} />
            <Text style={[styles.headerTitle, {color: textPrimary}]}>
              Bluetooth Analyser
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Error */}
        {error && (
          <View style={[styles.errorBanner, {backgroundColor: isDark ? '#451A1A' : '#FEF2F2'}]}>
            <Ionicons name="warning" size={16} color={red} />
            <Text style={[styles.errorText, {color: red}]}>{error}</Text>
          </View>
        )}

        {/* Connection Status */}
        {connectedDevice && (
          <View style={[styles.connectedBanner, {backgroundColor: isDark ? '#052E16' : '#F0FDF4', borderColor: isDark ? '#166534' : '#BBF7D0'}]}>
            <View style={styles.connectedInfo}>
              <View style={[styles.statusDot, {backgroundColor: green}]} />
              <View>
                <Text style={[styles.connectedName, {color: textPrimary}]}>
                  {connectedDevice.name || connectedDevice.localName || 'Unknown'}
                </Text>
                <Text style={[styles.connectedSub, {color: textSecondary}]}>
                  {connectedDevice.model ? `TPI ${connectedDevice.model}` : 'Connected'}
                  {deviceMetadata?.batteryLevel != null && ` • ${deviceMetadata.batteryLevel}%`}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleDisconnect} style={[styles.disconnectBtn, {borderColor: red}]}>
              <Text style={[styles.disconnectText, {color: red}]}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView style={styles.body} contentContainerStyle={{paddingBottom: insets.bottom + 20}}>
          {/* ── Not connected: Show scanner ── */}
          {!isConnected && !isConnecting && (
            <>
              <TouchableOpacity
                onPress={handleScan}
                style={[styles.scanBtn, {backgroundColor: isScanning ? red : accent}]}
              >
                {isScanning ? (
                  <>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={styles.scanBtnText}>Stop Scanning</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="search" size={18} color="#FFF" />
                    <Text style={styles.scanBtnText}>Scan for Devices</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Device list — TPI devices sorted to top */}
              {sortedDevices.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, {color: textSecondary}]}>
                    Nearby Devices ({sortedDevices.length})
                  </Text>
                  {sortedDevices.map((device) => (
                    <TouchableOpacity
                      key={device.id}
                      style={[styles.deviceRow, {backgroundColor: cardBg, borderColor: border}]}
                      onPress={() => handleConnect(device)}
                    >
                      <View style={styles.deviceInfo}>
                        <Ionicons
                          name={device.model ? 'hardware-chip' : 'bluetooth'}
                          size={20}
                          color={device.model ? green : accent}
                        />
                        <View style={{flex: 1}}>
                          <Text style={[styles.deviceName, {color: textPrimary}]}>
                            {device.name || device.localName || 'Unknown'}
                          </Text>
                          {device.model && (
                            <Text style={[styles.deviceId, {color: green}]}>
                              TPI {device.model}
                            </Text>
                          )}
                        </View>
                      </View>
                      {device.rssi != null && (
                        <Ionicons
                          name={device.rssi > -60 ? 'wifi' : device.rssi > -80 ? 'wifi' : 'wifi-outline'}
                          size={16}
                          color={device.rssi > -60 ? green : device.rssi > -80 ? textMuted : red}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {isScanning && sortedDevices.length === 0 && (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="large" color={accent} />
                  <Text style={[styles.emptyText, {color: textSecondary}]}>
                    Scanning for nearby devices...
                  </Text>
                  <Text style={[styles.emptyHint, {color: textMuted}]}>
                    Make sure your TPI analyser is powered on
                  </Text>
                </View>
              )}

              {!isScanning && sortedDevices.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="bluetooth-outline" size={48} color={textMuted} />
                  <Text style={[styles.emptyText, {color: textSecondary}]}>
                    No devices found
                  </Text>
                  <Text style={[styles.emptyHint, {color: textMuted}]}>
                    Tap &ldquo;Scan for Devices&rdquo; to search
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Connecting spinner */}
          {isConnecting && (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={accent} />
              <Text style={[styles.emptyText, {color: textSecondary}]}>
                Connecting...
              </Text>
            </View>
          )}

          {/* ── Connected: Show services & characteristics ── */}
          {isConnected && services.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, {color: textSecondary}]}>
                Services & Characteristics
              </Text>
              <Text style={[styles.sectionHint, {color: textMuted}]}>
                Tap a service to expand. Tap &ldquo;Monitor&rdquo; to watch live values.
              </Text>

              {services.map((service) => (
                <ServiceCard
                  key={service.uuid}
                  service={service}
                  expanded={expandedService === service.uuid}
                  onToggle={() => setExpandedService(
                    expandedService === service.uuid ? null : service.uuid,
                  )}
                  liveValues={liveValues}
                  monitoredChars={monitoredChars}
                  onRead={handleReadChar}
                  onToggleMonitor={handleToggleMonitor}
                  onSelectValue={onSelectValue ? handleSelectValue : undefined}
                  isDark={isDark}
                  theme={theme}
                />
              ))}
            </View>
          )}

          {isConnected && services.length === 0 && (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={accent} />
              <Text style={[styles.emptyText, {color: textSecondary}]}>
                Discovering services...
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Service Card component ─────────────────────────────────────

function ServiceCard({
  service,
  expanded,
  onToggle,
  liveValues,
  monitoredChars,
  onRead,
  onToggleMonitor,
  onSelectValue,
  isDark,
  theme,
}: {
  service: DiscoveredService;
  expanded: boolean;
  onToggle: () => void;
  liveValues: Record<string, string>;
  monitoredChars: Set<string>;
  onRead: (serviceUUID: string, charUUID: string) => void;
  onToggleMonitor: (serviceUUID: string, charUUID: string) => void;
  onSelectValue?: (value: string, charUUID: string) => void;
  isDark: boolean;
  theme: any;
}) {
  const cardBg = isDark ? theme.surface.card : '#FFFFFF';
  const border = isDark ? theme.surface.border : '#E2E8F0';
  const textPrimary = isDark ? theme.text.title : '#0F172A';
  const textSecondary = isDark ? theme.text.body : '#475569';
  const textMuted = isDark ? theme.text.muted : '#94A3B8';
  const accent = '#3B82F6';
  const green = '#10B981';

  // Shorten UUID for display
  const shortUUID = (uuid: string) => {
    if (uuid.length > 8) {
      return uuid.substring(0, 8) + '...';
    }
    return uuid;
  };

  return (
    <View style={[styles.serviceCard, {backgroundColor: cardBg, borderColor: border}]}>
      <TouchableOpacity onPress={onToggle} style={styles.serviceHeader}>
        <View style={{flex: 1}}>
          <Text style={[styles.serviceUUID, {color: textPrimary}]} numberOfLines={1}>
            {service.uuid}
          </Text>
          <Text style={[styles.serviceCharCount, {color: textMuted}]}>
            {service.characteristics.length} characteristic{service.characteristics.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.charList, {borderTopColor: border}]}>
          {service.characteristics.map((char) => {
            const isMonitored = monitoredChars.has(char.uuid);
            const value = liveValues[char.uuid];
            const badges: string[] = [];
            if (char.isReadable) badges.push('R');
            if (char.isNotifiable) badges.push('N');
            if (char.isWritable) badges.push('W');

            return (
              <View key={char.uuid} style={[styles.charRow, {borderBottomColor: border}]}>
                <View style={{flex: 1}}>
                  <View style={styles.charUUIDRow}>
                    <Text style={[styles.charUUID, {color: textSecondary}]} numberOfLines={1}>
                      {char.uuid}
                    </Text>
                    <View style={styles.badges}>
                      {badges.map((b) => (
                        <View key={b} style={[styles.badge, {backgroundColor: isDark ? '#1E293B' : '#F1F5F9'}]}>
                          <Text style={[styles.badgeText, {color: textMuted}]}>{b}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Live value display */}
                  {value != null && (
                    <TouchableOpacity
                      onPress={() => onSelectValue?.(value, char.uuid)}
                      disabled={!onSelectValue}
                      style={[styles.valueContainer, {backgroundColor: isDark ? '#0F2E1A' : '#F0FDF4'}]}
                    >
                      <Text style={[styles.valueText, {color: green}]} numberOfLines={2}>
                        {value}
                      </Text>
                      {onSelectValue && (
                        <Ionicons name="arrow-forward-circle" size={16} color={green} />
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {/* Action buttons */}
                <View style={styles.charActions}>
                  {char.isReadable && (
                    <TouchableOpacity
                      onPress={() => onRead(service.uuid, char.uuid)}
                      style={[styles.charBtn, {borderColor: accent}]}
                    >
                      <Text style={[styles.charBtnText, {color: accent}]}>Read</Text>
                    </TouchableOpacity>
                  )}
                  {char.isNotifiable && (
                    <TouchableOpacity
                      onPress={() => onToggleMonitor(service.uuid, char.uuid)}
                      style={[
                        styles.charBtn,
                        {borderColor: isMonitored ? red : green},
                        isMonitored && {backgroundColor: isDark ? '#451A1A' : '#FEF2F2'},
                      ]}
                    >
                      <Text style={[styles.charBtnText, {color: isMonitored ? red : green}]}>
                        {isMonitored ? 'Stop' : 'Monitor'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const red = '#EF4444';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  connectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  connectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  connectedName: {
    fontSize: 14,
    fontWeight: '700',
  },
  connectedSub: {
    fontSize: 12,
    marginTop: 1,
  },
  disconnectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  disconnectText: {
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
  },
  scanBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    marginBottom: 12,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
  },
  deviceId: {
    fontSize: 11,
    marginTop: 2,
  },
  rssiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rssiText: {
    fontSize: 11,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 13,
  },
  // Service cards
  serviceCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  serviceUUID: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  serviceCharCount: {
    fontSize: 11,
    marginTop: 2,
  },
  charList: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  charRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  charUUIDRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  charUUID: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flexShrink: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 3,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  valueText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  charActions: {
    flexDirection: 'column',
    gap: 4,
    alignItems: 'flex-end',
  },
  charBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
  },
  charBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
