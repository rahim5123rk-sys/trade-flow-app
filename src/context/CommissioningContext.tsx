import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {createContext, useCallback, useContext, useState} from 'react';
import {CustomerFormData, EMPTY_CUSTOMER_FORM} from '../../components/CustomerSelector';
import {
  CommissioningAppliance,
  CommissioningFinalInfo,
  EMPTY_COMMISSIONING_FINAL_INFO,
} from '../types/commissioning';
import {cloneSingleApplianceList, mergeCustomerForm, splitPropertyAddress} from './singleApplianceFormUtils';

export const COMMISSIONING_DRAFT_KEY = 'commissioning_draft_v1';

interface CommissioningState {
  customerForm: CustomerFormData;
  propertyAddressLine1: string;
  propertyAddressLine2: string;
  propertyCity: string;
  propertyPostCode: string;
  appliances: CommissioningAppliance[];
  finalInfo: CommissioningFinalInfo;
  commissioningDate: string;
  nextServiceDate: string;
  customerSignature: string;
  certRef: string;
}

interface CommissioningContextValue extends CommissioningState {
  setCustomerForm: (value: CustomerFormData) => void;
  setPropertyAddressLine1: (value: string) => void;
  setPropertyAddressLine2: (value: string) => void;
  setPropertyCity: (value: string) => void;
  setPropertyPostCode: (value: string) => void;
  propertyAddress: string;
  addAppliance: (appliance: CommissioningAppliance) => void;
  updateAppliance: (id: string, appliance: CommissioningAppliance) => void;
  removeAppliance: (id: string) => void;
  setFinalInfo: (value: CommissioningFinalInfo) => void;
  setCommissioningDate: (value: string) => void;
  setNextServiceDate: (value: string) => void;
  setCustomerSignature: (value: string) => void;
  setCertRef: (value: string) => void;
  editingDocumentId: string | null;
  setEditingDocumentId: (id: string | null) => void;
  hydrateFromDuplicate: (seed: {
    propertyAddress?: string;
    appliances?: CommissioningAppliance[];
    customerForm?: Partial<CustomerFormData>;
    finalInfo?: CommissioningFinalInfo;
    commissioningDate?: string;
    nextServiceDate?: string;
  }) => void;
  hydrateForEdit: (seed: {
    propertyAddress?: string;
    appliances?: CommissioningAppliance[];
    customerForm?: Partial<CustomerFormData>;
    finalInfo?: CommissioningFinalInfo;
    commissioningDate?: string;
    nextServiceDate?: string;
    customerSignature?: string;
    certRef?: string;
    documentId: string;
  }) => void;
  resetCommissioning: () => void;
}

const CommissioningContext = createContext<CommissioningContextValue | null>(null);

