import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {supabase} from '../../src/config/supabase';
import {useAuth} from '../../src/context/AuthContext';
import {useAppTheme} from '../../src/context/ThemeContext';
import {SiteAddress} from '../../src/types';
import {UI} from '../../constants/theme';

export interface SiteAddressSelection {
  addressLine1: string;
  addressLine2: string;
  city: string;
  postCode: string;
  tenantTitle: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
}

interface SiteAddressPickerProps {
  onSelect: (address: SiteAddressSelection) => void;
}

export function SiteAddressPicker({onSelect}: SiteAddressPickerProps) {
  const {theme, isDark} = useAppTheme();
  const {userProfile} = useAuth();
  const [visible, setVisible] = useState(false);
  const [addresses, setAddresses] = useState<SiteAddress[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchAddresses = useCallback(async () => {
    if (!userProfile?.company_id) return;
    setLoading(true);
    try {
      const {data} = await supabase
        .from('site_addresses')
        .select('*')
        .eq('company_id', userProfile.company_id)
        .order('updated_at', {ascending: false})
        .limit(100);
      setAddresses(data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [userProfile?.company_id]);

  useEffect(() => {
    if (visible) {
      fetchAddresses();
      setSearchText('');
    }
  }, [visible, fetchAddresses]);

  const filtered = useMemo(() => {
    if (!searchText.trim()) return addresses;
    const lower = searchText.toLowerCase();
    return addresses.filter(
      (a) =>
        a.address_line_1?.toLowerCase().includes(lower) ||
        a.city?.toLowerCase().includes(lower) ||
        a.post_code?.toLowerCase().includes(lower) ||
        a.tenant_name?.toLowerCase().includes(lower),
    );
  }, [addresses, searchText]);

  const handleSelect = (item: SiteAddress) => {
    onSelect({
      addressLine1: item.address_line_1 || '',
      addressLine2: item.address_line_2 || '',
      city: item.city || '',
      postCode: item.post_code || '',
      tenantTitle: item.tenant_title || '',
      tenantName: item.tenant_name || '',
      tenantEmail: item.tenant_email || '',
      tenantPhone: item.tenant_phone || '',
    });
    setVisible(false);
  };

  const formatAddress = (item: SiteAddress) =>
    [item.address_line_1, item.address_line_2, item.city, item.post_code]
      .filter(Boolean)
      .join(', ');

  return (
    <>
      <TouchableOpacity
        style={[styles.triggerBtn, isDark && {backgroundColor: `${theme.brand.primary}18`, borderColor: theme.brand.primary}]}
        onPress={() => setVisible(true)}
        activeOpacity={0.75}
      >
        <Ionicons name="location-outline" size={14} color={theme.brand.primary} />
        <Text style={[styles.triggerText, {color: theme.brand.primary}]}>Choose from existing</Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1}}>
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} />
            <Animated.View
              entering={FadeInDown.duration(350).springify()}
              style={[styles.modal, isDark && {backgroundColor: theme.surface.card}]}
            >
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <LinearGradient
                    colors={isDark ? [theme.brand.primary, theme.brand.primaryDark] as [string, string] : UI.gradients.primary}
                    style={styles.modalTitleIcon}
                  >
                    <Ionicons name="location" size={18} color={UI.text.white} />
                  </LinearGradient>
                  <Text style={[styles.modalTitle, isDark && {color: theme.text.title}]}>Select Site Address</Text>
                </View>
                <TouchableOpacity
                  style={[styles.modalClose, isDark && {backgroundColor: theme.surface.elevated}]}
                  onPress={() => setVisible(false)}
                >
                  <Ionicons name="close" size={20} color={isDark ? theme.text.muted : UI.text.muted} />
                </TouchableOpacity>
              </View>

              {/* Search */}
              <View style={[styles.modalSearch, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border}]}>
                <Ionicons name="search" size={18} color={UI.text.muted} />
                <TextInput
                  style={[styles.modalSearchInput, isDark && {color: theme.text.title}]}
                  placeholder="Search by address, tenant, postcode..."
                  placeholderTextColor="#94a3b8"
                  value={searchText}
                  onChangeText={setSearchText}
                  autoFocus
                />
                {searchText.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchText('')}>
                    <Ionicons name="close-circle" size={18} color={isDark ? theme.text.muted : UI.surface.border} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Count */}
              <Text style={[styles.modalCount, isDark && {color: theme.text.muted}]}>
                {filtered.length} address{filtered.length !== 1 ? 'es' : ''}
                {searchText ? ' found' : ''}
              </Text>

              {/* List */}
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={{paddingBottom: 20}}
                ListEmptyComponent={
                  <View style={styles.emptyList}>
                    <Ionicons name="location-outline" size={40} color={isDark ? theme.text.muted : UI.surface.border} />
                    <Text style={[styles.emptyText, isDark && {color: theme.text.muted}]}>
                      {loading ? 'Loading...' : 'No saved addresses'}
                    </Text>
                    <Text style={[styles.emptySubText, isDark && {color: theme.text.placeholder}]}>
                      {loading ? '' : 'Addresses are saved automatically when you submit forms'}
                    </Text>
                  </View>
                }
                renderItem={({item, index}) => (
                  <Animated.View entering={FadeInDown.delay(index * 40).duration(250)}>
                    <TouchableOpacity
                      style={[styles.addressRow, isDark && {borderBottomColor: theme.surface.border}]}
                      activeOpacity={0.6}
                      onPress={() => handleSelect(item)}
                    >
                      <View style={[styles.addressIcon, isDark && {backgroundColor: `${theme.brand.primary}18`}]}>
                        <Ionicons name="home-outline" size={18} color={theme.brand.primary} />
                      </View>
                      <View style={{flex: 1}}>
                        <Text style={[styles.addressText, isDark && {color: theme.text.title}]} numberOfLines={2}>
                          {formatAddress(item)}
                        </Text>
                        {item.tenant_name ? (
                          <Text style={[styles.tenantText, isDark && {color: theme.text.muted}]}>
                            {item.tenant_name}
                            {item.tenant_phone ? ` \u00B7 ${item.tenant_phone}` : ''}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={isDark ? theme.text.muted : UI.surface.border} />
                    </TouchableOpacity>
                  </Animated.View>
                )}
              />
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

/**
 * Upsert a site address after form submission.
 * Call this silently — no UI needed.
 */
export async function upsertSiteAddress(
  companyId: string,
  data: {
    addressLine1: string;
    addressLine2?: string;
    city?: string;
    postCode: string;
    tenantTitle?: string;
    tenantName?: string;
    tenantEmail?: string;
    tenantPhone?: string;
  },
) {
  if (!data.addressLine1.trim() || !data.postCode.trim()) return;

  try {
    await supabase.from('site_addresses').upsert(
      {
        company_id: companyId,
        address_line_1: data.addressLine1.trim(),
        address_line_2: data.addressLine2?.trim() || null,
        city: data.city?.trim() || null,
        post_code: data.postCode.trim().toUpperCase(),
        tenant_title: data.tenantTitle?.trim() || null,
        tenant_name: data.tenantName?.trim() || null,
        tenant_email: data.tenantEmail?.trim() || null,
        tenant_phone: data.tenantPhone?.trim() || null,
      },
      {onConflict: 'company_id,address_line_1,post_code'},
    );
  } catch {
    // silently fail — this is a convenience feature
  }
}

const styles = StyleSheet.create({
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: UI.surface.primaryLight,
    marginBottom: 12,
  },
  triggerText: {fontSize: 13, fontWeight: '700'},

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
  },
  modalTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  modalTitleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {fontSize: 20, fontWeight: '800', color: UI.text.title},
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: UI.surface.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.surface.base,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: UI.surface.divider,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: UI.text.title,
  },
  modalCount: {
    fontSize: 12,
    color: UI.text.muted,
    fontWeight: '600',
    marginBottom: 8,
    paddingLeft: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: UI.surface.elevated,
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: UI.surface.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressText: {fontSize: 14, fontWeight: '600', color: UI.text.title},
  tenantText: {fontSize: 12, fontWeight: '500', color: UI.text.muted, marginTop: 2},
  emptyList: {alignItems: 'center', paddingVertical: 40, gap: 8},
  emptyText: {fontSize: 16, fontWeight: '700', color: UI.text.bodyLight},
  emptySubText: {fontSize: 13, color: UI.text.muted, textAlign: 'center'},
});
