import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from './theme';

interface Props {
  value: number;
  onChange: (ts: number) => void;
}

function toInputValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromInputValue(s: string): number | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return isNaN(d.getTime()) ? null : d.getTime();
}

function formatDisplay(ts: number): string {
  return new Date(ts).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function TimestampPicker({ value, onChange }: Props) {
  const c = useColors();
  const styles = useMemo(() => StyleSheet.create({
    button: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
    buttonText: { fontSize: 14, color: c.muted },
    edit: { fontSize: 14, color: c.accent },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000aa' },
    sheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: c.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16,
      padding: 24, gap: 12,
    },
    label: { fontSize: 16, fontWeight: '600', color: c.text },
    input: {
      borderWidth: 1, borderColor: c.border, borderRadius: 10,
      padding: 12, fontSize: 15, color: c.text, backgroundColor: c.bg,
    },
    inputError: { borderColor: c.danger },
    errorText: { fontSize: 12, color: c.danger },
    row: { flexDirection: 'row', gap: 10, marginTop: 4 },
    cancel: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    cancelText: { color: c.muted, fontSize: 15 },
    confirm: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: c.accent, alignItems: 'center' },
    confirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  }), [c]);

  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(toInputValue(value));
  const [error, setError] = useState(false);

  const open = () => { setDraft(toInputValue(value)); setError(false); setVisible(true); };
  const confirm = () => {
    const ts = fromInputValue(draft);
    if (ts === null) { setError(true); return; }
    onChange(ts);
    setVisible(false);
  };

  return (
    <>
      <Pressable onPress={open} style={styles.button}>
        <Text style={styles.buttonText}>{formatDisplay(value)}</Text>
        <Text style={styles.edit}>✎</Text>
      </Pressable>
      <Modal visible={visible} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)} />
        <View style={styles.sheet}>
          <Text style={styles.label}>Zeitstempel bearbeiten</Text>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={draft}
            onChangeText={(t) => { setDraft(t); setError(false); }}
            placeholder="YYYY-MM-DDTHH:MM"
            placeholderTextColor={c.muted}
            autoCorrect={false}
          />
          {error && <Text style={styles.errorText}>Ungültiges Format</Text>}
          <View style={styles.row}>
            <Pressable style={styles.cancel} onPress={() => setVisible(false)}>
              <Text style={styles.cancelText}>Abbrechen</Text>
            </Pressable>
            <Pressable style={styles.confirm} onPress={confirm}>
              <Text style={styles.confirmText}>Übernehmen</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
