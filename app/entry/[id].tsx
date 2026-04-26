import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DropdownPicker } from '../../components/DropdownPicker';
import { QualifierPicker } from '../../components/QualifierPicker';
import { TagInput } from '../../components/TagInput';
import { TimestampPicker } from '../../components/TimestampPicker';
import { HEALTH_EMOJIS, MOOD_EMOJIS } from '../../components/qualifiers';
import { captureLocation, type GeoTag } from '../../utils/location';
import { useColors } from '../../components/theme';
import { getCategories, type Category } from '../../db/categories';
import { deleteEntry, getEntry, updateEntry } from '../../db/entries';
import { getTags } from '../../db/tags';
import { useT } from '../../i18n';
import { syncIfConfigured } from '../../sync/webdav';

export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useColors();
  const t = useT();
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
    locationBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
    },
    locationBtnActive: { borderColor: c.accent },
    locationBtnText: { fontSize: 13, color: c.muted },
    locationBtnTextActive: { color: c.accent },
    headerSave: { paddingHorizontal: 16, paddingVertical: 10 },
    headerSaveText: { fontSize: 16, fontWeight: '700' },
  }), [c]);

  const scrollRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(true);
  const [timestamp, setTimestamp] = useState(Date.now());
  const [text, setText] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [mood, setMood] = useState<number | null>(null);
  const [health, setHealth] = useState<number | null>(null);
  const [geoTag, setGeoTag] = useState<GeoTag | null>(null);
  const [locating, setLocating] = useState(false);
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
      setMood(entry.mood);
      setHealth(entry.health);
      if (entry.latitude && entry.longitude && entry.locationName) {
        setGeoTag({ latitude: entry.latitude, longitude: entry.longitude, locationName: entry.locationName });
      }
      setCategories(cats);

      const catIds = cats.filter((c) => entry.categories.some((ec) => ec.name === c.name)).map((c) => c.id);
      setSelectedCategoryIds(catIds);

      const matchedTags = allTags.filter((tag) => entry.tags.includes(tag.name));
      setSelectedTagIds(matchedTags.map((tag) => tag.id));
      setSelectedTagNames(matchedTags.map((tag) => tag.name));

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
      mood,
      health,
      latitude: geoTag?.latitude ?? null,
      longitude: geoTag?.longitude ?? null,
      locationName: geoTag?.locationName ?? null,
    });
    syncIfConfigured();
    router.back();
  };

  const confirmDelete = () => {
    Alert.alert(t.entry.deleteConfirmTitle, t.entry.deleteConfirmMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete, style: 'destructive', onPress: async () => {
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
              {t.common.save}
            </Text>
          </Pressable>
        ),
      }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
      >
        <ScrollView
          ref={scrollRef}
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
            placeholder={t.entry.textPlaceholderEdit}
            placeholderTextColor={c.muted}
          />

          <QualifierPicker label={t.entry.labelMood} emojis={MOOD_EMOJIS} value={mood} onChange={setMood} />
          <QualifierPicker label={t.entry.labelHealth} emojis={HEALTH_EMOJIS} value={health} onChange={setHealth} />
          <Pressable
            style={[styles.locationBtn, geoTag && styles.locationBtnActive]}
            onPress={async () => {
              if (geoTag) { setGeoTag(null); return; }
              setLocating(true);
              const tag = await captureLocation();
              if (tag) setGeoTag(tag);
              setLocating(false);
            }}
            disabled={locating}
          >
            {locating
              ? <ActivityIndicator size="small" color={c.accent} />
              : <Text style={[styles.locationBtnText, geoTag && styles.locationBtnTextActive]}>
                  {geoTag ? `📍 ${geoTag.locationName}  ✕` : t.entry.locationAdd}
                </Text>
            }
          </Pressable>

          <Text style={styles.label}>{t.entry.labelCategories}</Text>
          <DropdownPicker
            options={categories}
            selected={selectedCategoryIds}
            onChange={setSelectedCategoryIds}
            placeholder={t.entry.categoriesPlaceholder}
            multi
          />

          <Text style={styles.label}>{t.entry.labelTags}</Text>
          <TagInput
            selectedTagIds={selectedTagIds}
            selectedTagNames={selectedTagNames}
            onChange={(ids, names) => {
              setSelectedTagIds(ids);
              setSelectedTagNames(names);
            }}
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
          />

          <Pressable style={styles.deleteButton} onPress={confirmDelete}>
            <Text style={styles.deleteText}>{t.entry.deleteEntry}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
