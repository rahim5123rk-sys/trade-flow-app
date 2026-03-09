import {Ionicons} from '@expo/vector-icons';
import React, {useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useAppTheme} from '../../src/context/ThemeContext';
import {Input} from '../Input';

export function FormSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const {theme, isDark} = useAppTheme();

  return (
    <View style={[styles.section, isDark && {backgroundColor: theme.surface.card, borderColor: theme.surface.border}]}>
      <Text style={[styles.sectionTitle, {color: theme.text.title}]}>{title}</Text>
      {subtitle ? <Text style={[styles.sectionSubtitle, {color: theme.text.muted}]}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

export function DropdownField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const {theme, isDark} = useAppTheme();

  return (
    <View style={{marginBottom: 12}}>
      <Text style={[styles.label, {color: theme.text.muted}]}>{label}</Text>
      <TouchableOpacity
        style={[styles.selectTrigger, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}
        onPress={() => setOpen((prev) => !prev)}
        activeOpacity={0.75}
      >
        <Text style={[styles.selectText, {color: value ? theme.text.title : theme.text.placeholder}]}>{value || placeholder}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.text.muted} />
      </TouchableOpacity>
      {open ? (
        <View style={[styles.optionsList, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}>
          {options.map((option, index) => {
            const active = option === value;
            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.optionRow,
                  index < options.length - 1 && {borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? theme.surface.divider : '#E2E8F0'},
                ]}
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, {color: active ? theme.brand.primary : theme.text.body}]}>{option}</Text>
                {active ? <Ionicons name="checkmark" size={16} color={theme.brand.primary} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function ChoiceChips({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  const {theme, isDark} = useAppTheme();

  return (
    <View style={{marginBottom: 12}}>
      <Text style={[styles.label, {color: theme.text.muted}]}>{label}</Text>
      <View style={styles.chipsRow}>
        {options.map((option) => {
          const active = option === value;
          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.chip,
                isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border},
                active && {backgroundColor: `${theme.brand.primary}18`, borderColor: theme.brand.primary},
              ]}
              onPress={() => onChange(option)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, {color: active ? theme.brand.primary : theme.text.body}]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function TextAreaField(props: React.ComponentProps<typeof Input>) {
  return <Input {...props} multiline style={[{minHeight: 96}, props.style]} />;
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginLeft: 2,
    textTransform: 'uppercase',
  },
  selectTrigger: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionsList: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  optionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
