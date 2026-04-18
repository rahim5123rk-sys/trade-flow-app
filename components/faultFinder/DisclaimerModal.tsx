import AsyncStorage from '@react-native-async-storage/async-storage';
import {Ionicons} from '@expo/vector-icons';
import React, {useEffect, useState} from 'react';
import {Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useAppTheme} from '../../src/context/ThemeContext';

const STORAGE_KEY = 'faultFinder.disclaimerAcceptedAt';

export function DisclaimerModal() {
  const {theme, isDark} = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!stored) setVisible(true);
      } catch {
        setVisible(true);
      }
    })();
  }, []);

  const accept = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // fail open — user won't get blocked if storage is unavailable
    }
    setVisible(false);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={s.backdrop}>
        <View style={[s.card, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}>
          <View style={s.iconWrap}>
            <Ionicons name="warning-outline" size={28} color="#B45309" />
          </View>
          <Text style={[s.title, {color: theme.text.title}]}>Before you continue</Text>

          <ScrollView style={s.scroll} contentContainerStyle={{paddingBottom: 8}}>
            <Text style={[s.body, {color: theme.text.body}]}>
              For qualified Gas Safe engineers only.
            </Text>
            <Text style={[s.body, {color: theme.text.body, marginTop: 10}]}>
              This guide provides general diagnostic steps based on publicly available information and common field experience. Always isolate gas and electrical supplies before testing.
            </Text>
            <Text style={[s.body, {color: theme.text.body, marginTop: 10}]}>
              Readings and procedures vary by model — always refer to the manufacturer's installation and service manual for the specific appliance in front of you.
            </Text>
            <Text style={[s.body, {color: theme.text.body, marginTop: 10}]}>
              GasPilot and its authors accept no liability for damage, injury, or loss arising from use of this guide.
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={[s.checkRow]}
            activeOpacity={0.7}
            onPress={() => setChecked((v) => !v)}
          >
            <View style={[s.checkbox, checked && {backgroundColor: theme.brand.primary, borderColor: theme.brand.primary}]}>
              {checked ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
            </View>
            <Text style={[s.checkLabel, {color: theme.text.body}]}>I'm a qualified engineer and I understand.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.cta, !checked && {opacity: 0.4}, {backgroundColor: theme.brand.primary}]}
            activeOpacity={0.8}
            disabled={!checked}
            onPress={accept}
          >
            <Text style={s.ctaText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  title: {fontSize: 22, fontWeight: '800', marginBottom: 10},
  scroll: {maxHeight: 230, marginBottom: 16},
  body: {fontSize: 15, lineHeight: 22},
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(15,23,42,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: {fontSize: 15, fontWeight: '600', flex: 1},
  cta: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {fontSize: 16, fontWeight: '800', color: '#FFFFFF'},
});
