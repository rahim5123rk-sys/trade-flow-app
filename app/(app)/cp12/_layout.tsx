// ============================================
// FILE: app/(app)/cp12/_layout.tsx
// Stack layout for CP12 multi-step flow
// ============================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import {Stack, useNavigation} from 'expo-router';
import React, {useCallback, useEffect, useRef} from 'react';
import {Alert} from 'react-native';
import {CP12Provider, useCP12} from '../../../src/context/CP12Context';
import {useAppTheme} from '../../../src/context/ThemeContext';

const CP12_DRAFT_KEY = 'cp12_draft_v1';

/**
 * Inner component that has access to CP12Context for auto-save.
 * Saves current form state as a draft when the user navigates away
 * without completing. Restores from draft on next visit.
 */
function CP12AutoSave({children}: {children: React.ReactNode}) {
  const {
    landlordForm,
    tenantTitle,
    tenantName,
    tenantEmail,
    tenantPhone,
    tenantAddressLine1,
    tenantAddressLine2,
    tenantCity,
    tenantPostCode,
    appliances,
    finalChecks,
    inspectionDate,
    nextDueDate,
    renewalReminderEnabled,
    customerSignature,
    certRef,
    editingDocumentId,
    hydrateForEdit,
    hydrateFromDuplicate,
    setFinalChecks,
    setInspectionDate,
    setNextDueDate,
    setCustomerSignature,
    setCertRef,
    setEditingDocumentId,
  } = useCP12();

  const navigation = useNavigation();
  const hasRestoredDraft = useRef(false);

  // Save draft state on unmount / blur
  const saveDraft = useCallback(async () => {
    // Only save draft if customer details have been entered
    const hasCustomerDetails = landlordForm.customerName.trim().length > 0;
    if (!hasCustomerDetails) {
      await AsyncStorage.removeItem(CP12_DRAFT_KEY);
      return;
    }

    const propertyAddress = [tenantAddressLine1, tenantAddressLine2, tenantCity, tenantPostCode]
      .filter(Boolean)
      .join(', ');

    const draft = {
      propertyAddress,
      appliances,
      landlordForm: {
        customerName: landlordForm.customerName || '',
        customerCompany: landlordForm.customerCompany || '',
        customerId: landlordForm.customerId || '',
        addressLine1: landlordForm.addressLine1 || '',
        addressLine2: landlordForm.addressLine2 || '',
        city: landlordForm.city || '',
        postCode: landlordForm.postCode || '',
        email: landlordForm.email || '',
        phone: landlordForm.phone || '',
      },
      tenantTitle,
      tenantName,
      tenantEmail,
      tenantPhone,
      nextDueDate,
      renewalReminderEnabled,
      inspectionDate,
      finalChecks,
      customerSignature,
      certRef,
      editingDocumentId,
      savedAt: Date.now(),
    };

    await AsyncStorage.setItem(CP12_DRAFT_KEY, JSON.stringify(draft));
  }, [
    landlordForm, tenantTitle, tenantName, tenantEmail, tenantPhone,
    tenantAddressLine1, tenantAddressLine2, tenantCity, tenantPostCode,
    appliances, finalChecks, inspectionDate, nextDueDate, renewalReminderEnabled,
    customerSignature, certRef, editingDocumentId,
  ]);

  // Restore draft on mount (only if no edit/duplicate seed is present)
  useEffect(() => {
    const restoreDraft = async () => {
      if (hasRestoredDraft.current) return;
      hasRestoredDraft.current = true;

      try {
        // Don't restore if there's an edit or duplicate seed pending
        const editSeed = await AsyncStorage.getItem('cp12_edit_seed_v1');
        const dupSeed = await AsyncStorage.getItem('cp12_duplicate_seed_v1');
        if (editSeed || dupSeed) return;

        const raw = await AsyncStorage.getItem(CP12_DRAFT_KEY);
        if (!raw) return;

        const draft = JSON.parse(raw);
        // Only restore drafts less than 24 hours old
        if (draft.savedAt && Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
          await AsyncStorage.removeItem(CP12_DRAFT_KEY);
          return;
        }

        const customerName = draft.landlordForm?.customerName || draft.tenantName || 'Unknown';

        // Ask the user before restoring
        Alert.alert(
          'Continue Draft?',
          `You started a draft for "${customerName}". Would you like to continue where you left off?`,
          [
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => void AsyncStorage.removeItem(CP12_DRAFT_KEY),
            },
            {
              text: 'Continue',
              onPress: () => {
                // Hydrate form from draft
                if (draft.editingDocumentId) {
                  hydrateForEdit({
                    propertyAddress: draft.propertyAddress,
                    appliances: draft.appliances,
                    landlordForm: draft.landlordForm,
                    tenantTitle: draft.tenantTitle,
                    tenantName: draft.tenantName,
                    tenantEmail: draft.tenantEmail,
                    tenantPhone: draft.tenantPhone,
                    nextDueDate: draft.nextDueDate,
                    renewalReminderEnabled: draft.renewalReminderEnabled,
                    inspectionDate: draft.inspectionDate,
                    finalChecks: draft.finalChecks,
                    customerSignature: draft.customerSignature,
                    certRef: draft.certRef,
                    documentId: draft.editingDocumentId,
                  });
                } else {
                  hydrateFromDuplicate({
                    propertyAddress: draft.propertyAddress,
                    appliances: draft.appliances,
                    landlordForm: draft.landlordForm,
                    tenantTitle: draft.tenantTitle,
                    tenantName: draft.tenantName,
                    tenantEmail: draft.tenantEmail,
                    tenantPhone: draft.tenantPhone,
                    nextDueDate: draft.nextDueDate,
                    renewalReminderEnabled: draft.renewalReminderEnabled,
                  });
                  if (draft.finalChecks) setFinalChecks(draft.finalChecks);
                  if (draft.inspectionDate) setInspectionDate(draft.inspectionDate);
                  if (draft.customerSignature) setCustomerSignature(draft.customerSignature);
                  if (draft.certRef) setCertRef(draft.certRef);
                }
                void AsyncStorage.removeItem(CP12_DRAFT_KEY);
              },
            },
          ],
        );
      } catch {
        // Silently fail
      }
    };

    void restoreDraft();
  }, []);

  // Save draft when navigating away from CP12 flow
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      void saveDraft();
    });
    return unsubscribe;
  }, [navigation, saveDraft]);

  return <>{children}</>;
}

export default function CP12Layout() {
  const {theme} = useAppTheme();

  return (
    <CP12Provider>
      <CP12AutoSave>
        <Stack
          screenOptions={{
            headerShown: false,
            gestureEnabled: false,
            contentStyle: {backgroundColor: theme.surface.base},
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="appliances" />
          <Stack.Screen name="final-checks" />
          <Stack.Screen name="review-sign" />
        </Stack>
      </CP12AutoSave>
    </CP12Provider>
  );
}
