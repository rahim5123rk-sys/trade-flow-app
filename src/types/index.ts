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
  ownerId: string; // The user who created it
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'trialing';
  settings: {
    nextJobNumber: number;
    currency: string;
  };
}

export interface Job {
  id: string;
  companyId: string;
  reference: string;
  customerId: string;
  customerSnapshot: {
    name: string;
    address: string;
  };
  assignedTo: string[]; // Worker UIDs
  status: 'pending' | 'in_progress' | 'complete' | 'cancelled';
  scheduledDate: number; // Unix timestamp
  notes?: string;
}