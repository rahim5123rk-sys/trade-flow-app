import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors } from '../../../constants/theme';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';
import { uploadImage } from '../../../src/services/storage';

export default function SettingsScreen() {
  const { userProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (!userProfile?.company_id) return;
    loadCompanyData();
  }, [userProfile]);

  const loadCompanyData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', userProfile!.company_id)
      .single();

    if (data) {
      setName(data.name || '');
      setAddress(data.address || '');
      setPhone(data.phone || '');
      setEmail(data.email || '');
      setLogoUrl(data.logo_url || '');
    }
    setLoading(false);
  };

  const handlePickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setUploading(true);
      try {
        const url = await uploadImage(result.assets[0].uri, 'logos');
        setLogoUrl(url);
        await supabase
          .from('companies')
          .update({ logo_url: url })
          .eq('id', userProfile!.company_id);
          
        Alert.alert('Success', 'Logo updated!');
      } catch (e) {
        Alert.alert('Error', 'Failed to upload logo.');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('companies')
      .update({ name, address, phone, email })
      .eq('id', userProfile!.company_id);

    if (!error) Alert.alert('Saved', 'Company details updated.');
    else Alert.alert('Error', 'Could not save details.');
    
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Company Logo</Text>
          <View style={styles.logoRow}>
            <View style={styles.logoPreview}>
              {uploading ? (
                <ActivityIndicator color={Colors.primary} />
              ) : logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logoImage} />
              ) : (
                <Ionicons name="image-outline" size={40} color="#ccc" />
              )}
            </View>
            <TouchableOpacity style={styles.uploadBtn} onPress={handlePickLogo}>
              <Text style={styles.uploadBtnText}>Upload New Logo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Business Details</Text>
          <Text style={styles.label}>Company Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />
          
          <Text style={styles.label}>Address</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} multiline />
          
          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 16, ...Colors.shadow },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16, color: Colors.text },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  logoPreview: { width: 80, height: 80, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  logoImage: { width: '100%', height: '100%' },
  uploadBtn: { marginLeft: 16, backgroundColor: '#f1f5f9', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  uploadBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textLight, marginTop: 12, marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, fontSize: 16 },
  saveBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  logoutBtn: { padding: 16, alignItems: 'center', marginTop: 20 },
  logoutText: { color: Colors.danger, fontWeight: '600' },
});