import {Ionicons} from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import {StyleSheet, Text, TouchableOpacity} from 'react-native';
import {useAppTheme} from '../../src/context/ThemeContext';

const PARTS_URL = 'https://www.directheatingspares.co.uk/';

export function PartsLinkButton({hint}: {hint?: string}) {
  const {theme, isDark} = useAppTheme();
  const label = hint ? `Find "${hint}" part` : 'Find this part';

  return (
    <TouchableOpacity
      style={[s.btn, isDark ? {backgroundColor: theme.glass.bg, borderColor: theme.glass.border} : null]}
      activeOpacity={0.8}
      onPress={() => void WebBrowser.openBrowserAsync(PARTS_URL)}
    >
      <Ionicons name="cart-outline" size={18} color={theme.brand.primary} />
      <Text style={[s.label, {color: theme.text.title}]}>{label}</Text>
      <Text style={[s.hint, {color: theme.text.muted}]}>Search by GC number</Text>
      <Ionicons name="open-outline" size={16} color={theme.text.muted} style={{marginLeft: 'auto'}} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  label: {fontSize: 15, fontWeight: '700'},
  hint: {fontSize: 13, marginLeft: 4},
});
