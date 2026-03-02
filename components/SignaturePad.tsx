import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';
import { Colors, UI } from '../constants/theme';
import { useAppTheme } from '../src/context/ThemeContext';

interface SignaturePadProps {
  visible: boolean;
  onClose: () => void;
  onOK: (signature: string) => void;
}

export const SignaturePad = ({ visible, onClose, onOK }: SignaturePadProps) => {
  const ref = useRef<SignatureViewRef>(null);
  const { theme, isDark } = useAppTheme();

  const handleClear = () => {
    ref.current?.clearSignature();
  };

  const handleConfirm = () => {
    ref.current?.readSignature();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, isDark && { backgroundColor: theme.surface.card }]}>
          <View style={styles.header}>
            <Text style={[styles.title, isDark && { color: theme.text.title }]}>Customer Signature</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDark ? theme.text.body : Colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={[styles.padContainer, isDark && { borderColor: theme.surface.border }]}>
            <SignatureScreen
              ref={ref}
              onOK={onOK}
              webStyle={`.m-signature-pad--footer {display: none; margin: 0px;}`}
              backgroundColor={isDark ? theme.surface.elevated : '#fff'}
              penColor={isDark ? theme.text.title : Colors.text}
            />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.secondaryBtn, isDark && { borderColor: theme.surface.border }]} onPress={handleClear}>
              <Text style={[styles.secondaryBtnText, isDark && { color: theme.text.body }]}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirm}>
              <Text style={styles.primaryBtnText}>Confirm & Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { backgroundColor: '#fff', height: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  padContainer: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, overflow: 'hidden', marginBottom: 20 },
  footer: { flexDirection: 'row', gap: 12 },
  secondaryBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  secondaryBtnText: { fontWeight: '600', color: Colors.text },
  primaryBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  primaryBtnText: { fontWeight: 'bold', color: UI.text.white },
});