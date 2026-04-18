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
import {getBrand, getFlowchart, Step} from '../../../../../../src/data/faultFinder';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;

export default function FlowchartViewer() {
  const {theme, isDark} = useAppTheme();
  const insets = useSafeAreaInsets();
  const {brand: brandSlug, slug} = useLocalSearchParams<{brand: string; slug: string}>();
  const brand = brandSlug ? getBrand(brandSlug) : undefined;
  const flowchart = brand && slug ? getFlowchart(brand.slug, slug) : undefined;

  const stepMap = useMemo(() => {
    const map = new Map<string, Step>();
    flowchart?.steps.forEach((step) => map.set(step.id, step));
    return map;
  }, [flowchart]);

  const firstStepId = flowchart?.steps[0]?.id ?? '';
  const [history, setHistory] = useState<string[]>(firstStepId ? [firstStepId] : []);

  if (!brand || !flowchart || history.length === 0) {
    return (
      <View style={[s.root, {paddingTop: insets.top}]}>
        <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} />
        <View style={s.notFoundWrap}>
          <Text style={[s.notFoundTitle, {color: theme.text.title}]}>Flowchart not found</Text>
          <TouchableOpacity style={[s.primary, {backgroundColor: theme.brand.primary}]} onPress={() => router.back()}>
            <Text style={s.primaryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentStep = stepMap.get(history[history.length - 1]);

  const pickOption = (nextId: string) => {
    const next = stepMap.get(nextId);
    if (!next) return;
    setHistory((h) => [...h, nextId]);
  };

  const goNext = () => {
    if (!currentStep) return;
    if (currentStep.type === 'instruction' && currentStep.next) {
      pickOption(currentStep.next);
    }
  };

  const goBack = () => {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  };

  const restart = () => {
    setHistory([firstStepId]);
  };

  if (!currentStep) return null;

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
            <Text style={[s.brandLabel, {color: theme.text.muted}]}>{brand.brand}</Text>
            <Text style={[s.title, {color: theme.text.title}]}>{flowchart.title}</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).springify()} style={s.toolsRow}>
          {flowchart.toolsNeeded.map((tool) => (
            <View key={tool} style={[s.toolChip, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
              <Ionicons name="build-outline" size={13} color={theme.brand.primary} />
              <Text style={[s.toolChipText, {color: theme.text.title}]}>{tool}</Text>
            </View>
          ))}
        </Animated.View>

        {flowchart.safetyWarnings.length ? (
          <Animated.View entering={FadeInDown.delay(100).springify()} style={s.safetyCard}>
            <Ionicons name="warning-outline" size={18} color="#B45309" />
            <View style={{flex: 1}}>
              {flowchart.safetyWarnings.map((w) => (
                <Text key={w} style={s.safetyText}>{w}</Text>
              ))}
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeIn.duration(250)} key={currentStep.id} style={{marginTop: 16}}>
          <FlowchartStepView
            step={currentStep}
            stepNumber={history.length}
            totalSteps={flowchart.steps.length}
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
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {flex: 1},
  scroll: {paddingHorizontal: 20},
  header: {flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14},
  brandLabel: {fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase'},
  title: {fontSize: 24, fontWeight: '800', marginTop: 2, letterSpacing: -0.3},
  toolsRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12},
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  toolChipText: {fontSize: 12, fontWeight: '700'},
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  safetyText: {fontSize: 13, lineHeight: 19, color: '#7C2D12'},
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
