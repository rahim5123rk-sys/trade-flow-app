import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router, useLocalSearchParams} from 'expo-router';
import React, {useState} from 'react';
import {Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CodeSeverityChip} from '../../../../../../components/faultFinder/CodeSeverityChip';
import {PartsLinkButton} from '../../../../../../components/faultFinder/PartsLinkButton';
import {GlassIconButton} from '../../../../../../components/GlassIconButton';
import {useAppTheme} from '../../../../../../src/context/ThemeContext';
import {getBrand, getFaultCode, getFlowchart} from '../../../../../../src/data/faultFinder';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;

export default function FaultCodeDetail() {
  const {theme, isDark} = useAppTheme();
  const insets = useSafeAreaInsets();
  const {brand: brandSlug, code: codeParam} = useLocalSearchParams<{brand: string; code: string}>();
  const code = codeParam ? decodeURIComponent(codeParam) : '';
  const brand = brandSlug ? getBrand(brandSlug) : undefined;
  const fault = brand && code ? getFaultCode(brand.slug, code) : undefined;

  const [expanded, setExpanded] = useState<'causes' | 'checks' | 'related' | null>('causes');

  if (!brand || !fault) {
    return (
      <View style={[s.root, {paddingTop: insets.top}]}>
        <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} />
        <View style={s.notFoundWrap}>
          <Text style={[s.notFoundTitle, {color: theme.text.title}]}>Code not found</Text>
          <TouchableOpacity style={[s.primary, {backgroundColor: theme.brand.primary}]} onPress={() => router.back()}>
            <Text style={s.primaryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const heroColour = fault.severity === 'lockout' ? '#B91C1C' : fault.severity === 'warning' ? '#B45309' : '#1D4ED8';
  const relatedFlows = (fault.linkedFlowcharts || [])
    .map((slug) => getFlowchart(brand.slug, slug))
    .filter(Boolean);

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
          <Text style={[s.brandLabel, {color: theme.text.muted}]}>{brand.brand}</Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(80).springify()}
          style={[s.hero, {borderColor: heroColour, backgroundColor: isDark ? theme.glass.bg : '#FFFFFF'}]}
        >
          <Text style={[s.heroCode, {color: heroColour}]}>{fault.code}</Text>
          <Text style={[s.heroTitle, {color: theme.text.title}]}>{fault.title}</Text>
          <View style={{marginTop: 10}}>
            <CodeSeverityChip severity={fault.severity} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).springify()} style={[s.card, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
          <Text style={[s.summary, {color: theme.text.body}]}>{fault.summary}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).springify()}>
          <Section
            label="LIKELY CAUSES"
            icon="alert-circle-outline"
            open={expanded === 'causes'}
            onToggle={() => setExpanded(expanded === 'causes' ? null : 'causes')}
            theme={theme}
            isDark={isDark}
          >
            {fault.likelyCauses.map((c) => (
              <BulletRow key={c} text={c} theme={theme} />
            ))}
          </Section>

          <Section
            label="QUICK CHECKS"
            icon="flash-outline"
            open={expanded === 'checks'}
            onToggle={() => setExpanded(expanded === 'checks' ? null : 'checks')}
            theme={theme}
            isDark={isDark}
          >
            {fault.quickChecks.map((c) => (
              <BulletRow key={c} text={c} theme={theme} />
            ))}
          </Section>

          {relatedFlows.length > 0 ? (
            <Section
              label="RELATED DIAGNOSIS"
              icon="git-branch-outline"
              open={expanded === 'related'}
              onToggle={() => setExpanded(expanded === 'related' ? null : 'related')}
              theme={theme}
              isDark={isDark}
            >
              {relatedFlows.map((fc: any) => (
                <TouchableOpacity
                  key={fc.slug}
                  style={[s.flowLink, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/toolbox/fault-finder/${brand.slug}/flow/${fc.slug}`)}
                >
                  <Ionicons name="play-circle-outline" size={22} color={theme.brand.primary} />
                  <Text style={[s.flowLinkText, {color: theme.text.title}]}>{fc.title}</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
                </TouchableOpacity>
              ))}
            </Section>
          ) : null}

          {fault.partSearchHint ? (
            <View style={{marginTop: 16}}>
              <PartsLinkButton hint={fault.partSearchHint} />
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function Section({
  label,
  icon,
  open,
  onToggle,
  children,
  theme,
  isDark,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  theme: any;
  isDark: boolean;
}) {
  return (
    <View style={[s.section, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
      <TouchableOpacity style={s.sectionHeader} activeOpacity={0.8} onPress={onToggle}>
        <Ionicons name={icon} size={18} color={theme.brand.primary} />
        <Text style={[s.sectionLabel, {color: theme.text.title}]}>{label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.text.muted} />
      </TouchableOpacity>
      {open ? <View style={s.sectionBody}>{children}</View> : null}
    </View>
  );
}

function BulletRow({text, theme}: {text: string; theme: any}) {
  return (
    <View style={s.bulletRow}>
      <View style={[s.bullet, {backgroundColor: theme.brand.primary}]} />
      <Text style={[s.bulletText, {color: theme.text.body}]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {flex: 1},
  scroll: {paddingHorizontal: 20},
  header: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12},
  brandLabel: {fontSize: 13, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase'},
  hero: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  heroCode: {fontSize: 40, fontWeight: '900', letterSpacing: 1},
  heroTitle: {fontSize: 22, fontWeight: '800', marginTop: 6, lineHeight: 28},
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    marginBottom: 14,
  },
  summary: {fontSize: 15, lineHeight: 22},
  section: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    marginBottom: 10,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sectionLabel: {flex: 1, fontSize: 13, fontWeight: '800', letterSpacing: 0.8},
  sectionBody: {paddingHorizontal: 14, paddingBottom: 14, gap: 8},
  bulletRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4},
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },
  bulletText: {flex: 1, fontSize: 15, lineHeight: 22},
  flowLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  flowLinkText: {flex: 1, fontSize: 15, fontWeight: '700'},
  notFoundWrap: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20},
  notFoundTitle: {fontSize: 20, fontWeight: '800'},
  primary: {paddingHorizontal: 20, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  primaryText: {color: '#FFFFFF', fontSize: 16, fontWeight: '800'},
});
