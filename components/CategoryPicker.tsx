import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { categoryLabel } from '../db/categories';
import type { Category } from '../db/categories';
import { useColors } from './theme';
import { useT } from '../i18n';

interface Props {
  categories: Category[];
  selected: number[];
  onChange: (ids: number[]) => void;
}

export function CategoryPicker({ categories, selected, onChange }: Props) {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => StyleSheet.create({
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 14, color: c.muted },
    chipTextActive: { color: '#fff', fontWeight: '600' },
  }), [c]);

  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <View style={styles.wrap}>
      {categories.map((cat) => {
        const active = selected.includes(cat.id);
        return (
          <Pressable
            key={cat.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => toggle(cat.id)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{categoryLabel(cat, t)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
