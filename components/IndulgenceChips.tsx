import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { upsertTag } from '../db/tags';
import { useColors } from './theme';

const CHIPS = [
  { emoji: '🍺', name: 'alkohol' },
  { emoji: '🍫', name: 'süßes' },
  { emoji: '🚬', name: 'tabak' },
  { emoji: '🌿', name: 'cannabis' },
] as const;

interface Props {
  label: string;
  selectedTagIds: number[];
  selectedTagNames: string[];
  onChange: (ids: number[], names: string[]) => void;
}

export function IndulgenceChips({ label, selectedTagIds, selectedTagNames, onChange }: Props) {
  const c = useColors();
  const styles = useMemo(() => StyleSheet.create({
    label: { fontSize: 13, color: c.muted, marginTop: 4 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
    chip: {
      backgroundColor: c.border, borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 10,
      minHeight: 48, justifyContent: 'center',
    },
    chipActive: { backgroundColor: c.accent + '33' },
    chipText: { fontSize: 14, color: c.muted },
    chipTextActive: { color: c.accent, fontWeight: '600' },
  }), [c]);

  const toggle = async (name: string) => {
    const idx = selectedTagNames.indexOf(name);
    if (idx >= 0) {
      onChange(
        selectedTagIds.filter((_, i) => i !== idx),
        selectedTagNames.filter((_, i) => i !== idx),
      );
    } else {
      const id = await upsertTag(name);
      onChange([...selectedTagIds, id], [...selectedTagNames, name]);
    }
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {CHIPS.map(({ emoji, name }) => {
          const active = selectedTagNames.includes(name);
          return (
            <Pressable
              key={name}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggle(name)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {emoji} #{name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
