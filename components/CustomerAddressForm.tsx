// ─── CustomerAddressForm ─────────────────────────────────────────────
// Billing address inputs and save/edit action buttons.
// Rendered by CustomerSelector when the user is entering or editing details.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { UI } from '../constants/theme';
import { Button } from './ui/Button';
import { CustomerFormData } from './customerUtils';
import { Input } from './Input';

interface CustomerAddressFormProps {
  value: CustomerFormData;
  onChange: (data: CustomerFormData) => void;
  mode: 'full' | 'compact';
  isQuick: boolean;
  showActions: boolean;
  isEditing: boolean;
  hasChanged: boolean;
  customerMode: 'new' | 'existing';
  onCancel: () => void;
  onDone: () => void;
  onUpdateExisting: () => void;
  onCreateNew: () => void;
}

export function CustomerAddressForm({
  value,
  onChange,
  mode,
  isQuick,
  showActions,
  isEditing,
  hasChanged,
  customerMode,
  onCancel,
  onDone,
  onUpdateExisting,
  onCreateNew,
}: CustomerAddressFormProps) {
  const update = (field: keyof CustomerFormData, val: any) =>
    onChange({ ...value, [field]: val });

  return (
    <>
      {/* Contact name — always shown */}
      <Input
        label="Contact Name"
        required
        placeholder="e.g. Sarah Jenkins"
        value={value.customerName}
        onChangeText={(t) => update('customerName', t)}
      />

      {isQuick ? (
        <Input
          label="Address / Location (Optional)"
          placeholder="e.g. 12 High St, WR1"
          value={value.addressLine1}
          onChangeText={(t) => update('addressLine1', t)}
        />
      ) : (
        <>
          <Input
            label="Company Name"
            placeholder="e.g. Jenkins Plumbing Ltd"
            value={value.customerCompany}
            onChangeText={(t) => update('customerCompany', t)}
          />

          <Input
            label="Address Line 1"
            required
            placeholder="Street address"
            value={value.addressLine1}
            onChangeText={(t) => update('addressLine1', t)}
          />

          <Input
            label="Address Line 2"
            placeholder="Apt / Suite / Unit"
            value={value.addressLine2}
            onChangeText={(t) => update('addressLine2', t)}
          />

          <View style={s.row}>
            <Input
              label="City"
              placeholder="Worcester"
              value={value.city}
              onChangeText={(t) => update('city', t)}
              containerStyle={s.flexLeft}
            />
            <Input
              label="Post Code"
              required
              placeholder="WR1 1PA"
              value={value.postCode}
              onChangeText={(t) => update('postCode', t)}
              autoCapitalize="characters"
              containerStyle={s.flexRight}
            />
          </View>

          {mode === 'full' && (
            <Input
              label="Region / County"
              placeholder="Worcestershire"
              value={value.region}
              onChangeText={(t) => update('region', t)}
            />
          )}
        </>
      )}

      <View style={s.row}>
        <Input
          label="Phone"
          placeholder="07700…"
          value={value.phone}
          onChangeText={(t) => update('phone', t)}
          keyboardType="phone-pad"
          containerStyle={isQuick ? s.flexFull : s.flexLeft}
        />
        {!isQuick && (
          <Input
            label="Email"
            placeholder="email@…"
            value={value.email}
            onChangeText={(t) => update('email', t)}
            keyboardType="email-address"
            autoCapitalize="none"
            containerStyle={s.flexRight}
          />
        )}
      </View>

      {/* ── Action buttons ── */}
      {showActions && isEditing && (
        <Animated.View entering={FadeInUp.delay(100).duration(300)} style={{ marginTop: 10 }}>
          {!hasChanged ? (
            <View style={s.row}>
              <Button
                variant="secondary"
                title="Cancel"
                onPress={onCancel}
                style={s.flexLeft}
              />
              <Button
                variant="primary"
                icon="checkmark"
                title="Done"
                onPress={onDone}
                style={s.flexRight}
              />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <View style={s.row}>
                <Button
                  variant="secondary"
                  title="Cancel"
                  onPress={onCancel}
                  style={s.flexLeft}
                />
                <Button
                  variant="primary"
                  icon="sync"
                  title="Update Existing"
                  onPress={onUpdateExisting}
                  style={s.flexRight}
                />
              </View>
              <Button
                variant="success"
                icon="add-circle-outline"
                title="Save as New Customer"
                onPress={onCreateNew}
              />
            </View>
          )}
        </Animated.View>
      )}

      {showActions && !isEditing && customerMode === 'new' && value.customerName.length > 0 && (
        <Animated.View entering={FadeInUp.delay(150).duration(300)} style={{ marginTop: 6 }}>
          <Button
            variant="success"
            icon="save-outline"
            title="Save Customer to Database"
            onPress={onCreateNew}
          />
        </Animated.View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  flexLeft: { flex: 1 },
  flexRight: { flex: 1 },
  flexFull: { flex: 1 },
});
