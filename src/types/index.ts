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
    address: string; // The concatenated display address
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
  name: string; // Contact Person
  company_name?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  region?: string;
  postal_code: string;
  address: string; // The concatenated display address
  phone?: string;
  email?: string;
  company_id: string;
}