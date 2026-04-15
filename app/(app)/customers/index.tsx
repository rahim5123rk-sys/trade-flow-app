import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors, UI} from '../../../constants/theme';
import {useCustomers} from '../../../hooks/useCustomers';
import {useAuth} from '../../../src/context/AuthContext';
import {useAppTheme} from '../../../src/context/ThemeContext';

export default function CustomersListScreen() {
  const {userProfile} = useAuth();
  const {theme, isDark} = useAppTheme();
  const insets = useSafeAreaInsets();
  const {customers: filteredCustomers, loading, refreshing, loadingMore, hasMore, search, setSearch, onRefresh, loadMore} = useCustomers();

  const renderCustomer = ({item}: {item: any}) => (
    <TouchableOpacity
      style={[styles.card, {backgroundColor: theme.surface.card}, isDark && {borderWidth: 1, borderColor: theme.glass.border}, theme.shadow]}
      onPress={() => router.push(`/(app)/customers/${item.id}`)}
    >
      <View style={styles.row}>
        <View style={[styles.avatar, {backgroundColor: isDark ? theme.surface.elevated : UI.surface.base}]}>
          <Text style={[styles.avatarText, {color: theme.brand.primary}]}>
            {item.name[0]?.toUpperCase()}
          </Text>
        </View>
        <View style={{flex: 1}}>
          <Text style={[styles.name, {color: theme.text.title}]}>{item.name}</Text>
          {item.company_name ? (
            <Text style={[styles.companyName, {color: theme.brand.primary}]} numberOfLines={1}>
              {item.company_name}
            </Text>
          ) : null}
          <Text style={[styles.address, {color: theme.text.muted}]} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.text.muted} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, {paddingTop: insets.top, backgroundColor: theme.surface.base}]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={theme.text.title} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, {color: theme.text.title, flex: 1}]}>Customers</Text>
      </View>

      <View style={[styles.searchBox, {backgroundColor: theme.surface.card, borderColor: isDark ? theme.surface.border : Colors.border}]}>
        <Ionicons name="search" size={20} color={theme.text.muted} />
        <TextInput
          style={[styles.input, {color: theme.text.title}]}
          placeholder="Search customers..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={theme.text.placeholder}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color={theme.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator
          size="large"
          color={theme.brand.primary}
          style={{marginTop: 20}}
        />
      ) : (
        <FlatList
          data={filteredCustomers}
          renderItem={renderCustomer}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{padding: 16, paddingBottom: 100}}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.brand.primary}
            />
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 8, paddingVertical: 14, marginTop: 8, marginBottom: 20,
                  borderRadius: 14, backgroundColor: UI.surface.primaryLight,
                  borderWidth: 1, borderColor: '#C7D2FE',
                }}
                onPress={loadMore}
                activeOpacity={0.7}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={UI.brand.primary} />
                ) : (
                  <>
                    <Ionicons name="chevron-down-outline" size={18} color={UI.brand.primary} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: UI.brand.primary }}>Load more customers</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : filteredCustomers.length > 0 ? (
              <Text style={{ textAlign: 'center', color: theme.text.muted, fontSize: 13, paddingVertical: 16 }}>
                All customers loaded
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <Text style={[styles.empty, {color: theme.text.muted}]}>No customers found.</Text>
          }
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {marginLeft: 10, flex: 1, fontSize: 16, color: Colors.text},
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    ...Colors.shadow,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: 12},
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: UI.surface.base,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {fontSize: 18, fontWeight: '700', color: Colors.primary},
  name: {fontSize: 16, fontWeight: '700', color: Colors.text},
  companyName: {fontSize: 13, fontWeight: '600', marginTop: 1},
  address: {fontSize: 14, color: Colors.textLight},
  empty: {textAlign: 'center', marginTop: 40, color: Colors.textLight},
});