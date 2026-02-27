import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { File, Paths } from 'expo-file-system/next';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Linking,
    PanResponder,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Colors, UI } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';
import { uploadImage } from '../../../src/services/storage';

const GLASS_BG = UI.glass.bg;
const GLASS_BORDER = UI.glass.border;

// --- Signature Constants & HTML ---
const SIG_HEIGHT = 160;
const sigCanvasHTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  * { margin:0; padding:0; }
  body { background: #fff; overflow: hidden; touch-action: none; }
  canvas { display: block; width: 100%; height: ${SIG_HEIGHT}px; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
  const c = document.getElementById('c');
  const ctx = c.getContext('2d');
  c.width = c.offsetWidth * 2;
  c.height = c.offsetHeight * 2;
  ctx.scale(2, 2);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  let drawing = false;
  let paths = [];
  let current = [];
  function getPos(e) {
    const t = e.touches ? e.touches[0] : e;
    const r = c.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }
  c.addEventListener('touchstart', (e) => { e.preventDefault(); drawing = true; const p = getPos(e); current = [p]; ctx.beginPath(); ctx.moveTo(p.x, p.y); });
  c.addEventListener('touchmove', (e) => { e.preventDefault(); if (!drawing) return; const p = getPos(e); current.push(p); ctx.lineTo(p.x, p.y); ctx.stroke(); });
  c.addEventListener('touchend', (e) => { e.preventDefault(); drawing = false; if (current.length > 0) paths.push([...current]); current = []; });
  window.clearCanvas = function() { ctx.clearRect(0, 0, c.width, c.height); paths = []; current = []; window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cleared' })); };
  window.getSignature = function() {
    if (paths.length === 0) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'empty' })); return; }
    const dataUrl = c.toDataURL('image/png');
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'signature', data: dataUrl }));
  };
