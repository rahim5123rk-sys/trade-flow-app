export type UserRole = 'admin' | 'worker';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  companyId: string;
  role: UserRole;
  createdAt?: number;
}

export interface Company {
  id: string;
  name: string;
  ownerId: string;
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'trialing';
  settings: {
    nextJobNumber: number;
    currency: string;
  };
}

export type JobStatus =
  | 'pending'
  | 'accepted'
  | 'on_the_way'
  | 'in_progress'
  | 'complete'
  | 'invoiced'
  | 'paid'
  | 'cancelled';

export type JobCategory =
  | 'Gas & Heating'
  | 'Plumbing'
  | 'Electrical'
  | 'HVAC'
  | 'Carpentry'
  | 'Building'
  | 'Roofing'
  | 'Other';

export interface Job {
  id: string;
  companyId: string;
  reference: string;
  customerId?: string;
  customerSnapshot: {
    name: string;
    address: string;
    phone?: string;
    email?: string;
  };
  title: string;
  category: JobCategory;
  assignedTo: string[];
  status: JobStatus;
  scheduledDate: number; // Unix timestamp ms
  estimatedDuration?: string;
  price?: number;
  paymentStatus?: 'unpaid' | 'paid';
  paymentMethod?: 'cash' | 'bank_transfer' | 'card';
  notes?: string;
  createdAt: any;
}