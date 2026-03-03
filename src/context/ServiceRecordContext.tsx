// ============================================
// FILE: src/context/ServiceRecordContext.tsx
// Shared state for the Service Record multi-step flow
// ============================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useState } from 'react';
import { CustomerFormData, EMPTY_CUSTOMER_FORM } from '../../components/CustomerSelector';
import {
  EMPTY_SERVICE_APPLIANCE,
  EMPTY_SERVICE_FINAL_INFO,
  ServiceAppliance,
  ServiceFinalInfo,
} from '../types/serviceRecord';

const DRAFT_KEY = 'service_record_draft_v1';

interface ServiceRecordState {
  customerForm: CustomerFormData;
  propertyAddressLine1: string;
  propertyAddressLine2: string;
  propertyCity: string;
  propertyPostCode: string;
  appliances: ServiceAppliance[];
  finalInfo: ServiceFinalInfo;
  serviceDate: string;
  customerSignature: string;
  certRef: string;
}

interface ServiceRecordContextValue extends ServiceRecordState {
  setCustomerForm: (f: CustomerFormData) => void;
  setPropertyAddressLine1: (v: string) => void;
  setPropertyAddressLine2: (v: string) => void;
  setPropertyCity: (v: string) => void;
  setPropertyPostCode: (v: string) => void;
  propertyAddress: string;
  addAppliance: (a: ServiceAppliance) => void;
  updateAppliance: (id: string, a: ServiceAppliance) => void;
  removeAppliance: (id: string) => void;
  setFinalInfo: (f: ServiceFinalInfo) => void;
  setServiceDate: (v: string) => void;
  setCustomerSignature: (v: string) => void;
  setCertRef: (v: string) => void;
  editingDocumentId: string | null;
  setEditingDocumentId: (id: string | null) => void;
  resetServiceRecord: () => void;
}

const ServiceRecordContext = createContext<ServiceRecordContextValue | null>(null);

export function ServiceRecordProvider({ children }: { children: React.ReactNode }) {
  const [customerForm, setCustomerForm] = useState<CustomerFormData>(EMPTY_CUSTOMER_FORM);
  const [propertyAddressLine1, setPropertyAddressLine1] = useState('');
  const [propertyAddressLine2, setPropertyAddressLine2] = useState('');
  const [propertyCity, setPropertyCity] = useState('');
  const [propertyPostCode, setPropertyPostCode] = useState('');
  const [appliances, setAppliances] = useState<ServiceAppliance[]>([]);
  const [finalInfo, setFinalInfo] = useState<ServiceFinalInfo>(EMPTY_SERVICE_FINAL_INFO);

  const todayStr = new Date().toLocaleDateString('en-GB');
  const [serviceDate, setServiceDate] = useState(todayStr);
  const [customerSignature, setCustomerSignature] = useState('');
  const [certRef, setCertRef] = useState('');
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);

  const propertyAddress = [propertyAddressLine1, propertyAddressLine2, propertyCity, propertyPostCode]
    .filter(Boolean)
    .join(', ');

  const addAppliance = useCallback((a: ServiceAppliance) => {
    setAppliances((prev) => [...prev, a]);
  }, []);

  const updateAppliance = useCallback((id: string, a: ServiceAppliance) => {
    setAppliances((prev) => prev.map((p) => (p.id === id ? a : p)));
  }, []);

  const removeAppliance = useCallback((id: string) => {
    setAppliances((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const resetServiceRecord = useCallback(() => {
    setCustomerForm(EMPTY_CUSTOMER_FORM);
    setPropertyAddressLine1('');
    setPropertyAddressLine2('');
    setPropertyCity('');
    setPropertyPostCode('');
    setAppliances([]);
    setFinalInfo(EMPTY_SERVICE_FINAL_INFO);
    setServiceDate(new Date().toLocaleDateString('en-GB'));
    setCustomerSignature('');
    setCertRef('');
    setEditingDocumentId(null);
    void AsyncStorage.removeItem(DRAFT_KEY);
  }, []);

  return (
    <ServiceRecordContext.Provider
      value={{
        customerForm,
        setCustomerForm,
        propertyAddressLine1,
        setPropertyAddressLine1,
        propertyAddressLine2,
        setPropertyAddressLine2,
        propertyCity,
        setPropertyCity,
        propertyPostCode,
        setPropertyPostCode,
        propertyAddress,
        appliances,
        addAppliance,
        updateAppliance,
        removeAppliance,
        finalInfo,
        setFinalInfo,
        serviceDate,
        setServiceDate,
        customerSignature,
        setCustomerSignature,
        certRef,
        setCertRef,
        editingDocumentId,
        setEditingDocumentId,
        resetServiceRecord,
      }}
    >
      {children}
    </ServiceRecordContext.Provider>
  );
}

export function useServiceRecord() {
  const ctx = useContext(ServiceRecordContext);
  if (!ctx) throw new Error('useServiceRecord must be inside ServiceRecordProvider');
  return ctx;
}
