import React from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from './theme';
import { useT } from '../i18n';

interface Props {
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
}

export function SectionHelpModal({ visible, title, body, onClose }: Props) {
  const c = useColors();
  const t = useT();
  const windowHeight = Dimensions.get('window').height;

  const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 24 },
    card: {
      backgroundColor: c.surface, borderRadius: 20,
      padding: 24, gap: 16, maxHeight: windowHeight * 0.8,
    },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    title: { fontSize: 17, fontWeight: '700', color: c.text, flex: 1 },
    closeBtn: { fontSize: 20, color: c.muted, padding: 4 },
    body: { fontSize: 15, color: c.text, lineHeight: 23 },
    doneBtn: {
      backgroundColor: c.accent, borderRadius: 12,
      paddingVertical: 13, alignItems: 'center',
    },
    doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={e => e.stopPropagation()}>
          <View style={styles.card}>
            <View style={styles.topRow}>
              <Text style={styles.title}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={styles.closeBtn}>✕</Text>
              </Pressable>
            </View>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ flexShrink: 1 }}>
              <Text style={styles.body}>{body}</Text>
            </ScrollView>
            <Pressable style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>{t.common.done}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
