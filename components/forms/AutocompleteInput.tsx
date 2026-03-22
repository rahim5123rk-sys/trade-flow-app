import React, {useCallback, useMemo, useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated';
import {useAppTheme} from '../../src/context/ThemeContext';
import {Input} from '../Input';

const MAX_SUGGESTIONS = 5;
const MIN_CHARS = 2;

// ─── Full autocomplete input (wraps Input component) ────────────
// Use this in forms that use the Input component (commissioning, breakdown, etc.)

interface AutocompleteInputProps {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  icon?: React.ComponentProps<typeof Input>['icon'];
  required?: boolean;
}

export function AutocompleteInput({
  label,
  value,
  onChangeText,
  suggestions,
  placeholder,
  icon,
  required,
}: AutocompleteInputProps) {
  const {theme, isDark} = useAppTheme();
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = useMemo(() => {
    if (!value || value.length < MIN_CHARS) return [];
    const lower = value.toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().includes(lower)).slice(0, MAX_SUGGESTIONS);
  }, [value, suggestions]);

  const handleSelect = useCallback(
    (item: string) => {
      onChangeText(item);
      setShowSuggestions(false);
    },
    [onChangeText],
  );

  return (
    <View style={styles.container}>
      <Input
        label={label}
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          setShowSuggestions(true);
        }}
        placeholder={placeholder}
        icon={icon}
        required={required}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => {
          // Delay to allow tap on suggestion
          setTimeout(() => setShowSuggestions(false), 200);
        }}
      />
      {showSuggestions && filtered.length > 0 && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={[
            styles.dropdown,
            isDark && {backgroundColor: theme.surface.card, borderColor: theme.surface.border},
          ]}
        >
          {filtered.map((item, index) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.dropdownItem,
                index < filtered.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: isDark ? theme.surface.divider : '#E2E8F0',
                },
              ]}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dropdownText, {color: theme.text.body}]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

// ─── Suggestions-only overlay ────────────────────────────────────
// Use this in forms that have their own local FormInput (cp12/appliances, service-record/service)
// Render this directly below the TextInput it should attach to.

interface AutocompleteSuggestionsProps {
  value: string;
  suggestions: string[];
  onSelect: (value: string) => void;
  visible: boolean;
}

export function AutocompleteSuggestions({
  value,
  suggestions,
  onSelect,
  visible,
}: AutocompleteSuggestionsProps) {
  const {theme, isDark} = useAppTheme();

  const filtered = useMemo(() => {
    if (!value || value.length < MIN_CHARS) return [];
    const lower = value.toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().includes(lower)).slice(0, MAX_SUGGESTIONS);
  }, [value, suggestions]);

  if (!visible || filtered.length === 0) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
      style={[
        styles.dropdown,
        isDark && {backgroundColor: theme.surface.card, borderColor: theme.surface.border},
      ]}
    >
      {filtered.map((item, index) => (
        <TouchableOpacity
          key={item}
          style={[
            styles.dropdownItem,
            index < filtered.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: isDark ? theme.surface.divider : '#E2E8F0',
            },
          ]}
          onPress={() => onSelect(item)}
          activeOpacity={0.7}
        >
          <Text style={[styles.dropdownText, {color: theme.text.body}]}>{item}</Text>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  dropdown: {
    marginTop: -8,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
