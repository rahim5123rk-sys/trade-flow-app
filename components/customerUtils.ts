// ─── Customer Types & Pure Helpers ──────────────────────────────────
// Extracted from CustomerSelector.tsx to allow sharing across files
// without circular dependencies.

import { supabase } from '../src/config/supabase';

export interface CustomerFormData {
  customerId: string | null;
  customerName: string;
  customerCompany: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postCode: string;
  phone: string;
  email: string;
  sameAsBilling: boolean;
  jobAddressLine1: string;
  jobAddressLine2: string;
  jobCity: string;
  jobPostCode: string;
  siteContactName: string;
  siteContactEmail: string;
}

export const EMPTY_CUSTOMER_FORM: CustomerFormData = {
  customerId: null,
  customerName: '',
  customerCompany: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  region: '',
  postCode: '',
  phone: '',
  email: '',
  sameAsBilling: true,
  jobAddressLine1: '',
  jobAddressLine2: '',
  jobCity: '',
  jobPostCode: '',
  siteContactName: '',
  siteContactEmail: '',
};

export function buildCustomerSnapshot(form: CustomerFormData) {
  const activeAddressLine1 = form.sameAsBilling
    ? form.addressLine1
    : form.jobAddressLine1 || form.addressLine1;
  const activeAddressLine2 = form.sameAsBilling
    ? form.addressLine2
    : form.jobAddressLine2 || '';
  const activeCity = form.sameAsBilling ? form.city : form.jobCity || form.city;
  const activePostCode = form.sameAsBilling
    ? form.postCode
    : form.jobPostCode || form.postCode;

  const combinedAddress = [
    activeAddressLine1,
    activeAddressLine2,
    activeCity,
    form.region,
    activePostCode,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    name: form.customerName.trim(),
    company_name: form.customerCompany.trim(),
    address_line_1: activeAddressLine1.trim(),
    address_line_2: activeAddressLine2.trim(),
    city: activeCity.trim(),
    region: form.region.trim(),
    postal_code: activePostCode.trim().toUpperCase(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    site_contact_name: form.sameAsBilling ? '' : form.siteContactName.trim(),
    site_contact_email: form.sameAsBilling ? '' : form.siteContactEmail.trim(),
    billing_address_line_1: form.addressLine1.trim(),
    billing_address_line_2: form.addressLine2.trim(),
    billing_city: form.city.trim(),
    billing_postal_code: form.postCode.trim().toUpperCase(),
    address: combinedAddress || 'No address provided',
  };
}

export function buildCustomerInsert(form: CustomerFormData, companyId: string) {
  const snapshot = buildCustomerSnapshot(form);
  return {
    company_id: companyId,
    name: snapshot.name,
    company_name: snapshot.company_name || null,
    address_line_1: snapshot.address_line_1,
    address_line_2: snapshot.address_line_2 || null,
    city: snapshot.city || null,
    region: snapshot.region || null,
    postal_code: snapshot.postal_code,
    address: snapshot.address,
    phone: snapshot.phone || null,
    email: snapshot.email || null,
  };
}

export function getJobAddress(form: CustomerFormData) {
  if (form.sameAsBilling) {
    return {
      jobAddress1: form.addressLine1,
      jobAddress2: form.addressLine2,
      jobCity: form.city,
      jobPostcode: form.postCode,
    };
  }
  return {
    jobAddress1: form.jobAddressLine1,
    jobAddress2: form.jobAddressLine2,
    jobCity: form.jobCity,
    jobPostcode: form.jobPostCode,
  };
}

export function prefillFromJob(job: any): CustomerFormData {
  const snap = job.customer_snapshot || {};
  return {
    customerId: job.customer_id || null,
    customerName: snap.name || '',
    customerCompany: snap.company_name || '',
    addressLine1: snap.address_line_1 || '',
    addressLine2: snap.address_line_2 || '',
    city: snap.city || '',
    region: snap.region || '',
    postCode: snap.postal_code || '',
    phone: snap.phone || '',
    email: snap.email || '',
    sameAsBilling: true,
    jobAddressLine1: snap.address_line_1 || '',
    jobAddressLine2: snap.address_line_2 || '',
    jobCity: snap.city || '',
    jobPostCode: snap.postal_code || '',
    siteContactName: snap.site_contact_name || '',
    siteContactEmail: snap.site_contact_email || '',
  };
}

export async function updateExistingCustomer(
  customerId: string,
  form: CustomerFormData,
) {
  const snapshot = buildCustomerSnapshot(form);
  const { error } = await supabase
    .from('customers')
    .update({
      name: snapshot.name,
      company_name: snapshot.company_name || null,
      address_line_1: snapshot.address_line_1,
      address_line_2: snapshot.address_line_2 || null,
      city: snapshot.city || null,
      region: snapshot.region || null,
      postal_code: snapshot.postal_code,
      address: snapshot.address,
      phone: snapshot.phone || null,
      email: snapshot.email || null,
    })
    .eq('id', customerId);
  if (error) throw error;
}
