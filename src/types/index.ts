// src/types/index.ts

export type UserRole = 'admin' | 'worker';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  company_id: string;
  role: UserRole;
  created_at?: string;
}

export type JobStatus = 
  | 'pending'
  | 'in_progress'
  | 'complete'
  | 'paid'
  | 'cancelled';

export interface Job {
  id: string;
  company_id: string;
  reference: string;
  customer_id?: string;
  customer_snapshot: {
    name: string;
    company_name?: string;
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    region?: string;
    postal_code?: string;
    phone?: string;
    email?: string;
    site_contact_name?: string;
    site_contact_email?: string;
    address: string;
  };
  title: string;
  assigned_to: string[];
  status: JobStatus;
  scheduled_date: number;
  estimated_duration?: string;
  price?: number;
  photos?: string[];
  signature?: string;
  notes?: string;
  created_at: string;
  payment_status?: 'paid' | 'unpaid';
}

export interface Customer {
  id: string;
  name: string;
  company_name?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  region?: string;
  postal_code: string;
  address: string;
  phone?: string;
  email?: string;
  company_id: string;
}

// ─── Site Address (property + tenant details for reuse) ─────────

export interface SiteAddress {
  id: string;
  company_id: string;
  address_line_1: string;
  address_line_2?: string;
  city?: string;
  post_code: string;
  tenant_title?: string;
  tenant_name?: string;
  tenant_email?: string;
  tenant_phone?: string;
  created_at: string;
  updated_at: string;
}

// ─── NEW: Document type for quotes & invoices ───────────────────

export type DocumentType =
  | 'invoice'
  | 'quote'
  | 'cp12'
  | 'service_record'
  | 'commissioning'
  | 'decommissioning'
  | 'warning_notice'
  | 'breakdown_report'
  | 'installation_cert';

export type DocumentStatus = 
  | 'Draft'
  | 'Sent'
  | 'Accepted'
  | 'Declined'
  | 'Unpaid'
  | 'Paid'
  | 'Overdue';

export interface DocumentLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatPercent: number;
}

export interface Document {
  id: string;
  company_id: string;
  user_id?: string;
  type: DocumentType;
  number: number;
  reference?: string;
  status: DocumentStatus;
  date: string;
  expiry_date?: string;
  job_id?: string;
  customer_id?: string;
  customer_snapshot?: {
    name: string;
    company_name?: string;
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    postal_code?: string;
    phone?: string;
    email?: string;
    address: string;
  };
  job_address?: {
    address_line_1: string;
    address_line_2?: string;
    city: string;
    postcode: string;
  };
  items: DocumentLineItem[];
  subtotal: number;
  discount_percent: number;
  total_vat: number;
  total: number;
  sync_to_xero?: boolean;
  notes?: string;
  payment_info?: string;
  created_at: string;
  updated_at: string;
}