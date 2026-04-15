// ============================================
// FILE: src/services/documentActions.ts
// Duplicate / edit handlers for all gas form types
// ============================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import {router} from 'expo-router';
import {Alert} from 'react-native';
import type {Document} from '../types';

// ─── Seed Keys ──────────────────────────────────────────────
export const CP12_DUPLICATE_SEED_KEY = 'cp12_duplicate_seed_v1';
export const CP12_EDIT_SEED_KEY = 'cp12_edit_seed_v1';
export const COMMISSIONING_DUPLICATE_SEED_KEY = 'commissioning_duplicate_seed_v1';
export const COMMISSIONING_EDIT_SEED_KEY = 'commissioning_edit_seed_v1';
export const DECOMMISSIONING_DUPLICATE_SEED_KEY = 'decommissioning_duplicate_seed_v1';
export const DECOMMISSIONING_EDIT_SEED_KEY = 'decommissioning_edit_seed_v1';
export const WARNING_NOTICE_DUPLICATE_SEED_KEY = 'warning_notice_duplicate_seed_v1';
export const WARNING_NOTICE_EDIT_SEED_KEY = 'warning_notice_edit_seed_v1';
export const BREAKDOWN_REPORT_DUPLICATE_SEED_KEY = 'breakdown_report_duplicate_seed_v1';
export const BREAKDOWN_REPORT_EDIT_SEED_KEY = 'breakdown_report_edit_seed_v1';
export const INSTALLATION_CERT_DUPLICATE_SEED_KEY = 'installation_cert_duplicate_seed_v1';
export const INSTALLATION_CERT_EDIT_SEED_KEY = 'installation_cert_edit_seed_v1';
export const SERVICE_RECORD_DUPLICATE_SEED_KEY = 'service_record_duplicate_seed_v1';
export const SERVICE_RECORD_EDIT_SEED_KEY = 'service_record_edit_seed_v1';

// ─── Utility helpers ────────────────────────────────────────

export const splitAddress = (address?: string) => {
  const parts = (address || '').split(',').map((part) => part.trim()).filter(Boolean);
  // 4+ parts: line1, [line2...], city, postcode
  // 3 parts:  line1, city, postcode (no line2)
  // 2 parts:  line1, postcode
  // 1 part:   line1 only
  return {
    line1: parts[0] || '',
    line2: parts.length > 3 ? parts.slice(1, -2).join(', ') : '',
    city: parts.length >= 3 ? parts[parts.length - 2] || '' : '',
    postCode: parts.length >= 2 ? parts[parts.length - 1] || '' : '',
  };
};

export const incrementDdMmYyyyByYear = (value?: string) => {
  const [dd, mm, yyyy] = (value || '').split('/');
  return yyyy ? `${dd}/${mm}/${String(Number(yyyy) + 1)}` : '';
};

export const combineNotes = (...parts: Array<string | null | undefined>) => parts.map((part) => part?.trim()).filter(Boolean).join('\n\n');

export const formatDisplayDate = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// ─── Resolve customer ID helper type ────────────────────────
type ResolveCustomerId = (currentId: string | null | undefined, name: string) => Promise<string | null>;

// ─── CP12 helpers ───────────────────────────────────────────

