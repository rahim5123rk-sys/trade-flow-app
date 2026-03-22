import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import type {Job} from '../types';

const CALENDAR_ID_KEY = '@gaspilot_calendar_id';
const CALENDAR_MAPPINGS_KEY = '@gaspilot_calendar_mappings';
const CALENDAR_SYNC_ENABLED_KEY = '@gaspilot_calendar_sync_enabled';

// Lazy-load expo-calendar to avoid crash when native module isn't available
// (requires dev client rebuild after installing expo-calendar)
async function getCalendarModule() {
  try {
    const Calendar = await import('expo-calendar');
    return Calendar;
  } catch {
    console.warn('[CalendarSync] expo-calendar native module not available. Rebuild dev client.');
    return null;
  }
}

// ─── Permission ──────────────────────────────────────────────

export async function requestCalendarPermission(): Promise<boolean> {
  const Calendar = await getCalendarModule();
  if (!Calendar) return false;
  const {status} = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

// ─── Calendar CRUD ───────────────────────────────────────────

async function getOrCreateGasPilotCalendar(): Promise<string | null> {
  const Calendar = await getCalendarModule();
  if (!Calendar) return null;

  const storedId = await AsyncStorage.getItem(CALENDAR_ID_KEY);

  // Verify the stored calendar still exists
  if (storedId) {
    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      if (calendars.some((c) => c.id === storedId)) {
        return storedId;
      }
    } catch {
      // Calendar was deleted, recreate below
    }
  }

  // Find a default calendar source (iCloud or local)
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const defaultSource =
    Platform.OS === 'ios'
      ? calendars.find((c) => c.source?.name === 'iCloud')?.source ??
        calendars.find((c) => c.allowsModifications)?.source ??
        calendars[0]?.source
      : undefined;

  const newCalendarId = await Calendar.createCalendarAsync({
    title: 'GasPilot',
    color: '#0066FF',
    entityType: Calendar.EntityTypes.EVENT,
    source: defaultSource
      ? {isLocalAccount: defaultSource.isLocalAccount, name: defaultSource.name, type: defaultSource.type}
      : undefined,
    sourceId: defaultSource?.id,
    name: 'GasPilot',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
    ownerAccount: 'GasPilot',
  });

  await AsyncStorage.setItem(CALENDAR_ID_KEY, newCalendarId);
  return newCalendarId;
}

// ─── Mappings (jobId → nativeEventId) ────────────────────────

async function getMappings(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(CALENDAR_MAPPINGS_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function setMappings(mappings: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(CALENDAR_MAPPINGS_KEY, JSON.stringify(mappings));
}

// ─── Duration parsing ────────────────────────────────────────

function parseDurationMs(duration?: string): number {
  if (!duration) return 60 * 60 * 1000; // default 1 hour

  const lower = duration.toLowerCase();
  let totalMs = 0;

  const hourMatch = lower.match(/(\d+(?:\.\d+)?)\s*h(?:our|r)?s?/);
  if (hourMatch) totalMs += parseFloat(hourMatch[1]) * 60 * 60 * 1000;

  const minMatch = lower.match(/(\d+)\s*m(?:in(?:ute)?)?s?/);
  if (minMatch) totalMs += parseInt(minMatch[1], 10) * 60 * 1000;

  return totalMs > 0 ? totalMs : 60 * 60 * 1000;
}

// ─── Job → Calendar Event ────────────────────────────────────

function jobToEventDetails(job: Job) {
  const startDate = new Date(job.scheduled_date);
  const endDate = new Date(startDate.getTime() + parseDurationMs(job.estimated_duration));

  const addressParts = [
    job.customer_snapshot?.address_line_1,
    job.customer_snapshot?.city,
    job.customer_snapshot?.postal_code,
  ].filter(Boolean);
  const location = addressParts.join(', ') || job.customer_snapshot?.address || '';

  const notesParts = [
    job.customer_snapshot?.name ? `Customer: ${job.customer_snapshot.name}` : null,
    job.customer_snapshot?.phone ? `Phone: ${job.customer_snapshot.phone}` : null,
    job.notes || null,
  ].filter(Boolean);

  return {
    title: job.title || job.reference || 'GasPilot Job',
    startDate,
    endDate,
    location,
    notes: notesParts.join('\n'),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

// ─── Public API ──────────────────────────────────────────────

export async function syncJobToCalendar(job: Job): Promise<void> {
  const Calendar = await getCalendarModule();
  if (!Calendar) return;

  const calendarId = await getOrCreateGasPilotCalendar();
  if (!calendarId) return;

  const mappings = await getMappings();
  const details = jobToEventDetails(job);

  const existingEventId = mappings[job.id];

  if (existingEventId) {
    try {
      await Calendar.updateEventAsync(existingEventId, details);
      return;
    } catch {
      // Event may have been deleted manually, create a new one
    }
  }

  const newEventId = await Calendar.createEventAsync(calendarId, details);
  mappings[job.id] = newEventId;
  await setMappings(mappings);
}

export async function removeJobFromCalendar(jobId: string): Promise<void> {
  const Calendar = await getCalendarModule();
  if (!Calendar) return;

  const mappings = await getMappings();
  const eventId = mappings[jobId];
  if (!eventId) return;

  try {
    await Calendar.deleteEventAsync(eventId);
  } catch {
    // Event may already be gone
  }

  delete mappings[jobId];
  await setMappings(mappings);
}

export async function bulkSyncAllJobs(jobs: Job[]): Promise<void> {
  for (const job of jobs) {
    if (job.scheduled_date) {
      await syncJobToCalendar(job);
    }
  }
}

export async function clearAllGasPilotEvents(): Promise<void> {
  const Calendar = await getCalendarModule();

  const calendarId = await AsyncStorage.getItem(CALENDAR_ID_KEY);
  if (calendarId && Calendar) {
    try {
      await Calendar.deleteCalendarAsync(calendarId);
    } catch {
      // Calendar may already be gone
    }
  }
  await AsyncStorage.removeItem(CALENDAR_ID_KEY);
  await AsyncStorage.removeItem(CALENDAR_MAPPINGS_KEY);
}

// ─── Sync enabled state ─────────────────────────────────────

export async function isCalendarSyncEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(CALENDAR_SYNC_ENABLED_KEY);
  return val === 'true';
}

export async function setCalendarSyncEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(CALENDAR_SYNC_ENABLED_KEY, enabled ? 'true' : 'false');
}
