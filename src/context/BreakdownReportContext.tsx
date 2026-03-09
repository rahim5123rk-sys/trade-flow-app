import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {createContext, useCallback, useContext, useState} from 'react';
import {CustomerFormData, EMPTY_CUSTOMER_FORM} from '../../components/CustomerSelector';
import {BreakdownReportAppliance, BreakdownReportFinalInfo, EMPTY_BREAKDOWN_REPORT_FINAL_INFO} from '../types/breakdownReport';
import {cloneSingleApplianceList, mergeCustomerForm, splitPropertyAddress} from './singleApplianceFormUtils';

export const BREAKDOWN_REPORT_DRAFT_KEY = 'breakdown_report_draft_v1';

interface BreakdownReportState {
  customerForm: CustomerFormData;
  propertyAddressLine1: string;
  propertyAddressLine2: string;
  propertyCity: string;
  propertyPostCode: string;
  appliances: BreakdownReportAppliance[];
  finalInfo: BreakdownReportFinalInfo;
  reportDate: string;
  customerSignature: string;
  certRef: string;
}

interface BreakdownReportContextValue extends BreakdownReportState {
  setCustomerForm: (value: CustomerFormData) => void;
  setPropertyAddressLine1: (value: string) => void;
  setPropertyAddressLine2: (value: string) => void;
  setPropertyCity: (value: string) => void;
  setPropertyPostCode: (value: string) => void;
  propertyAddress: string;
  addAppliance: (appliance: BreakdownReportAppliance) => void;
  updateAppliance: (id: string, appliance: BreakdownReportAppliance) => void;
  removeAppliance: (id: string) => void;
  setFinalInfo: (value: BreakdownReportFinalInfo) => void;
  setReportDate: (value: string) => void;
  setCustomerSignature: (value: string) => void;
  setCertRef: (value: string) => void;
  editingDocumentId: string | null;
  setEditingDocumentId: (value: string | null) => void;
  hydrateFromDuplicate: (seed: {propertyAddress?: string; appliances?: BreakdownReportAppliance[]; customerForm?: Partial<CustomerFormData>; finalInfo?: BreakdownReportFinalInfo; reportDate?: string;}) => void;
  hydrateForEdit: (seed: {propertyAddress?: string; appliances?: BreakdownReportAppliance[]; customerForm?: Partial<CustomerFormData>; finalInfo?: BreakdownReportFinalInfo; reportDate?: string; customerSignature?: string; certRef?: string; documentId: string;}) => void;
  resetBreakdownReport: () => void;
}

const BreakdownReportContext = createContext<BreakdownReportContextValue | null>(null);

export function BreakdownReportProvider({children}: {children: React.ReactNode}) {
  const [customerForm, setCustomerForm] = useState<CustomerFormData>(EMPTY_CUSTOMER_FORM);
  const [propertyAddressLine1, setPropertyAddressLine1] = useState('');
  const [propertyAddressLine2, setPropertyAddressLine2] = useState('');
  const [propertyCity, setPropertyCity] = useState('');
  const [propertyPostCode, setPropertyPostCode] = useState('');
  const [appliances, setAppliances] = useState<BreakdownReportAppliance[]>([]);
  const [finalInfo, setFinalInfo] = useState<BreakdownReportFinalInfo>(EMPTY_BREAKDOWN_REPORT_FINAL_INFO);
  const [reportDate, setReportDate] = useState(new Date().toLocaleDateString('en-GB'));
  const [customerSignature, setCustomerSignature] = useState('');
  const [certRef, setCertRef] = useState('');
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const propertyAddress = [propertyAddressLine1, propertyAddressLine2, propertyCity, propertyPostCode].filter(Boolean).join(', ');

  const addAppliance = useCallback((appliance: BreakdownReportAppliance) => setAppliances([appliance]), []);
  const updateAppliance = useCallback((id: string, appliance: BreakdownReportAppliance) => setAppliances((prev) => prev.map((item) => item.id === id ? appliance : item)), []);
  const removeAppliance = useCallback((id: string) => setAppliances((prev) => prev.filter((item) => item.id !== id)), []);

  const hydrateFromDuplicate = useCallback((seed: {propertyAddress?: string; appliances?: BreakdownReportAppliance[]; customerForm?: Partial<CustomerFormData>; finalInfo?: BreakdownReportFinalInfo; reportDate?: string;}) => {
    const property = splitPropertyAddress(seed.propertyAddress);
    setPropertyAddressLine1(property.line1); setPropertyAddressLine2(property.line2); setPropertyCity(property.city); setPropertyPostCode(property.postCode);
    setAppliances(cloneSingleApplianceList(seed.appliances));
    if (seed.customerForm) setCustomerForm(mergeCustomerForm(seed.customerForm));
    if (seed.finalInfo) setFinalInfo(seed.finalInfo);
    if (seed.reportDate) setReportDate(seed.reportDate);
  }, []);

  const hydrateForEdit = useCallback((seed: {propertyAddress?: string; appliances?: BreakdownReportAppliance[]; customerForm?: Partial<CustomerFormData>; finalInfo?: BreakdownReportFinalInfo; reportDate?: string; customerSignature?: string; certRef?: string; documentId: string;}) => {
    const property = splitPropertyAddress(seed.propertyAddress);
    setPropertyAddressLine1(property.line1); setPropertyAddressLine2(property.line2); setPropertyCity(property.city); setPropertyPostCode(property.postCode);
    setAppliances(cloneSingleApplianceList(seed.appliances));
    if (seed.customerForm) setCustomerForm(mergeCustomerForm(seed.customerForm));
    if (seed.finalInfo) setFinalInfo(seed.finalInfo);
    if (seed.reportDate) setReportDate(seed.reportDate);
    if (seed.customerSignature) setCustomerSignature(seed.customerSignature);
    if (seed.certRef) setCertRef(seed.certRef);
    setEditingDocumentId(seed.documentId);
  }, []);

  const resetBreakdownReport = useCallback(() => {
    setCustomerForm(EMPTY_CUSTOMER_FORM); setPropertyAddressLine1(''); setPropertyAddressLine2(''); setPropertyCity(''); setPropertyPostCode('');
    setAppliances([]); setFinalInfo(EMPTY_BREAKDOWN_REPORT_FINAL_INFO); setReportDate(new Date().toLocaleDateString('en-GB')); setCustomerSignature(''); setCertRef(''); setEditingDocumentId(null);
    void AsyncStorage.removeItem(BREAKDOWN_REPORT_DRAFT_KEY);
  }, []);

  return <BreakdownReportContext.Provider value={{customerForm, setCustomerForm, propertyAddressLine1, setPropertyAddressLine1, propertyAddressLine2, setPropertyAddressLine2, propertyCity, setPropertyCity, propertyPostCode, setPropertyPostCode, propertyAddress, appliances, addAppliance, updateAppliance, removeAppliance, finalInfo, setFinalInfo, reportDate, setReportDate, customerSignature, setCustomerSignature, certRef, setCertRef, editingDocumentId, setEditingDocumentId, hydrateFromDuplicate, hydrateForEdit, resetBreakdownReport}}>{children}</BreakdownReportContext.Provider>;
}

export function useBreakdownReport() {
  const ctx = useContext(BreakdownReportContext);
  if (!ctx) throw new Error('useBreakdownReport must be inside BreakdownReportProvider');
  return ctx;
}
