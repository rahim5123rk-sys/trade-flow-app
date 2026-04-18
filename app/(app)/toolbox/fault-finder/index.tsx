import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router} from 'expo-router';
import React, {useMemo, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CodeSeverityChip} from '../../../../components/faultFinder/CodeSeverityChip';
import {DisclaimerModal} from '../../../../components/faultFinder/DisclaimerModal';
import {GlassIconButton} from '../../../../components/GlassIconButton';
import {useAppTheme} from '../../../../src/context/ThemeContext';
import {BRANDS, searchCodes} from '../../../../src/data/faultFinder';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;

const BRAND_ICON: Record<string, keyof typeof import('@expo/vector-icons').Ionicons.glyphMap> = {
  worcester: 'flame-outline',
  vaillant: 'snow-outline',
  ideal: 'bulb-outline',
  generic: 'layers-outline',
};

export default function FaultFinderHome() {
  const {theme, isDark} = useAppTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const hits = useMemo(() => (query.trim().length ? searchCodes(query) : []), [query]);

  return (
    <View style={[s.root, {paddingTop: insets.top}]}>
      <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} />
      <DisclaimerModal />

      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={{paddingBottom: TAB_BAR_HEIGHT + 100}}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.delay(40).springify()} style={s.header}>
            <GlassIconButton onPress={() => router.back()} />
            <View style={{flex: 1}}>
              <Text style={[s.title, {color: theme.text.title}]}>Fault Finder</Text>
              <Text style={[s.subtitle, {color: theme.text.muted}]}>
                Search a code, pick a brand, or run a diagnosis flowchart
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).springify()}>
            <View style={[s.searchBox, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}>
              <Ionicons name="search-outline" size={18} color={theme.text.muted} />
              <TextInput
                style={[s.searchInput, {color: theme.text.title}]}
                placeholder="Search any fault code (e.g. EA, F22, L2)"
                placeholderTextColor={theme.text.placeholder}
                autoCapitalize="characters"
                autoCorrect={false}
                value={query}
                onChangeText={setQuery}
              />
              {query.length > 0 ? (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={theme.text.muted} />
                </TouchableOpacity>
              ) : null}
            </View>
          </Animated.View>

          {hits.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(100).springify()} style={{marginTop: 16, gap: 10}}>
              <Text style={[s.sectionLabel, {color: theme.text.muted}]}>
                {hits.length} result{hits.length === 1 ? '' : 's'}
              </Text>
              {hits.map((hit) => (
                <TouchableOpacity
                  key={`${hit.brandSlug}-${hit.code}`}
                  style={[s.hitRow, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
                  activeOpacity={0.8}
                  onPress={() =>
                    router.push(`/toolbox/fault-finder/${hit.brandSlug}/code/${encodeURIComponent(hit.code)}`)
                  }
                >
                  <View style={[s.hitCode, isDark && {backgroundColor: theme.surface.elevated}]}>
                    <Text style={[s.hitCodeText, {color: theme.text.title}]}>{hit.code}</Text>
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={[s.hitTitle, {color: theme.text.title}]}>{hit.title}</Text>
                    <Text style={[s.hitBrand, {color: theme.text.muted}]}>{hit.brandName}</Text>
                  </View>
                  <CodeSeverityChip severity={hit.severity} />
                </TouchableOpacity>
              ))}
            </Animated.View>
          ) : null}

          {query.length === 0 ? (
            <>
              <Animated.View entering={FadeInDown.delay(120).springify()} style={{marginTop: 24}}>
                <Text style={[s.sectionLabel, {color: theme.text.muted}]}>BRANDS</Text>
                <View style={s.brandGrid}>
                  {BRANDS.map((brand) => (
                    <TouchableOpacity
                      key={brand.slug}
                      style={[s.brandCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
                      activeOpacity={0.85}
                      onPress={() => router.push(`/toolbox/fault-finder/${brand.slug}`)}
                    >
                      <View style={[s.brandIcon, {backgroundColor: isDark ? 'rgba(59,130,246,0.16)' : '#EEF5FF'}]}>
                        <Ionicons
                          name={BRAND_ICON[brand.slug] || 'help-circle-outline'}
                          size={22}
                          color={theme.brand.primary}
                        />
                      </View>
                      <Text style={[s.brandName, {color: theme.text.title}]}>{brand.brand}</Text>
                      <Text style={[s.brandMeta, {color: theme.text.muted}]}>
                        {brand.faultCodes.length} codes
                        {brand.flowcharts.length ? ` · ${brand.flowcharts.length} flowcharts` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(160).springify()}
                style={[s.disclaimerCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
              >
                <Ionicons name="warning-outline" size={20} color="#B45309" />
                <Text style={[s.disclaimerText, {color: theme.text.muted}]}>
                  For qualified Gas Safe engineers only. Always isolate gas and electrical supplies before testing. Readings vary by model — refer to the manufacturer's service manual for the appliance in front of you. GasPilot accepts no liability for damage or injury.
                </Text>
              </Animated.View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {flex: 1},
  scroll: {paddingHorizontal: 20},
  header: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20},
  title: {fontSize: 32, fontWeight: '800', letterSpacing: -0.5},
  subtitle: {fontSize: 15, fontWeight: '500', marginTop: 4, lineHeight: 21},
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  searchInput: {flex: 1, fontSize: 16, fontWeight: '600'},
  sectionLabel: {fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginBottom: 10},
  hitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  hitCode: {
    minWidth: 54,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hitCodeText: {fontSize: 15, fontWeight: '800'},
  hitTitle: {fontSize: 15, fontWeight: '700'},
  hitBrand: {fontSize: 13, marginTop: 2},
  brandGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  brandCard: {
    width: '47%',
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  brandName: {fontSize: 17, fontWeight: '800'},
  brandMeta: {fontSize: 13, marginTop: 4, lineHeight: 18},
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    marginTop: 24,
  },
  disclaimerText: {flex: 1, fontSize: 13, lineHeight: 20},
});
