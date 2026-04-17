import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router} from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, {useEffect, useMemo, useState} from 'react';
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
import {GlassIconButton} from '../../../components/GlassIconButton';
import {Colors, UI} from '../../../constants/theme';
import {useAppTheme} from '../../../src/context/ThemeContext';
import {
  calculateGasRate,
  calculateGeneralOpenFlueVentilation,
  calculateOpenFlueCompartmentVentilation,
  calculateRoomSealedCompartmentVentilation,
  FuelType,
  GasRateMode,
  lookupWaterHardness,
  VentilationDestination,
  VentilationMode,
  WATER_AUTHORITY_LINKS,
} from '../../../src/utils/toolbox';

type ToolboxTool = 'menu' | 'gas-rate' | 'ventilation' | 'hardness';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;

const formatNumber = (value: number, decimals = 2): string => {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(decimals);
};

const formatStopwatch = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const ToolRow = ({
  label,
  description,
  icon,
  onPress,
  theme,
  isDark,
}: {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  theme: ReturnType<typeof useAppTheme>['theme'];
  isDark: boolean;
}) => (
  <TouchableOpacity
    style={[s.toolRow, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
    activeOpacity={0.75}
    onPress={onPress}
  >
    <View style={[s.toolRowIcon, isDark && {backgroundColor: theme.surface.elevated}]}>
      <Ionicons name={icon} size={18} color={theme.brand.primary} />
    </View>
    <View style={{flex: 1}}>
      <Text style={[s.toolRowTitle, {color: theme.text.title}]}>{label}</Text>
      <Text style={[s.toolRowDescription, {color: theme.text.muted}]}>{description}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
  </TouchableOpacity>
);

const ModeToggle = ({
  options,
  value,
  onChange,
  theme,
  isDark,
}: {
  options: Array<{value: string; label: string}>;
  value: string;
  onChange: (value: any) => void;
  theme: ReturnType<typeof useAppTheme>['theme'];
  isDark: boolean;
}) => (
  <View style={[s.segmentWrap, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
    {options.map((option) => {
      const active = option.value === value;
      return (
        <TouchableOpacity
          key={option.value}
          style={[
            s.segmentBtn,
            active && [s.segmentBtnActive, isDark && {backgroundColor: 'rgba(255,255,255,0.12)'}],
          ]}
          activeOpacity={0.75}
          onPress={() => onChange(option.value)}
        >
          <Text style={[s.segmentText, active ? s.segmentTextActive : s.segmentTextInactive, active && {color: theme.brand.primary}, !active && {color: theme.text.muted}]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const ResultCard = ({
  label,
  value,
  hint,
  accent,
  theme,
  isDark,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  theme: ReturnType<typeof useAppTheme>['theme'];
  isDark: boolean;
}) => (
  <View style={[s.resultCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
    <Text style={[s.resultLabel, {color: theme.text.muted}]}>{label}</Text>
    <Text style={[s.resultValue, {color: accent || theme.text.title}]}>{value}</Text>
    {hint ? <Text style={[s.resultHint, {color: theme.text.muted}]}>{hint}</Text> : null}
  </View>
);

export default function ToolboxScreen() {
  const {theme, isDark} = useAppTheme();
  const insets = useSafeAreaInsets();
  const [activeTool, setActiveTool] = useState<ToolboxTool>('menu');

  const [gasRateMode, setGasRateMode] = useState<GasRateMode>('metric');
  const [fuelType, setFuelType] = useState<FuelType>('natural_gas');
  const [initialReading, setInitialReading] = useState('0.584');
  const [finalReading, setFinalReading] = useState('0.632');
  const [metricTimerSeconds, setMetricTimerSeconds] = useState<'60' | '120'>('60');
  const [imperialSeconds, setImperialSeconds] = useState('60');
  const [metricStopwatchSeconds, setMetricStopwatchSeconds] = useState(0);
  const [metricStopwatchRunning, setMetricStopwatchRunning] = useState(false);

  const [ventilationScope, setVentilationScope] = useState<'open_flue' | 'compartment'>('open_flue');
  const [compartmentType, setCompartmentType] = useState<'room_sealed_compartment' | 'open_flue_compartment'>('room_sealed_compartment');
  const [ventDestination, setVentDestination] = useState<VentilationDestination>('room');
  const [ventilationKw, setVentilationKw] = useState('24');

  const [postcode, setPostcode] = useState('');

  useEffect(() => {
    if (!metricStopwatchRunning) {
      return;
    }

    const startedAt = Date.now() - metricStopwatchSeconds * 1000;
    const interval = setInterval(() => {
      setMetricStopwatchSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);

    return () => clearInterval(interval);
  }, [metricStopwatchRunning, metricStopwatchSeconds]);

  const gasRateResult = useMemo(
    () =>
      calculateGasRate({
        mode: gasRateMode,
        fuel: fuelType,
        totalSeconds: gasRateMode === 'metric' ? Number(metricTimerSeconds) : Number(imperialSeconds || 0),
        initialReading: Number(initialReading || 0),
        finalReading: Number(finalReading || 0),
      }),
    [fuelType, gasRateMode, metricTimerSeconds, imperialSeconds, initialReading, finalReading],
  );

  const ventilationMode: VentilationMode = ventilationScope === 'open_flue' ? 'general' : compartmentType;
  const totalKw = Number(ventilationKw || 0);
  const generalVentResult = useMemo(() => calculateGeneralOpenFlueVentilation(totalKw), [totalKw]);
  const roomSealedResult = useMemo(() => calculateRoomSealedCompartmentVentilation(totalKw), [totalKw]);
  const openFlueResult = useMemo(() => calculateOpenFlueCompartmentVentilation(totalKw, ventDestination), [totalKw, ventDestination]);
  const hardnessResult = useMemo(() => lookupWaterHardness(postcode), [postcode]);

  return (
    <View style={[s.root, {paddingTop: insets.top}]}>
      <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={{paddingBottom: TAB_BAR_HEIGHT + 100}}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.delay(40).springify()} style={s.header}>
            <GlassIconButton onPress={() => router.back()} />
            <View style={{flex: 1}}>
              <Text style={[s.title, {color: theme.text.title}]}>Tools</Text>
              <Text style={[s.subtitle, {color: theme.text.muted}]}>Gas calculators and field lookup tools</Text>
            </View>
          </Animated.View>

          {activeTool === 'menu' ? (
            <Animated.View entering={FadeInDown.delay(80).springify()} style={s.menuList}>
              <ToolRow
                label="Gas Rate Calculator"
                description="Metric and imperial gas rate with simplified outputs."
                icon="speedometer-outline"
                onPress={() => setActiveTool('gas-rate')}
                theme={theme}
                isDark={isDark}
              />
              <ToolRow
                label="Ventilation Calculator"
                description="Domestic open flue and compartment ventilation sizing."
                icon="apps-outline"
                onPress={() => setActiveTool('ventilation')}
                theme={theme}
                isDark={isDark}
              />
              <ToolRow
                label="Water Hardness Lookup"
                description="Postcode-based hardness estimate with supplier links."
                icon="water-outline"
                onPress={() => setActiveTool('hardness')}
                theme={theme}
                isDark={isDark}
              />
              <ToolRow
                label="Boiler Manuals"
                description="Open the boiler manuals library for service and installation documents."
                icon="book-outline"
                onPress={() => void WebBrowser.openBrowserAsync('https://www.freeboilermanuals.com')}
                theme={theme}
                isDark={isDark}
              />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.delay(80).springify()} style={s.menuBackWrap}>
              <TouchableOpacity
                style={[s.menuBackBtn, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
                activeOpacity={0.75}
                onPress={() => setActiveTool('menu')}
              >
                <Ionicons name="chevron-back" size={16} color={theme.text.title} />
                <Text style={[s.menuBackText, {color: theme.text.title}]}>All tools</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {activeTool === 'gas-rate' ? (
            <Animated.View entering={FadeInDown.delay(120).springify()}>
              <View style={[s.card, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
                <View style={s.cardHeader}>
                  <View style={[s.iconWrap, {backgroundColor: isDark ? 'rgba(59,130,246,0.18)' : '#EEF5FF'}]}>
                    <Ionicons name="flame-outline" size={18} color={theme.brand.primary} />
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={[s.cardTitle, {color: theme.text.title}]}>Gas Rate Calculator</Text>
                    <Text style={[s.cardSubtitle, {color: theme.text.muted}]}>Metric 0.01 m³ or imperial 1 ft³ timing converted to rate and heat input.</Text>
                  </View>
                </View>

                <Text style={[s.fieldLabel, {color: theme.text.body}]}>Meter Type</Text>
                <ModeToggle
                  options={[{value: 'metric', label: 'Metric 0.01 m³'}, {value: 'imperial', label: 'Imperial 1 ft³'}]}
                  value={gasRateMode}
                  onChange={setGasRateMode}
                  theme={theme}
                  isDark={isDark}
                />

                <Text style={[s.fieldLabel, {color: theme.text.body}]}>Fuel</Text>
                <ModeToggle
                  options={[{value: 'natural_gas', label: 'Natural Gas'}, {value: 'lpg', label: 'LPG'}]}
                  value={fuelType}
                  onChange={setFuelType}
                  theme={theme}
                  isDark={isDark}
                />

                {gasRateMode === 'metric' ? (
                  <>
                    <Text style={[s.fieldLabel, {color: theme.text.body}]}>Initial meter reading</Text>
                    <TextInput
                      style={[s.input, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title}]}
                      value={initialReading}
                      onChangeText={setInitialReading}
                      keyboardType="decimal-pad"
                      placeholder="0.584"
                      placeholderTextColor={theme.text.placeholder}
                    />
                  </>
                ) : null}

                {gasRateMode === 'metric' ? (
                  <>
                    <Text style={[s.fieldLabel, {color: theme.text.body}]}>Timer</Text>
                    <ModeToggle
                      options={[{value: '60', label: '1 minute'}, {value: '120', label: '2 minutes'}]}
                      value={metricTimerSeconds}
                      onChange={setMetricTimerSeconds}
                      theme={theme}
                      isDark={isDark}
                    />

                    <View style={[s.stopwatchCard, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}>
                      <View style={s.stopwatchHeader}>
                        <Text style={[s.stopwatchTitle, {color: theme.text.title}]}>Stopwatch</Text>
                        <Text style={[s.stopwatchSubtitle, {color: theme.text.muted}]}>Use this to time the reading, then leave the selector on 1 or 2 minutes.</Text>
                      </View>
                      <Text style={[s.stopwatchDisplay, {color: theme.text.title}]}>{formatStopwatch(metricStopwatchSeconds)}</Text>
                      <View style={s.stopwatchActions}>
                        <TouchableOpacity
                          style={[s.stopwatchButton, s.stopwatchPrimaryButton]}
                          activeOpacity={0.8}
                          onPress={() => setMetricStopwatchRunning((current) => !current)}
                        >
                          <Text style={s.stopwatchPrimaryText}>{metricStopwatchRunning ? 'Stop' : 'Start'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.stopwatchButton, s.stopwatchSecondaryButton, isDark && {borderColor: theme.surface.border, backgroundColor: theme.glass.bg}]}
                          activeOpacity={0.8}
                          onPress={() => {
                            setMetricStopwatchRunning(false);
                            setMetricStopwatchSeconds(0);
                          }}
                        >
                          <Text style={[s.stopwatchSecondaryText, {color: theme.text.title}]}>Reset</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[s.fieldLabel, {color: theme.text.body}]}>Seconds for one full revolution</Text>
                    <TextInput
                      style={[s.input, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title}]}
                      value={imperialSeconds}
                      onChangeText={setImperialSeconds}
                      keyboardType="number-pad"
                      placeholder="60"
                      placeholderTextColor={theme.text.placeholder}
                    />
                  </>
                )}

                {gasRateMode === 'metric' ? (
                  <>
                    <Text style={[s.fieldLabel, {color: theme.text.body}]}>Final meter reading</Text>
                    <TextInput
                      style={[s.input, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title}]}
                      value={finalReading}
                      onChangeText={setFinalReading}
                      keyboardType="decimal-pad"
                      placeholder="0.632"
                      placeholderTextColor={theme.text.placeholder}
                    />
                  </>
                ) : null}

                <Text style={[s.noteText, {color: theme.text.muted}]}>Checked figures: gas rate = gas used ÷ time × 3600. Metric uses final minus initial reading. Example 0.584 to 0.632 over 1 minute = 2.88 m³/hr, net 27.92 kW, gross 31.36 kW.</Text>
              </View>

              <View style={s.resultGrid}>
                <ResultCard label="Gas Rate" value={gasRateResult ? `${formatNumber(gasRateResult.cubicMetresPerHour, 2)} m³/hr` : '—'} hint={gasRateMode === 'metric' ? 'From reading difference' : 'From one-foot dial timing'} theme={theme} isDark={isDark} />
                <ResultCard label="Net kW" value={gasRateResult ? formatNumber(gasRateResult.netKw, 2) : '—'} accent="#059669" hint={gasRateResult?.fuelLabel} theme={theme} isDark={isDark} />
                <ResultCard label="Gross kW" value={gasRateResult ? formatNumber(gasRateResult.grossKw, 2) : '—'} accent={theme.brand.primary} hint={gasRateResult?.fuelLabel} theme={theme} isDark={isDark} />
                <ResultCard label={gasRateMode === 'metric' ? 'Gas Used' : 'Dial Volume'} value={gasRateResult ? (gasRateMode === 'metric' ? `${formatNumber(gasRateResult.measuredVolumeM3, 3)} m³` : '1 ft³') : '—'} hint={gasRateMode === 'metric' ? 'Final minus initial' : `${formatNumber(gasRateResult?.cubicFeetPerHour || 0, 1)} ft³/hr`} theme={theme} isDark={isDark} />
              </View>
            </Animated.View>
          ) : null}

          {activeTool === 'ventilation' ? (
            <Animated.View entering={FadeInDown.delay(120).springify()}>
              <View style={[s.card, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
                <View style={s.cardHeader}>
                  <View style={[s.iconWrap, {backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : '#ECFDF5'}]}>
                    <Ionicons name="resize-outline" size={18} color="#059669" />
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={[s.cardTitle, {color: theme.text.title}]}>Domestic Ventilation Calculator</Text>
                    <Text style={[s.cardSubtitle, {color: theme.text.muted}]}>Uses standard domestic free-area calculations for open flue and compartment ventilation.</Text>
                  </View>
                </View>

                <Text style={[s.fieldLabel, {color: theme.text.body}]}>Appliance input (kW)</Text>
                <TextInput
                  style={[s.input, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title}]}
                  value={ventilationKw}
                  onChangeText={setVentilationKw}
                  keyboardType="decimal-pad"
                  placeholder="24"
                  placeholderTextColor={theme.text.placeholder}
                />

                <Text style={[s.fieldLabel, {color: theme.text.body}]}>Ventilation type</Text>
                <ModeToggle
                  options={[
                    {value: 'open_flue', label: 'Open Flue'},
                    {value: 'compartment', label: 'Compartment'},
                  ]}
                  value={ventilationScope}
                  onChange={setVentilationScope}
                  theme={theme}
                  isDark={isDark}
                />

                {ventilationScope === 'compartment' ? (
                  <>
                    <Text style={[s.fieldLabel, {color: theme.text.body}]}>Compartment appliance</Text>
                    <ModeToggle
                      options={[{value: 'room_sealed_compartment', label: 'Room Sealed'}, {value: 'open_flue_compartment', label: 'Open Flue'}]}
                      value={compartmentType}
                      onChange={setCompartmentType}
                      theme={theme}
                      isDark={isDark}
                    />

                    <Text style={[s.fieldLabel, {color: theme.text.body}]}>Where does it ventilate to?</Text>
                    <ModeToggle
                      options={[{value: 'room', label: 'To room / internal'}, {value: 'outside', label: 'Direct outside'}]}
                      value={ventDestination}
                      onChange={setVentDestination}
                      theme={theme}
                      isDark={isDark}
                    />
                  </>
                ) : null}

                {ventilationScope === 'open_flue' ? (
                  <>
                    <Text style={[s.noteText, {color: theme.text.muted}]}>Open flue uses the standard domestic allowance of 7 kW adventitious air, then 5 cm² of permanent free area for each additional kW.</Text>
                  </>
                ) : null}
              </View>

              {ventilationMode === 'general' ? (
                <View style={s.resultGrid}>
                  <ResultCard label="Adventitious allowance" value="7 kW" hint="Subtracted before sizing" theme={theme} isDark={isDark} />
                  <ResultCard label="Excess input" value={generalVentResult ? `${formatNumber(generalVentResult.excessKw, 1)} kW` : '—'} theme={theme} isDark={isDark} />
                  <ResultCard label="Required vent" value={generalVentResult ? `${formatNumber(generalVentResult.requiredCm2, 0)} cm²` : '—'} accent="#059669" hint="5 cm² per kW above 7 kW" theme={theme} isDark={isDark} />
                </View>
              ) : null}

              {ventilationMode === 'room_sealed_compartment' ? (
                <View style={s.resultGrid}>
                  <ResultCard
                    label="High level vent"
                    value={roomSealedResult ? `${formatNumber((ventDestination === 'room' ? roomSealedResult.toRoom.highLevelCm2 : roomSealedResult.toOutside.highLevelCm2), 0)} cm²` : '—'}
                    hint={ventDestination === 'room' ? '10 cm² per kW' : '5 cm² per kW'}
                    theme={theme}
                    isDark={isDark}
                  />
                  <ResultCard
                    label="Low level vent"
                    value={roomSealedResult ? `${formatNumber((ventDestination === 'room' ? roomSealedResult.toRoom.lowLevelCm2 : roomSealedResult.toOutside.lowLevelCm2), 0)} cm²` : '—'}
                    hint={ventDestination === 'room' ? '10 cm² per kW' : '5 cm² per kW'}
                    theme={theme}
                    isDark={isDark}
                  />
                </View>
              ) : null}

              {ventilationMode === 'open_flue_compartment' ? (
                <View style={s.resultGrid}>
                  <ResultCard label="High level vent" value={openFlueResult ? `${formatNumber(openFlueResult.highLevelCm2, 0)} cm²` : '—'} accent="#B45309" hint={ventDestination === 'room' ? '10 cm² per kW' : '5 cm² per kW'} theme={theme} isDark={isDark} />
                  <ResultCard label="Low level vent" value={openFlueResult ? `${formatNumber(openFlueResult.lowLevelCm2, 0)} cm²` : '—'} accent="#B45309" hint={ventDestination === 'room' ? '20 cm² per kW' : '10 cm² per kW'} theme={theme} isDark={isDark} />
                </View>
              ) : null}

              <View style={[s.infoCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
                <Ionicons name="information-circle-outline" size={18} color={theme.text.muted} />
                <Text style={[s.infoText, {color: theme.text.muted}]}>Figures use standard domestic free-area rules: general open flue uses 5 cm² per kW above 7 kW, and compartment sizing varies depending on whether the vents open to the room or directly outside. Always confirm against the current standard and manufacturer instructions.</Text>
              </View>
            </Animated.View>
          ) : null}

          {activeTool === 'hardness' ? (
            <Animated.View entering={FadeInDown.delay(120).springify()}>
              <View style={[s.card, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
                <View style={s.cardHeader}>
                  <View style={[s.iconWrap, {backgroundColor: isDark ? 'rgba(14,165,233,0.18)' : '#EFF6FF'}]}>
                    <Ionicons name="water-outline" size={18} color="#0284C7" />
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={[s.cardTitle, {color: theme.text.title}]}>Water Hardness Lookup</Text>
                    <Text style={[s.cardSubtitle, {color: theme.text.muted}]}>Outward postcode estimate in ppm and °Clark using a built-in regional database.</Text>
                  </View>
                </View>

                <Text style={[s.fieldLabel, {color: theme.text.body}]}>Postcode</Text>
                <TextInput
                  style={[s.input, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title}]}
                  value={postcode}
                  onChangeText={setPostcode}
                  autoCapitalize="characters"
                  placeholder="SW1A 1AA"
                  placeholderTextColor={theme.text.placeholder}
                />
                <Text style={[s.noteText, {color: theme.text.muted}]}>This uses a static regional lookup. Treat it as a fast field estimate and verify against the local supplier when dosing or setting commissioning values.</Text>
              </View>

              {hardnessResult ? (
                <>
                  <View style={s.resultGrid}>
                    <ResultCard label="Area" value={hardnessResult.outwardCode} hint={hardnessResult.label} theme={theme} isDark={isDark} />
                    <ResultCard label="Supplier" value={hardnessResult.supplier} hint="Regional match" theme={theme} isDark={isDark} />
                    <ResultCard label="PPM" value={hardnessResult.ppmLabel} accent="#0284C7" hint={`Typical ${formatNumber(hardnessResult.typicalPpm, 0)} ppm`} theme={theme} isDark={isDark} />
                    <ResultCard label="°Clark" value={`${formatNumber(hardnessResult.clarkRange[0], 1)}–${formatNumber(hardnessResult.clarkRange[1], 1)}`} hint={`Typical ${formatNumber(hardnessResult.typicalClark, 1)} °Clark`} theme={theme} isDark={isDark} />
                  </View>

                  <View style={[s.infoCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
                    <Ionicons name="bookmark-outline" size={18} color={theme.text.muted} />
                    <Text style={[s.infoText, {color: theme.text.muted}]}>{hardnessResult.note}</Text>
                  </View>

                  <TouchableOpacity
                    style={[s.linkButton, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}
                    activeOpacity={0.75}
                    onPress={() => void WebBrowser.openBrowserAsync(hardnessResult.supplierUrl)}
                  >
                    <View style={s.linkButtonLeft}>
                      <Ionicons name="open-outline" size={18} color="#0284C7" />
                      <Text style={[s.linkButtonText, {color: theme.text.title}]}>Open {hardnessResult.supplier} checker</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
                  </TouchableOpacity>
                </>
              ) : postcode.trim().length > 0 ? (
                <View style={[s.infoCard, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
                  <Ionicons name="alert-circle-outline" size={18} color="#B45309" />
                  <Text style={[s.infoText, {color: theme.text.muted}]}>No static match found for that outward postcode yet. Use one of the official links below to verify hardness directly.</Text>
                </View>
              ) : null}

              <View style={[s.card, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
                <Text style={[s.cardTitle, {color: theme.text.title}]}>Official supplier links</Text>
                <Text style={[s.cardSubtitle, {color: theme.text.muted}]}>Quick access to major UK water-quality and hardness pages.</Text>
                <View style={s.linkList}>
                  {WATER_AUTHORITY_LINKS.map((link) => (
                    <TouchableOpacity
                      key={link.label}
                      style={[s.linkButton, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}
                      activeOpacity={0.75}
                      onPress={() => void WebBrowser.openBrowserAsync(link.url)}
                    >
                      <View style={s.linkButtonLeft}>
                        <Ionicons name="globe-outline" size={18} color={theme.brand.primary} />
                        <Text style={[s.linkButtonText, {color: theme.text.title}]}>{link.label}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </Animated.View>
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: UI.glass.bg,
    borderWidth: 1,
    borderColor: UI.glass.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {fontSize: 32, fontWeight: '800', color: Colors.text, letterSpacing: -0.5},
  subtitle: {fontSize: 16, fontWeight: '500', marginTop: 4, lineHeight: 22},
  menuList: {gap: 12, paddingBottom: 16},
  menuBackWrap: {marginBottom: 16},
  menuBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(15,23,42,0.06)',
  },
  menuBackText: {fontSize: 16, fontWeight: '700'},
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(15,23,42,0.06)',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  toolRowIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: UI.surface.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolRowTitle: {fontSize: 18, fontWeight: '800'},
  toolRowDescription: {fontSize: 15, lineHeight: 21, marginTop: 4},
  card: {
    backgroundColor: UI.glass.bg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: UI.glass.border,
    padding: 18,
    marginBottom: 16,
    shadowColor: UI.text.muted,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18},
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {fontSize: 20, fontWeight: '800', color: Colors.text},
  cardSubtitle: {fontSize: 16, lineHeight: 22, marginTop: 4},
  fieldLabel: {fontSize: 16, fontWeight: '700', marginBottom: 10, marginTop: 6},
  segmentWrap: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.84)',
    marginBottom: 14,
  },
  segmentBtn: {flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center'},
  segmentBtnActive: {backgroundColor: '#FFFFFF'},
  segmentText: {fontSize: 15},
  segmentTextActive: {fontWeight: '800'},
  segmentTextInactive: {fontWeight: '600'},
  inputRow: {flexDirection: 'row', gap: 12},
  input: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: UI.surface.divider,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 18,
    color: Colors.text,
    marginBottom: 12,
  },
  noteText: {fontSize: 15, lineHeight: 22},
  stopwatchCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.surface.divider,
    backgroundColor: '#F8FAFC',
    padding: 16,
    marginBottom: 14,
  },
  stopwatchHeader: {gap: 4},
  stopwatchTitle: {fontSize: 17, fontWeight: '800'},
  stopwatchSubtitle: {fontSize: 14, lineHeight: 20},
  stopwatchDisplay: {fontSize: 34, fontWeight: '800', letterSpacing: 1, marginTop: 14},
  stopwatchActions: {flexDirection: 'row', gap: 10, marginTop: 16},
  stopwatchButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  stopwatchPrimaryButton: {backgroundColor: '#2563EB'},
  stopwatchSecondaryButton: {
    borderWidth: 1,
    borderColor: UI.surface.divider,
    backgroundColor: '#FFFFFF',
  },
  stopwatchPrimaryText: {fontSize: 16, fontWeight: '800', color: '#FFFFFF'},
  stopwatchSecondaryText: {fontSize: 16, fontWeight: '700'},
  resultGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16},
  resultCard: {
    width: '47%',
    minHeight: 116,
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.84)',
  },
  resultLabel: {fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.2},
  resultValue: {fontSize: 26, fontWeight: '800', marginTop: 10},
  resultHint: {fontSize: 14, marginTop: 8, lineHeight: 20},
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.84)',
    marginBottom: 16,
  },
  infoText: {flex: 1, fontSize: 15, lineHeight: 22},
  linkList: {gap: 10, marginTop: 14},
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: UI.surface.divider,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginTop: 12,
  },
  linkButtonLeft: {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 10},
  linkButtonText: {fontSize: 16, fontWeight: '700'},
});
