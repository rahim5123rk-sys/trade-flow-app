import AsyncStorage from '@react-native-async-storage/async-storage';
import {Stack, useNavigation} from 'expo-router';
import React, {useCallback, useEffect, useRef} from 'react';
import {Alert} from 'react-native';
import {COMMISSIONING_DRAFT_KEY, CommissioningProvider, useCommissioning} from '../../../../src/context/CommissioningContext';
import {useAppTheme} from '../../../../src/context/ThemeContext';

const COMMISSIONING_DUPLICATE_SEED_KEY = 'commissioning_duplicate_seed_v1';
const COMMISSIONING_EDIT_SEED_KEY = 'commissioning_edit_seed_v1';

function CommissioningAutoSave({children}: {children: React.ReactNode}) {
  const {
    customerForm,
    propertyAddress,
    appliances,
    finalInfo,
    commissioningDate,
    nextServiceDate,
    customerSignature,
    certRef,
    editingDocumentId,
    hydrateForEdit,
    hydrateFromDuplicate,
  } = useCommissioning();
  const navigation = useNavigation();
  const restored = useRef(false);

  const saveDraft = useCallback(async () => {
    if (!customerForm.customerName.trim()) {
      await AsyncStorage.removeItem(COMMISSIONING_DRAFT_KEY);
      return;
    }

    await AsyncStorage.setItem(COMMISSIONING_DRAFT_KEY, JSON.stringify({
      propertyAddress,
      appliances,
      customerForm,
      finalInfo,
      commissioningDate,
      nextServiceDate,
      customerSignature,
      certRef,
      editingDocumentId,
      savedAt: Date.now(),
    }));
  }, [customerForm, propertyAddress, appliances, finalInfo, commissioningDate, nextServiceDate, customerSignature, certRef, editingDocumentId]);

  useEffect(() => {
    const restoreDraft = async () => {
      if (restored.current) return;
      restored.current = true;
      try {
        const editSeed = await AsyncStorage.getItem(COMMISSIONING_EDIT_SEED_KEY);
        const duplicateSeed = await AsyncStorage.getItem(COMMISSIONING_DUPLICATE_SEED_KEY);
        if (editSeed || duplicateSeed) return;

        const raw = await AsyncStorage.getItem(COMMISSIONING_DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (draft.savedAt && Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
          await AsyncStorage.removeItem(COMMISSIONING_DRAFT_KEY);
          return;
        }

        Alert.alert(
          'Continue Draft?',
          `Continue the commissioning draft for "${draft.customerForm?.customerName || 'Customer'}"?`,
          [
            {text: 'Discard', style: 'destructive', onPress: () => void AsyncStorage.removeItem(COMMISSIONING_DRAFT_KEY)},
            {
              text: 'Continue',
              onPress: () => {
                if (draft.editingDocumentId) {
                  hydrateForEdit({
                    propertyAddress: draft.propertyAddress,
                    appliances: draft.appliances,
                    customerForm: draft.customerForm,
                    finalInfo: draft.finalInfo,
                    commissioningDate: draft.commissioningDate,
                    nextServiceDate: draft.nextServiceDate,
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
                    commissioningDate: draft.commissioningDate,
                    nextServiceDate: draft.nextServiceDate,
                  });
                }
                void AsyncStorage.removeItem(COMMISSIONING_DRAFT_KEY);
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

export default function CommissioningLayout() {
  const {theme} = useAppTheme();
  return (
    <CommissioningProvider>
      <CommissioningAutoSave>
        <Stack screenOptions={{headerShown: false, gestureEnabled: false, contentStyle: {backgroundColor: theme.surface.base}}}>
          <Stack.Screen name="index" />
          <Stack.Screen name="details" />
          <Stack.Screen name="review-sign" />
        </Stack>
      </CommissioningAutoSave>
    </CommissioningProvider>
  );
}
