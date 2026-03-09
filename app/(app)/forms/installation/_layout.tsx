import AsyncStorage from '@react-native-async-storage/async-storage';
import {Stack, useNavigation} from 'expo-router';
import React, {useCallback, useEffect, useRef} from 'react';
import {Alert} from 'react-native';
import {INSTALLATION_CERT_DRAFT_KEY, InstallationCertProvider, useInstallationCert} from '../../../../src/context/InstallationCertContext';
import {useAppTheme} from '../../../../src/context/ThemeContext';

const INSTALLATION_CERT_DUPLICATE_SEED_KEY = 'installation_cert_duplicate_seed_v1';
const INSTALLATION_CERT_EDIT_SEED_KEY = 'installation_cert_edit_seed_v1';

function InstallationAutoSave({children}: {children: React.ReactNode}) {
  const {customerForm, propertyAddress, appliances, finalInfo, installationDate, nextServiceDate, customerSignature, certRef, editingDocumentId, hydrateForEdit, hydrateFromDuplicate} = useInstallationCert();
  const navigation = useNavigation();
  const restored = useRef(false);

  const saveDraft = useCallback(async () => {
    if (!customerForm.customerName.trim()) {
      await AsyncStorage.removeItem(INSTALLATION_CERT_DRAFT_KEY);
      return;
    }
    await AsyncStorage.setItem(INSTALLATION_CERT_DRAFT_KEY, JSON.stringify({propertyAddress, appliances, customerForm, finalInfo, installationDate, nextServiceDate, customerSignature, certRef, editingDocumentId, savedAt: Date.now()}));
  }, [customerForm, propertyAddress, appliances, finalInfo, installationDate, nextServiceDate, customerSignature, certRef, editingDocumentId]);

  useEffect(() => {
    const restoreDraft = async () => {
      if (restored.current) return;
      restored.current = true;
      try {
        const editSeed = await AsyncStorage.getItem(INSTALLATION_CERT_EDIT_SEED_KEY);
        const duplicateSeed = await AsyncStorage.getItem(INSTALLATION_CERT_DUPLICATE_SEED_KEY);
        if (editSeed || duplicateSeed) return;
        const raw = await AsyncStorage.getItem(INSTALLATION_CERT_DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (draft.savedAt && Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
          await AsyncStorage.removeItem(INSTALLATION_CERT_DRAFT_KEY);
          return;
        }
        Alert.alert('Continue Draft?', `Continue the installation certificate draft for "${draft.customerForm?.customerName || 'Customer'}"?`, [
          {text: 'Discard', style: 'destructive', onPress: () => void AsyncStorage.removeItem(INSTALLATION_CERT_DRAFT_KEY)},
          {
            text: 'Continue', onPress: () => {
              if (draft.editingDocumentId) {
                hydrateForEdit({propertyAddress: draft.propertyAddress, appliances: draft.appliances, customerForm: draft.customerForm, finalInfo: draft.finalInfo, installationDate: draft.installationDate, nextServiceDate: draft.nextServiceDate, customerSignature: draft.customerSignature, certRef: draft.certRef, documentId: draft.editingDocumentId});
              } else {
                hydrateFromDuplicate({propertyAddress: draft.propertyAddress, appliances: draft.appliances, customerForm: draft.customerForm, finalInfo: draft.finalInfo, installationDate: draft.installationDate, nextServiceDate: draft.nextServiceDate});
              }
              void AsyncStorage.removeItem(INSTALLATION_CERT_DRAFT_KEY);
            }
          },
        ]);
      } catch {
        // ignore draft restore failures
      }
    };

    void restoreDraft();
  }, [hydrateForEdit, hydrateFromDuplicate]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      void saveDraft();
    });
    return unsubscribe;
  }, [navigation, saveDraft]);

  return <>{children}</>;
}

export default function InstallationLayout() {
  const {theme} = useAppTheme();
  return (
    <InstallationCertProvider>
      <InstallationAutoSave>
        <Stack screenOptions={{headerShown: false, contentStyle: {backgroundColor: theme.surface.base}}}>
          <Stack.Screen name="index" />
          <Stack.Screen name="installation" />
          <Stack.Screen name="review-sign" />
        </Stack>
      </InstallationAutoSave>
    </InstallationCertProvider>
  );
}
