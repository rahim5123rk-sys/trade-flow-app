import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {createContext, useCallback, useContext, useState} from 'react';
import {CustomerFormData, EMPTY_CUSTOMER_FORM} from '../../components/CustomerSelector';
import {EMPTY_INSTALLATION_CERT_FINAL_INFO, InstallationCertAppliance, InstallationCertFinalInfo} from '../types/installationCert';
import {cloneSingleApplianceList, mergeCustomerForm, splitPropertyAddress} from './singleApplianceFormUtils';

export const INSTALLATION_CERT_DRAFT_KEY = 'installation_cert_draft_v1';

interface InstallationCertState {
  customerForm: CustomerFormData;
  propertyAddressLine1: string;
  propertyAddressLine2: string;
  propertyCity: string;
  propertyPostCode: string;
  appliances: InstallationCertAppliance[];
  finalInfo: InstallationCertFinalInfo;
  installationDate: string;
  nextServiceDate: string;
  customerSignature: string;
  certRef: string;
}

interface InstallationCertContextValue extends InstallationCertState {
  setCustomerForm: (value: CustomerFormData) => void;
  setPropertyAddressLine1: (value: string) => void;
  setPropertyAddressLine2: (value: string) => void;
  setPropertyCity: (value: string) => void;
  setPropertyPostCode: (value: string) => void;
  propertyAddress: string;
  addAppliance: (appliance: InstallationCertAppliance) => void;
  updateAppliance: (id: string, appliance: InstallationCertAppliance) => void;
  removeAppliance: (id: string) => void;
  setFinalInfo: (value: InstallationCertFinalInfo) => void;
  setInstallationDate: (value: string) => void;
  setNextServiceDate: (value: string) => void;
  setCustomerSignature: (value: string) => void;
  setCertRef: (value: string) => void;
  editingDocumentId: string | null;
  setEditingDocumentId: (value: string | null) => void;
  hydrateFromDuplicate: (seed: {propertyAddress?: string; appliances?: InstallationCertAppliance[]; customerForm?: Partial<CustomerFormData>; finalInfo?: InstallationCertFinalInfo; installationDate?: string; nextServiceDate?: string;}) => void;
  hydrateForEdit: (seed: {propertyAddress?: string; appliances?: InstallationCertAppliance[]; customerForm?: Partial<CustomerFormData>; finalInfo?: InstallationCertFinalInfo; installationDate?: string; nextServiceDate?: string; customerSignature?: string; certRef?: string; documentId: string;}) => void;
  resetInstallationCert: () => void;
}

const InstallationCertContext = createContext<InstallationCertContextValue | null>(null);

