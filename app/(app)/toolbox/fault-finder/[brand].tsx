import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router, useLocalSearchParams} from 'expo-router';
import React, {useMemo, useState} from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {FaultCodeRow} from '../../../../components/faultFinder/FaultCodeRow';
import {FlowchartCard} from '../../../../components/faultFinder/FlowchartCard';
import {GlassIconButton} from '../../../../components/GlassIconButton';
import {useAppTheme} from '../../../../src/context/ThemeContext';
import {
  FaultCode,
  Flowchart,
  filterFaultCodes,
  filterFlowcharts,
  getBrand,
} from '../../../../src/data/faultFinder';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;
type Tab = 'codes' | 'flowcharts';

export default function BrandLanding() {
  const {theme, isDark} = useAppTheme();
  const insets = useSafeAreaInsets();
  const {brand: brandSlug} = useLocalSearchParams<{brand: string}>();
  const brand = brandSlug ? getBrand(brandSlug) : undefined;

  const [tab, setTab] = useState<Tab>('codes');
  const [modelId, setModelId] = useState<string>('all');

  const codes = useMemo<FaultCode[]>(() => (brand ? filterFaultCodes(brand, modelId) : []), [brand, modelId]);
  const flowcharts = useMemo<Flowchart[]>(() => (brand ? filterFlowcharts(brand, modelId) : []), [brand, modelId]);

  if (!brand) {
    return (
      <View style={[s.root, {paddingTop: insets.top}]}>
        <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} />
        <View style={s.notFoundWrap}>
          <Text style={[s.notFoundTitle, {color: theme.text.title}]}>Brand not found</Text>
          <TouchableOpacity style={[s.primary, {backgroundColor: theme.brand.primary}]} onPress={() => router.back()}>
            <Text style={s.primaryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
            <Text style={[s.title, {color: theme.text.title}]}>{brand.brand}</Text>
            <Text style={[s.subtitle, {color: theme.text.muted}]}>{brand.description}</Text>
          </View>
        </Animated.View>

        {brand.models.length > 1 ? (
          <Animated.View entering={FadeInDown.delay(80).springify()}>
            <Text style={[s.sectionLabel, {color: theme.text.muted}]}>MODEL</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, paddingVertical: 4}}>
              <ModelPill label="All models" active={modelId === 'all'} onPress={() => setModelId('all')} />
              {brand.models.map((m) => (
                <ModelPill key={m.id} label={m.name} active={modelId === m.id} onPress={() => setModelId(m.id)} />
              ))}
            </ScrollView>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(120).springify()} style={[s.tabBar, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
          <TabBtn label={`Fault Codes (${codes.length})`} active={tab === 'codes'} onPress={() => setTab('codes')} />
          <TabBtn label={`Flowcharts (${flowcharts.length})`} active={tab === 'flowcharts'} onPress={() => setTab('flowcharts')} />
        </Animated.View>

        {tab === 'codes' ? (
          <Animated.View entering={FadeInDown.delay(160).springify()} style={{gap: 10}}>
            {codes.length === 0 ? (
              <EmptyNote text="No codes match the selected model." theme={theme} isDark={isDark} />
            ) : (
              codes.map((code) => (
                <FaultCodeRow
                  key={code.code}
                  code={code}
                  onPress={() =>
                    router.push(`/toolbox/fault-finder/${brand.slug}/code/${encodeURIComponent(code.code)}`)
                  }
                />
              ))
            )}
          </Animated.View>
        ) : null}

        {tab === 'flowcharts' ? (
          <Animated.View entering={FadeInDown.delay(160).springify()} style={{gap: 12}}>
            {flowcharts.length === 0 ? (
              <EmptyNote
                text="No dedicated flowcharts for this model yet — check the generic flowcharts under any other brand with flowcharts."
                theme={theme}
                isDark={isDark}
              />
            ) : (
              flowcharts.map((fc) => (
                <FlowchartCard
                  key={fc.slug}
                  flowchart={fc}
                  onPress={() => router.push(`/toolbox/fault-finder/${brand.slug}/flow/${fc.slug}`)}
                />
              ))
            )}
          </Animated.View>
        ) : null}


      </ScrollView>
    </View>
  );
}

function ModelPill({label, active, onPress}: {label: string; active: boolean; onPress: () => void}) {
  const {theme, isDark} = useAppTheme();
  return (
    <TouchableOpacity
      style={[
        pillStyles.pill,
        isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border},
        active && {backgroundColor: theme.brand.primary, borderColor: theme.brand.primary},
      ]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <Text style={[pillStyles.label, {color: active ? '#FFFFFF' : theme.text.title}]}>{label}</Text>
    </TouchableOpacity>
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

function EmptyNote({text, theme, isDark}: {text: string; theme: any; isDark: boolean}) {
  return (
    <View style={[s.emptyCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
      <Ionicons name="information-circle-outline" size={18} color={theme.text.muted} />
      <Text style={[s.emptyText, {color: theme.text.muted}]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {flex: 1},
  scroll: {paddingHorizontal: 20},
  header: {flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16},
  title: {fontSize: 28, fontWeight: '800', letterSpacing: -0.5},
  subtitle: {fontSize: 14, fontWeight: '500', marginTop: 6, lineHeight: 20},
  sectionLabel: {fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6, marginTop: 6},
  tabBar: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.84)',
    marginVertical: 18,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.84)',
  },
  emptyText: {flex: 1, fontSize: 14, lineHeight: 20},
  notFoundWrap: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20},
  notFoundTitle: {fontSize: 20, fontWeight: '800'},
  primary: {paddingHorizontal: 20, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  primaryText: {color: '#FFFFFF', fontSize: 16, fontWeight: '800'},
});

const pillStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  label: {fontSize: 14, fontWeight: '700'},
});

const tabStyles = StyleSheet.create({
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnActive: {backgroundColor: '#FFFFFF'},
  label: {fontSize: 13},
});
