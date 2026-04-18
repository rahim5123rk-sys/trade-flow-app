import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router, useLocalSearchParams} from 'expo-router';
import React, {useMemo, useState} from 'react';
import {Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Animated, {FadeIn, FadeInDown} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {FlowchartStepView} from '../../../../../../components/faultFinder/FlowchartStepView';
import {GlassIconButton} from '../../../../../../components/GlassIconButton';
import {useAppTheme} from '../../../../../../src/context/ThemeContext';
import {getCommonTest, Step} from '../../../../../../src/data/faultFinder';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;

export default function CommonTestViewer() {
  const {theme, isDark} = useAppTheme();
  const insets = useSafeAreaInsets();
  const {slug} = useLocalSearchParams<{slug: string}>();
  const test = slug ? getCommonTest(slug) : undefined;

  const stepMap = useMemo(() => {
    const map = new Map<string, Step>();
    test?.procedure.forEach((step) => map.set(step.id, step));
    return map;
  }, [test]);

  const firstStepId = test?.procedure[0]?.id ?? '';
  const [history, setHistory] = useState<string[]>(firstStepId ? [firstStepId] : []);
  const [mode, setMode] = useState<'reference' | 'procedure'>(test?.referenceTable?.length ? 'reference' : 'procedure');

  if (!test || history.length === 0) {
    return (
      <View style={[s.root, {paddingTop: insets.top}]}>
        <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} />
        <View style={s.notFoundWrap}>
          <Text style={[s.notFoundTitle, {color: theme.text.title}]}>Test not found</Text>
          <TouchableOpacity style={[s.primary, {backgroundColor: theme.brand.primary}]} onPress={() => router.back()}>
            <Text style={s.primaryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentStep = stepMap.get(history[history.length - 1]);
  const pickOption = (nextId: string) => {
    if (stepMap.has(nextId)) setHistory((h) => [...h, nextId]);
  };
  const goNext = () => {
    if (currentStep && currentStep.type === 'instruction' && currentStep.next) pickOption(currentStep.next);
  };
  const goBack = () => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  const restart = () => setHistory([firstStepId]);

  return (
    <View style={[s.root, {paddingTop: insets.top}]}>
      <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{paddingBottom: TAB_BAR_HEIGHT + 100}}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(40).springify()} style={s.header}>
          <GlassIconButton onPress={() => router.back()} />
          <View style={{flex: 1}}>
            <Text style={[s.brandLabel, {color: theme.text.muted}]}>COMMON TEST</Text>
            <Text style={[s.title, {color: theme.text.title}]}>{test.title}</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).springify()} style={[s.summaryCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
          <Text style={[s.summary, {color: theme.text.body}]}>{test.summary}</Text>
        </Animated.View>

        {test.safetyWarnings.length ? (
          <View style={s.safetyCard}>
            <Ionicons name="warning-outline" size={18} color="#B45309" />
            <View style={{flex: 1}}>
              {test.safetyWarnings.map((w) => (
                <Text key={w} style={s.safetyText}>{w}</Text>
              ))}
            </View>
          </View>
        ) : null}

        {test.referenceTable?.length ? (
          <View style={[s.tabBar, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
            <TabBtn label="Reference" active={mode === 'reference'} onPress={() => setMode('reference')} />
            <TabBtn label="Procedure" active={mode === 'procedure'} onPress={() => setMode('procedure')} />
          </View>
        ) : null}

        {mode === 'reference' && test.referenceTable?.length ? (
          <Animated.View entering={FadeIn.duration(200)} style={[s.tableCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
            {test.referenceTable.map((row, idx) => (
              <View
                key={row.label}
                style={[s.tableRow, idx !== 0 && s.tableRowBorder, isDark && {borderTopColor: theme.surface.divider}]}
              >
                <Text style={[s.tableLabel, {color: theme.text.muted}]}>{row.label}</Text>
                <Text style={[s.tableValue, {color: theme.text.title}]}>{row.value}</Text>
              </View>
            ))}
          </Animated.View>
        ) : null}

        {mode === 'procedure' && currentStep ? (
          <>
            <Animated.View entering={FadeIn.duration(200)} key={currentStep.id} style={{marginTop: 16}}>
              <FlowchartStepView
                step={currentStep}
                stepNumber={history.length}
                totalSteps={test.procedure.length}
                onPickOption={pickOption}
                onNext={goNext}
                onRestart={restart}
              />
            </Animated.View>

            {history.length > 1 && currentStep.type !== 'result' ? (
              <TouchableOpacity
                style={[s.backBtn, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
                activeOpacity={0.8}
                onPress={goBack}
              >
                <Ionicons name="arrow-back-outline" size={16} color={theme.text.title} />
                <Text style={[s.backBtnText, {color: theme.text.title}]}>Previous step</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function TabBtn({label, active, onPress}: {label: string; active: boolean; onPress: () => void}) {
  const {theme} = useAppTheme();
  return (
    <TouchableOpacity style={[tabStyles.btn, active && tabStyles.btnActive]} activeOpacity={0.75} onPress={onPress}>
      <Text style={[tabStyles.label, {color: active ? theme.brand.primary : theme.text.muted, fontWeight: active ? '800' : '600'}]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: {flex: 1},
  scroll: {paddingHorizontal: 20},
  header: {flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14},
  brandLabel: {fontSize: 12, fontWeight: '700', letterSpacing: 0.6},
  title: {fontSize: 24, fontWeight: '800', marginTop: 2, letterSpacing: -0.3},
  summaryCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    marginBottom: 14,
  },
  summary: {fontSize: 15, lineHeight: 22},
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    marginBottom: 14,
  },
  safetyText: {fontSize: 13, lineHeight: 19, color: '#7C2D12'},
  tabBar: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.84)',
    marginBottom: 14,
  },
  tableCard: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tableRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15,23,42,0.08)',
  },
  tableLabel: {fontSize: 15, fontWeight: '600'},
  tableValue: {fontSize: 16, fontWeight: '800'},
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  backBtnText: {fontSize: 14, fontWeight: '700'},
  notFoundWrap: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20},
  notFoundTitle: {fontSize: 20, fontWeight: '800'},
  primary: {paddingHorizontal: 20, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  primaryText: {color: '#FFFFFF', fontSize: 16, fontWeight: '800'},
});

const tabStyles = StyleSheet.create({
  btn: {flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center'},
  btnActive: {backgroundColor: '#FFFFFF'},
  label: {fontSize: 13},
});
