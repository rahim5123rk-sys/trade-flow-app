// ============================================
// FILE: src/context/TpiDeviceContext.tsx
// React Context for TPI BLE gas analyser connection
//
// Provides:
// - BLE scanning (all devices — discovery mode)
// - Connect / disconnect
// - Service & characteristic discovery (explorer)
// - Live monitoring of any characteristic
// - Calculated values (CO2, ratio) from raw O2/CO
// - Easy consumption via useTpiDevice() hook
// ============================================

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Subscription } from 'react-native-ble-plx';
import type {
  BleConnectionStatus,
  BleDeviceInfo,
  TpiCompleteReading,
  TpiGasAnalyserReading,
  TpiDeviceMetadata,
} from '../types/tpiDevice';
import {
  requestBlePermissions,
  startScanAll,
  stopScan,
  connectToDevice,
  disconnectDevice,
  discoverServices,
  readCharacteristic,
  readDeviceMetadata,
  monitorCharacteristic,
  subscribeToReadings,
  onDeviceDisconnected,
  isBleReady,
  destroyManager,
  type DiscoveredService,
} from '../services/tpiBluetooth';
import { calculateCO2FromO2, calculateCOCO2Ratio } from '../utils/combustion';
import { tpiReadingsToFGA } from '../utils/combustion';
import type { FuelType } from '../types/gasForms';

// ─── Context Type ───────────────────────────────────────────────

interface TpiDeviceContextValue {
  /** Current BLE connection status */
  connectionStatus: BleConnectionStatus;

  /** Error message, if any */
  error: string | null;

  /** Discovered devices during scanning */
  discoveredDevices: BleDeviceInfo[];

  /** Currently connected device info */
  connectedDevice: BleDeviceInfo | null;

  /** Discovered GATT services (after connection) */
  services: DiscoveredService[];

  /** Map of characteristic UUID → latest value */
  liveValues: Record<string, string>;

  /** Latest complete reading (raw + calculated) — used in production mode */
  latestReading: TpiCompleteReading | null;

  /** Pre-formatted FGA values ready to drop into form fields */
  fgaValues: { co: string; co2: string; ratio: string };

  /** Device metadata (serial, cal dates, battery etc.) */
  deviceMetadata: TpiDeviceMetadata | null;

  /** Fuel type used for CO2 calculation */
  fuelType: FuelType;
  setFuelType: (ft: FuelType) => void;

  /** Whether Bluetooth is available on this device */
  bleAvailable: boolean;

  /** Start scanning for ALL nearby BLE devices */
  scan: () => void;

  /** Stop scanning */
  cancelScan: () => void;

  /** Connect to a discovered device */
  connect: (device: BleDeviceInfo) => Promise<void>;

  /** Disconnect from current device */
  disconnect: () => Promise<void>;

  /** Read a single characteristic value */
  readChar: (serviceUUID: string, charUUID: string) => Promise<string | null>;

  /** Start monitoring a characteristic for live values */
  monitorChar: (serviceUUID: string, charUUID: string) => void;

  /** Stop monitoring a characteristic */
  stopMonitorChar: (charUUID: string) => void;

  /** Clear the latest reading */
  clearReading: () => void;
}

const TpiDeviceContext = createContext<TpiDeviceContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────

