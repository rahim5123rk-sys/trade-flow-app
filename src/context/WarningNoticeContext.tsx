import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {createContext, useCallback, useContext, useState} from 'react';
import {CustomerFormData, EMPTY_CUSTOMER_FORM} from '../../components/CustomerSelector';
import {
  EMPTY_WARNING_NOTICE_FINAL_INFO,
  WarningNoticeAppliance,
  WarningNoticeFinalInfo,
} from '../types/warningNotice';
import {cloneSingleApplianceList, mergeCustomerForm, splitPropertyAddress} from './singleApplianceFormUtils';

export const WARNING_NOTICE_DRAFT_KEY = 'warning_notice_draft_v1';

interface WarningNoticeState {
  customerForm: CustomerFormData;
  propertyAddressLine1: string;
  propertyAddressLine2: string;
  propertyCity: string;
  propertyPostCode: string;
  appliances: WarningNoticeAppliance[];
  finalInfo: WarningNoticeFinalInfo;
  issueDate: string;
  customerSignature: string;
  certRef: string;
}

interface WarningNoticeContextValue extends WarningNoticeState {
  setCustomerForm: (value: CustomerFormData) => void;
  setPropertyAddressLine1: (value: string) => void;
  setPropertyAddressLine2: (value: string) => void;
  setPropertyCity: (value: string) => void;
  setPropertyPostCode: (value: string) => void;
  propertyAddress: string;
  addAppliance: (appliance: WarningNoticeAppliance) => void;
  updateAppliance: (id: string, appliance: WarningNoticeAppliance) => void;
  removeAppliance: (id: string) => void;
  setFinalInfo: (value: WarningNoticeFinalInfo) => void;
  setIssueDate: (value: string) => void;
  setCustomerSignature: (value: string) => void;
  setCertRef: (value: string) => void;
  editingDocumentId: string | null;
  setEditingDocumentId: (value: string | null) => void;
  hydrateFromDuplicate: (seed: {propertyAddress?: string; appliances?: WarningNoticeAppliance[]; customerForm?: Partial<CustomerFormData>; finalInfo?: WarningNoticeFinalInfo; issueDate?: string;}) => void;
  hydrateForEdit: (seed: {propertyAddress?: string; appliances?: WarningNoticeAppliance[]; customerForm?: Partial<CustomerFormData>; finalInfo?: WarningNoticeFinalInfo; issueDate?: string; customerSignature?: string; certRef?: string; documentId: string;}) => void;
  resetWarningNotice: () => void;
}

const WarningNoticeContext = createContext<WarningNoticeContextValue | null>(null);

export function WarningNoticeProvider({children}: {children: React.ReactNode}) {
  const [customerForm, setCustomerForm] = useState<CustomerFormData>(EMPTY_CUSTOMER_FORM);
  const [propertyAddressLine1, setPropertyAddressLine1] = useState('');
  const [propertyAddressLine2, setPropertyAddressLine2] = useState('');
  const [propertyCity, setPropertyCity] = useState('');
  const [propertyPostCode, setPropertyPostCode] = useState('');
  const [appliances, setAppliances] = useState<WarningNoticeAppliance[]>([]);
  const [finalInfo, setFinalInfo] = useState<WarningNoticeFinalInfo>(EMPTY_WARNING_NOTICE_FINAL_INFO);
  const [issueDate, setIssueDate] = useState(new Date().toLocaleDateString('en-GB'));
  const [customerSignature, setCustomerSignature] = useState('');
  const [certRef, setCertRef] = useState('');
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const propertyAddress = [propertyAddressLine1, propertyAddressLine2, propertyCity, propertyPostCode].filter(Boolean).join(', ');

  const addAppliance = useCallback((appliance: WarningNoticeAppliance) => setAppliances([appliance]), []);
  const updateAppliance = useCallback((id: string, appliance: WarningNoticeAppliance) => setAppliances((prev) => prev.map((item) => item.id === id ? appliance : item)), []);
  const removeAppliance = useCallback((id: string) => setAppliances((prev) => prev.filter((item) => item.id !== id)), []);

  const hydrateFromDuplicate = useCallback((seed: {propertyAddress?: string; appliances?: WarningNoticeAppliance[]; customerForm?: Partial<CustomerFormData>; finalInfo?: WarningNoticeFinalInfo; issueDate?: string;}) => {
    const property = splitPropertyAddress(seed.propertyAddress);
    setPropertyAddressLine1(property.line1);
    setPropertyAddressLine2(property.line2);
    setPropertyCity(property.city);
    setPropertyPostCode(property.postCode);
    setAppliances(cloneSingleApplianceList(seed.appliances));
    if (seed.customerForm) setCustomerForm(mergeCustomerForm(seed.customerForm));
    if (seed.finalInfo) setFinalInfo(seed.finalInfo);
    if (seed.issueDate) setIssueDate(seed.issueDate);
  }, []);

  const hydrateForEdit = useCallback((seed: {propertyAddress?: string; appliances?: WarningNoticeAppliance[]; customerForm?: Partial<CustomerFormData>; finalInfo?: WarningNoticeFinalInfo; issueDate?: string; customerSignature?: string; certRef?: string; documentId: string;}) => {
    const property = splitPropertyAddress(seed.propertyAddress);
    setPropertyAddressLine1(property.line1);
    setPropertyAddressLine2(property.line2);
    setPropertyCity(property.city);
    setPropertyPostCode(property.postCode);
    setAppliances(cloneSingleApplianceList(seed.appliances));
    if (seed.customerForm) setCustomerForm(mergeCustomerForm(seed.customerForm));
    if (seed.finalInfo) setFinalInfo(seed.finalInfo);
    if (seed.issueDate) setIssueDate(seed.issueDate);
    if (seed.customerSignature) setCustomerSignature(seed.customerSignature);
    if (seed.certRef) setCertRef(seed.certRef);
    setEditingDocumentId(seed.documentId);
  }, []);

  const resetWarningNotice = useCallback(() => {
    setCustomerForm(EMPTY_CUSTOMER_FORM);
    setPropertyAddressLine1('');
    setPropertyAddressLine2('');
    setPropertyCity('');
    setPropertyPostCode('');
    setAppliances([]);
    setFinalInfo(EMPTY_WARNING_NOTICE_FINAL_INFO);
    setIssueDate(new Date().toLocaleDateString('en-GB'));
    setCustomerSignature('');
    setCertRef('');
    setEditingDocumentId(null);
    void AsyncStorage.removeItem(WARNING_NOTICE_DRAFT_KEY);
  }, []);

  return <WarningNoticeContext.Provider value={{customerForm, setCustomerForm, propertyAddressLine1, setPropertyAddressLine1, propertyAddressLine2, setPropertyAddressLine2, propertyCity, setPropertyCity, propertyPostCode, setPropertyPostCode, propertyAddress, appliances, addAppliance, updateAppliance, removeAppliance, finalInfo, setFinalInfo, issueDate, setIssueDate, customerSignature, setCustomerSignature, certRef, setCertRef, editingDocumentId, setEditingDocumentId, hydrateFromDuplicate, hydrateForEdit, resetWarningNotice}}>{children}</WarningNoticeContext.Provider>;
}

export function useWarningNotice() {
  const ctx = useContext(WarningNoticeContext);
  if (!ctx) throw new Error('useWarningNotice must be inside WarningNoticeProvider');
  return ctx;
}
