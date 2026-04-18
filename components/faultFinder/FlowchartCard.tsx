import {Ionicons} from '@expo/vector-icons';
import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {Flowchart} from '../../src/data/faultFinder';
import {useAppTheme} from '../../src/context/ThemeContext';

const CATEGORY_ICON: Record<Flowchart['symptomCategory'], keyof typeof Ionicons.glyphMap> = {
  'no-ignition': 'flame-outline',
  'no-hot-water': 'water-outline',
  'no-heating': 'thermometer-outline',
  pressure: 'speedometer-outline',
  leak: 'rainy-outline',
  noise: 'volume-high-outline',
  fan: 'sync-outline',
  condensate: 'snow-outline',
  sensor: 'pulse-outline',
};

export function FlowchartCard({
  flowchart,
  onPress,
}: {
  flowchart: Flowchart;
  onPress: () => void;
}) {
  const {theme, isDark} = useAppTheme();
  return (
    <TouchableOpacity
      style={[s.card, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={[s.iconWrap, {backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EEF5FF'}]}>
        <Ionicons name={CATEGORY_ICON[flowchart.symptomCategory] || 'help-circle-outline'} size={22} color={theme.brand.primary} />
      </View>
      <View style={{flex: 1}}>
        <Text style={[s.title, {color: theme.text.title}]}>{flowchart.title}</Text>
        <Text style={[s.meta, {color: theme.text.muted}]}>
          {flowchart.steps.length} steps · Tools: {flowchart.toolsNeeded.slice(0, 2).join(', ')}
          {flowchart.toolsNeeded.length > 2 ? '…' : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {fontSize: 17, fontWeight: '800'},
  meta: {fontSize: 13, marginTop: 4, lineHeight: 18},
});
