import AsyncStorage from '@react-native-async-storage/async-storage';
import {Stack, useNavigation} from 'expo-router';
import React, {useCallback, useEffect, useRef} from 'react';
import {Alert} from 'react-native';
import {BREAKDOWN_REPORT_DRAFT_KEY, BreakdownReportProvider, useBreakdownReport} from '../../../../src/context/BreakdownReportContext';
import {useAppTheme} from '../../../../src/context/ThemeContext';

const BREAKDOWN_REPORT_DUPLICATE_SEED_KEY = 'breakdown_report_duplicate_seed_v1';
const BREAKDOWN_REPORT_EDIT_SEED_KEY = 'breakdown_report_edit_seed_v1';

function BreakdownAutoSave({children}: {children: React.ReactNode}) {
  const {customerForm, propertyAddress, appliances, finalInfo, reportDate, customerSignature, certRef, editingDocumentId, hydrateForEdit, hydrateFromDuplicate} = useBreakdownReport();
  const navigation = useNavigation();
  const restored = useRef(false);

  const saveDraft = useCallback(async () => {
    await AsyncStorage.setItem(BREAKDOWN_REPORT_DRAFT_KEY, JSON.stringify({propertyAddress, appliances, customerForm, finalInfo, reportDate, customerSignature, certRef, editingDocumentId, savedAt: Date.now()}));
  }, [customerForm, propertyAddress, appliances, finalInfo, reportDate, customerSignature, certRef, editingDocumentId]);

  useEffect(() => {
    const restoreDraft = async () => {
      if (restored.current) return;
      restored.current = true;
      try {
        const editSeed = await AsyncStorage.getItem(BREAKDOWN_REPORT_EDIT_SEED_KEY);
        const duplicateSeed = await AsyncStorage.getItem(BREAKDOWN_REPORT_DUPLICATE_SEED_KEY);
        if (editSeed || duplicateSeed) return;
        const raw = await AsyncStorage.getItem(BREAKDOWN_REPORT_DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (draft.savedAt && Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
          await AsyncStorage.removeItem(BREAKDOWN_REPORT_DRAFT_KEY);
          return;
        }
        Alert.alert('Continue Draft?', `Continue the breakdown report draft for "${draft.customerForm?.customerName || 'Customer'}"?`, [
          {text: 'Discard', style: 'destructive', onPress: () => void AsyncStorage.removeItem(BREAKDOWN_REPORT_DRAFT_KEY)},
          {
            text: 'Continue', onPress: () => {
              if (draft.editingDocumentId) {
                hydrateForEdit({propertyAddress: draft.propertyAddress, appliances: draft.appliances, customerForm: draft.customerForm, finalInfo: draft.finalInfo, reportDate: draft.reportDate, customerSignature: draft.customerSignature, certRef: draft.certRef, documentId: draft.editingDocumentId});
              } else {
                hydrateFromDuplicate({propertyAddress: draft.propertyAddress, appliances: draft.appliances, customerForm: draft.customerForm, finalInfo: draft.finalInfo, reportDate: draft.reportDate});
              }
              void AsyncStorage.removeItem(BREAKDOWN_REPORT_DRAFT_KEY);
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

export default function BreakdownLayout() {
  const {theme} = useAppTheme();
  return (
    <BreakdownReportProvider>
      <BreakdownAutoSave>
        <Stack screenOptions={{headerShown: false, gestureEnabled: false, contentStyle: {backgroundColor: theme.surface.base}}}>
          <Stack.Screen name="index" />
          <Stack.Screen name="details" />
          <Stack.Screen name="review-sign" />
        </Stack>
      </BreakdownAutoSave>
    </BreakdownReportProvider>
  );
}
