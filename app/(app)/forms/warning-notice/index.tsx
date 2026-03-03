// Warning Notice – Placeholder
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router} from 'expo-router';
import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppTheme} from '../../../../src/context/ThemeContext';

export default function WarningNoticeIndex() {
  const {theme} = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, {paddingTop: insets.top + 20}]}>
      <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} />
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={theme.brand.primary} />
      </TouchableOpacity>
      <Ionicons name="warning" size={64} color="#DC2626" style={{marginBottom: 16}} />
      <Text style={[styles.title, {color: theme.text.title}]}>Warning Notice</Text>
      <Text style={[styles.sub, {color: theme.text.muted}]}>Coming Soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20},
  back: {position: 'absolute', top: 60, left: 20},
  title: {fontSize: 24, fontWeight: '800', marginBottom: 6},
  sub: {fontSize: 15, fontWeight: '500'},
});