export function InstallationCertProvider({children}: {children: React.ReactNode}) {
  const [customerForm, setCustomerForm] = useState<CustomerFormData>(EMPTY_CUSTOMER_FORM);
  const [propertyAddressLine1, setPropertyAddressLine1] = useState('');
  const [propertyAddressLine2, setPropertyAddressLine2] = useState('');
  const [propertyCity, setPropertyCity] = useState('');
  const [propertyPostCode, setPropertyPostCode] = useState('');
  const [appliances, setAppliances] = useState<InstallationCertAppliance[]>([]);
  const [finalInfo, setFinalInfo] = useState<InstallationCertFinalInfo>(EMPTY_INSTALLATION_CERT_FINAL_INFO);
  const today = new Date().toLocaleDateString('en-GB');
  const next = new Date(); next.setFullYear(next.getFullYear() + 1);
  const [installationDate, setInstallationDate] = useState(today);
  const [nextServiceDate, setNextServiceDate] = useState(next.toLocaleDateString('en-GB'));
  const [customerSignature, setCustomerSignature] = useState('');
  const [certRef, setCertRef] = useState('');
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const propertyAddress = [propertyAddressLine1, propertyAddressLine2, propertyCity, propertyPostCode].filter(Boolean).join(', ');

  const addAppliance = useCallback((appliance: InstallationCertAppliance) => setAppliances([appliance]), []);
  const updateAppliance = useCallback((id: string, appliance: InstallationCertAppliance) => setAppliances((prev) => prev.map((item) => item.id === id ? appliance : item)), []);
  const removeAppliance = useCallback((id: string) => setAppliances((prev) => prev.filter((item) => item.id !== id)), []);

  const hydrateFromDuplicate = useCallback((seed: {propertyAddress?: string; appliances?: InstallationCertAppliance[]; customerForm?: Partial<CustomerFormData>; finalInfo?: InstallationCertFinalInfo; installationDate?: string; nextServiceDate?: string;}) => {
    const property = splitPropertyAddress(seed.propertyAddress);
    setPropertyAddressLine1(property.line1); setPropertyAddressLine2(property.line2); setPropertyCity(property.city); setPropertyPostCode(property.postCode);
    setAppliances(cloneSingleApplianceList(seed.appliances));
    if (seed.customerForm) setCustomerForm(mergeCustomerForm(seed.customerForm));
    if (seed.finalInfo) setFinalInfo(seed.finalInfo);
    if (seed.installationDate) setInstallationDate(seed.installationDate);
    if (seed.nextServiceDate) setNextServiceDate(seed.nextServiceDate);
  }, []);

  const hydrateForEdit = useCallback((seed: {propertyAddress?: string; appliances?: InstallationCertAppliance[]; customerForm?: Partial<CustomerFormData>; finalInfo?: InstallationCertFinalInfo; installationDate?: string; nextServiceDate?: string; customerSignature?: string; certRef?: string; documentId: string;}) => {
    const property = splitPropertyAddress(seed.propertyAddress);
    setPropertyAddressLine1(property.line1); setPropertyAddressLine2(property.line2); setPropertyCity(property.city); setPropertyPostCode(property.postCode);
    setAppliances(cloneSingleApplianceList(seed.appliances));
    if (seed.customerForm) setCustomerForm(mergeCustomerForm(seed.customerForm));
    if (seed.finalInfo) setFinalInfo(seed.finalInfo);
    if (seed.installationDate) setInstallationDate(seed.installationDate);
    if (seed.nextServiceDate) setNextServiceDate(seed.nextServiceDate);
    if (seed.customerSignature) setCustomerSignature(seed.customerSignature);
    if (seed.certRef) setCertRef(seed.certRef);
    setEditingDocumentId(seed.documentId);
  }, []);

  const resetInstallationCert = useCallback(() => {
    setCustomerForm(EMPTY_CUSTOMER_FORM); setPropertyAddressLine1(''); setPropertyAddressLine2(''); setPropertyCity(''); setPropertyPostCode(''); setAppliances([]); setFinalInfo(EMPTY_INSTALLATION_CERT_FINAL_INFO); setInstallationDate(new Date().toLocaleDateString('en-GB')); const nextDate = new Date(); nextDate.setFullYear(nextDate.getFullYear() + 1); setNextServiceDate(nextDate.toLocaleDateString('en-GB')); setCustomerSignature(''); setCertRef(''); setEditingDocumentId(null); void AsyncStorage.removeItem(INSTALLATION_CERT_DRAFT_KEY);
  }, []);

  return <InstallationCertContext.Provider value={{customerForm, setCustomerForm, propertyAddressLine1, setPropertyAddressLine1, propertyAddressLine2, setPropertyAddressLine2, propertyCity, setPropertyCity, propertyPostCode, setPropertyPostCode, propertyAddress, appliances, addAppliance, updateAppliance, removeAppliance, finalInfo, setFinalInfo, installationDate, setInstallationDate, nextServiceDate, setNextServiceDate, customerSignature, setCustomerSignature, certRef, setCertRef, editingDocumentId, setEditingDocumentId, hydrateFromDuplicate, hydrateForEdit, resetInstallationCert}}>{children}</InstallationCertContext.Provider>;
}

export function useInstallationCert() {
  const ctx = useContext(InstallationCertContext);
  if (!ctx) throw new Error('useInstallationCert must be inside InstallationCertProvider');
  return ctx;
}
