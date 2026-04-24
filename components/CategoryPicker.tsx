import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 14, color: colors.muted },
  chipTextActive: { color: '#fff', fontWeight: '600' },
});
