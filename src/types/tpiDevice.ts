// ============================================
// FILE: src/types/tpiDevice.ts
// Type definitions for TPI gas analyser BLE integration
//
// TPI instruments (DC710, DC711, SP620) publish
// data over Bluetooth Low Energy.
//
// UUIDs reverse-engineered from a physical DC710 (serial 28009435887)
// using the GasPilot BLE discovery modal on 17 Apr 2026.
// Manufacturer: SUMMIT | Firmware: VerF 3.04
// ============================================

// ─── TPI Instrument Models ──────────────────────────────────────

export type TpiModel = 'DC710' | 'DC711' | 'SP620';

export type TpiInstrumentType = 'gas_analyser' | 'manometer';

/**
 * Describes a known TPI instrument and its BLE characteristics.
 */
export interface TpiDeviceProfile {
  model: TpiModel;
  type: TpiInstrumentType;
  /** Human-readable name shown in UI */
  displayName: string;
  /** BLE service UUID for FGA data */
  serviceUUID: string;
  /** Map of reading type → BLE characteristic UUID */
  characteristics: Record<string, string>;
}

// ─── TPI BLE UUIDs ──────────────────────────────────────────────

/** Main FGA data service (custom UUID — shared across DC710/DC711) */
export const TPI_FGA_SERVICE_UUID = 'fa4935cf-3b82-44b6-bd4f-575ea5294300';

/** Standard BLE SIG service UUIDs */
export const TPI_DEVICE_INFO_SERVICE_UUID = '0000180a-0000-1000-8000-00805f9634fb';
export const TPI_BATTERY_SERVICE_UUID = '0000180f-0000-1000-8000-00805f9b34fb';
export const TPI_CONFIG_SERVICE_UUID = 'ec3bcf6b-0a4d-4aa3-b2b6-fb803a8f5b10';

/** FGA characteristic UUIDs within TPI_FGA_SERVICE_UUID */
export const TPI_CHAR_O2 = 'cb8fed4c-1c37-4245-81b4-ddf6953034ff';           // O2 % (R, N)
export const TPI_CHAR_CO = '4a61b9c4-cf0d-4910-90f4-58727949c64a';           // CO ppm (R, N)
export const TPI_CHAR_FLUE_TEMP = '64ecb722-d523-4ed5-8460-a40a6ae3981e';    // Flue/Probe temp °C (R)
export const TPI_CHAR_AMBIENT_TEMP = 'da5353e5-9e46-4a47-8773-0b7baa3f4d1f'; // Ambient temp °C (R, N)
export const TPI_CHAR_EFFICIENCY = '5f0c3328-b29e-4633-ac75-f07099dca600';   // Efficiency % (R, N)
export const TPI_CHAR_SENSOR_INFO = '150e77f8-9823-4933-ba9a-d514e46e91c0';  // "S1=02, S2=CO" (R)
export const TPI_CHAR_STATUS = '845b6a54-4b1a-45a3-8bd0-7496884dfa3f';       // Status byte (R)
export const TPI_CHAR_MODE = '63e3783f-1bdb-42a7-834d-319f0a33ac90';         // Operating mode (R, N)
export const TPI_CHAR_PUMP_FLAG = '53427144-ba66-4307-ba31-616ba296d26f';    // Pump/flag (R, N)
export const TPI_CHAR_CO_CAL_INFO = 'a3966043-0801-42a9-8116-7db8971e8589'; // CO cal info (R)
export const TPI_CHAR_O2_CAL_INFO = '663f0f2c-5461-4666-81cd-3ae4eaf66bac'; // O2 cal info (R)
export const TPI_CHAR_LAST_CAL_DATE = '7cb5ba0b-a375-44ce-ae7d-4d4be7742d83'; // Last cal date (R)
export const TPI_CHAR_CAL_DUE_DATE = '5558181f-c281-4c0a-8dec-9f18e3a597fd';  // Cal due date (R)
export const TPI_CHAR_COMMAND = '60a4da6e-d147-47a9-a98d-c9ff220d79ee';       // Command (W)

/** Device Info characteristic UUIDs (standard BLE SIG) */
export const TPI_CHAR_MANUFACTURER = '00002a29-0000-1000-8000-00805f9634fb'; // "SUMMIT"
export const TPI_CHAR_MODEL_NUMBER = '00002a24-0000-1000-8000-00805f9634fb'; // "DC710"
export const TPI_CHAR_SERIAL_NUMBER = '00002a25-0000-1000-8000-00805f9b34fb';
export const TPI_CHAR_FIRMWARE_REV = '00002a26-0000-1000-8000-00805f9b34fb'; // "VerF 3.04"

/** Battery characteristic (standard BLE SIG) */
export const TPI_CHAR_BATTERY_LEVEL = '00002a19-0000-1000-8000-00805f9634fb';

