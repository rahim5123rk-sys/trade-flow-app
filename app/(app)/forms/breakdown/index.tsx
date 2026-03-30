import AsyncStorage from '@react-native-async-storage/async-storage';
import {router} from 'expo-router';
import React, {useEffect, useState} from 'react';
import {Alert} from 'react-native';
import {CustomerPropertyDetailsStep} from '../../../../components/forms/CustomerPropertyDetailsStep';
import {SiteAddressData} from '../../../../components/forms/SiteAddressSelector';
import {useBreakdownReport} from '../../../../src/context/BreakdownReportContext';

const BREAKDOWN_REPORT_DUPLICATE_SEED_KEY = 'breakdown_report_duplicate_seed_v1';
const BREAKDOWN_REPORT_EDIT_SEED_KEY = 'breakdown_report_edit_seed_v1';

export default function BreakdownIndex() {
  const {
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
    hydrateFromDuplicate,
    hydrateForEdit,
  } = useBreakdownReport();

  const [tenantTitle, setTenantTitle] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');

  useEffect(() => {
    const loadSeed = async () => {
      try {
        const editRaw = await AsyncStorage.getItem(BREAKDOWN_REPORT_EDIT_SEED_KEY);
        if (editRaw) {
          const parsed = JSON.parse(editRaw);
          hydrateForEdit({
            propertyAddress: parsed?.propertyAddress,
            appliances: parsed?.appliances,
            customerForm: parsed?.customerForm,
            finalInfo: parsed?.finalInfo,
            reportDate: parsed?.reportDate,
            customerSignature: parsed?.customerSignature,
            certRef: parsed?.certRef,
            documentId: parsed?.documentId,
          });
          await AsyncStorage.removeItem(BREAKDOWN_REPORT_EDIT_SEED_KEY);
          Alert.alert('Editing Breakdown Report', 'Previous details have been loaded. Make your changes and save from Review.');
          return;
        }

        const duplicateRaw = await AsyncStorage.getItem(BREAKDOWN_REPORT_DUPLICATE_SEED_KEY);
        if (!duplicateRaw) return;
        const parsed = JSON.parse(duplicateRaw);
        hydrateFromDuplicate({
          propertyAddress: parsed?.propertyAddress,
          appliances: parsed?.appliances,
          customerForm: parsed?.customerForm,
          finalInfo: parsed?.finalInfo,
          reportDate: parsed?.reportDate,
        });
        await AsyncStorage.removeItem(BREAKDOWN_REPORT_DUPLICATE_SEED_KEY);
        Alert.alert('Breakdown Report Duplicated', 'Customer, property and appliance details have been prefilled. Review them before saving.');
      } catch {
        await AsyncStorage.removeItem(BREAKDOWN_REPORT_DUPLICATE_SEED_KEY);
        await AsyncStorage.removeItem(BREAKDOWN_REPORT_EDIT_SEED_KEY);
      }
    };

    void loadSeed();
  }, [hydrateForEdit, hydrateFromDuplicate]);

  const handleNext = () => {
    if (!propertyAddressLine1.trim() || !propertyCity.trim() || !propertyPostCode.trim()) {
      Alert.alert('Missing Info', 'Address Line 1, City and Postcode are required.');
      return;
    }
    router.push('/(app)/forms/breakdown/details' as any);
  };

  const siteAddress: SiteAddressData = {
    tenantTitle, tenantName, tenantEmail, tenantPhone,
    addressLine1: propertyAddressLine1, addressLine2: propertyAddressLine2,
    city: propertyCity, postCode: propertyPostCode,
  };

  const handleSiteAddressChange = (data: SiteAddressData) => {
    setPropertyAddressLine1(data.addressLine1);
    setPropertyAddressLine2(data.addressLine2);
    setPropertyCity(data.city);
    setPropertyPostCode(data.postCode);
    setTenantTitle(data.tenantTitle);
    setTenantName(data.tenantName);
    setTenantEmail(data.tenantEmail);
    setTenantPhone(data.tenantPhone);
  };

  return (
    <CustomerPropertyDetailsStep
      title="Breakdown Report"
      subtitle="Gas appliance breakdown and repair record"
      stepLabels={['Details', 'Repair', 'Review']}
      nextButtonLabel="Next: Breakdown Details"
      customerForm={customerForm}
      onCustomerFormChange={setCustomerForm}
      siteAddress={siteAddress}
      onSiteAddressChange={handleSiteAddressChange}
      onNext={handleNext}
    />
  );
}
