import {Ionicons} from '@expo/vector-icons';
import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {UI} from '../constants/theme';
import {useJobParts, PartStatus} from '../hooks/useJobParts';
import {useAppTheme} from '../src/context/ThemeContext';

const STATUS_CONFIG: Record<PartStatus, {label: string; bg: string; color: string}> = {
  needed: {label: 'Needed', bg: '#FEF3C7', color: '#92400E'},
  ordered: {label: 'Ordered', bg: '#DBEAFE', color: '#1E40AF'},
  collected: {label: 'Collected', bg: '#D1FAE5', color: '#065F46'},
};

export default function JobPartsSection({jobId}: {jobId: string}) {
  const {theme, isDark} = useAppTheme();
  const {parts, loading, addPart, cycleStatus, removePart} = useJobParts(jobId);
  const [newPartName, setNewPartName] = useState('');

  const handleAdd = async () => {
    if (!newPartName.trim()) return;
    await addPart(newPartName);
    setNewPartName('');
  };

  const handleRemove = (id: string, name: string) => {
    Alert.alert('Remove Part', `Remove "${name}" from the list?`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Remove', style: 'destructive', onPress: () => removePart(id)},
    ]);
  };

  return (
    <View style={[s.card, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
      {/* Header */}
      <View style={s.header}>
        <View style={[s.iconWrap, {backgroundColor: 'rgba(217,119,6,0.1)'}]}>
          <Ionicons name="construct" size={16} color="#D97706" />
        </View>
        <Text style={[s.title, isDark && {color: theme.text.title}]}>Parts Needed</Text>
        {parts.length > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{parts.length}</Text>
          </View>
        )}
      </View>

      {/* Add row */}
      <View style={s.addRow}>
        <TextInput
          style={[s.input, isDark && {backgroundColor: theme.surface.elevated, borderColor: theme.surface.border, color: theme.text.title}]}
          placeholder="Add a part..."
          placeholderTextColor={isDark ? theme.text.placeholder : UI.text.muted}
          value={newPartName}
          onChangeText={setNewPartName}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <TouchableOpacity onPress={handleAdd} style={[s.addBtn, !newPartName.trim() && {opacity: 0.4}]} disabled={!newPartName.trim()}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Parts list */}
      {loading ? (
        <ActivityIndicator style={{marginTop: 12}} color={theme.brand.primary} />
      ) : parts.length === 0 ? (
        <Text style={[s.empty, isDark && {color: theme.text.muted}]}>No parts added yet.</Text>
      ) : (
        parts.map((part) => {
          const cfg = STATUS_CONFIG[part.status];
          return (
            <View key={part.id} style={[s.partRow, isDark && {borderColor: theme.surface.border}]}>
              <TouchableOpacity onPress={() => handleRemove(part.id, part.name)} hitSlop={8} style={s.removeBtn}>
                <Ionicons name="close-circle" size={18} color={isDark ? theme.text.muted : UI.text.muted} />
              </TouchableOpacity>
              <View style={{flex: 1}}>
                <Text style={[s.partName, isDark && {color: theme.text.title}, part.status === 'collected' && s.partCollected]}>
                  {part.name}
                  {part.quantity > 1 && <Text style={s.qty}> x{part.quantity}</Text>}
                </Text>
              </View>
              <TouchableOpacity onPress={() => cycleStatus(part.id)} activeOpacity={0.7}>
                <View style={[s.statusPill, {backgroundColor: isDark ? cfg.bg + '30' : cfg.bg}]}>
                  {part.status === 'collected' && <Ionicons name="checkmark" size={12} color={cfg.color} style={{marginRight: 2}} />}
                  <Text style={[s.statusText, {color: cfg.color}]}>{cfg.label}</Text>
                </View>
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {flexDirection: 'row', alignItems: 'center', marginBottom: 12},
  iconWrap: {width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 8},
  title: {fontSize: 15, fontWeight: '700', color: UI.text.title, flex: 1},
  badge: {backgroundColor: '#D97706', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1},
  badgeText: {color: '#fff', fontSize: 11, fontWeight: '700'},
  addRow: {flexDirection: 'row', gap: 8, marginBottom: 8},
  input: {
    flex: 1,
    backgroundColor: UI.surface.base,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: UI.text.title,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  addBtn: {backgroundColor: '#D97706', width: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center'},
  empty: {color: UI.text.muted, fontSize: 13, textAlign: 'center', paddingVertical: 12},
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  removeBtn: {marginRight: 8},
  partName: {fontSize: 14, fontWeight: '500', color: UI.text.title},
  partCollected: {textDecorationLine: 'line-through', opacity: 0.6},
  qty: {fontSize: 12, fontWeight: '400', color: UI.text.muted},
  statusPill: {flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4},
  statusText: {fontSize: 11, fontWeight: '700'},
});
