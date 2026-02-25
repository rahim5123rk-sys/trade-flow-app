import { Colors } from '../../constants/theme';

// ─── Currency ───────────────────────────────────────────────────────

/**
 * Format a number as GBP currency string.
 * formatCurrency(1500) → "£1,500.00"
 * formatCurrency(1500, false) → "£1,500"
 */
export function formatCurrency(
  amount: number,
  showPence: boolean = true
): string {
  return `£${amount.toLocaleString('en-GB', {
    minimumFractionDigits: showPence ? 2 : 0,
    maximumFractionDigits: showPence ? 2 : 0,
  })}`;
}

// ─── Status ─────────────────────────────────────────────────────────

export interface StatusStyle {
  label: string;
  color: string;
  bg: string;
}

const STATUS_MAP: Record<string, StatusStyle> = {
  pending: { label: 'PENDING', color: '#C2410C', bg: '#FFF7ED' },
  accepted: { label: 'ACCEPTED', color: '#1D4ED8', bg: '#EFF6FF' },
  on_the_way: { label: 'ON THE WAY', color: '#7C3AED', bg: '#F5F3FF' },
  in_progress: { label: 'IN PROGRESS', color: '#1D4ED8', bg: '#EFF6FF' },
  complete: { label: 'COMPLETE', color: '#15803D', bg: '#F0FDF4' },
  paid: { label: 'PAID', color: '#047857', bg: '#F0FDF4' },
  cancelled: { label: 'CANCELLED', color: '#DC2626', bg: '#FEF2F2' },
};

/**
 * Get display label, text color, and background color for a job status.
 */
export function getStatusStyle(status: string): StatusStyle {
  return (
    STATUS_MAP[status] || {
      label: status.replace('_', ' ').toUpperCase(),
      color: Colors.textLight,
      bg: '#f3f4f6',
    }
  );
}

/**
 * Get just the color for a status (backwards compatible with existing code).
 */
export function getStatusColor(status: string): string {
  return getStatusStyle(status).color;
}

// ─── Names ──────────────────────────────────────────────────────────

/**
 * Get the first name from a display name.
 * getFirstName("John Smith") → "John"
 */
export function getFirstName(displayName: string | undefined | null): string {
  return displayName?.split(' ')[0] || 'There';
}

/**
 * Get initials from a name (1 or 2 characters).
 * getInitials("John Smith") → "JS"
 * getInitials("Madonna") → "M"
 */
export function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Phone ──────────────────────────────────────────────────────────

/**
 * Format a UK phone number for display.
 * formatPhone("07700900000") → "07700 900000"
 */
export function formatPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
}

// ─── Reference ──────────────────────────────────────────────────────

/**
 * Generate a job reference string.
 * generateReference(42) → "TF-2025-0042"
 */
export function generateReference(sequenceNumber: number): string {
  return `TF-${new Date().getFullYear()}-${String(sequenceNumber).padStart(4, '0')}`;
}