// ============================================
// FILE: src/services/tpiBluetooth.ts
// BLE service layer for TPI gas analyser integration
//
// Handles scanning, connecting, reading characteristics,
// and subscribing to live data from TPI instruments.
//
// Supports two modes:
//  A) Discovery mode — scan ALL devices, explore services/chars (no UUIDs needed)
//  B) Production mode — subscribe to known TPI UUIDs for auto-populate
//
// Flow:
// 1. requestPermissions() — ensure BLE permissions granted
// 2. startScan() / startScanAll() — discover nearby BLE devices
// 3. connectToDevice() — establish BLE connection
// 4. discoverServices() — list all GATT services & characteristics
// 5. monitorCharacteristic() — subscribe to live data on any char
// 6. disconnect() — clean up
// ============================================

import { PermissionsAndroid, Platform } from 'react-native';
import { BleError, BleManager, Characteristic, Device, Service, Subscription } from 'react-native-ble-plx';
import {
    TPI_BATTERY_SERVICE_UUID,
    TPI_BLE_NAME_PREFIXES,
    TPI_CHAR_BATTERY_LEVEL,
    TPI_CHAR_CAL_DUE_DATE,
    TPI_CHAR_FIRMWARE_REV,
    TPI_CHAR_LAST_CAL_DATE,
    TPI_CHAR_MANUFACTURER,
    TPI_CHAR_MODEL_NUMBER,
    TPI_CHAR_SERIAL_NUMBER,
    TPI_DEVICE_INFO_SERVICE_UUID,
    TPI_DEVICE_PROFILES,
    TPI_FGA_SERVICE_UUID,
    type BleDeviceInfo,
    type TpiDeviceMetadata,
    type TpiGasAnalyserReading,
    type TpiModel
} from '../types/tpiDevice';

// ─── Types for discovery mode ───────────────────────────────────

export interface DiscoveredCharacteristic {
  uuid: string;
  serviceUUID: string;
  isNotifiable: boolean;
  isReadable: boolean;
  isWritable: boolean;
  /** Last read / notified value (decoded) */
  latestValue: string | null;
}

export interface DiscoveredService {
  uuid: string;
  characteristics: DiscoveredCharacteristic[];
}

// ─── Singleton BLE Manager ──────────────────────────────────────

let _manager: BleManager | null = null;

function getManager(): BleManager {
  if (!_manager) {
    _manager = new BleManager();
  }
  return _manager;
}

/**
 * Destroy the BLE manager. Call on app cleanup / unmount.
 */
export function destroyManager(): void {
  if (_manager) {
    _manager.destroy();
    _manager = null;
  }
}

// ─── Permissions ────────────────────────────────────────────────

/**
 * Request BLE permissions from the OS.
 * iOS: handled by Info.plist description + system prompt.
 * Android 12+: BLUETOOTH_SCAN + BLUETOOTH_CONNECT required.
 *
 * @returns true if permissions granted
 */
export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    // iOS permissions are requested automatically by the system
    // when BLE operations begin. The Info.plist description is shown.
    return true;
  }

  if (Platform.OS === 'android') {
    if (Platform.Version >= 31) {
      // Android 12+
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      return Object.values(results).every(
        (r) => r === PermissionsAndroid.RESULTS.GRANTED,
      );
    } else {
      // Android < 12
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
  }

  return false;
}

// ─── Device Identification ──────────────────────────────────────

/**
 * Attempt to identify a TPI model from a BLE device's advertised name.
 */
export function identifyTpiModel(device: Device): TpiModel | null {
  const name = device.name || device.localName || '';
  if (!name) return null;

  const upper = name.toUpperCase();

  for (const [model, prefixes] of Object.entries(TPI_BLE_NAME_PREFIXES)) {
    for (const prefix of prefixes) {
      if (upper.includes(prefix.toUpperCase())) {
        return model as TpiModel;
      }
    }
  }

  return null;
}

/**
 * Convert a raw BLE Device into our BleDeviceInfo type.
 */
function toBleDeviceInfo(device: Device): BleDeviceInfo {
  return {
    id: device.id,
    name: device.name,
    localName: device.localName,
    rssi: device.rssi,
    model: identifyTpiModel(device),
  };
}

// ─── Scanning ───────────────────────────────────────────────────

/**
 * Scan for nearby TPI BLE devices (filters by known name prefixes).
 */
export function startScan(
  onDeviceFound: (device: BleDeviceInfo) => void,
  timeoutMs: number = 10_000,
): () => void {
  return startScanAll((device) => {
    // Only report devices that look like TPI instruments
    if (device.model) {
      onDeviceFound(device);
    }
  }, timeoutMs);
}