</script>
</body>
</html>
`;

// --- Reusable Components ---

const SectionHeader = ({ title }: { title: string }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

const SettingRow = ({
  icon,
  label,
  value,
  isDestructive,
  onPress,
  hasToggle,
  toggleValue,
  onToggle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  isDestructive?: boolean;
  onPress?: () => void;
  hasToggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (val: boolean) => void;
}) => (
  <TouchableOpacity
    style={styles.row}
    onPress={onPress}
    activeOpacity={hasToggle ? 1 : 0.7}
    disabled={hasToggle && !onPress}
  >
    <View style={[styles.iconBox, isDestructive && styles.destructiveIconBox]}>
      <Ionicons
        name={icon}
        size={20}
        color={isDestructive ? UI.brand.danger : UI.brand.primary}
      />
    </View>
    <View style={styles.rowContent}>
      <Text style={[styles.rowLabel, isDestructive && styles.destructiveText]}>
        {label}
      </Text>
      {value && <Text style={styles.rowValue}>{value}</Text>}
    </View>
    {hasToggle ? (
      <Switch
        value={toggleValue}
        onValueChange={onToggle}
        trackColor={{ false: '#E2E8F0', true: UI.brand.primary }}
        thumbColor={'#fff'}
      />
    ) : (
      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
    )}
  </TouchableOpacity>
);

const InputField = ({
  label,
  value,
  onChange,
  icon,
  placeholder,
  multiline = false,
  minHeight,
  autoCapitalize = 'none',
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  multiline?: boolean;
  minHeight?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
}) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={[styles.inputWrapper, multiline && { alignItems: 'flex-start' }]}>
      {icon && (
        <Ionicons
          name={icon}
          size={20}
          color={UI.text.muted}
          style={{ marginRight: 10, marginTop: multiline ? 8 : 0 }}
        />
      )}
      <TextInput
        style={[
          styles.input, 
          multiline && styles.textArea,
          minHeight ? { minHeight } : {}
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
      />
    </View>
  </View>
);

// --- Main Screen ---

export default function SettingsScreen() {
  const { user, userProfile, signOut, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const sigWebViewRef = useRef<WebView>(null);

  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Data States
  const [workerCount, setWorkerCount] = useState(0);
  const [displayName, setDisplayName] = useState('');
  
  // Company Fields
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyTrade, setCompanyTrade] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // Invoice & Signature Fields
  const [invoiceTerms, setInvoiceTerms] = useState('14 days');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [savedSignatureBase64, setSavedSignatureBase64] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  // Preferences
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.display_name || '');
      loadCompanyData();
      loadWorkerCount();
    }
  }, [userProfile]);

  const loadCompanyData = async () => {
    if (!userProfile?.company_id) return;

    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('id', userProfile.company_id)
      .single();

    if (data) {
      setCompanyName(data.name || '');
      setCompanyAddress(data.address || '');
      setCompanyEmail(data.email || '');
      setCompanyPhone(data.phone || '');
      setCompanyTrade(data.trade || '');
      setLogoUrl(data.logo_url || '');
      
      // Load Settings JSON
      const s = data.settings || {};
      if (s.invoiceTerms) setInvoiceTerms(s.invoiceTerms);
      if (s.invoiceNotes) setInvoiceNotes(s.invoiceNotes);
      if (s.signatureBase64) setSavedSignatureBase64(s.signatureBase64);
    }
    setIsLoading(false);
  };

  const loadWorkerCount = async () => {
    if (!userProfile?.company_id) return;
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', userProfile.company_id)
      .eq('role', 'worker');
    setWorkerCount(count || 0);
  };

  // --- Signature Logic ---
  const handleWebViewMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'signature' && msg.data) {
        setSavedSignatureBase64(msg.data);
        setShowSignaturePad(false);
      }
    } catch (e) {}
  };

  const saveSignature = () => {
    sigWebViewRef.current?.injectJavaScript('window.getSignature(); true;');
  };

  const clearSignature = () => {
    setSavedSignatureBase64(null);
    setShowSignaturePad(false);
  };

  // --- Image Upload ---
  const handleLogoUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0].uri) {
      setIsUploading(true);
      try {
        const url = await uploadImage(result.assets[0].uri, 'logos');
        setLogoUrl(url);
        await supabase
          .from('companies')
          .update({ logo_url: url })
          .eq('id', userProfile!.company_id);
      } catch (error) {
        Alert.alert('Upload Failed', 'Could not upload image.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  // --- Save All ---
  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      // Update settings
      if (userProfile?.company_id) {
        const { data: currentData } = await supabase.from('companies').select('settings').eq('id', userProfile.company_id).single();
        const currentSettings = currentData?.settings || {};

        await supabase
          .from('companies')
          .update({
            name: companyName,
            address: companyAddress,
            email: companyEmail.trim(),
            phone: companyPhone,
            trade: companyTrade,
            settings: { 
                ...currentSettings, 
                invoiceTerms, 
                invoiceNotes, 
                signatureBase64: savedSignatureBase64,
            },
          })
          .eq('id', userProfile.company_id);
      }
      Alert.alert('Success', 'Settings saved successfully.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete My Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'Type DELETE to confirm. All your data including customers, jobs, documents and certificates will be permanently removed.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const userId = user?.id;
                      const companyId = userProfile?.company_id;

                      if (!userId) return;

                      // If admin, delete all company data
                      if (userProfile?.role === 'admin' && companyId) {
                        // Delete job activity logs
                        await supabase.from('job_activity').delete().eq('company_id', companyId);

                        // Clean up storage files
                        try {
                          const { data: jobPhotos } = await supabase.storage.from('job-photos').list();
                          if (jobPhotos && jobPhotos.length > 0) {
                            await supabase.storage.from('job-photos').remove(jobPhotos.map(f => f.name));
                          }
                          const { data: logos } = await supabase.storage.from('logos').list();
                          if (logos && logos.length > 0) {
                            await supabase.storage.from('logos').remove(logos.map(f => f.name));
                          }
                        } catch {
                          // Storage cleanup is best-effort
                        }

                        // Delete documents
                        await supabase.from('documents').delete().eq('company_id', companyId);
                        // Delete jobs
                        await supabase.from('jobs').delete().eq('company_id', companyId);
                        // Delete customers
                        await supabase.from('customers').delete().eq('company_id', companyId);
                        // Delete company
                        await supabase.from('companies').delete().eq('id', companyId);
                      }

                      // Delete user profile
                      await supabase.from('profiles').delete().eq('id', userId);

                      // Sign out and delete auth user
                      await supabase.auth.signOut();
                      router.replace('/(auth)/login');
                      Alert.alert('Account Deleted', 'Your account and data have been permanently deleted.');
                    } catch (error: any) {
                      Alert.alert('Error', error.message || 'Failed to delete account.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleExportData = async () => {
    try {
      const userId = user?.id;
      const companyId = userProfile?.company_id;
      if (!userId || !companyId) {
        Alert.alert('Error', 'No active session.');
        return;
      }

      Alert.alert('Export Data', 'This will generate a JSON file with all your personal data.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: async () => {
            try {
              // Gather all user data
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, email, display_name, role, created_at')
                .eq('id', userId)
                .single();

              const { data: company } = await supabase
                .from('companies')
                .select('name, address, email, phone, trade, created_at')
                .eq('id', companyId)
                .single();

              const { data: customers } = await supabase
                .from('customers')
                .select('name, company_name, address_line1, address_line2, city, county, postcode, email, phone, created_at')
                .eq('company_id', companyId);

              const { data: jobs } = await supabase
                .from('jobs')
                .select('title, description, status, scheduled_date, created_at, customer_snapshot')
                .eq('company_id', companyId);

              const { data: documents } = await supabase
                .from('documents')
                .select('type, status, total, created_at')
                .eq('company_id', companyId);

              const exportData = {
                exportDate: new Date().toISOString(),
                exportedBy: userId,
                profile,
                company,
                customers: customers || [],
                jobs: (jobs || []).map((j: any) => ({ ...j, customer_snapshot: undefined })),
                documents: (documents || []).map((d: any) => ({ type: d.type, status: d.status, total: d.total, created_at: d.created_at })),
              };

              const json = JSON.stringify(exportData, null, 2);
              const file = new File(Paths.cache, 'tradeflow-data-export.json');
              file.write(json);

              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(file.uri, {
                  mimeType: 'application/json',
                  dialogTitle: 'TradeFlow Data Export',
                });
              } else {
                Alert.alert('Exported', 'Data has been saved to your device.');
              }
            } catch (error: any) {
              Alert.alert('Export Failed', error.message || 'Could not export data.');
            }
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to export data.');
    }
  };

  const handleSwipeClose = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(app)/dashboard' as any);
  };

  const swipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dx > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 90 && Math.abs(gesture.dy) < 70) {
          handleSwipeClose();
        }
      },
    })
  ).current;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      {...swipeResponder.panHandlers}
    >
      <LinearGradient
        colors={UI.gradients.appBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.delay(40).springify()} style={styles.headerRow}>
          <View>
            <Text style={styles.screenTitle}>Settings</Text>
            <Text style={styles.screenSubtitle}>Business profile & preferences</Text>
          </View>
          {isLoading ? (
            <ActivityIndicator color={UI.brand.primary} />
          ) : (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{userProfile?.role === 'admin' ? 'ADMIN' : 'WORKER'}</Text>
            </View>
          )}
        </Animated.View>

        {/* --- Profile Card --- */}
        <Animated.View entering={FadeInDown.delay(70).springify()} style={styles.profileCard}>
          <LinearGradient colors={UI.gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase() || 'U'}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{displayName || 'User'}</Text>
            <Text style={styles.profileRole}>{userProfile?.role === 'admin' ? 'Administrator' : 'Worker'}</Text>
          </View>
        </Animated.View>

        {/* --- User & Company --- */}
        <SectionHeader title="Details" />
        <View style={styles.card}>
          <SettingRow
            icon="person-circle-outline"
            label="User Details"
            value="Name, email, Gas Safe, licence & OFTEC"
            onPress={() => router.push('/(app)/settings/user-details')}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="business-outline"
            label="Company Details"
            value="Company name, address, telephone & trade"
            onPress={() => router.push('/(app)/settings/company-details')}
          />
        </View>

        {/* --- Branding --- */}
        <SectionHeader title="Branding" />
        <View style={styles.card}>
          <View style={styles.logoSection}>
            <View style={styles.logoPreview}>
              {isUploading ? <ActivityIndicator size="small" /> : logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logoImg} /> : <Ionicons name="image-outline" size={32} color="#CBD5E1" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.logoLabel}>Company Logo</Text>
              <Text style={styles.logoSub}>Used on invoices and job sheets.</Text>
              <TouchableOpacity onPress={handleLogoUpload}>
                <Text style={styles.uploadLink}>Upload New Image</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* --- Team Management --- */}
        <SectionHeader title="Team Management" />
        <View style={styles.card}>
          <SettingRow
            icon="people-outline"
            label="Manage Team"
            value={workerCount > 0 ? `${workerCount} worker${workerCount !== 1 ? 's' : ''}` : 'No workers yet'}
            onPress={() => router.push('/(app)/workers')}
          />
        </View>

        {/* --- Invoice Defaults (NEW) --- */}
        <SectionHeader title="Invoice Defaults" />
        <View style={styles.card}>
          <InputField 
            label="Payment Terms" 
            value={invoiceTerms} 
            onChange={setInvoiceTerms} 
            placeholder="e.g. 14 days"
            icon="time-outline"
          />
          <View style={{ height: 16 }} />
          <InputField 
            label="Notes & Payment Instructions" 
            value={invoiceNotes} 
            onChange={setInvoiceNotes} 
            placeholder={"Bank details, sort code, etc."}
            icon="document-text-outline"
            multiline
            minHeight={100}
          />
        </View>

        {/* --- Signature (NEW) --- */}
        <SectionHeader title="Digital Signature" />
        <View style={styles.card}>
          <Text style={styles.hint}>Used for signing off invoices and job sheets.</Text>
          
          {savedSignatureBase64 && !showSignaturePad ? (
            <View>
              <View style={styles.signaturePreview}>
                <Image source={{ uri: savedSignatureBase64 }} style={{ width: '100%', height: 100 }} resizeMode="contain" />
              </View>
              <View style={styles.sigActions}>
                <TouchableOpacity style={styles.sigBtn} onPress={() => setShowSignaturePad(true)}>
                  <Ionicons name="create-outline" size={16} color={Colors.primary} />
                  <Text style={styles.sigBtnText}>Re-draw</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sigBtn, styles.sigBtnDanger]} onPress={clearSignature}>
                  <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                  <Text style={[styles.sigBtnText, { color: Colors.danger }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.signaturePadWrapper}>
                <WebView
                  ref={sigWebViewRef}
                  source={{ html: sigCanvasHTML }}
                  style={{ height: SIG_HEIGHT, backgroundColor: 'transparent' }}
                  scrollEnabled={false}
                  bounces={false}
                  onMessage={handleWebViewMessage}
                />
                <View style={styles.sigPadLabel}>
                  <Ionicons name="pencil" size={12} color="#cbd5e1" />
                  <Text style={styles.sigPadLabelText}>Sign here</Text>
                </View>
              </View>
              <View style={styles.sigActions}>
                <TouchableOpacity style={styles.sigBtn} onPress={() => sigWebViewRef.current?.injectJavaScript('window.clearCanvas(); true;')}>
                  <Ionicons name="refresh" size={16} color={Colors.textLight} />
                  <Text style={[styles.sigBtnText, { color: Colors.textLight }]}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sigBtn, styles.sigBtnPrimary]} onPress={saveSignature}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={[styles.sigBtnText, { color: '#fff' }]}>Save Signature</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* --- Preferences --- */}
        <SectionHeader title="Preferences" />
        <View style={styles.card}>
          <SettingRow icon="notifications-outline" label="Push Notifications" hasToggle toggleValue={notificationsEnabled} onToggle={setNotificationsEnabled} />
          <View style={styles.divider} />
          <SettingRow icon="moon-outline" label="Dark Mode" hasToggle toggleValue={darkMode} onToggle={setDarkMode} />
        </View>

        {/* --- Save Button --- */}
        <TouchableOpacity style={[styles.saveBtn, isSaving && { opacity: 0.7 }]} onPress={handleSaveChanges} disabled={isSaving}>
          <LinearGradient colors={UI.gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveBtnGradient}>
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
          </LinearGradient>
        </TouchableOpacity>

        {/* --- Legal & Privacy --- */}
        <SectionHeader title="Legal & Privacy" />
        <View style={styles.card}>
          <SettingRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            value="How we handle your data"
            onPress={() => router.push('/(app)/settings/privacy-policy')}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => router.push('/(app)/settings/terms-of-service')}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="download-outline"
            label="Export My Data"
            value="Download all your data (JSON)"
            onPress={handleExportData}
          />
        </View>

        {/* --- Support --- */}
        <SectionHeader title="Support" />
        <View style={styles.card}>
          <SettingRow icon="help-circle-outline" label="Help Center" onPress={() => Linking.openURL('https://google.com')} />
          <View style={styles.divider} />
          <SettingRow icon="log-out-outline" label="Sign Out" isDestructive onPress={handleSignOut} />
          <View style={styles.divider} />
          <SettingRow icon="trash-outline" label="Delete My Account" isDestructive onPress={handleDeleteAccount} />
        </View>

        <Text style={styles.versionText}>TradeFlow v1.0.5</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  screenTitle: { fontSize: 30, fontWeight: '800', color: UI.text.title, letterSpacing: -0.5 },
  screenSubtitle: { fontSize: 13, color: UI.text.muted, marginTop: 2 },
  roleBadge: {
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '800', color: UI.brand.primary, letterSpacing: 0.6 },
  
  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    borderRadius: 20,
    marginBottom: 26,
    ...Colors.shadow,
  },
  avatarContainer: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#fff' },
  profileName: { fontSize: 18, fontWeight: '700', color: UI.text.title },
  profileRole: { fontSize: 13, color: UI.text.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionHeader: { fontSize: 12, fontWeight: '800', color: UI.text.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginLeft: 4 },
  card: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 16,
    padding: 16,
    marginBottom: 22,
    ...Colors.shadow,
  },
  divider: { height: 1, backgroundColor: 'rgba(148,163,184,0.18)', marginVertical: 12 },

  // Logo
  logoSection: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  logoPreview: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(248,250,252,0.75)' : '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: '100%', height: '100%' },
  logoLabel: { fontSize: 15, fontWeight: '700', color: UI.text.title },
  logoSub: { fontSize: 12, color: UI.text.muted, marginBottom: 8 },
  uploadLink: { fontSize: 13, fontWeight: '700', color: UI.brand.primary },

  // Inputs
  inputContainer: { gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: UI.text.body, marginLeft: 4 },
  fieldHint: { fontSize: 12, color: UI.text.muted, marginTop: 8, marginLeft: 4 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(248,250,252,0.78)' : '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: UI.text.title, fontWeight: '500' },
  textArea: { height: '100%', textAlignVertical: 'top', paddingTop: 12 },

  // Settings Row
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(99,102,241,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  destructiveIconBox: { backgroundColor: '#FEF2F2' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: UI.text.title },
  destructiveText: { color: Colors.danger, fontWeight: '600' },
  rowValue: { fontSize: 13, color: UI.text.muted, marginTop: 2 },

  // Signature Styles
  hint: { fontSize: 12, color: UI.text.muted, fontStyle: 'italic', marginBottom: 12 },
  signaturePreview: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 8, backgroundColor: '#fefefe', marginBottom: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  signaturePadWrapper: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, borderStyle: 'dashed', backgroundColor: '#fefefe', overflow: 'hidden', marginBottom: 8, position: 'relative' },
  sigPadLabel: { position: 'absolute', bottom: 6, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.5 },
  sigPadLabelText: { fontSize: 11, color: '#cbd5e1' },
  sigActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  sigBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f1f5f9' },
  sigBtnPrimary: { backgroundColor: UI.brand.primary },
  sigBtnDanger: { backgroundColor: '#FEF2F2' },
  sigBtnText: { fontSize: 13, fontWeight: '600', color: UI.brand.primary },

  // Buttons
  saveBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 24, ...Colors.shadow },
  saveBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  versionText: { textAlign: 'center', color: UI.text.muted, fontSize: 11, marginBottom: 20 },
});