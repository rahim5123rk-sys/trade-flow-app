import AsyncStorage from '@react-native-async-storage/async-storage';
import {router} from 'expo-router';
import React, {useEffect} from 'react';
import {Alert} from 'react-native';
import {CustomerPropertyDetailsStep} from '../../../../components/forms/CustomerPropertyDetailsStep';
import {useDecommissioning} from '../../../../src/context/DecommissioningContext';

const DECOMMISSIONING_DUPLICATE_SEED_KEY = 'decommissioning_duplicate_seed_v1';
const DECOMMISSIONING_EDIT_SEED_KEY = 'decommissioning_edit_seed_v1';

export default function DecommissioningIndex() {
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
  } = useDecommissioning();

  useEffect(() => {
    const loadSeed = async () => {
      try {
        const editRaw = await AsyncStorage.getItem(DECOMMISSIONING_EDIT_SEED_KEY);
        if (editRaw) {
          const parsed = JSON.parse(editRaw);
          hydrateForEdit({
            propertyAddress: parsed?.propertyAddress,
            appliances: parsed?.appliances,
            customerForm: parsed?.customerForm,
            finalInfo: parsed?.finalInfo,
            decommissionDate: parsed?.decommissionDate,
            customerSignature: parsed?.customerSignature,
            certRef: parsed?.certRef,
            documentId: parsed?.documentId,
          });
          await AsyncStorage.removeItem(DECOMMISSIONING_EDIT_SEED_KEY);
          Alert.alert('Editing Decommissioning Certificate', 'Previous details have been loaded. Make your changes and save from Review.');
          return;
        }

        const duplicateRaw = await AsyncStorage.getItem(DECOMMISSIONING_DUPLICATE_SEED_KEY);
        if (!duplicateRaw) return;
        const parsed = JSON.parse(duplicateRaw);
        hydrateFromDuplicate({
          propertyAddress: parsed?.propertyAddress,
          appliances: parsed?.appliances,
          customerForm: parsed?.customerForm,
          finalInfo: parsed?.finalInfo,
          decommissionDate: parsed?.decommissionDate,
        });
        await AsyncStorage.removeItem(DECOMMISSIONING_DUPLICATE_SEED_KEY);
        Alert.alert('Decommissioning Duplicated', 'Customer, property and appliance details have been prefilled. Review them before saving.');
      } catch {
        await AsyncStorage.removeItem(DECOMMISSIONING_DUPLICATE_SEED_KEY);
        await AsyncStorage.removeItem(DECOMMISSIONING_EDIT_SEED_KEY);
      }
    };

    void loadSeed();
  }, [hydrateForEdit, hydrateFromDuplicate]);

  const handleNext = () => {
    if (!customerForm.customerName.trim()) {
      Alert.alert('Missing Info', 'Please enter the customer name.');
      return;
    }
    if (!propertyAddressLine1.trim() || !propertyCity.trim() || !propertyPostCode.trim()) {
      Alert.alert('Missing Info', 'Address Line 1, City and Postcode are required.');
      return;
    }
    router.push('/(app)/forms/decommissioning/decommission' as any);
  };

  const handleUseCustomerAddress = () => {
    if (!customerForm.addressLine1 && !customerForm.city && !customerForm.postCode) {
      Alert.alert('No Address', 'Enter a customer address first.');
      return;
    }
    setPropertyAddressLine1(customerForm.addressLine1);
    setPropertyAddressLine2(customerForm.addressLine2);
    setPropertyCity(customerForm.city);
    setPropertyPostCode(customerForm.postCode);
  };

  return (
    <CustomerPropertyDetailsStep
      title="Decommissioning"
      subtitle="Gas appliance decommissioning certificate"
      stepLabels={['Details', 'Decommission', 'Review']}
      nextButtonLabel="Next: Decommission Details"
      customerForm={customerForm}
      onCustomerFormChange={setCustomerForm}
      propertyAddressLine1={propertyAddressLine1}
      onPropertyAddressLine1Change={setPropertyAddressLine1}
      propertyAddressLine2={propertyAddressLine2}
      onPropertyAddressLine2Change={setPropertyAddressLine2}
      propertyCity={propertyCity}
      onPropertyCityChange={setPropertyCity}
      propertyPostCode={propertyPostCode}
      onPropertyPostCodeChange={setPropertyPostCode}
      propertyAddress={propertyAddress}
      onUseCustomerAddress={handleUseCustomerAddress}
      onNext={handleNext}
    />
  );
}
