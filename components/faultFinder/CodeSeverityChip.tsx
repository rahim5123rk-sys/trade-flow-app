import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Severity} from '../../src/data/faultFinder';

const LABEL: Record<Severity, string> = {
  lockout: 'LOCKOUT',
  warning: 'WARNING',
  info: 'INFO',
};

const BG: Record<Severity, string> = {
  lockout: 'rgba(220,38,38,0.12)',
  warning: 'rgba(245,158,11,0.14)',
  info: 'rgba(59,130,246,0.14)',
};

const FG: Record<Severity, string> = {
  lockout: '#B91C1C',
  warning: '#B45309',
  info: '#1D4ED8',
};

export function CodeSeverityChip({severity}: {severity: Severity}) {
  return (
    <View style={[s.chip, {backgroundColor: BG[severity]}]}>
      <Text style={[s.text, {color: FG[severity]}]}>{LABEL[severity]}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