/**
 * Scan for ALL nearby BLE devices (no name filter).
 * Used for discovery mode when we don't yet know TPI's BLE names.
 *
 * @param onDeviceFound - Callback fired for each discovered device
 * @param timeoutMs - Stop scanning after this many milliseconds (default: 15s)
 * @returns Cleanup function to stop scanning early
 */
export function startScanAll(
  onDeviceFound: (device: BleDeviceInfo) => void,
  timeoutMs: number = 15_000,
): () => void {
  const manager = getManager();
  const seen = new Set<string>();

  manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
    if (error) {
      console.warn('[TPI BLE] Scan error:', error.message);
      return;
    }

    if (!device) return;

    // Skip unnamed devices
    const name = device.name || device.localName;
    if (!name) return;

    // Deduplicate by device ID
    if (seen.has(device.id)) return;
    seen.add(device.id);

    onDeviceFound(toBleDeviceInfo(device));
  });

  // Auto-stop after timeout
  const timer = setTimeout(() => {
    manager.stopDeviceScan();
  }, timeoutMs);

  return () => {
    clearTimeout(timer);
    manager.stopDeviceScan();
  };
}

/**
 * Stop any active scan.
 */
export function stopScan(): void {
  getManager().stopDeviceScan();
}

// ─── Connection ─────────────────────────────────────────────────

/**
 * Connect to a TPI device by its BLE ID.
 *
 * @param deviceId - The BLE device ID from scanning
 * @returns The connected Device object
 */
export async function connectToDevice(deviceId: string): Promise<Device> {
  const manager = getManager();

  // Connect
  const device = await manager.connectToDevice(deviceId, {
    requestMTU: 512,
    timeout: 10_000,
  });

  // Discover all services and characteristics
  await device.discoverAllServicesAndCharacteristics();

  return device;
}

/**
 * Disconnect from a TPI device.
 */
export async function disconnectDevice(deviceId: string): Promise<void> {
  const manager = getManager();

  try {
    const isConnected = await manager.isDeviceConnected(deviceId);
    if (isConnected) {
      await manager.cancelDeviceConnection(deviceId);
    }
  } catch (err) {
    console.warn('[TPI BLE] Disconnect error:', err);
  }
}

/**
 * Check if a device is currently connected.
 */
export async function isDeviceConnected(deviceId: string): Promise<boolean> {
  try {
    return await getManager().isDeviceConnected(deviceId);
  } catch {
    return false;
  }
}

// ─── Reading Characteristics ────────────────────────────────────

/**
 * Subscribe to BLE characteristic notifications from a TPI device.
 * Uses the real UUIDs discovered from DC710 (serial 28009435887).
 * Monitors O2, CO, flue temp, ambient temp, and efficiency.
 *
 * @param deviceId - Connected device ID
 * @param model - TPI model to determine which characteristics to subscribe
 * @param onReading - Callback with parsed reading
 * @returns Array of subscriptions (call .remove() to unsubscribe)
 */
export function subscribeToReadings(
  deviceId: string,
  model: TpiModel,
  onReading: (reading: Partial<TpiGasAnalyserReading>) => void,
): Subscription[] {
  const manager = getManager();
  const profile = TPI_DEVICE_PROFILES[model];
  const subscriptions: Subscription[] = [];

  // Map characteristic key → how to parse and which field to populate
  const charMap: Array<{ key: string; charUUID: string; field: keyof TpiGasAnalyserReading }> = [
    { key: 'o2', charUUID: profile.characteristics.o2, field: 'o2' },
    { key: 'co', charUUID: profile.characteristics.co, field: 'co' },
    { key: 'flueTemp', charUUID: profile.characteristics.flueTemp, field: 'flueTemp' },
    { key: 'ambientTemp', charUUID: profile.characteristics.ambientTemp, field: 'ambientTemp' },
    { key: 'efficiency', charUUID: profile.characteristics.efficiency, field: 'efficiency' },
  ];

  for (const { key, charUUID, field } of charMap) {
    if (!charUUID) continue;

    const sub = manager.monitorCharacteristicForDevice(
      deviceId,
      profile.serviceUUID,
      charUUID,
      (error: BleError | null, characteristic) => {
        if (error) {
          console.warn(`[TPI BLE] ${key} notification error:`, error.message);
          return;
        }

        if (!characteristic?.value) return;

        const parsed = parseCharacteristicValue(key, characteristic.value);
        if (parsed !== null) {
          onReading({
            [field]: parsed,
            timestamp: new Date(),
          } as Partial<TpiGasAnalyserReading>);
        }
      },
    );

    subscriptions.push(sub);
  }

  return subscriptions;
}

// ─── Data Parsing ───────────────────────────────────────────────

