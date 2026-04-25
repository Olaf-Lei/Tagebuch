import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from './theme';

interface Props {
  label: string;
  emojis: string[];
  value: number | null;
  onChange: (v: number | null) => void;
}

export function QualifierPicker({ label, emojis, value, onChange }: Props) {
  const c = useColors();
  const styles = useMemo(() => StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    label: { fontSize: 13, color: c.muted, width: 70 },
    btn: {
      width: 44, height: 44, borderRadius: 22, borderWidth: 1.5,
      alignItems: 'center', justifyContent: 'center',
    },
    emoji: { fontSize: 22 },
  }), [c]);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {emojis.map((emoji, i) => {
        const level = i + 1;
        const active = value === level;
        return (
          <Pressable
            key={level}
            style={[
              styles.btn,
              {
                backgroundColor: active ? c.accent + '22' : c.surface,
                borderColor: active ? c.accent : c.border,
              },
            ]}
            onPress={() => onChange(active ? null : level)}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
