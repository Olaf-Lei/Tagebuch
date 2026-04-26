import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DropdownPicker } from '../components/DropdownPicker';
import { QualifierPicker } from '../components/QualifierPicker';
import { TagInput } from '../components/TagInput';
import { TimestampPicker } from '../components/TimestampPicker';
import { HEALTH_EMOJIS, MOOD_EMOJIS } from '../components/qualifiers';
import { captureLocation, type GeoTag } from '../utils/location';
import { useColors } from '../components/theme';
import { getCategories, type Category } from '../db/categories';
import { createEntry } from '../db/entries';
import { useT } from '../i18n';

export default function NewEntryScreen() {
  const router = useRouter();
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    content: { padding: 16, gap: 12, paddingBottom: 20 },
    textInput: {
      backgroundColor: c.surface, borderRadius: 10, padding: 14,
      fontSize: 16, color: c.text, minHeight: 180, lineHeight: 24,
    },
    label: { fontSize: 13, color: c.muted, marginTop: 4 },
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

  const inputRef = useRef<TextInput>(null);

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
      mood,
      health,
      latitude: geoTag?.latitude ?? null,
      longitude: geoTag?.longitude ?? null,
      locationName: geoTag?.locationName ?? null,
    });
    router.back();
  };

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
            placeholder={t.entry.textPlaceholderNew}
            placeholderTextColor={c.muted}
            multiline
            textAlignVertical="top"
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
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