/**
 * Parse a BLE characteristic value into a number.
 *
 * The DC710 sends values as base64-encoded ASCII strings.
 * Examples from discovery:
 *   O2 → "20.9"
 *   CO → "0.0"
 *   Flue temp → "16.17"
 *   Ambient temp → "15.39"
 *   Efficiency → "nan" (when not combusting)
 */
function parseCharacteristicValue(
  _readingKey: string,
  base64Value: string,
): number | null {
  try {
    // Decode base64 → ASCII string
    const decoded = atob(base64Value);
    const trimmed = decoded.trim();

    // DC710 sends "nan" when value is unavailable (e.g. efficiency when pump off)
    if (trimmed.toLowerCase() === 'nan' || trimmed.toLowerCase() === 'inf') {
      return null;
    }

    // Parse as float — the DC710 sends plain numeric strings
    const numValue = parseFloat(trimmed);
    if (isFinite(numValue)) {
      return Math.round(numValue * 100) / 100; // 2 decimal places
    }

    // Fallback: try extracting number from mixed content
    const numMatch = trimmed.match(/-?[\d.]+/);
    if (numMatch) {
      const extracted = parseFloat(numMatch[0]);
      if (isFinite(extracted)) {
        return Math.round(extracted * 100) / 100;
      }
    }

    return null;
  } catch {
    console.warn('[TPI BLE] Failed to parse characteristic value');
    return null;
  }
}

// ─── Connection Monitoring ──────────────────────────────────────

/**
 * Read device metadata from standard BLE SIG + TPI custom characteristics.
 * Call after connecting and discovering services.
 */
export async function readDeviceMetadata(deviceId: string): Promise<TpiDeviceMetadata> {
  const meta: TpiDeviceMetadata = {
    manufacturer: null,
    modelNumber: null,
    serialNumber: null,
    firmwareRevision: null,
    batteryLevel: null,
    lastCalDate: null,
    calDueDate: null,
  };

  try {
    meta.manufacturer = await readCharacteristic(deviceId, TPI_DEVICE_INFO_SERVICE_UUID, TPI_CHAR_MANUFACTURER);
    meta.modelNumber = await readCharacteristic(deviceId, TPI_DEVICE_INFO_SERVICE_UUID, TPI_CHAR_MODEL_NUMBER);
    meta.serialNumber = await readCharacteristic(deviceId, TPI_DEVICE_INFO_SERVICE_UUID, TPI_CHAR_SERIAL_NUMBER);
    meta.firmwareRevision = await readCharacteristic(deviceId, TPI_DEVICE_INFO_SERVICE_UUID, TPI_CHAR_FIRMWARE_REV);

    const batteryStr = await readCharacteristic(deviceId, TPI_BATTERY_SERVICE_UUID, TPI_CHAR_BATTERY_LEVEL);
    if (batteryStr) {
      // Battery level may be a single byte (0-100) or ASCII
      const batteryNum = parseInt(batteryStr, 10);
      if (isFinite(batteryNum)) meta.batteryLevel = batteryNum;
    }

    meta.lastCalDate = await readCharacteristic(deviceId, TPI_FGA_SERVICE_UUID, TPI_CHAR_LAST_CAL_DATE);
    meta.calDueDate = await readCharacteristic(deviceId, TPI_FGA_SERVICE_UUID, TPI_CHAR_CAL_DUE_DATE);
  } catch (err) {
    console.warn('[TPI BLE] Error reading device metadata:', err);
  }

  return meta;
}

/**
 * Monitor device disconnection events.
 *
 * @param deviceId - Device to monitor
 * @param onDisconnected - Callback when device disconnects
 * @returns Subscription to remove the listener
 */
export function onDeviceDisconnected(
  deviceId: string,
  onDisconnected: (error: BleError | null) => void,
): Subscription {
  const manager = getManager();

  return manager.onDeviceDisconnected(deviceId, (error) => {
    console.log('[TPI BLE] Device disconnected:', deviceId);
    onDisconnected(error);
  });
}

// ─── BLE State ──────────────────────────────────────────────────

/**
 * Check if Bluetooth is powered on and ready.
 */
export async function isBleReady(): Promise<boolean> {
  const manager = getManager();
  const state = await manager.state();
  return state === 'PoweredOn';
}

/**
 * Monitor BLE adapter state changes.
 */
export function onBleStateChange(
  callback: (state: string) => void,
): Subscription {
  const manager = getManager();
  return manager.onStateChange((state) => {
    callback(state);
  }, true);
}

// ─── Discovery Mode ─────────────────────────────────────────────

/**
 * Discover all GATT services and characteristics on a connected device.
 * Used to reverse-engineer TPI's BLE profile before they provide UUIDs.
 *
 * @param deviceId - Connected device ID
 * @returns Array of services with their characteristics
 */
