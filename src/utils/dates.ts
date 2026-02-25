/**
 * Date and time utilities for consistent formatting across the app.
 * All display dates use en-GB locale (day/month/year).
 */

// ─── Formatting ─────────────────────────────────────────────────────

/**
 * Safely convert a timestamp that might be seconds or milliseconds to a Date.
 */
export function toDate(timestamp: number): Date {
  if (!timestamp) return new Date();
  // Heuristic: if less than 10 billion, it's probably seconds (Unix epoch)
  return new Date(timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp);
}

/**
 * Format: "Monday, 3 February"
 */
export function formatFullDate(timestamp: number): string {
  return toDate(timestamp).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Format: "3 Feb 2025"
 */
export function formatShortDate(timestamp: number): string {
  return toDate(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format: "Mon 3 Feb"
 */
export function formatCalendarDate(timestamp: number): string {
  return toDate(timestamp).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format: "09:30"
 */
export function formatTime(timestamp: number): string {
  return toDate(timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format: "3 Feb, 09:30"
 */
export function formatDateTime(timestamp: number): string {
  return toDate(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Comparisons ────────────────────────────────────────────────────

/**
 * Get start of today in epoch ms.
 */
export function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * Get end of today in epoch ms.
 */
export function endOfToday(): number {
  return startOfToday() + 86_400_000;
}

/**
 * Check if a timestamp falls on today.
 */
export function isToday(timestamp: number): boolean {
  const start = startOfToday();
  return timestamp >= start && timestamp < start + 86_400_000;
}

/**
 * Check if a timestamp is in the past (before start of today).
 */
export function isPast(timestamp: number): boolean {
  return timestamp < startOfToday();
}

/**
 * Check if a timestamp is in the future (after end of today).
 */
export function isFuture(timestamp: number): boolean {
  return timestamp >= endOfToday();
}

/**
 * Convert a timestamp to YYYY-MM-DD string (for calendar components).
 */
export function toDateString(timestamp: number): string {
  return toDate(timestamp).toISOString().split('T')[0];
}

/**
 * Get "X days ago" / "in X days" / "today" relative label.
 */
export function relativeDay(timestamp: number): string {
  const dayMs = 86_400_000;
  const start = startOfToday();
  const diff = timestamp - start;

  if (diff >= 0 && diff < dayMs) return 'Today';
  if (diff >= dayMs && diff < dayMs * 2) return 'Tomorrow';
  if (diff >= -dayMs && diff < 0) return 'Yesterday';

  const days = Math.round(diff / dayMs);
  if (days > 0) return `In ${days} days`;
  return `${Math.abs(days)} days ago`;
}