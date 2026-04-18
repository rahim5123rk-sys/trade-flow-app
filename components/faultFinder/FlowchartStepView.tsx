import {Ionicons} from '@expo/vector-icons';
import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {ResultOutcome, Step} from '../../src/data/faultFinder';
import {useAppTheme} from '../../src/context/ThemeContext';
import {PartsLinkButton} from './PartsLinkButton';

const OUTCOME_META: Record<ResultOutcome, {label: string; colour: string; icon: keyof typeof Ionicons.glyphMap}> = {
  'component-faulty': {label: 'Component faulty', colour: '#B91C1C', icon: 'close-circle'},
  'needs-clean': {label: 'Needs cleaning/servicing', colour: '#B45309', icon: 'brush-outline'},
  'needs-service': {label: 'Further investigation needed', colour: '#B45309', icon: 'construct-outline'},
  ok: {label: 'No fault found here', colour: '#047857', icon: 'checkmark-circle'},
  'call-manufacturer': {label: 'Call manufacturer technical', colour: '#1D4ED8', icon: 'call-outline'},
};

export function FlowchartStepView({
  step,
  stepNumber,
  totalSteps,
  onPickOption,
  onNext,
  onRestart,
}: {
  step: Step;
  stepNumber: number;
  totalSteps: number;
  onPickOption: (nextId: string) => void;
  onNext: () => void;
  onRestart: () => void;
}) {
  const {theme, isDark} = useAppTheme();

  return (
    <View style={s.wrap}>
      <Text style={[s.progress, {color: theme.text.muted}]}>
        Step {stepNumber} of {totalSteps}
      </Text>

      <View style={[s.card, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
        <Text style={[s.typeBadge, {color: theme.brand.primary}]}>{step.type.toUpperCase()}</Text>
        <Text style={[s.body, {color: theme.text.title}]}>{step.body}</Text>

        {step.type === 'measurement' ? (
          <View style={[s.expectedRow, isDark && {backgroundColor: theme.surface.elevated}]}>
            <Ionicons name="speedometer-outline" size={18} color={theme.brand.primary} />
            <Text style={[s.expectedLabel, {color: theme.text.muted}]}>EXPECTED</Text>
            <Text style={[s.expectedValue, {color: theme.text.title}]}>{step.expected}</Text>
          </View>
        ) : null}
      </View>

      {step.type === 'instruction' ? (
        <TouchableOpacity
          style={[s.primaryBtn, {backgroundColor: theme.brand.primary}]}
          activeOpacity={0.85}
          onPress={onNext}
        >
          <Text style={s.primaryBtnText}>Done, next step</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      ) : null}

      {step.type === 'decision' || step.type === 'measurement' ? (
        <View style={s.options}>
          {step.options.map((opt) => (
            <TouchableOpacity
              key={opt.next}
              style={[s.optionBtn, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
              activeOpacity={0.8}
              onPress={() => onPickOption(opt.next)}
            >
              <Text style={[s.optionLabel, {color: theme.text.title}]}>{opt.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {step.type === 'result' ? (
        <ResultBlock step={step as any} onRestart={onRestart} />
      ) : null}
    </View>
  );
}

function ResultBlock({step, onRestart}: {step: any; onRestart: () => void}) {
  const {theme, isDark} = useAppTheme();
  const meta = OUTCOME_META[step.outcome as ResultOutcome];
  return (
    <View style={s.resultWrap}>
      <View style={[s.resultHero, {borderColor: meta.colour, backgroundColor: isDark ? theme.glass.bg : 'rgba(255,255,255,0.9)'}]}>
        <View style={[s.resultIcon, {backgroundColor: meta.colour}]}>
          <Ionicons name={meta.icon} size={24} color="#fff" />
        </View>
        <Text style={[s.resultLabel, {color: meta.colour}]}>{meta.label.toUpperCase()}</Text>
      </View>

      {step.partSearchHint ? <View style={{marginTop: 14}}><PartsLinkButton hint={step.partSearchHint} /></View> : null}

      <TouchableOpacity
        style={[s.restartBtn, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
        activeOpacity={0.8}
        onPress={onRestart}
      >
        <Ionicons name="refresh-outline" size={18} color={theme.text.title} />
        <Text style={[s.restartLabel, {color: theme.text.title}]}>Start flowchart again</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {gap: 14},
  progress: {fontSize: 13, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase'},
  card: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    gap: 10,
  },
  typeBadge: {fontSize: 12, fontWeight: '800', letterSpacing: 0.8},
  body: {fontSize: 18, lineHeight: 26, fontWeight: '600'},
  expectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginTop: 6,
  },
  expectedLabel: {fontSize: 12, fontWeight: '800', letterSpacing: 0.8},
  expectedValue: {fontSize: 15, fontWeight: '800', flex: 1},
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: 16,
  },
  primaryBtnText: {fontSize: 16, fontWeight: '800', color: '#FFFFFF'},
  options: {gap: 10},
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  optionLabel: {fontSize: 16, fontWeight: '700', flex: 1, paddingRight: 12},
  resultWrap: {gap: 6},
  resultHero: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    gap: 10,
  },
  resultIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultLabel: {fontSize: 14, fontWeight: '800', letterSpacing: 0.6},
  restartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  restartLabel: {fontSize: 15, fontWeight: '700'},
});
