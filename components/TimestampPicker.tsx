import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useColors } from './theme';

interface Props {
  value: number;
  onChange: (ts: number) => void;
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
  }), [c]);

  // 'date' → show date picker, 'time' → show time picker, null → closed
  const [step, setStep] = useState<'date' | 'time' | null>(null);
  const [draft, setDraft] = useState(new Date(value));

  const open = () => {
    setDraft(new Date(value));
    setStep('date');
  };

  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (_event.type === 'dismissed') { setStep(null); return; }
    if (!selected) return;

    if (step === 'date') {
      const next = new Date(draft);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setDraft(next);
      setStep('time');
    } else {
      const next = new Date(draft);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      onChange(next.getTime());
      setStep(null);
    }
  };

  return (
    <>
      <Pressable onPress={open} style={styles.button}>
        <Text style={styles.buttonText}>{formatDisplay(value)}</Text>
        <Text style={styles.edit}>✎</Text>
      </Pressable>

      {step !== null && (
        <DateTimePicker
          value={draft}
          mode={step}
          display="default"
          onChange={handleChange}
          locale="de-DE"
        />
      )}
    </>
  );
}
