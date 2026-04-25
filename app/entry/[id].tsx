import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryPicker } from '../../components/CategoryPicker';
import { TagInput } from '../../components/TagInput';
import { TimestampPicker } from '../../components/TimestampPicker';
import { useColors } from '../../components/theme';
import { getCategories, type Category } from '../../db/categories';
import { deleteEntry, getEntry, updateEntry } from '../../db/entries';
import { getTags } from '../../db/tags';

export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useColors();
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
    content: { padding: 16, gap: 12, paddingBottom: 20 },
    textInput: {
      backgroundColor: c.surface, borderRadius: 10, padding: 14,
      fontSize: 16, color: c.text, minHeight: 180, lineHeight: 24,
    },
    label: { fontSize: 13, color: c.muted, marginTop: 4 },
    deleteButton: { marginTop: 20, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: c.danger, alignItems: 'center' },
    deleteText: { color: c.danger, fontSize: 15 },
    headerSave: { paddingHorizontal: 16, paddingVertical: 10 },
    headerSaveText: { fontSize: 16, fontWeight: '700' },
  }), [c]);

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
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{
        headerRight: () => (
          <Pressable style={styles.headerSave} onPress={save} disabled={!text.trim() || saving}>
            <Text style={[styles.headerSaveText, { color: text.trim() && !saving ? c.accent : c.muted }]}>
              Speichern
            </Text>
          </Pressable>
        ),
      }} />
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
            placeholderTextColor={c.muted}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

