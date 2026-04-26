import React, { useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useColors } from './theme';
import { useT } from '../i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function HelpModal({ visible, onClose }: Props) {
  const c = useColors();
  const t = useT();
  const [step, setStep] = useState(0);

  const steps = [
    { title: t.help.step1Title, icon: t.help.step1Icon, text: t.help.step1Text },
    { title: t.help.step2Title, icon: t.help.step2Icon, text: t.help.step2Text },
    { title: t.help.step3Title, icon: t.help.step3Icon, text: t.help.step3Text },
    { title: t.help.step4Title, icon: t.help.step4Icon, text: t.help.step4Text },
    { title: t.help.step5Title, icon: t.help.step5Icon, text: t.help.step5Text },
    { title: t.help.step6Title, icon: t.help.step6Icon, text: t.help.step6Text },
  ];

  const total = steps.length;
  const isLast = step === total - 1;
  const current = steps[step];

  const handleClose = () => {
    setStep(0);
    onClose();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center', padding: 24,
    },
    card: {
      backgroundColor: c.surface, borderRadius: 20,
      padding: 24, gap: 16,
    },
    topRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    stepLabel: { fontSize: 13, color: c.muted, fontWeight: '600' },
    closeBtn: { fontSize: 20, color: c.muted, padding: 4 },
    iconText: { fontSize: 52, textAlign: 'center' },
    title: { fontSize: 19, fontWeight: '700', color: c.text, textAlign: 'center' },
    body: { fontSize: 15, color: c.text, lineHeight: 23, textAlign: 'left' },
    btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    btnPrimary: {
      flex: 1, backgroundColor: c.accent, borderRadius: 12,
      paddingVertical: 13, alignItems: 'center',
    },
    btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    btnSecondary: {
      flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      paddingVertical: 13, alignItems: 'center',
    },
    btnSecondaryText: { color: c.muted, fontSize: 15 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.border },
    dotActive: { backgroundColor: c.accent, width: 18 },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable onPress={e => e.stopPropagation()}>
          <View style={styles.card}>
            <View style={styles.topRow}>
              <Text style={styles.stepLabel}>{t.help.stepLabel(step + 1, total)}</Text>
              <Pressable onPress={handleClose} hitSlop={12}>
                <Text style={styles.closeBtn}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.iconText}>{current.icon}</Text>
            <Text style={styles.title}>{current.title}</Text>

            <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.body}>{current.text}</Text>
            </ScrollView>

            <View style={styles.btnRow}>
              {step > 0 && (
                <Pressable style={styles.btnSecondary} onPress={() => setStep(s => s - 1)}>
                  <Text style={styles.btnSecondaryText}>{t.help.btnBack}</Text>
                </Pressable>
              )}
              <Pressable style={styles.btnPrimary} onPress={() => isLast ? handleClose() : setStep(s => s + 1)}>
                <Text style={styles.btnPrimaryText}>{isLast ? t.help.btnDone : t.help.btnNext}</Text>
              </Pressable>
            </View>

            <View style={styles.dots}>
              {steps.map((_, i) => (
                <Pressable key={i} onPress={() => setStep(i)}>
                  <View style={[styles.dot, i === step && styles.dotActive]} />
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
