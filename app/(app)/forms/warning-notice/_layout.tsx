import AsyncStorage from '@react-native-async-storage/async-storage';
import {Stack, useNavigation} from 'expo-router';
import React, {useCallback, useEffect, useRef} from 'react';
import {Alert} from 'react-native';
import {useAppTheme} from '../../../../src/context/ThemeContext';
import {WARNING_NOTICE_DRAFT_KEY, WarningNoticeProvider, useWarningNotice} from '../../../../src/context/WarningNoticeContext';

const WARNING_NOTICE_DUPLICATE_SEED_KEY = 'warning_notice_duplicate_seed_v1';
const WARNING_NOTICE_EDIT_SEED_KEY = 'warning_notice_edit_seed_v1';

function WarningNoticeAutoSave({children}: {children: React.ReactNode}) {
  const {
    customerForm,
    propertyAddress,
    appliances,
    finalInfo,
    issueDate,
    customerSignature,
    certRef,
    editingDocumentId,
    hydrateForEdit,
    hydrateFromDuplicate,
  } = useWarningNotice();
  const navigation = useNavigation();
  const restored = useRef(false);

  const saveDraft = useCallback(async () => {
    await AsyncStorage.setItem(WARNING_NOTICE_DRAFT_KEY, JSON.stringify({
      propertyAddress,
      appliances,
      customerForm,
      finalInfo,
      issueDate,
      customerSignature,
      certRef,
      editingDocumentId,
      savedAt: Date.now(),
    }));
  }, [customerForm, propertyAddress, appliances, finalInfo, issueDate, customerSignature, certRef, editingDocumentId]);

  useEffect(() => {
    const restoreDraft = async () => {
      if (restored.current) return;
      restored.current = true;
      try {
        const editSeed = await AsyncStorage.getItem(WARNING_NOTICE_EDIT_SEED_KEY);
        const duplicateSeed = await AsyncStorage.getItem(WARNING_NOTICE_DUPLICATE_SEED_KEY);
        if (editSeed || duplicateSeed) return;

        const raw = await AsyncStorage.getItem(WARNING_NOTICE_DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (draft.savedAt && Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
          await AsyncStorage.removeItem(WARNING_NOTICE_DRAFT_KEY);
          return;
        }

        Alert.alert(
          'Continue Draft?',
          `Continue the warning notice draft for "${draft.customerForm?.customerName || 'Customer'}"?`,
          [
            {text: 'Discard', style: 'destructive', onPress: () => void AsyncStorage.removeItem(WARNING_NOTICE_DRAFT_KEY)},
            {
              text: 'Continue',
              onPress: () => {
                if (draft.editingDocumentId) {
                  hydrateForEdit({
                    propertyAddress: draft.propertyAddress,
                    appliances: draft.appliances,
                    customerForm: draft.customerForm,
                    finalInfo: draft.finalInfo,
                    issueDate: draft.issueDate,
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
                    issueDate: draft.issueDate,
                  });
                }
                void AsyncStorage.removeItem(WARNING_NOTICE_DRAFT_KEY);
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

export default function WarningNoticeLayout() {
  const {theme} = useAppTheme();

  return (
    <WarningNoticeProvider>
      <WarningNoticeAutoSave>
        <Stack screenOptions={{headerShown: false, gestureEnabled: false, contentStyle: {backgroundColor: theme.surface.base}}}>
          <Stack.Screen name="index" />
          <Stack.Screen name="hazard" />
          <Stack.Screen name="review-sign" />
        </Stack>
      </WarningNoticeAutoSave>
    </WarningNoticeProvider>
  );
}
