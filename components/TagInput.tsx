import React, { useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import { searchTags, upsertTag } from '../db/tags';
import { colors } from './theme';

interface Props {
  selectedTagIds: number[];
  selectedTagNames: string[];
  onChange: (ids: number[], names: string[]) => void;
}

export function TagInput({ selectedTagIds, selectedTagNames, onChange }: Props) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<{ id: number; name: string }[]>([]);

  const handleInputChange = async (text: string) => {
    setInput(text);
    if (text.trim().length > 0) {
      const results = await searchTags(text);
      setSuggestions(results.filter((t) => !selectedTagIds.includes(t.id)));
    } else {
      setSuggestions([]);
    }
  };

  const addTagByName = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = await upsertTag(trimmed);
    if (!selectedTagIds.includes(id)) {
      onChange([...selectedTagIds, id], [...selectedTagNames, trimmed.toLowerCase()]);
    }
    setInput('');
    setSuggestions([]);
  };

  const removeTag = (id: number) => {
    const idx = selectedTagIds.indexOf(id);
    onChange(
      selectedTagIds.filter((_, i) => i !== idx),
      selectedTagNames.filter((_, i) => i !== idx)
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tagsRow}>
        {selectedTagNames.map((name, i) => (
          <Pressable
            key={selectedTagIds[i]}
            style={styles.tag}
            onPress={() => removeTag(selectedTagIds[i])}
          >
            <Text style={styles.tagText}>#{name} ✕</Text>
          </Pressable>
        ))}
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={handleInputChange}
          onSubmitEditing={() => addTagByName(input)}
          placeholder="Tag hinzufügen…"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          blurOnSubmit={false}
          autoCapitalize="none"
        />
      </View>
      {suggestions.length > 0 && (
        <ScrollView style={styles.suggestions} keyboardShouldPersistTaps="handled">
          {suggestions.map((s) => (
            <Pressable
              key={s.id}
              style={styles.suggestion}
              onPress={() => addTagByName(s.name)}
            >
              <Text style={styles.suggestionText}>#{s.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 0 },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  tag: {
    backgroundColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: { fontSize: 13, color: colors.muted },
  input: { flex: 1, minWidth: 100, fontSize: 15, color: colors.text, paddingVertical: 4 },
  suggestions: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    maxHeight: 140,
    marginTop: 4,
  },
  suggestion: { paddingHorizontal: 14, paddingVertical: 10 },
  suggestionText: { fontSize: 14, color: colors.text },
});