export async function discoverServices(deviceId: string): Promise<DiscoveredService[]> {
  const manager = getManager();
  const services: Service[] = await manager.servicesForDevice(deviceId);
  const result: DiscoveredService[] = [];

  for (const service of services) {
    const chars: Characteristic[] = await manager.characteristicsForDevice(
      deviceId,
      service.uuid,
    );

    const discoveredChars: DiscoveredCharacteristic[] = chars.map((c) => ({
      uuid: c.uuid,
      serviceUUID: service.uuid,
      isNotifiable: c.isNotifiable || c.isIndicatable,
      isReadable: c.isReadable,
      isWritable: c.isWritableWithResponse || c.isWritableWithoutResponse,
      latestValue: null,
    }));

    result.push({
      uuid: service.uuid,
      characteristics: discoveredChars,
    });
  }

  return result;
}

/**
 * Read a single characteristic value.
 *
 * @param deviceId - Connected device ID
 * @param serviceUUID - Service UUID
 * @param charUUID - Characteristic UUID
 * @returns Decoded string value, or null
 */
export async function readCharacteristic(
  deviceId: string,
  serviceUUID: string,
  charUUID: string,
): Promise<string | null> {
  const manager = getManager();
  try {
    const char = await manager.readCharacteristicForDevice(
      deviceId,
      serviceUUID,
      charUUID,
    );
    if (!char?.value) return null;
    return decodeBase64Value(char.value);
  } catch (err) {
    console.warn('[TPI BLE] Read error:', err);
    return null;
  }
}

/**
 * Write a value to a BLE characteristic.
 * Used for sending commands (e.g. pump start/stop via TPI_CHAR_COMMAND).
 *
 * @param deviceId - Connected device ID
 * @param serviceUUID - Service UUID
 * @param charUUID - Characteristic UUID
 * @param base64Value - Base64-encoded value to write
 * @param withResponse - If true, use Write-With-Response; false for Write-Without-Response. Default true.
 * @returns true if write succeeded
 */
export async function writeCharacteristic(
  deviceId: string,
  serviceUUID: string,
  charUUID: string,
  base64Value: string,
  withResponse: boolean = true,
): Promise<boolean> {
  const manager = getManager();
  try {
    if (withResponse) {
      await manager.writeCharacteristicWithResponseForDevice(
        deviceId,
        serviceUUID,
        charUUID,
        base64Value,
      );
    } else {
      await manager.writeCharacteristicWithoutResponseForDevice(
        deviceId,
        serviceUUID,
        charUUID,
        base64Value,
      );
    }
    return true;
  } catch (err) {
    console.warn('[TPI BLE] Write error:', err);
    return false;
  }
}

/**
 * Monitor (subscribe to notifications) on any characteristic.
 * Used in discovery mode to watch live data from unknown characteristics.
 *
 * @param deviceId - Connected device ID
 * @param serviceUUID - Service UUID
 * @param charUUID - Characteristic UUID
 * @param onValue - Callback with decoded string value
 * @returns Subscription to remove the listener
 */
export function monitorCharacteristic(
  deviceId: string,
  serviceUUID: string,
  charUUID: string,
  onValue: (value: string, raw: string) => void,
): Subscription {
  const manager = getManager();

  return manager.monitorCharacteristicForDevice(
    deviceId,
    serviceUUID,
    charUUID,
    (error: BleError | null, characteristic) => {
      if (error) {
        console.warn(`[TPI BLE] Monitor error on ${charUUID}:`, error.message);
        return;
      }
      if (!characteristic?.value) return;

      const decoded = decodeBase64Value(characteristic.value);
      if (decoded) {
        onValue(decoded, characteristic.value);
      }
    },
  );
}

/**
 * Decode a base64 BLE value to a readable string.
 * Tries multiple interpretations.
 */
export function decodeBase64Value(base64: string): string | null {
  try {
    const decoded = atob(base64);

    // Check if it's printable ASCII
    const isPrintable = /^[\x20-\x7E\r\n\t]+$/.test(decoded);
    if (isPrintable) {
      return decoded.trim();
    }

    // Show as hex bytes for binary data
    const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
    const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');

    // Also try as numbers
    if (bytes.length === 2) {
      const view = new DataView(bytes.buffer, bytes.byteOffset);
      const int16 = view.getInt16(0, true);
      return `${int16} (0x ${hex})`;
    }
    if (bytes.length === 4) {
      const view = new DataView(bytes.buffer, bytes.byteOffset);
      const float32 = view.getFloat32(0, true);
      if (isFinite(float32) && Math.abs(float32) < 100_000) {
        return `${float32.toFixed(2)} (0x ${hex})`;
      }
    }

    return `0x ${hex}`;
  } catch {
    return null;
  }
}