export function TpiDeviceProvider({ children }: { children: React.ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<BleConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<BleDeviceInfo[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<BleDeviceInfo | null>(null);
  const [services, setServices] = useState<DiscoveredService[]>([]);
  const [liveValues, setLiveValues] = useState<Record<string, string>>({});
  const [rawReading, setRawReading] = useState<TpiGasAnalyserReading | null>(null);
  const [fuelType, setFuelType] = useState<FuelType>('Natural Gas');
  const [bleAvailable, setBleAvailable] = useState(false);
  const [deviceMetadata, setDeviceMetadata] = useState<TpiDeviceMetadata | null>(null);

  // Track subscriptions for cleanup
  const readingSubsRef = useRef<Subscription[]>([]);
  const monitorSubsRef = useRef<Map<string, Subscription>>(new Map());
  const disconnectSubRef = useRef<Subscription | null>(null);
  const scanCleanupRef = useRef<(() => void) | null>(null);

  // Check BLE availability on mount
  useEffect(() => {
    isBleReady().then(setBleAvailable).catch(() => setBleAvailable(false));
  }, []);

  // ─── Computed: latest complete reading ──────────────────────────

  const latestReading: TpiCompleteReading | null = useMemo(() => {
    if (!rawReading) return null;

    const co2 = calculateCO2FromO2(rawReading.o2, fuelType);
    const ratio = calculateCOCO2Ratio(rawReading.co, co2);

    return {
      ...rawReading,
      co2,
      ratio,
    };
  }, [rawReading, fuelType]);

  // ─── Computed: FGA form values (ready to populate fields) ──────

  const fgaValues = useMemo(() => {
    if (!latestReading) return { co: '', co2: '', ratio: '' };
    return tpiReadingsToFGA(latestReading.o2, latestReading.co, fuelType);
  }, [latestReading, fuelType]);

  // ─── Scan (all devices) ───────────────────────────────────────

  const scan = useCallback(async () => {
    setError(null);
    setDiscoveredDevices([]);

    const hasPermissions = await requestBlePermissions();
    if (!hasPermissions) {
      setError('Bluetooth permissions not granted. Check Settings.');
      return;
    }

    const ready = await isBleReady();
    if (!ready) {
      setError('Bluetooth is turned off. Please enable Bluetooth.');
      return;
    }

    setBleAvailable(true);
    setConnectionStatus('scanning');

    const cleanup = startScanAll((device) => {
      setDiscoveredDevices((prev) => {
        if (prev.find((d) => d.id === device.id)) return prev;
        return [...prev, device];
      });
    }, 15_000);

    scanCleanupRef.current = cleanup;

    // Auto-reset status after timeout
    setTimeout(() => {
      setConnectionStatus((curr) => curr === 'scanning' ? 'idle' : curr);
    }, 15_500);
  }, []);

  const cancelScan = useCallback(() => {
    scanCleanupRef.current?.();
    scanCleanupRef.current = null;
    stopScan();
    setConnectionStatus((curr) => curr === 'scanning' ? 'idle' : curr);
  }, []);

  // ─── Connect ──────────────────────────────────────────────────

  const connect = useCallback(async (device: BleDeviceInfo) => {
    try {
      setError(null);
      setConnectionStatus('connecting');
      cancelScan();
      setServices([]);
      setLiveValues({});
      setDeviceMetadata(null);

      await connectToDevice(device.id);

      setConnectedDevice(device);
      setConnectionStatus('connected');

      // Monitor for unexpected disconnection
      disconnectSubRef.current = onDeviceDisconnected(device.id, () => {
        setConnectionStatus('idle');
        setConnectedDevice(null);
        setServices([]);
        setLiveValues({});
        setDeviceMetadata(null);
        cleanupSubscriptions();
      });

      // Discover services automatically
      try {
        const discovered = await discoverServices(device.id);
        setServices(discovered);
      } catch (err) {
        console.warn('[TPI] Service discovery error:', err);
      }

      // Read device metadata (serial, cal dates, battery)
      try {
        const meta = await readDeviceMetadata(device.id);
        setDeviceMetadata(meta);
      } catch (err) {
        console.warn('[TPI] Metadata read error:', err);
      }

      // If known TPI model, also subscribe to production readings
      if (device.model) {
        const subs = subscribeToReadings(device.id, device.model, (partial) => {
          setRawReading((prev) => ({
            o2: prev?.o2 ?? null,
            co: prev?.co ?? null,
            flueTemp: prev?.flueTemp ?? null,
            ambientTemp: prev?.ambientTemp ?? null,
            pressure: prev?.pressure ?? null,
            efficiency: prev?.efficiency ?? null,
            timestamp: new Date(),
            ...prev,
            ...partial,
          }));
        });
        readingSubsRef.current = subs;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setError(message);
      setConnectionStatus('error');
      setConnectedDevice(null);
    }
  }, [cancelScan]);

  // ─── Disconnect ───────────────────────────────────────────────

  const disconnect = useCallback(async () => {
    if (!connectedDevice) return;

    try {
      setConnectionStatus('disconnecting');
      cleanupSubscriptions();
      await disconnectDevice(connectedDevice.id);
    } catch (err) {
      console.warn('[TPI] Disconnect error:', err);
    } finally {
      setConnectedDevice(null);
      setServices([]);
      setLiveValues({});
      setConnectionStatus('idle');
    }
  }, [connectedDevice]);

  // ─── Characteristic read / monitor ────────────────────────────

  const readChar = useCallback(async (serviceUUID: string, charUUID: string) => {
    if (!connectedDevice) return null;
    const val = await readCharacteristic(connectedDevice.id, serviceUUID, charUUID);
    if (val) {
      setLiveValues((prev) => ({ ...prev, [charUUID]: val }));
    }
    return val;
  }, [connectedDevice]);

  const monitorChar = useCallback((serviceUUID: string, charUUID: string) => {
    if (!connectedDevice) return;

    // Don't double-subscribe
    if (monitorSubsRef.current.has(charUUID)) return;

    const sub = monitorCharacteristic(
      connectedDevice.id,
      serviceUUID,
      charUUID,
      (value) => {
        setLiveValues((prev) => ({ ...prev, [charUUID]: value }));
      },
    );

    monitorSubsRef.current.set(charUUID, sub);
  }, [connectedDevice]);

  const stopMonitorChar = useCallback((charUUID: string) => {
    const sub = monitorSubsRef.current.get(charUUID);
    if (sub) {
      sub.remove();
      monitorSubsRef.current.delete(charUUID);
    }
  }, []);

  // ─── Cleanup Helpers ──────────────────────────────────────────

  function cleanupSubscriptions() {
    readingSubsRef.current.forEach((sub) => sub.remove());
    readingSubsRef.current = [];
    monitorSubsRef.current.forEach((sub) => sub.remove());
    monitorSubsRef.current.clear();
    disconnectSubRef.current?.remove();
    disconnectSubRef.current = null;
  }

  const clearReading = useCallback(() => {
    setRawReading(null);
    setLiveValues({});
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupSubscriptions();
      scanCleanupRef.current?.();
      destroyManager();
    };
  }, []);

  // ─── Value ────────────────────────────────────────────────────

  const value = useMemo<TpiDeviceContextValue>(
    () => ({
      connectionStatus,
      error,
      discoveredDevices,
      connectedDevice,
      services,
      liveValues,
      latestReading,
      fgaValues,
      deviceMetadata,
      fuelType,
      setFuelType,
      bleAvailable,
      scan,
      cancelScan,
      connect,
      disconnect,
      readChar,
      monitorChar,
      stopMonitorChar,
      clearReading,
    }),
    [
      connectionStatus,
      error,
      discoveredDevices,
      connectedDevice,
      services,
      liveValues,
      latestReading,
      fgaValues,
      deviceMetadata,
      fuelType,
      bleAvailable,
      scan,
      cancelScan,
      connect,
      disconnect,
      readChar,
      monitorChar,
      stopMonitorChar,
      clearReading,
    ],
  );

  return (
    <TpiDeviceContext.Provider value={value}>
      {children}
    </TpiDeviceContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────

export function useTpiDevice(): TpiDeviceContextValue {
  const ctx = useContext(TpiDeviceContext);
  if (!ctx) {
    throw new Error('useTpiDevice must be used within a TpiDeviceProvider');
  }
  return ctx;
}

export default TpiDeviceContext;
