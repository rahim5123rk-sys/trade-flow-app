export type UserRole = 'admin' | 'worker';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string; // Changed from displayName
  company_id: string;   // Changed from companyId
  role: UserRole;
  created_at?: string;  // Changed from createdAt
}

export type JobStatus = 
  | 'pending'
  | 'in_progress'
  | 'complete'
  | 'paid'
  | 'cancelled';

export interface Job {
  id: string;
  company_id: string;         // Match DB
  reference: string;
  customer_id?: string;       // Match DB
  customer_snapshot: {        // Match DB
    name: string;
    address: string;
    phone?: string;
    email?: string;
  };
  title: string;
  assigned_to: string[];      // Match DB
  status: JobStatus;
  scheduled_date: number;     // Match DB
  estimated_duration?: string; // Match DB
  price?: number;
  photos?: string[];
  signature?: string;
  notes?: string;
  created_at: string;         // Match DB
  payment_status?: 'paid' | 'unpaid'; // Match DB
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  company_id: string;         // Match DB
}