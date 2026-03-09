import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {createContext, useCallback, useContext, useState} from 'react';
import {CustomerFormData, EMPTY_CUSTOMER_FORM} from '../../components/CustomerSelector';
import {
  DecommissioningAppliance,
  DecommissioningFinalInfo,
  EMPTY_DECOMMISSIONING_FINAL_INFO,
} from '../types/decommissioning';
import {cloneSingleApplianceList, mergeCustomerForm, splitPropertyAddress} from './singleApplianceFormUtils';

export const DECOMMISSIONING_DRAFT_KEY = 'decommissioning_draft_v1';

interface DecommissioningState {
  customerForm: CustomerFormData;
  propertyAddressLine1: string;
  propertyAddressLine2: string;
  propertyCity: string;
  propertyPostCode: string;
  appliances: DecommissioningAppliance[];
  finalInfo: DecommissioningFinalInfo;
  decommissionDate: string;
  customerSignature: string;
  certRef: string;
}

interface DecommissioningContextValue extends DecommissioningState {
  setCustomerForm: (value: CustomerFormData) => void;
  setPropertyAddressLine1: (value: string) => void;
  setPropertyAddressLine2: (value: string) => void;
  setPropertyCity: (value: string) => void;
  setPropertyPostCode: (value: string) => void;
  propertyAddress: string;
  addAppliance: (appliance: DecommissioningAppliance) => void;
  updateAppliance: (id: string, appliance: DecommissioningAppliance) => void;
  removeAppliance: (id: string) => void;
  setFinalInfo: (value: DecommissioningFinalInfo) => void;
  setDecommissionDate: (value: string) => void;
  setCustomerSignature: (value: string) => void;
  setCertRef: (value: string) => void;
  editingDocumentId: string | null;
  setEditingDocumentId: (id: string | null) => void;
  hydrateFromDuplicate: (seed: {
    propertyAddress?: string;
    appliances?: DecommissioningAppliance[];
    customerForm?: Partial<CustomerFormData>;
    finalInfo?: DecommissioningFinalInfo;
    decommissionDate?: string;
  }) => void;
  hydrateForEdit: (seed: {
    propertyAddress?: string;
    appliances?: DecommissioningAppliance[];
    customerForm?: Partial<CustomerFormData>;
    finalInfo?: DecommissioningFinalInfo;
    decommissionDate?: string;
    customerSignature?: string;
    certRef?: string;
    documentId: string;
  }) => void;
  resetDecommissioning: () => void;
}

const DecommissioningContext = createContext<DecommissioningContextValue | null>(null);

export function DecommissioningProvider({children}: {children: React.ReactNode}) {
  const [customerForm, setCustomerForm] = useState<CustomerFormData>(EMPTY_CUSTOMER_FORM);
  const [propertyAddressLine1, setPropertyAddressLine1] = useState('');
  const [propertyAddressLine2, setPropertyAddressLine2] = useState('');
  const [propertyCity, setPropertyCity] = useState('');
  const [propertyPostCode, setPropertyPostCode] = useState('');
  const [appliances, setAppliances] = useState<DecommissioningAppliance[]>([]);
  const [finalInfo, setFinalInfo] = useState<DecommissioningFinalInfo>(EMPTY_DECOMMISSIONING_FINAL_INFO);
  const [decommissionDate, setDecommissionDate] = useState(new Date().toLocaleDateString('en-GB'));
  const [customerSignature, setCustomerSignature] = useState('');
  const [certRef, setCertRef] = useState('');
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);

  const propertyAddress = [propertyAddressLine1, propertyAddressLine2, propertyCity, propertyPostCode]
    .filter(Boolean)
    .join(', ');

  const addAppliance = useCallback((appliance: DecommissioningAppliance) => {
    setAppliances([appliance]);
  }, []);

  const updateAppliance = useCallback((id: string, appliance: DecommissioningAppliance) => {
    setAppliances((prev) => prev.map((item) => (item.id === id ? appliance : item)));
  }, []);

  const removeAppliance = useCallback((id: string) => {
    setAppliances((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const hydrateFromDuplicate = useCallback((seed: {
    propertyAddress?: string;
    appliances?: DecommissioningAppliance[];
    customerForm?: Partial<CustomerFormData>;
    finalInfo?: DecommissioningFinalInfo;
    decommissionDate?: string;
  }) => {
    const property = splitPropertyAddress(seed.propertyAddress);
    setPropertyAddressLine1(property.line1);
    setPropertyAddressLine2(property.line2);
    setPropertyCity(property.city);
    setPropertyPostCode(property.postCode);
    setAppliances(cloneSingleApplianceList(seed.appliances));
    if (seed.customerForm) setCustomerForm(mergeCustomerForm(seed.customerForm));
    if (seed.finalInfo) setFinalInfo(seed.finalInfo);
    if (seed.decommissionDate) setDecommissionDate(seed.decommissionDate);
  }, []);

  const hydrateForEdit = useCallback((seed: {
    propertyAddress?: string;
    appliances?: DecommissioningAppliance[];
    customerForm?: Partial<CustomerFormData>;
    finalInfo?: DecommissioningFinalInfo;
    decommissionDate?: string;
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
    if (seed.decommissionDate) setDecommissionDate(seed.decommissionDate);
    if (seed.customerSignature) setCustomerSignature(seed.customerSignature);
    if (seed.certRef) setCertRef(seed.certRef);
    setEditingDocumentId(seed.documentId);
  }, []);

  const resetDecommissioning = useCallback(() => {
    setCustomerForm(EMPTY_CUSTOMER_FORM);
    setPropertyAddressLine1('');
    setPropertyAddressLine2('');
    setPropertyCity('');
    setPropertyPostCode('');
    setAppliances([]);
    setFinalInfo(EMPTY_DECOMMISSIONING_FINAL_INFO);
    setDecommissionDate(new Date().toLocaleDateString('en-GB'));
    setCustomerSignature('');
    setCertRef('');
    setEditingDocumentId(null);
    void AsyncStorage.removeItem(DECOMMISSIONING_DRAFT_KEY);
  }, []);

  return (
    <DecommissioningContext.Provider
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
        decommissionDate,
        setDecommissionDate,
        customerSignature,
        setCustomerSignature,
        certRef,
        setCertRef,
        editingDocumentId,
        setEditingDocumentId,
        hydrateFromDuplicate,
        hydrateForEdit,
        resetDecommissioning,
      }}
    >
      {children}
    </DecommissioningContext.Provider>
  );
}

export function useDecommissioning() {
  const ctx = useContext(DecommissioningContext);
  if (!ctx) throw new Error('useDecommissioning must be inside DecommissioningProvider');
  return ctx;
}
