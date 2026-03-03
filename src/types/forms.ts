// ============================================
// FILE: src/types/forms.ts
// Shared base types for all gas form types
// ============================================

import { CustomerFormData } from '../../components/CustomerSelector';

// ─── Form Registry ──────────────────────────────────────────────

export type FormType =
  | 'cp12'
  | 'warning_notice'
  | 'service_record'
  | 'commissioning'
  | 'decommissioning'
  | 'breakdown_report'
  | 'installation_cert';

export interface FormDefinition {
  type: FormType;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;        // Ionicons name
  gradient: readonly [string, string];
  color: string;
  route: string;       // expo-router path
  stepsCount: number;
  stepLabels: string[];
  available: boolean;  // false = "Coming Soon"
}

/**
 * Master registry of all form types.
 * Add new forms here and they auto-appear on the Forms hub.
 */
export const FORM_REGISTRY: FormDefinition[] = [
  {
    type: 'cp12',
    label: 'Gas Safety Certificate (CP12)',
    shortLabel: 'CP12 / LGSR',
    description: 'Landlord Gas Safety Record — annual inspection of gas appliances, flues and pipework.',
    icon: 'shield-checkmark',
    gradient: ['#0EA5E9', '#1D4ED8'] as const,
    color: '#1D4ED8',
    route: '/(app)/cp12',
    stepsCount: 4,
    stepLabels: ['Details', 'Appliances', 'Checks', 'Review'],
    available: true,
  },
  {
    type: 'warning_notice',
    label: 'Gas Warning Notice',
    shortLabel: 'Warning Notice',
    description: 'Record unsafe situations, At Risk or Immediately Dangerous classifications with RIDDOR reporting.',
    icon: 'warning',
    gradient: ['#DC2626', '#EF4444'] as const,
    color: '#DC2626',
    route: '/(app)/forms/warning-notice',
    stepsCount: 3,
    stepLabels: ['Details', 'Hazard', 'Review'],
    available: false,
  },
  {
    type: 'service_record',
    label: 'Gas Service Record',
    shortLabel: 'Service Record',
    description: 'Document boiler servicing, maintenance checks, readings and parts replaced.',
    icon: 'construct',
    gradient: ['#059669', '#10B981'] as const,
    color: '#059669',
    route: '/(app)/forms/service-record',
    stepsCount: 3,
    stepLabels: ['Details', 'Service', 'Review'],
    available: true,
  },
  {
    type: 'commissioning',
    label: 'Commissioning Certificate',
    shortLabel: 'Commissioning',
    description: 'Record new appliance installation, commissioning checks and manufacturer settings.',
    icon: 'checkmark-circle',
    gradient: ['#7C3AED', '#A78BFA'] as const,
    color: '#7C3AED',
    route: '/(app)/forms/commissioning',
    stepsCount: 3,
    stepLabels: ['Details', 'Commissioning', 'Review'],
    available: false,
  },
  {
    type: 'decommissioning',
    label: 'Decommissioning Certificate',
    shortLabel: 'Decommissioning',
    description: 'Document safe disconnection and capping of gas appliances.',
    icon: 'close-circle',
    gradient: ['#64748B', '#94A3B8'] as const,
    color: '#64748B',
    route: '/(app)/forms/decommissioning',
    stepsCount: 3,
    stepLabels: ['Details', 'Decommission', 'Review'],
    available: false,
  },
  {
    type: 'breakdown_report',
    label: 'Breakdown / Repair Report',
    shortLabel: 'Breakdown',
    description: 'Report fault diagnosis, parts ordered/replaced and repair outcome.',
    icon: 'build',
    gradient: ['#D97706', '#F59E0B'] as const,
    color: '#D97706',
    route: '/(app)/forms/breakdown',
    stepsCount: 3,
    stepLabels: ['Details', 'Repair', 'Review'],
    available: false,
  },
  {
    type: 'installation_cert',
    label: 'Installation Certificate',
    shortLabel: 'Installation',
    description: 'Certify a new gas appliance installation, including benchmark commissioning data.',
    icon: 'home',
    gradient: ['#0284C7', '#38BDF8'] as const,
    color: '#0284C7',
    route: '/(app)/forms/installation',
    stepsCount: 3,
    stepLabels: ['Details', 'Installation', 'Review'],
    available: false,
  },
];

// ─── Shared base for all form contexts ──────────────────────────

export interface BaseFormCustomerData {
  landlordForm: CustomerFormData;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  tenantAddressLine1: string;
  tenantAddressLine2: string;
  tenantCity: string;
  tenantPostCode: string;
  propertyAddress: string;
}

export interface BaseFormReviewData {
  inspectionDate: string;
  customerSignature: string;
  certRef: string;
  editingDocumentId: string | null;
}
