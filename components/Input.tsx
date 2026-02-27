import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    View,
    ViewStyle,
} from 'react-native';
import { Colors, UI } from './../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  icon,
  error,
  required,
  containerStyle,
  multiline,
  style,
  ...rest
}: InputProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <View
        style={[
          styles.inputWrapper,
          multiline && styles.multilineWrapper,
          error && styles.errorBorder,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={Colors.textLight}
            style={[styles.icon, multiline && { marginTop: 12 }]}
          />
        )}
        <TextInput
          style={[
            styles.input,
            multiline && styles.textArea,
            style,
          ]}
          placeholderTextColor="#94A3B8"
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...rest}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: UI.text.secondary,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginLeft: 2,
  },
  required: {
    color: Colors.danger,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.surface.base,
    borderWidth: 1,
    borderColor: UI.surface.divider,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  multilineWrapper: {
    alignItems: 'flex-start',
  },
  errorBorder: {
    borderColor: Colors.danger,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
    marginLeft: 2,
  },
});