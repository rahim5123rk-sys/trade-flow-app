import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';
import { Colors, UI} from '../constants/theme';

interface SignaturePadProps {
  visible: boolean;
  onClose: () => void;
  onOK: (signature: string) => void;
}

export const SignaturePad = ({ visible, onClose, onOK }: SignaturePadProps) => {
  const ref = useRef<SignatureViewRef>(null);

  const handleClear = () => {
    ref.current?.clearSignature();
  };

  const handleConfirm = () => {
    ref.current?.readSignature();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Customer Signature</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.padContainer}>
            <SignatureScreen
              ref={ref}
              onOK={onOK}
              webStyle={`.m-signature-pad--footer {display: none; margin: 0px;}`}
              backgroundColor="#fff"
              penColor={Colors.text}
            />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleClear}>
              <Text style={styles.secondaryBtnText}>Clear</Text>
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