/** Config service characteristics */
export const TPI_CHAR_DEVICE_CLOCK = '6cc841a7-1423-4fd6-a50e-9cf4e803f395'; // "HH:MM:SS YYYY/MM/DD" (R, W)
export const TPI_CHAR_BULK_DATA = '98bf25f7-f196-458a-8bf9-c2fb8fb168be';    // Memory/data log (R, N, W)

// ─── BLE Connection State ───────────────────────────────────────

export type BleConnectionStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export interface BleDeviceInfo {
  id: string;
  name: string | null;
  localName: string | null;
  rssi: number | null;
  /** Matched TPI model, if identified */
  model: TpiModel | null;
}

// ─── Live Readings ──────────────────────────────────────────────

/**
 * Raw readings published by TPI gas analysers over BLE.
 * O2 and CO come directly from BLE characteristics.
 * CO2 and ratio are calculated by the app (src/utils/combustion.ts).
 */
export interface TpiGasAnalyserReading {
  /** O2 percentage (e.g. 5.2) — from TPI_CHAR_O2 */
  o2: number | null;
  /** CO in ppm (e.g. 42) — from TPI_CHAR_CO */
  co: number | null;
  /** Flue temperature in °C — from TPI_CHAR_FLUE_TEMP */
  flueTemp: number | null;
  /** Ambient temperature in °C — from TPI_CHAR_AMBIENT_TEMP */
  ambientTemp: number | null;
  /** Differential pressure (for SP620 manometer) */
  pressure: number | null;
  /** Efficiency % — from TPI_CHAR_EFFICIENCY (NaN when not combusting) */
  efficiency: number | null;
  /** Timestamp of the reading */
  timestamp: Date;
}

/** Device metadata readable from BLE */
export interface TpiDeviceMetadata {
  manufacturer: string | null;   // "SUMMIT"
  modelNumber: string | null;    // "DC710"
  serialNumber: string | null;   // "28009435887"
  firmwareRevision: string | null; // "VerF 3.04"
  batteryLevel: number | null;   // 0-100
  lastCalDate: string | null;    // "2025/07/04"
  calDueDate: string | null;     // "2026/07/04"
}

/**
 * Calculated values derived from raw TPI readings.
 * These are computed by src/utils/combustion.ts
 */
export interface CalculatedReadings {
  /** CO2 percentage — derived from O2 reading */
  co2: number | null;
  /** CO/CO2 ratio */
  ratio: number | null;
}

/**
 * Complete reading combining raw + calculated values,
 * ready to populate FGAReadings fields on forms.
 */
export interface TpiCompleteReading extends TpiGasAnalyserReading, CalculatedReadings {}

// ─── Manometer Reading (SP620) ──────────────────────────────────

export interface TpiManometerReading {
  /** Pressure in mbar */
  pressure: number | null;
  timestamp: Date;
}

// ─── Device Profile Registry ────────────────────────────────────

/**
 * Known TPI device profiles with real UUIDs.
 * DC710 UUIDs confirmed via physical device (serial 28009435887).
 * DC711 likely shares the same service/characteristic UUIDs (same platform).
 */
export const TPI_DEVICE_PROFILES: Record<TpiModel, TpiDeviceProfile> = {
  DC710: {
    model: 'DC710',
    type: 'gas_analyser',
    displayName: 'TPI DC710',
    serviceUUID: TPI_FGA_SERVICE_UUID,
    characteristics: {
      o2: TPI_CHAR_O2,
      co: TPI_CHAR_CO,
      flueTemp: TPI_CHAR_FLUE_TEMP,
      ambientTemp: TPI_CHAR_AMBIENT_TEMP,
      efficiency: TPI_CHAR_EFFICIENCY,
    },
  },
  DC711: {
    model: 'DC711',
    type: 'gas_analyser',
    displayName: 'TPI DC711',
    // DC711 is same platform as DC710 — likely identical UUIDs
    serviceUUID: TPI_FGA_SERVICE_UUID,
    characteristics: {
      o2: TPI_CHAR_O2,
      co: TPI_CHAR_CO,
      flueTemp: TPI_CHAR_FLUE_TEMP,
      ambientTemp: TPI_CHAR_AMBIENT_TEMP,
      efficiency: TPI_CHAR_EFFICIENCY,
    },
  },
  SP620: {
    model: 'SP620',
    type: 'manometer',
    displayName: 'TPI SP620 Manometer',
    serviceUUID: '00000000-0000-0000-0000-000000000000', // TODO: discover from physical SP620
    characteristics: {
      pressure: '00000000-0000-0000-0000-000000000001', // TODO: discover from physical SP620
    },
  },
};

/**
 * BLE name prefixes used to identify TPI devices during scanning.
 * DC710 advertises as "DC710-XXX" (last 3 digits of serial).
 */
export const TPI_BLE_NAME_PREFIXES: Record<TpiModel, string[]> = {
  DC710: ['DC710'],
  DC711: ['DC711'],
  SP620: ['SP620'],
};
