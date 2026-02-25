// ============================================
// FILE: hooks/index.ts
// ============================================

export { useCreateCustomer, useCustomerDetail, useCustomers } from './useCustomers';
export { useCreateJob, useJobs, useUpdateJobStatus } from './useJobs';
export {
    useRealtimeJobActivity,
    useRealtimeJobs,
    useRealtimeTable
} from './useRealtime';
export { notifyWorkers, useWorkers } from './useWorkers';
