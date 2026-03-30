import AsyncStorage from '@react-native-async-storage/async-storage';
import {Stack, useNavigation} from 'expo-router';
import React, {useCallback, useEffect, useRef} from 'react';
import {Alert} from 'react-native';
import {DECOMMISSIONING_DRAFT_KEY, DecommissioningProvider, useDecommissioning} from '../../../../src/context/DecommissioningContext';
import {useAppTheme} from '../../../../src/context/ThemeContext';

const DECOMMISSIONING_DUPLICATE_SEED_KEY = 'decommissioning_duplicate_seed_v1';
const DECOMMISSIONING_EDIT_SEED_KEY = 'decommissioning_edit_seed_v1';

function DecommissioningAutoSave({children}: {children: React.ReactNode}) {
  const {
    customerForm,
    propertyAddress,
    appliances,
    finalInfo,
    decommissionDate,
    customerSignature,
    certRef,
    editingDocumentId,
    hydrateForEdit,
    hydrateFromDuplicate,
  } = useDecommissioning();
  const navigation = useNavigation();
  const restored = useRef(false);

  const saveDraft = useCallback(async () => {
    await AsyncStorage.setItem(DECOMMISSIONING_DRAFT_KEY, JSON.stringify({
      propertyAddress,
      appliances,
      customerForm,
      finalInfo,
      decommissionDate,
      customerSignature,
      certRef,
      editingDocumentId,
      savedAt: Date.now(),
    }));
  }, [customerForm, propertyAddress, appliances, finalInfo, decommissionDate, customerSignature, certRef, editingDocumentId]);

  useEffect(() => {
    const restoreDraft = async () => {
      if (restored.current) return;
      restored.current = true;
      try {
        const editSeed = await AsyncStorage.getItem(DECOMMISSIONING_EDIT_SEED_KEY);
        const duplicateSeed = await AsyncStorage.getItem(DECOMMISSIONING_DUPLICATE_SEED_KEY);
        if (editSeed || duplicateSeed) return;

        const raw = await AsyncStorage.getItem(DECOMMISSIONING_DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (draft.savedAt && Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
          await AsyncStorage.removeItem(DECOMMISSIONING_DRAFT_KEY);
          return;
        }

        Alert.alert(
          'Continue Draft?',
          `Continue the decommissioning draft for "${draft.customerForm?.customerName || 'Customer'}"?`,
          [
            {text: 'Discard', style: 'destructive', onPress: () => void AsyncStorage.removeItem(DECOMMISSIONING_DRAFT_KEY)},
            {
              text: 'Continue',
              onPress: () => {
                if (draft.editingDocumentId) {
                  hydrateForEdit({
                    propertyAddress: draft.propertyAddress,
                    appliances: draft.appliances,
                    customerForm: draft.customerForm,
                    finalInfo: draft.finalInfo,
                    decommissionDate: draft.decommissionDate,
                    customerSignature: draft.customerSignature,
                    certRef: draft.certRef,
                    documentId: draft.editingDocumentId,
                  });
                } else {
                  hydrateFromDuplicate({
                    propertyAddress: draft.propertyAddress,
                    appliances: draft.appliances,
                    customerForm: draft.customerForm,
                    finalInfo: draft.finalInfo,
                    decommissionDate: draft.decommissionDate,
                  });
                }
                void AsyncStorage.removeItem(DECOMMISSIONING_DRAFT_KEY);
              },
            },
          ],
        );
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

export default function DecommissioningLayout() {
  const {theme} = useAppTheme();
  return (
    <DecommissioningProvider>
      <DecommissioningAutoSave>
        <Stack screenOptions={{headerShown: false, gestureEnabled: false, contentStyle: {backgroundColor: theme.surface.base}}}>
          <Stack.Screen name="index" />
          <Stack.Screen name="decommission" />
          <Stack.Screen name="review-sign" />
        </Stack>
      </DecommissioningAutoSave>
    </DecommissioningProvider>
  );
}
