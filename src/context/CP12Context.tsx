// ============================================
// FILE: src/context/CP12Context.tsx
// Shared state for the CP12 multi-step flow
// ============================================

import React, { createContext, useCallback, useContext, useState } from 'react';
import { CustomerFormData, EMPTY_CUSTOMER_FORM } from '../../components/CustomerSelector';
import {
    CP12Appliance,
    CP12FinalChecks,
    EMPTY_FINAL_CHECKS,
} from '../types/cp12';

interface CP12State {
  landlordForm: CustomerFormData;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  tenantAddressLine1: string;
  tenantAddressLine2: string;
  tenantCity: string;
  tenantPostCode: string;
  appliances: CP12Appliance[];
  finalChecks: CP12FinalChecks;
  inspectionDate: string;
  nextDueDate: string;
  customerSignature: string;
  certRef: string;
}

interface CP12ContextValue extends CP12State {
  setLandlordForm: (f: CustomerFormData) => void;
  setTenantName: (v: string) => void;
  setTenantEmail: (v: string) => void;
  setTenantPhone: (v: string) => void;
  setTenantAddressLine1: (v: string) => void;
  setTenantAddressLine2: (v: string) => void;
  setTenantCity: (v: string) => void;
  setTenantPostCode: (v: string) => void;
  propertyAddress: string;
  addAppliance: (a: CP12Appliance) => void;
  updateAppliance: (id: string, a: CP12Appliance) => void;
  removeAppliance: (id: string) => void;
  setFinalChecks: (f: CP12FinalChecks) => void;
  setInspectionDate: (v: string) => void;
  setNextDueDate: (v: string) => void;
  setCustomerSignature: (v: string) => void;
  setCertRef: (v: string) => void;
  resetCP12: () => void;
}

const CP12Context = createContext<CP12ContextValue | null>(null);

export function CP12Provider({ children }: { children: React.ReactNode }) {
  const [landlordForm, setLandlordForm] = useState<CustomerFormData>(EMPTY_CUSTOMER_FORM);
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [tenantAddressLine1, setTenantAddressLine1] = useState('');
  const [tenantAddressLine2, setTenantAddressLine2] = useState('');
  const [tenantCity, setTenantCity] = useState('');
  const [tenantPostCode, setTenantPostCode] = useState('');
  const [appliances, setAppliances] = useState<CP12Appliance[]>([]);
  const [finalChecks, setFinalChecks] = useState<CP12FinalChecks>(EMPTY_FINAL_CHECKS);

  // Step 4 – Review & Sign
  const todayStr = new Date().toLocaleDateString('en-GB');
  const [inspectionDate, setInspectionDate] = useState(todayStr);
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const [nextDueDate, setNextDueDate] = useState(nextYear.toLocaleDateString('en-GB'));
  const [customerSignature, setCustomerSignature] = useState('');
  const [certRef, setCertRef] = useState('');

  // Derived property address from tenant address fields
  const propertyAddress = [tenantAddressLine1, tenantAddressLine2, tenantCity, tenantPostCode]
    .filter(Boolean)
    .join(', ');

  const addAppliance = useCallback((a: CP12Appliance) => {
    setAppliances((prev) => [...prev, a]);
  }, []);

  const updateAppliance = useCallback((id: string, a: CP12Appliance) => {
    setAppliances((prev) => prev.map((p) => (p.id === id ? a : p)));
  }, []);

  const removeAppliance = useCallback((id: string) => {
    setAppliances((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const resetCP12 = useCallback(() => {
    setLandlordForm(EMPTY_CUSTOMER_FORM);
    setTenantName('');
    setTenantEmail('');
    setTenantPhone('');
    setTenantAddressLine1('');
    setTenantAddressLine2('');
    setTenantCity('');
    setTenantPostCode('');
    setAppliances([]);
    setFinalChecks(EMPTY_FINAL_CHECKS);
    setInspectionDate(todayStr);
    setNextDueDate(nextYear.toLocaleDateString('en-GB'));
    setCustomerSignature('');
    setCertRef('');
  }, []);

  return (
    <CP12Context.Provider
      value={{
        landlordForm,
        setLandlordForm,
        tenantName,
        setTenantName,
        tenantEmail,
        setTenantEmail,
        tenantPhone,
        setTenantPhone,
        tenantAddressLine1,
        setTenantAddressLine1,
        tenantAddressLine2,
        setTenantAddressLine2,
        tenantCity,
        setTenantCity,
        tenantPostCode,
        setTenantPostCode,
        propertyAddress,
        appliances,
        addAppliance,
        updateAppliance,
        removeAppliance,
        finalChecks,
        setFinalChecks,
        inspectionDate,
        setInspectionDate,
        nextDueDate,
        setNextDueDate,
        customerSignature,
        setCustomerSignature,
        certRef,
        setCertRef,
        resetCP12,
      }}
    >
      {children}
    </CP12Context.Provider>
  );
}

export function useCP12() {
  const ctx = useContext(CP12Context);
  if (!ctx) throw new Error('useCP12 must be inside CP12Provider');
  return ctx;
}
