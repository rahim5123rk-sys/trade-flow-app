import AsyncStorage from '@react-native-async-storage/async-storage';
import {router} from 'expo-router';
import React, {useEffect, useState} from 'react';
import {Alert} from 'react-native';
import {CustomerPropertyDetailsStep} from '../../../../components/forms/CustomerPropertyDetailsStep';
import {SiteAddressData} from '../../../../components/forms/SiteAddressSelector';
import {useInstallationCert} from '../../../../src/context/InstallationCertContext';

const INSTALLATION_CERT_DUPLICATE_SEED_KEY = 'installation_cert_duplicate_seed_v1';
const INSTALLATION_CERT_EDIT_SEED_KEY = 'installation_cert_edit_seed_v1';

export default function InstallationIndex() {
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
  } = useInstallationCert();

  const [tenantTitle, setTenantTitle] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');

  useEffect(() => {
    const loadSeed = async () => {
      try {
        const editRaw = await AsyncStorage.getItem(INSTALLATION_CERT_EDIT_SEED_KEY);
        if (editRaw) {
          const parsed = JSON.parse(editRaw);
          hydrateForEdit({
            propertyAddress: parsed?.propertyAddress,
            appliances: parsed?.appliances,
            customerForm: parsed?.customerForm,
            finalInfo: parsed?.finalInfo,
            installationDate: parsed?.installationDate,
            nextServiceDate: parsed?.nextServiceDate,
            customerSignature: parsed?.customerSignature,
            certRef: parsed?.certRef,
            documentId: parsed?.documentId,
          });
          await AsyncStorage.removeItem(INSTALLATION_CERT_EDIT_SEED_KEY);
          Alert.alert('Editing Installation Certificate', 'Previous details have been loaded. Make your changes and save from Review.');
          return;
        }

        const duplicateRaw = await AsyncStorage.getItem(INSTALLATION_CERT_DUPLICATE_SEED_KEY);
        if (!duplicateRaw) return;
        const parsed = JSON.parse(duplicateRaw);
        hydrateFromDuplicate({
          propertyAddress: parsed?.propertyAddress,
          appliances: parsed?.appliances,
          customerForm: parsed?.customerForm,
          finalInfo: parsed?.finalInfo,
          installationDate: parsed?.installationDate,
          nextServiceDate: parsed?.nextServiceDate,
        });
        await AsyncStorage.removeItem(INSTALLATION_CERT_DUPLICATE_SEED_KEY);
        Alert.alert('Installation Certificate Duplicated', 'Customer, property and appliance details have been prefilled. Review them before saving.');
      } catch {
        await AsyncStorage.removeItem(INSTALLATION_CERT_DUPLICATE_SEED_KEY);
        await AsyncStorage.removeItem(INSTALLATION_CERT_EDIT_SEED_KEY);
      }
    };

    void loadSeed();
  }, [hydrateForEdit, hydrateFromDuplicate]);

  const handleNext = () => {
    if (!propertyAddressLine1.trim() || !propertyCity.trim() || !propertyPostCode.trim()) {
      Alert.alert('Missing Info', 'Address Line 1, City and Postcode are required.');
      return;
    }
    router.push('/(app)/forms/installation/details' as any);
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
      title="Installation Certificate"
      subtitle="Gas appliance installation certificate"
      stepLabels={['Details', 'Installation', 'Review']}
      nextButtonLabel="Next: Installation Details"
      customerForm={customerForm}
      onCustomerFormChange={setCustomerForm}
      siteAddress={siteAddress}
      onSiteAddressChange={handleSiteAddressChange}
      onNext={handleNext}
    />
  );
}