const parseCp12LandlordAddress = (address: string, postCode: string, snap?: Document['customer_snapshot']) => {
  const addrParts = (address || snap?.address || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const partsWithoutPostcode =
    postCode && addrParts[addrParts.length - 1] === postCode
      ? addrParts.slice(0, -1)
      : addrParts;
  return {
    addrLine1: partsWithoutPostcode[0] || snap?.address_line_1 || '',
    addrCity: partsWithoutPostcode.length > 1 ? partsWithoutPostcode[partsWithoutPostcode.length - 1] : snap?.city || '',
    addrLine2: partsWithoutPostcode.length > 2 ? partsWithoutPostcode.slice(1, -1).join(', ') : snap?.address_line_2 || '',
  };
};

const parseCp12LandlordAddressEdit = (address: string, postCode: string) => {
  const addrParts = (address || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const partsWithoutPostcode =
    postCode && addrParts[addrParts.length - 1] === postCode
      ? addrParts.slice(0, -1)
      : addrParts;
  return {
    addrLine1: partsWithoutPostcode[0] || '',
    addrCity: partsWithoutPostcode.length > 1 ? partsWithoutPostcode[partsWithoutPostcode.length - 1] : '',
    addrLine2: partsWithoutPostcode.length > 2 ? partsWithoutPostcode.slice(1, -1).join(', ') : '',
  };
};

// ─── Generic customer form builder (non-CP12, duplicate) ────
const buildCustomerFormDuplicate = async (
  pdfData: any,
  snap: Document['customer_snapshot'],
  customerId: string | null | undefined,
  resolveCustomerId: ResolveCustomerId,
) => {
  const customerAddress = splitAddress(pdfData.customerAddress || snap?.address);
  return {
    customerId: await resolveCustomerId(customerId, pdfData.customerName || snap?.name || ''),
    customerName: pdfData.customerName || snap?.name || '',
    customerCompany: pdfData.customerCompany || snap?.company_name || '',
    addressLine1: customerAddress.line1 || snap?.address_line_1 || '',
    addressLine2: customerAddress.line2 || snap?.address_line_2 || '',
    city: customerAddress.city || snap?.city || '',
    postCode: customerAddress.postCode || snap?.postal_code || '',
    email: pdfData.customerEmail || snap?.email || '',
    phone: pdfData.customerPhone || snap?.phone || '',
  };
};

// ─── Generic customer form builder (non-CP12, edit) ─────────
const buildCustomerFormEdit = async (
  pdfData: any,
  customerId: string | null | undefined,
  resolveCustomerId: ResolveCustomerId,
) => {
  const customerAddress = splitAddress(pdfData.customerAddress);
  return {
    customerId: await resolveCustomerId(customerId, pdfData.customerName || ''),
    customerName: pdfData.customerName || '',
    customerCompany: pdfData.customerCompany || '',
    addressLine1: customerAddress.line1,
    addressLine2: customerAddress.line2,
    city: customerAddress.city,
    postCode: customerAddress.postCode,
    email: pdfData.customerEmail || '',
    phone: pdfData.customerPhone || '',
  };
};

// ─── Duplicate handlers ─────────────────────────────────────

async function duplicateCp12(doc: Document, payload: any, resolveCustomerId: ResolveCustomerId) {
  const {pdfData} = payload;
  const snap = doc.customer_snapshot;

  const [dd, mm, yyyy] = (pdfData.nextDueDate || '').split('/');
  const incrementedDueDate = yyyy ? `${dd}/${mm}/${String(Number(yyyy) + 1)}` : '';

  const postCode = pdfData.landlordPostcode || snap?.postal_code || '';
  const {addrLine1, addrLine2, addrCity} = parseCp12LandlordAddress(
    pdfData.landlordAddress || snap?.address || '',
    postCode,
    snap,
  );

  await AsyncStorage.setItem(
    CP12_DUPLICATE_SEED_KEY,
    JSON.stringify({
      propertyAddress: pdfData.propertyAddress,
      appliances: pdfData.appliances,
      landlordForm: {
        customerId: await resolveCustomerId(doc.customer_id, pdfData.landlordName || snap?.name || ''),
        customerName: pdfData.landlordName || snap?.name || '',
        customerCompany: pdfData.landlordCompany || snap?.company_name || '',
        addressLine1: addrLine1,
        addressLine2: addrLine2,
        city: pdfData.landlordCity || addrCity,
        postCode,
        email: pdfData.landlordEmail || snap?.email || '',
        phone: pdfData.landlordPhone || snap?.phone || '',
      },
      tenantName: pdfData.tenantName || '',
      tenantEmail: pdfData.tenantEmail || '',
      tenantPhone: pdfData.tenantPhone || '',
      nextDueDate: incrementedDueDate,
      renewalReminderEnabled: !!pdfData.renewalReminderEnabled,
    }),
  );
  router.push('/(app)/cp12' as any);
}

async function editCp12(doc: Document, payload: any, resolveCustomerId: ResolveCustomerId) {
  const {pdfData} = payload;

  const postCode = pdfData.landlordPostcode || '';
  const {addrLine1, addrLine2, addrCity} = parseCp12LandlordAddressEdit(
    pdfData.landlordAddress || '',
    postCode,
  );

  await AsyncStorage.setItem(
    CP12_EDIT_SEED_KEY,
    JSON.stringify({
      documentId: doc.id,
      propertyAddress: pdfData.propertyAddress,
      appliances: pdfData.appliances,
      landlordForm: {
        customerId: await resolveCustomerId(doc.customer_id, pdfData.landlordName || ''),
        customerName: pdfData.landlordName || '',
        customerCompany: pdfData.landlordCompany || '',
        addressLine1: addrLine1,
        addressLine2: addrLine2,
        city: pdfData.landlordCity || addrCity,
        postCode,
        email: pdfData.landlordEmail || '',
        phone: pdfData.landlordPhone || '',
      },
      tenantName: pdfData.tenantName || '',
      tenantEmail: pdfData.tenantEmail || '',
      tenantPhone: pdfData.tenantPhone || '',
      nextDueDate: pdfData.nextDueDate || '',
      renewalReminderEnabled: !!pdfData.renewalReminderEnabled,
      inspectionDate: pdfData.inspectionDate || '',
      finalChecks: pdfData.finalChecks,
      customerSignature: pdfData.customerSignature || '',
      certRef: pdfData.certRef || doc.reference || '',
    }),
  );
  router.push('/(app)/cp12' as any);
}

async function duplicateCommissioning(doc: Document, payload: any, resolveCustomerId: ResolveCustomerId) {
  const {pdfData} = payload;
  const snap = doc.customer_snapshot;
  await AsyncStorage.setItem(
    COMMISSIONING_DUPLICATE_SEED_KEY,
    JSON.stringify({
      propertyAddress: pdfData.propertyAddress || snap?.address || '',
      appliances: pdfData.appliances,
      customerForm: await buildCustomerFormDuplicate(pdfData, snap, doc.customer_id, resolveCustomerId),
      finalInfo: pdfData.finalInfo,
      commissioningDate: pdfData.commissioningDate,
      nextServiceDate: incrementDdMmYyyyByYear(pdfData.nextServiceDate),
    }),
  );
  router.push('/(app)/forms/commissioning' as any);
}

async function editCommissioning(doc: Document, payload: any, resolveCustomerId: ResolveCustomerId) {
  const {pdfData} = payload;
  await AsyncStorage.setItem(
    COMMISSIONING_EDIT_SEED_KEY,
    JSON.stringify({
      documentId: doc.id,
      propertyAddress: pdfData.propertyAddress,
      appliances: pdfData.appliances,
      customerForm: await buildCustomerFormEdit(pdfData, doc.customer_id, resolveCustomerId),
      finalInfo: pdfData.finalInfo,
      commissioningDate: pdfData.commissioningDate,
      nextServiceDate: pdfData.nextServiceDate,
      customerSignature: pdfData.customerSignature || '',
      certRef: pdfData.certRef || doc.reference || '',
    }),
  );
  router.push('/(app)/forms/commissioning' as any);
}

async function duplicateDecommissioning(doc: Document, payload: any, resolveCustomerId: ResolveCustomerId) {
  const {pdfData} = payload;
  const snap = doc.customer_snapshot;
  await AsyncStorage.setItem(
    DECOMMISSIONING_DUPLICATE_SEED_KEY,
    JSON.stringify({
      propertyAddress: pdfData.propertyAddress || snap?.address || '',
      appliances: pdfData.appliances,
      customerForm: await buildCustomerFormDuplicate(pdfData, snap, doc.customer_id, resolveCustomerId),
      finalInfo: pdfData.finalInfo,
      decommissionDate: pdfData.decommissionDate,
    }),
  );
  router.push('/(app)/forms/decommissioning' as any);
}

async function editDecommissioning(doc: Document, payload: any, resolveCustomerId: ResolveCustomerId) {
  const {pdfData} = payload;
  await AsyncStorage.setItem(
    DECOMMISSIONING_EDIT_SEED_KEY,
    JSON.stringify({
      documentId: doc.id,
      propertyAddress: pdfData.propertyAddress,
      appliances: pdfData.appliances,
      customerForm: await buildCustomerFormEdit(pdfData, doc.customer_id, resolveCustomerId),
      finalInfo: pdfData.finalInfo,
      decommissionDate: pdfData.decommissionDate,
      customerSignature: pdfData.customerSignature || '',
      certRef: pdfData.certRef || doc.reference || '',
    }),
  );
  router.push('/(app)/forms/decommissioning' as any);
}

async function duplicateWarningNotice(doc: Document, payload: any, resolveCustomerId: ResolveCustomerId) {
  const {pdfData} = payload;
  const snap = doc.customer_snapshot;
  await AsyncStorage.setItem(
    WARNING_NOTICE_DUPLICATE_SEED_KEY,
    JSON.stringify({
      propertyAddress: pdfData.propertyAddress || snap?.address || '',
      appliances: pdfData.appliances,
      customerForm: await buildCustomerFormDuplicate(pdfData, snap, doc.customer_id, resolveCustomerId),
      finalInfo: pdfData.finalInfo,
      issueDate: pdfData.issueDate,
    }),
  );
  router.push('/(app)/forms/warning-notice' as any);
}

async function editWarningNotice(doc: Document, payload: any, resolveCustomerId: ResolveCustomerId) {
  const {pdfData} = payload;
  await AsyncStorage.setItem(
    WARNING_NOTICE_EDIT_SEED_KEY,
    JSON.stringify({
      documentId: doc.id,
      propertyAddress: pdfData.propertyAddress,
      appliances: pdfData.appliances,
      customerForm: await buildCustomerFormEdit(pdfData, doc.customer_id, resolveCustomerId),
      finalInfo: pdfData.finalInfo,
      issueDate: pdfData.issueDate,
      customerSignature: pdfData.customerSignature || '',
      certRef: pdfData.certRef || doc.reference || '',
    }),
  );
  router.push('/(app)/forms/warning-notice' as any);
}

async function duplicateBreakdown(doc: Document, payload: any, resolveCustomerId: ResolveCustomerId) {
  const {pdfData} = payload;
  const snap = doc.customer_snapshot;
  await AsyncStorage.setItem(
    BREAKDOWN_REPORT_DUPLICATE_SEED_KEY,
    JSON.stringify({
      propertyAddress: pdfData.propertyAddress || snap?.address || '',
      appliances: pdfData.appliances,
      customerForm: await buildCustomerFormDuplicate(pdfData, snap, doc.customer_id, resolveCustomerId),
      finalInfo: pdfData.finalInfo,
      reportDate: pdfData.reportDate,
    }),
  );
  router.push('/(app)/forms/breakdown' as any);
}

async function editBreakdown(doc: Document, payload: any, resolveCustomerId: ResolveCustomerId) {
  const {pdfData} = payload;
  await AsyncStorage.setItem(
    BREAKDOWN_REPORT_EDIT_SEED_KEY,
    JSON.stringify({
      documentId: doc.id,
      propertyAddress: pdfData.propertyAddress,
      appliances: pdfData.appliances,
      customerForm: await buildCustomerFormEdit(pdfData, doc.customer_id, resolveCustomerId),
      finalInfo: pdfData.finalInfo,
      reportDate: pdfData.reportDate,
      customerSignature: pdfData.customerSignature || '',
      certRef: pdfData.certRef || doc.reference || '',
    }),
  );
  router.push('/(app)/forms/breakdown' as any);
}

async function duplicateInstallation(doc: Document, payload: any, resolveCustomerId: ResolveCustomerId) {
  const {pdfData} = payload;
  const snap = doc.customer_snapshot;
  await AsyncStorage.setItem(
    INSTALLATION_CERT_DUPLICATE_SEED_KEY,
    JSON.stringify({
      propertyAddress: pdfData.propertyAddress || snap?.address || '',
      appliances: pdfData.appliances,
      customerForm: await buildCustomerFormDuplicate(pdfData, snap, doc.customer_id, resolveCustomerId),
      finalInfo: pdfData.finalInfo,
      installationDate: pdfData.installationDate,
      nextServiceDate: incrementDdMmYyyyByYear(pdfData.nextServiceDate),
    }),
  );
  router.push('/(app)/forms/installation' as any);
}

async function editInstallation(doc: Document, payload: any, resolveCustomerId: ResolveCustomerId) {
  const {pdfData} = payload;
  await AsyncStorage.setItem(
    INSTALLATION_CERT_EDIT_SEED_KEY,
    JSON.stringify({
      documentId: doc.id,
      propertyAddress: pdfData.propertyAddress,
      appliances: pdfData.appliances,
      customerForm: await buildCustomerFormEdit(pdfData, doc.customer_id, resolveCustomerId),
      finalInfo: pdfData.finalInfo,
      installationDate: pdfData.installationDate,
      nextServiceDate: pdfData.nextServiceDate,
      customerSignature: pdfData.customerSignature || '',
      certRef: pdfData.certRef || doc.reference || '',
    }),
  );
  router.push('/(app)/forms/installation' as any);
}

async function duplicateServiceRecord(doc: Document, payload: any, resolveCustomerId: ResolveCustomerId) {
  const {pdfData} = payload;
  const snap = doc.customer_snapshot;
  await AsyncStorage.setItem(
    SERVICE_RECORD_DUPLICATE_SEED_KEY,
    JSON.stringify({
      propertyAddress: pdfData.propertyAddress || snap?.address || '',
      appliances: pdfData.appliances,
      customerForm: await buildCustomerFormDuplicate(pdfData, snap, doc.customer_id, resolveCustomerId),
      finalInfo: pdfData.finalInfo,
      serviceDate: pdfData.serviceDate,
      nextInspectionDate: incrementDdMmYyyyByYear(pdfData.nextInspectionDate),
    }),
  );
  router.push('/(app)/forms/service-record' as any);
}

async function editServiceRecord(doc: Document, payload: any, resolveCustomerId: ResolveCustomerId) {
  const {pdfData} = payload;
  await AsyncStorage.setItem(
    SERVICE_RECORD_EDIT_SEED_KEY,
    JSON.stringify({
      documentId: doc.id,
      propertyAddress: pdfData.propertyAddress,
      appliances: pdfData.appliances,
      customerForm: await buildCustomerFormEdit(pdfData, doc.customer_id, resolveCustomerId),
      finalInfo: pdfData.finalInfo,
      serviceDate: pdfData.serviceDate,
      nextInspectionDate: pdfData.nextInspectionDate,
      customerSignature: pdfData.customerSignature || '',
      certRef: pdfData.certRef || doc.reference || '',
    }),
  );
  router.push('/(app)/forms/service-record' as any);
}

// ─── Public API ─────────────────────────────────────────────

const duplicateMap: Record<string, (doc: Document, payload: any, r: ResolveCustomerId) => Promise<void>> = {
  cp12: duplicateCp12,
  commissioning: duplicateCommissioning,
  decommissioning: duplicateDecommissioning,
  warning_notice: duplicateWarningNotice,
  breakdown_report: duplicateBreakdown,
  installation_cert: duplicateInstallation,
  service_record: duplicateServiceRecord,
};

const editMap: Record<string, (doc: Document, payload: any, r: ResolveCustomerId) => Promise<void>> = {
  cp12: editCp12,
  commissioning: editCommissioning,
  decommissioning: editDecommissioning,
  warning_notice: editWarningNotice,
  breakdown_report: editBreakdown,
  installation_cert: editInstallation,
  service_record: editServiceRecord,
};

const errorLabelMap: Record<string, string> = {
  cp12: 'gas certificate',
  commissioning: 'commissioning certificate',
  decommissioning: 'decommissioning certificate',
  warning_notice: 'warning notice',
  breakdown_report: 'breakdown report',
  installation_cert: 'installation certificate',
  service_record: 'service record',
};

export async function duplicateDocument(doc: Document, payload: any, resolveCustomerId: ResolveCustomerId): Promise<void> {
  const handler = duplicateMap[payload.kind];
  if (!handler) {
    Alert.alert('Error', 'Unsupported form type for duplication.');
    return;
  }
  try {
    await handler(doc, payload, resolveCustomerId);
  } catch {
    Alert.alert('Error', `Could not duplicate this ${errorLabelMap[payload.kind] || 'document'}.`);
  }
}

export async function editDocument(doc: Document, payload: any, resolveCustomerId: ResolveCustomerId): Promise<void> {
  const handler = editMap[payload.kind];
  if (!handler) {
    Alert.alert('Error', 'Unsupported form type for editing.');
    return;
  }
  try {
    await handler(doc, payload, resolveCustomerId);
  } catch {
    Alert.alert('Error', `Could not open ${errorLabelMap[payload.kind] || 'document'} for editing.`);
  }
}
