import React, { useMemo, useState } from 'react';
import {
  Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View,
} from 'react-native';
import { useColors } from './theme';

interface Option { id: number; name: string; color?: string | null; }

interface Props {
  options: Option[];
  selected: number[];
  onChange: (ids: number[]) => void;
  placeholder: string;
  multi?: boolean;
}

export function DropdownPicker({ options, selected, onChange, placeholder, multi = false }: Props) {
  const c = useColors();
  const [open, setOpen] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    trigger: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderRadius: 8, borderColor: c.border,
      paddingHorizontal: 12, paddingVertical: 10, backgroundColor: c.surface, flex: 1,
    },
    triggerOpen: { borderColor: c.accent },
    triggerText: { fontSize: 14, color: c.text, flex: 1 },
    triggerPlaceholder: { fontSize: 14, color: c.muted, flex: 1 },
    arrow: { fontSize: 11, color: c.muted, marginLeft: 6 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
    sheet: { backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden', maxHeight: 420 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 15, fontWeight: '600', color: c.text },
    doneBtn: { paddingHorizontal: 8, paddingVertical: 4 },
    doneBtnText: { fontSize: 15, fontWeight: '700', color: c.accent },
    row: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    rowPressed: { backgroundColor: c.border + '44' },
    rowText: { flex: 1, fontSize: 15, color: c.text },
    rowTextActive: { color: c.accent, fontWeight: '600' },
    indicator: {
      width: 22, height: 22, borderRadius: 11, borderWidth: 2,
      borderColor: c.border, alignItems: 'center', justifyContent: 'center',
    },
    indicatorActive: { borderColor: c.accent, backgroundColor: c.accent },
    indicatorDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
    checkmark: { fontSize: 14, color: '#fff', fontWeight: '700' },
  }), [c, open]);

  const label = useMemo(() => {
    if (selected.length === 0) return null;
    if (!multi) {
      return options.find((o) => o.id === selected[0])?.name ?? null;
    }
    if (selected.length === 1) return options.find((o) => o.id === selected[0])?.name ?? null;
    return `${selected.length} ausgewählt`;
  }, [selected, options, multi]);

  const toggle = (id: number) => {
    if (!multi) {
      onChange([id]);
      setOpen(false);
      return;
    }
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <>
      <Pressable style={[styles.trigger, open && styles.triggerOpen]} onPress={() => { Keyboard.dismiss(); setOpen(true); }}>
        {label
          ? <Text style={styles.triggerText} numberOfLines={1}>{label}</Text>
          : <Text style={styles.triggerPlaceholder} numberOfLines={1}>{placeholder}</Text>
        }
        <Text style={styles.arrow}>{open ? '▲' : '▼'}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.backdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                {multi && (
                  <View style={styles.header}>
                    <Text style={styles.headerTitle}>{placeholder}</Text>
                    <Pressable style={styles.doneBtn} onPress={() => setOpen(false)}>
                      <Text style={styles.doneBtnText}>Fertig</Text>
                    </Pressable>
                  </View>
                )}
                <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
                  {options.map((opt) => {
                    const active = selected.includes(opt.id);
                    return (
                      <Pressable
                        key={opt.id}
                        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                        onPress={() => toggle(opt.id)}
                      >
                        {opt.color ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: opt.color }} />
                            <Text style={[styles.rowText, active && styles.rowTextActive, { flex: 1 }]}>{opt.name}</Text>
                          </View>
                        ) : (
                          <Text style={[styles.rowText, active && styles.rowTextActive]}>{opt.name}</Text>
                        )}
                        <View style={[styles.indicator, active && styles.indicatorActive]}>
                          {active && (
                            multi
                              ? <Text style={styles.checkmark}>✓</Text>
                              : <View style={styles.indicatorDot} />
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
