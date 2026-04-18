import {Ionicons} from '@expo/vector-icons';
import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {FaultCode} from '../../src/data/faultFinder';
import {useAppTheme} from '../../src/context/ThemeContext';
import {CodeSeverityChip} from './CodeSeverityChip';

export function FaultCodeRow({
  code,
  onPress,
  brandLabel,
}: {
  code: FaultCode;
  onPress: () => void;
  brandLabel?: string;
}) {
  const {theme, isDark} = useAppTheme();
  return (
    <TouchableOpacity
      style={[s.row, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
      activeOpacity={0.75}
      onPress={onPress}
    >
      <View style={[s.codeBadge, isDark && {backgroundColor: theme.surface.elevated}]}>
        <Text style={[s.codeText, {color: theme.text.title}]}>{code.code}</Text>
      </View>
      <View style={{flex: 1}}>
        <Text style={[s.title, {color: theme.text.title}]}>{code.title}</Text>
        {brandLabel ? <Text style={[s.brand, {color: theme.text.muted}]}>{brandLabel}</Text> : null}
        <View style={{marginTop: 6}}>
          <CodeSeverityChip severity={code.severity} />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  codeBadge: {
    minWidth: 54,
    height: 48,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: {fontSize: 17, fontWeight: '800', letterSpacing: 0.3},
  title: {fontSize: 16, fontWeight: '700'},
  brand: {fontSize: 13, marginTop: 2},
});