export function CommissioningProvider({children}: {children: React.ReactNode}) {
  const [customerForm, setCustomerForm] = useState<CustomerFormData>(EMPTY_CUSTOMER_FORM);
  const [propertyAddressLine1, setPropertyAddressLine1] = useState('');
  const [propertyAddressLine2, setPropertyAddressLine2] = useState('');
  const [propertyCity, setPropertyCity] = useState('');
  const [propertyPostCode, setPropertyPostCode] = useState('');
  const [appliances, setAppliances] = useState<CommissioningAppliance[]>([]);
  const [finalInfo, setFinalInfo] = useState<CommissioningFinalInfo>(EMPTY_COMMISSIONING_FINAL_INFO);
  const todayStr = new Date().toLocaleDateString('en-GB');
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const [commissioningDate, setCommissioningDate] = useState(todayStr);
  const [nextServiceDate, setNextServiceDate] = useState(nextYear.toLocaleDateString('en-GB'));
  const [customerSignature, setCustomerSignature] = useState('');
  const [certRef, setCertRef] = useState('');
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);

  const propertyAddress = [propertyAddressLine1, propertyAddressLine2, propertyCity, propertyPostCode]
    .filter(Boolean)
    .join(', ');

  const addAppliance = useCallback((appliance: CommissioningAppliance) => {
    setAppliances([appliance]);
  }, []);

  const updateAppliance = useCallback((id: string, appliance: CommissioningAppliance) => {
    setAppliances((prev) => prev.map((item) => (item.id === id ? appliance : item)));
  }, []);

  const removeAppliance = useCallback((id: string) => {
    setAppliances((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const hydrateFromDuplicate = useCallback((seed: {
    propertyAddress?: string;
    appliances?: CommissioningAppliance[];
    customerForm?: Partial<CustomerFormData>;
    finalInfo?: CommissioningFinalInfo;
    commissioningDate?: string;
    nextServiceDate?: string;
  }) => {
    const property = splitPropertyAddress(seed.propertyAddress);
    setPropertyAddressLine1(property.line1);
    setPropertyAddressLine2(property.line2);
    setPropertyCity(property.city);
    setPropertyPostCode(property.postCode);
    setAppliances(cloneSingleApplianceList(seed.appliances));
    if (seed.customerForm) setCustomerForm(mergeCustomerForm(seed.customerForm));
    if (seed.finalInfo) setFinalInfo(seed.finalInfo);
    if (seed.commissioningDate) setCommissioningDate(seed.commissioningDate);
    if (seed.nextServiceDate) setNextServiceDate(seed.nextServiceDate);
  }, []);

  const hydrateForEdit = useCallback((seed: {
    propertyAddress?: string;
    appliances?: CommissioningAppliance[];
    customerForm?: Partial<CustomerFormData>;
    finalInfo?: CommissioningFinalInfo;
    commissioningDate?: string;
    nextServiceDate?: string;
    customerSignature?: string;
    certRef?: string;
    documentId: string;
  }) => {
    const property = splitPropertyAddress(seed.propertyAddress);
    setPropertyAddressLine1(property.line1);
    setPropertyAddressLine2(property.line2);
    setPropertyCity(property.city);
    setPropertyPostCode(property.postCode);
    setAppliances(cloneSingleApplianceList(seed.appliances));
    if (seed.customerForm) setCustomerForm(mergeCustomerForm(seed.customerForm));
    if (seed.finalInfo) setFinalInfo(seed.finalInfo);
    if (seed.commissioningDate) setCommissioningDate(seed.commissioningDate);
    if (seed.nextServiceDate) setNextServiceDate(seed.nextServiceDate);
    if (seed.customerSignature) setCustomerSignature(seed.customerSignature);
    if (seed.certRef) setCertRef(seed.certRef);
    setEditingDocumentId(seed.documentId);
  }, []);

  const resetCommissioning = useCallback(() => {
    setCustomerForm(EMPTY_CUSTOMER_FORM);
    setPropertyAddressLine1('');
    setPropertyAddressLine2('');
    setPropertyCity('');
    setPropertyPostCode('');
    setAppliances([]);
    setFinalInfo(EMPTY_COMMISSIONING_FINAL_INFO);
    setCommissioningDate(new Date().toLocaleDateString('en-GB'));
    const next = new Date();
    next.setFullYear(next.getFullYear() + 1);
    setNextServiceDate(next.toLocaleDateString('en-GB'));
    setCustomerSignature('');
    setCertRef('');
    setEditingDocumentId(null);
    void AsyncStorage.removeItem(COMMISSIONING_DRAFT_KEY);
  }, []);

  return (
    <CommissioningContext.Provider
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
        commissioningDate,
        setCommissioningDate,
        nextServiceDate,
        setNextServiceDate,
        customerSignature,
        setCustomerSignature,
        certRef,
        setCertRef,
        editingDocumentId,
        setEditingDocumentId,
        hydrateFromDuplicate,
        hydrateForEdit,
        resetCommissioning,
      }}
    >
      {children}
    </CommissioningContext.Provider>
  );
}

export function useCommissioning() {
  const ctx = useContext(CommissioningContext);
  if (!ctx) throw new Error('useCommissioning must be inside CommissioningProvider');
  return ctx;
}
