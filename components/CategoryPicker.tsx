import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Category } from '../db/categories';
import { colors } from './theme';

interface Props {
  categories: Category[];
  selected: number[];
  onChange: (ids: number[]) => void;
}

export function CategoryPicker({ categories, selected, onChange }: Props) {
  const toggle = (id: number) => {
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    );
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
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {cat.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 14, color: colors.muted },
  chipTextActive: { color: '#fff', fontWeight: '600' },
});
