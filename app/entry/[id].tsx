import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryPicker } from '../../components/CategoryPicker';
import { TagInput } from '../../components/TagInput';
import { TimestampPicker } from '../../components/TimestampPicker';
import { colors } from '../../components/theme';
import { getCategories, type Category } from '../../db/categories';
import { deleteEntry, getEntry, updateEntry } from '../../db/entries';
import { getTags } from '../../db/tags';

export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [timestamp, setTimestamp] = useState(Date.now());
  const [text, setText] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [entry, cats, allTags] = await Promise.all([
        getEntry(Number(id)),
        getCategories(),
        getTags(),
      ]);
      if (!entry) { router.back(); return; }

      setTimestamp(entry.timestamp);
      setText(entry.text);
      setCategories(cats);

      const catIds = cats.filter((c) => entry.categories.includes(c.name)).map((c) => c.id);
      setSelectedCategoryIds(catIds);

      const matchedTags = allTags.filter((t) => entry.tags.includes(t.name));
      setSelectedTagIds(matchedTags.map((t) => t.id));
      setSelectedTagNames(matchedTags.map((t) => t.name));

      setLoading(false);
    };
    load();
  }, [id]);

  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    await updateEntry(Number(id), {
      timestamp,
      text: text.trim(),
      categoryIds: selectedCategoryIds,
      tagIds: selectedTagIds,
    });
    router.back();
  };

  const confirmDelete = () => {
    Alert.alert('Eintrag löschen?', 'Diese Aktion kann nicht rückgängig gemacht werden.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          await deleteEntry(Number(id));
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

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
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            multiline
            textAlignVertical="top"
            placeholder="Eintrag…"
            placeholderTextColor={colors.muted}
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

          <Pressable style={styles.deleteButton} onPress={confirmDelete}>
            <Text style={styles.deleteText}>Eintrag löschen</Text>
          </Pressable>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 20 },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    minHeight: 180,
    lineHeight: 24,
  },
  label: { fontSize: 13, color: colors.muted, marginTop: 4 },
  deleteButton: {
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
  },
  deleteText: { color: colors.danger, fontSize: 15 },
  footer: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveDisabled: { opacity: 0.4 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
