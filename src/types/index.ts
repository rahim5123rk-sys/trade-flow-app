export type UserRole = 'admin' | 'worker';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  companyId: string;
  role: UserRole;
  createdAt?: number;
}

export type JobStatus = 
  | 'pending'      // Scheduled / Assigned
  | 'in_progress'  // Worker is working
  | 'complete'     // Work done
  | 'paid'         // Admin only
  | 'cancelled';

// Removed "JobCategory" type entirely

export interface Job {
  id: string;
  companyId: string;
  reference: string;
  customerId?: string; // Link to the customer doc
  customerSnapshot: {
    name: string;
    address: string;
    phone?: string;
    email?: string;
  };
  title: string;
  // category: removed; 
  assignedTo: string[];
  status: JobStatus;
  scheduledDate: number;
  estimatedDuration?: string;
  price?: number;
  photos?: string[];
  signature?: string;
  notes?: string;
  createdAt: any;
  paymentStatus?: 'paid' | 'unpaid';
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  companyId: string;
}