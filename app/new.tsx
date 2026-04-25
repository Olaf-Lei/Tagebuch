import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryPicker } from '../components/CategoryPicker';
import { TagInput } from '../components/TagInput';
import { TimestampPicker } from '../components/TimestampPicker';
import { useColors } from '../components/theme';
import { getCategories, type Category } from '../db/categories';
import { createEntry } from '../db/entries';

export default function NewEntryScreen() {
  const router = useRouter();
  const c = useColors();
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    content: { padding: 16, gap: 12, paddingBottom: 20 },
    textInput: {
      backgroundColor: c.surface, borderRadius: 10, padding: 14,
      fontSize: 16, color: c.text, minHeight: 180, lineHeight: 24,
    },
    label: { fontSize: 13, color: c.muted, marginTop: 4 },
    footer: { padding: 14, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg },
    saveButton: { backgroundColor: c.accent, borderRadius: 12, padding: 16, alignItems: 'center' },
    saveDisabled: { opacity: 0.4 },
    saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  }), [c]);

  const inputRef = useRef<TextInput>(null);

  const [timestamp, setTimestamp] = useState(Date.now());
  const [text, setText] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    await createEntry({
      timestamp,
      text: text.trim(),
      categoryIds: selectedCategoryIds,
      tagIds: selectedTagIds,
    });
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <TimestampPicker value={timestamp} onChange={setTimestamp} />

          <TextInput
            ref={inputRef}
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder="Was liegt dir auf dem Herzen?"
            placeholderTextColor={c.muted}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>Kategorien</Text>
          <CategoryPicker
            categories={categories}
            selected={selectedCategoryIds}
            onChange={setSelectedCategoryIds}
          />

          <Text style={styles.label}>Tags</Text>
          <TagInput
            selectedTagIds={selectedTagIds}
            selectedTagNames={selectedTagNames}
            onChange={(ids, names) => {
              setSelectedTagIds(ids);
              setSelectedTagNames(names);
            }}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.saveButton, (!text.trim() || saving) && styles.saveDisabled]}
            onPress={save}
            disabled={!text.trim() || saving}
          >
            <Text style={styles.saveText}>Speichern</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

