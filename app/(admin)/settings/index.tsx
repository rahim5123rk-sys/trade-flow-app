import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';
import { uploadImage } from '../../../src/services/storage';

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
  onToggle
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
      <Ionicons name={icon} size={20} color={isDestructive ? Colors.danger : Colors.primary} />
    </View>
    <View style={styles.rowContent}>
      <Text style={[styles.rowLabel, isDestructive && styles.destructiveText]}>{label}</Text>
      {value && <Text style={styles.rowValue}>{value}</Text>}
    </View>
    {hasToggle ? (
      <Switch 
        value={toggleValue} 
        onValueChange={onToggle} 
        trackColor={{ false: '#E2E8F0', true: Colors.primary }}
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
  multiline = false 
}: { 
  label: string; 
  value: string; 
  onChange: (t: string) => void; 
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  multiline?: boolean;
}) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={[styles.inputWrapper, multiline && { alignItems: 'flex-start' }]}>
      <Ionicons name={icon} size={20} color={Colors.textLight} style={{ marginRight: 10, marginTop: multiline ? 8 : 0 }} />
      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        multiline={multiline}
      />
    </View>
  </View>
);

// --- Main Screen ---

export default function SettingsScreen() {
  const { userProfile, signOut, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form State
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  
  // Preferences State (Mock)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.display_name || '');
      loadCompanyData();
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
      setLogoUrl(data.logo_url || '');
    }
  };

  const handleLogoUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos to upload a logo.');
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
        // Save immediately
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

  const handleSaveChanges = async () => {
    setIsLoading(true);
    try {
      // 1. Update Profile (Personal)
      if (userProfile?.id) {
        await supabase
          .from('profiles')
          .update({ display_name: displayName })
          .eq('id', userProfile.id);
        
        await refreshProfile(); // Refresh context
      }

      // 2. Update Company (Business)
      if (userProfile?.company_id) {
        await supabase
          .from('companies')
          .update({
            name: companyName,
            address: companyAddress,
            email: companyEmail,
            phone: companyPhone,
          })
          .eq('id', userProfile.company_id);
      }

      Alert.alert('Success', 'Settings saved successfully.');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Sign Out', 
        style: 'destructive', 
        onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
        } 
      }
    ]);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>Settings</Text>
          {isLoading && <ActivityIndicator color={Colors.primary} />}
        </View>

        {/* --- Profile Card --- */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
             <Text style={styles.avatarText}>
               {displayName.charAt(0).toUpperCase() || 'U'}
             </Text>
          </View>
          <View style={{ flex: 1 }}>
             <Text style={styles.profileName}>{displayName || 'User'}</Text>
             <Text style={styles.profileRole}>{userProfile?.role === 'admin' ? 'Administrator' : 'Worker'}</Text>
          </View>
        </View>

        {/* --- Branding Section --- */}
        <SectionHeader title="Branding & Identity" />
        <View style={styles.card}>
           <View style={styles.logoSection}>
              <View style={styles.logoPreview}>
                {isUploading ? <ActivityIndicator size="small" /> : logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.logoImg} />
                ) : (
                  <Ionicons name="image-outline" size={32} color="#CBD5E1" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                 <Text style={styles.logoLabel}>Company Logo</Text>
                 <Text style={styles.logoSub}>Used on invoices and job sheets.</Text>
                 <TouchableOpacity onPress={handleLogoUpload}>
                   <Text style={styles.uploadLink}>Upload New Image</Text>
                 </TouchableOpacity>
              </View>
           </View>

           <View style={styles.divider} />

           <InputField 
             label="Business Name" 
             value={companyName} 
             onChange={setCompanyName} 
             icon="briefcase-outline" 
             placeholder="e.g. Acme Plumbing" 
           />
        </View>

        {/* --- Contact Details --- */}
        <SectionHeader title="Contact Information" />
        <View style={styles.card}>
          <InputField 
             label="Business Address" 
             value={companyAddress} 
             onChange={setCompanyAddress} 
             icon="location-outline" 
             placeholder="Full business address" 
             multiline
           />
           <View style={{ height: 16 }} />
           <InputField 
             label="Email Address" 
             value={companyEmail} 
             onChange={setCompanyEmail} 
             icon="mail-outline" 
             placeholder="contact@business.com" 
           />
           <View style={{ height: 16 }} />
           <InputField 
             label="Phone Number" 
             value={companyPhone} 
             onChange={setCompanyPhone} 
             icon="call-outline" 
             placeholder="+44 7000 000000" 
           />
        </View>

        {/* --- Personal Details --- */}
        <SectionHeader title="Personal Profile" />
        <View style={styles.card}>
           <InputField 
             label="Display Name" 
             value={displayName} 
             onChange={setDisplayName} 
             icon="person-outline" 
             placeholder="Your Name" 
           />
        </View>

        {/* --- Preferences (Mock) --- */}
        <SectionHeader title="Preferences" />
        <View style={styles.card}>
          <SettingRow 
             icon="notifications-outline" 
             label="Push Notifications" 
             hasToggle 
             toggleValue={notificationsEnabled} 
             onToggle={setNotificationsEnabled} 
          />
          <View style={styles.divider} />
          <SettingRow 
             icon="moon-outline" 
             label="Dark Mode" 
             hasToggle 
             toggleValue={darkMode} 
             onToggle={setDarkMode} 
          />
        </View>

        {/* --- Save Button --- */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveChanges} disabled={isLoading}>
          <Text style={styles.saveBtnText}>{isLoading ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>

        {/* --- Support & Danger Zone --- */}
        <SectionHeader title="Support" />
        <View style={styles.card}>
          <SettingRow 
            icon="help-circle-outline" 
            label="Help Center" 
            onPress={() => Linking.openURL('https://google.com')} 
          />
          <View style={styles.divider} />
          <SettingRow 
             icon="log-out-outline" 
             label="Sign Out" 
             isDestructive 
             onPress={handleSignOut} 
          />
        </View>

        <Text style={styles.versionText}>TradeFlow v1.0.2 (Build 240)</Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  screenTitle: { fontSize: 30, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  
  // Profile Card
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 20, marginBottom: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  avatarContainer: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#fff' },
  profileName: { fontSize: 18, fontWeight: '700', color: Colors.text },
  profileRole: { fontSize: 13, color: Colors.textLight, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Sections
  sectionHeader: { fontSize: 13, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 24, shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },

  // Logo Upload
  logoSection: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  logoPreview: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  logoImg: { width: '100%', height: '100%' },
  logoLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  logoSub: { fontSize: 12, color: Colors.textLight, marginBottom: 8 },
  uploadLink: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  // Inputs
  inputContainer: { gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: Colors.text, marginLeft: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.text, fontWeight: '500' },
  textArea: { height: 80, textAlignVertical: 'top' },

  // Rows
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  destructiveIconBox: { backgroundColor: '#FEF2F2' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500', color: Colors.text },
  destructiveText: { color: Colors.danger, fontWeight: '600' },
  rowValue: { fontSize: 13, color: Colors.textLight, marginTop: 2 },

  // Buttons
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 24, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  
  versionText: { textAlign: 'center', color: Colors.textLight, fontSize: 11, marginBottom: 20 },
});