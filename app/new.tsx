import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLayout } from '../hooks/useLayout';
import { DropdownPicker } from '../components/DropdownPicker';
import { QualifierPicker } from '../components/QualifierPicker';
import { TagInput } from '../components/TagInput';
import { IndulgenceChips } from '../components/IndulgenceChips';
import { TimestampPicker } from '../components/TimestampPicker';
import { EMOJI_PRESETS } from '../components/qualifiers';
import { getQualifiersForCategories, type Qualifier } from '../db/qualifiers';
import { captureLocation, type GeoTag } from '../utils/location';
import { LocationPickerModal } from '../components/LocationPickerModal';
import { useColors } from '../components/theme';
import { getCategories, type Category } from '../db/categories';
import { createEntry } from '../db/entries';
import { useT } from '../i18n';
import { syncIfConfigured } from '../sync/webdav';

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
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    locationBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
    },
    locationBtnActive: { borderColor: c.accent },
    locationBtnText: { fontSize: 13, color: c.muted },
    locationBtnTextActive: { color: c.accent },
    mapBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    headerSave: { paddingHorizontal: 16, paddingVertical: 10 },
    headerSaveText: { fontSize: 16, fontWeight: '700' },
  }), [c]);

  const { isWide, formMaxWidth } = useLayout();
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const [timestamp, setTimestamp] = useState(Date.now());
  const [text, setText] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [qualifierValues, setQualifierValues] = useState<Record<number, number>>({});
  const [visibleQualifiers, setVisibleQualifiers] = useState<Qualifier[]>([]);
  const [geoTag, setGeoTag] = useState<GeoTag | null>(null);
  const [locating, setLocating] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    getQualifiersForCategories(selectedCategoryIds).then((qs) => {
      setVisibleQualifiers(qs);
      // Werte von Qualifiern die nicht mehr sichtbar sind, löschen
      setQualifierValues((prev) => {
        const visibleIds = new Set(qs.map(q => q.id));
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          if (!visibleIds.has(Number(id))) delete next[Number(id)];
        }
        return next;
      });
    });
  }, [selectedCategoryIds]);

  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    await createEntry({
      timestamp,
      text: text.trim(),
      categoryIds: selectedCategoryIds,
      tagIds: selectedTagIds,
      qualifierValues,
      latitude: geoTag?.latitude ?? null,
      longitude: geoTag?.longitude ?? null,
      locationName: geoTag?.locationName ?? null,
    });
    syncIfConfigured();
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
        behavior="padding"
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.content, formMaxWidth != null && { maxWidth: formMaxWidth, alignSelf: 'center', width: '100%' }]}
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

          {visibleQualifiers.map((q) => {
            const preset = EMOJI_PRESETS[q.emoji_preset];
            if (!preset) return null;
            return (
              <QualifierPicker
                key={q.id}
                label={q.name}
                emojis={preset.emojis}
                value={qualifierValues[q.id] ?? null}
                onChange={(v) => setQualifierValues((prev) => {
                  const next = { ...prev };
                  if (v === null) delete next[q.id]; else next[q.id] = v;
                  return next;
                })}
              />
            );
          })}
          <View style={styles.locationRow}>
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
            <Pressable style={styles.mapBtn} onPress={() => setShowMapPicker(true)} hitSlop={8}>
              <Text>🗺️</Text>
            </Pressable>
          </View>
          <LocationPickerModal
            visible={showMapPicker}
            initialLat={geoTag?.latitude}
            initialLng={geoTag?.longitude}
            onSelect={(lat, lng, name) => { setGeoTag({ latitude: lat, longitude: lng, locationName: name }); setShowMapPicker(false); }}
            onClose={() => setShowMapPicker(false)}
          />

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
          <IndulgenceChips
            label={t.entry.labelIndulgences}
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
