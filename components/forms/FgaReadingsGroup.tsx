// ============================================
// FILE: components/forms/FgaReadingsGroup.tsx
// Shared FGA readings input group with BLE connect button
//
// Replaces inline FGARow/FgaGroup in all gas forms.
// Shows CO, CO₂, Ratio fields with a Bluetooth button
// that opens the BLE scanner/explorer modal.
//
// When connected to a TPI analyser, live readings
// auto-populate the fields via useTpiDevice() context.
// ============================================

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { UI } from '../../constants/theme';
import { useAppTheme } from '../../src/context/ThemeContext';
import { useTpiDevice } from '../../src/context/TpiDeviceContext';
import { BleConnectModal } from '../BleConnectModal';

interface FGAValues {
  co: string;
  co2: string;
  ratio: string;
}

interface FgaReadingsGroupProps {
  label: string;
  value: FGAValues;
  onChange: (value: FGAValues) => void;
  /** Show N/A toggle per field (CP12 style). Default: true */
  showNA?: boolean;
  /** Show Bluetooth connect button. Default: true */
  showBluetooth?: boolean;
}

const FIELD_LABELS = { co: 'CO', co2: 'CO₂', ratio: 'Ratio' } as const;

export function FgaReadingsGroup({
  label,
  value,
  onChange,
  showNA = true,
  showBluetooth = true,
}: FgaReadingsGroupProps) {
  const { isDark, theme } = useAppTheme();
  const [bleModalVisible, setBleModalVisible] = useState(false);
  const { connectedDevice, connectionStatus, deviceMetadata } = useTpiDevice();

  const isConnected = connectionStatus === 'connected' && !!connectedDevice;

  const handleManualChange = useCallback(
    (field: keyof FGAValues, text: string) => {
      onChange({ ...value, [field]: text });
    },
    [value, onChange],
  );

  const handleBleValue = useCallback(
    (rawValue: string, _charUUID: string) => {
      const numMatch = rawValue.match(/-?[\d.]+/);
      if (!numMatch) return;

      const num = parseFloat(numMatch[0]);
      if (!isFinite(num)) return;

      onChange({ ...value, co: String(num) });
      setBleModalVisible(false);
    },
    [value, onChange],
  );

  return (
    <View style={styles.container}>
      {/* Label row with BLE button */}
      <View style={styles.labelRow}>
        <Text style={[styles.label, isDark && { color: theme.text.bodyLight }]}>
          {label}
        </Text>
        {showBluetooth && (
          <TouchableOpacity
            onPress={() => setBleModalVisible(true)}
            style={[
              styles.bleBtn,
              isConnected && styles.bleBtnConnected,
              isDark && { backgroundColor: theme.surface.elevated, borderColor: theme.surface.border },
            ]}
          >
            <Ionicons
              name={isConnected ? 'bluetooth-outline' : 'bluetooth'}
              size={14}
              color={isConnected ? '#10B981' : '#3B82F6'}
            />
            <Text style={[styles.bleBtnText, isConnected && styles.bleBtnTextConnected]}>
              {isConnected
                ? `${connectedDevice?.name ?? 'TPI'}${deviceMetadata?.batteryLevel != null ? ` ${deviceMetadata.batteryLevel}%` : ''}`
                : 'Connect TPI'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* FGA Input Fields */}
      <View style={styles.grid}>
        {(['co', 'co2', 'ratio'] as const).map((field) => (
          <View key={field} style={styles.field}>
            <Text style={[styles.fieldLabel, isDark && { color: theme.text.muted }]}>
              {FIELD_LABELS[field]}
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.input,
                  isConnected && value[field] && value[field] !== 'N/A' && styles.inputLive,
                  isDark && {
                    backgroundColor: theme.surface.elevated,
                    borderColor: theme.surface.border,
                    color: theme.text.title,
                  },
                ]}
                value={value[field]}
                onChangeText={(t) => handleManualChange(field, t)}
                placeholder="–"
                placeholderTextColor={isDark ? '#64748B' : '#CBD5E1'}
                keyboardType="decimal-pad"
                keyboardAppearance={isDark ? 'dark' : 'light'}
                editable={value[field] !== 'N/A'}
              />
              {showNA && (
                <TouchableOpacity
                  style={[
                    styles.naBtn,
                    value[field] === 'N/A' && styles.naBtnActive,
                  ]}
                  onPress={() =>
                    onChange({
                      ...value,
                      [field]: value[field] === 'N/A' ? '' : 'N/A',
                    })
                  }
                >
                  <Text
                    style={[
                      styles.naBtnText,
                      value[field] === 'N/A' && styles.naBtnTextActive,
                    ]}
                  >
                    N/A
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* BLE Modal */}
      {showBluetooth && (
        <BleConnectModal
          visible={bleModalVisible}
          onClose={() => setBleModalVisible(false)}
          onSelectValue={handleBleValue}
          onUseReadings={(values) => {
            onChange(values);
            setBleModalVisible(false);
          }}
        />
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: UI.text.bodyLight,
  },
  bleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  bleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
  },
  bleBtnConnected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  bleBtnTextConnected: {
    color: '#10B981',
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
  },
  field: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: UI.text.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: UI.text.title,
    backgroundColor: UI.surface.base,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: UI.surface.divider,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    textAlign: 'center',
  },
  inputLive: {
    borderColor: '#10B981',
    borderWidth: 1.5,
  },
  naBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: UI.surface.elevated,
    borderWidth: 1,
    borderColor: UI.surface.divider,
  },
  naBtnActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  naBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: UI.text.muted,
  },
  naBtnTextActive: {
    color: UI.brand.danger,
  },
});
