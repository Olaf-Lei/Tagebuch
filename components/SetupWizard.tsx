import React, { useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useColors } from './theme';
import { useT } from '../i18n';
import { EMOJI_PRESETS } from './qualifiers';
import { getDb } from '../db/schema';

export const WIZARD_DONE_KEY = 'wizard_done';

interface Props {
  visible: boolean;
  onDone: () => void;
}

export function SetupWizard({ visible, onDone }: Props) {
  const c = useColors();
  const t = useT();
  const w = t.wizard;

  const qualSuggestions = [
    { preset: 'mood',   name: t.qualifierPresets.mood,   defaultOn: true },
    { preset: 'health', name: t.qualifierPresets.health, defaultOn: true },
    { preset: 'sleep',  name: t.qualifierPresets.sleep,  defaultOn: false },
    { preset: 'energy', name: t.qualifierPresets.energy, defaultOn: false },
    { preset: 'pain',   name: t.qualifierPresets.pain,   defaultOn: false },
    { preset: 'stress', name: t.qualifierPresets.stress, defaultOn: false },
  ];

  const [step, setStep] = useState(0);

  const [selectedCats, setSelectedCats] = useState<Set<string>>(
    () => new Set(w.catSuggestions.map(c => c.name))
  );
  const [customCats, setCustomCats] = useState<{ name: string; color: string }[]>([]);
  const [catInput, setCatInput] = useState('');

  const [selectedQuals, setSelectedQuals] = useState<Set<string>>(
    () => new Set(qualSuggestions.filter(q => q.defaultOn).map(q => q.preset))
  );

  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [saving, setSaving] = useState(false);

  const total = 3;
  const isLast = step === total - 1;

  const allCats = [...w.catSuggestions, ...customCats];
  const allTags = [...w.tagSuggestions, ...customTags];

  const toggleCat = (name: string) =>
    setSelectedCats(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const toggleQual = (preset: string) =>
    setSelectedQuals(prev => {
      const next = new Set(prev);
      next.has(preset) ? next.delete(preset) : next.add(preset);
      return next;
    });

  const toggleTag = (name: string) =>
    setSelectedTags(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const addCat = () => {
    const name = catInput.trim();
    if (!name || allCats.some(c => c.name === name)) { setCatInput(''); return; }
    const color = CAT_FALLBACK_COLORS[allCats.length % CAT_FALLBACK_COLORS.length];
    setCustomCats(prev => [...prev, { name, color }]);
    setSelectedCats(prev => new Set([...prev, name]));
    setCatInput('');
  };

  const addTag = () => {
    const name = tagInput.trim();
    if (!name || allTags.includes(name)) { setTagInput(''); return; }
    setCustomTags(prev => [...prev, name]);
    setSelectedTags(prev => new Set([...prev, name]));
    setTagInput('');
  };

  const handleDone = async () => {
    setSaving(true);
    try {
      const db = await getDb();
      for (const cat of allCats) {
        if (selectedCats.has(cat.name)) {
          await db.runAsync(`DELETE FROM deleted_category_names WHERE name = ?`, [cat.name]);
          await db.runAsync(`INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)`, [cat.name, cat.color]);
        }
      }
      for (const q of qualSuggestions) {
        if (selectedQuals.has(q.preset)) {
          const existing = await db.getFirstAsync<{ id: number }>(
            `SELECT id FROM qualifiers WHERE name = ? AND deleted = 0`, [q.name]
          );
          if (!existing) {
            const pos = await db.getFirstAsync<{ p: number }>(`SELECT MAX(position) as p FROM qualifiers WHERE deleted = 0`);
            await db.runAsync(
              `INSERT OR IGNORE INTO qualifiers (name, emoji_preset, position, active, deleted) VALUES (?, ?, ?, 1, 0)`,
              [q.name, q.preset, (pos?.p ?? -1) + 1]
            );
          }
        }
      }
      for (const name of allTags) {
        if (selectedTags.has(name)) {
          await db.runAsync(`DELETE FROM deleted_tag_names WHERE name = ?`, [name]);
          await db.runAsync(`INSERT OR IGNORE INTO tags (name) VALUES (?)`, [name]);
        }
      }
      await SecureStore.setItemAsync(WIZARD_DONE_KEY, 'true');
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 24 },
    card: { backgroundColor: c.surface, borderRadius: 20, padding: 24, gap: 14, maxHeight: '90%' },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    stepLabel: { fontSize: 12, color: c.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    icon: { fontSize: 42, textAlign: 'center' },
    title: { fontSize: 18, fontWeight: '700', color: c.text, textAlign: 'center' },
    body: { fontSize: 14, color: c.muted, lineHeight: 20, textAlign: 'center' },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: c.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
    chipOn: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 14, color: c.muted },
    chipTextOn: { color: '#fff', fontWeight: '600' },
    colorDot: { width: 9, height: 9, borderRadius: 5 },
    qualChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: c.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, width: '100%' },
    qualChipOn: { backgroundColor: c.accent + '22', borderColor: c.accent },
    qualIcon: { fontSize: 18 },
    qualName: { fontSize: 14, fontWeight: '600', color: c.text, flex: 1 },
    qualNameOn: { color: c.accent },
    qualEmojis: { fontSize: 13, letterSpacing: 1 },
    inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    input: { flex: 1, backgroundColor: c.bg, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: c.text },
    addBtn: { backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    btnPrimary: { flex: 1, backgroundColor: c.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
    btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    btnSecondary: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
    btnSecondaryText: { color: c.muted, fontSize: 15 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.border },
    dotActive: { backgroundColor: c.accent, width: 18 },
  });

  const stepTitles = [w.catTitle, w.qualTitle, w.tagTitle];
  const stepIcons  = [w.catIcon,  w.qualIcon,  w.tagIcon];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.topRow}>
            <Text style={s.stepLabel}>{w.stepLabel(step + 1, total)}</Text>
          </View>

          <Text style={s.icon}>{stepIcons[step]}</Text>
          <Text style={s.title}>{stepTitles[step]}</Text>
          <Text style={s.body}>
            {step === 0 ? w.catText : step === 1 ? w.qualText : w.tagText}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
            {step === 0 && (
              <>
                <View style={s.chipsWrap}>
                  {allCats.map(cat => {
                    const on = selectedCats.has(cat.name);
                    return (
                      <Pressable key={cat.name} style={[s.chip, on && s.chipOn]} onPress={() => toggleCat(cat.name)}>
                        <View style={[s.colorDot, { backgroundColor: cat.color }]} />
                        <Text style={[s.chipText, on && s.chipTextOn]}>{cat.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {step === 1 && (
              <View style={{ gap: 8 }}>
                {qualSuggestions.map(q => {
                  const on = selectedQuals.has(q.preset);
                  const preset = EMOJI_PRESETS[q.preset];
                  return (
                    <Pressable key={q.preset} style={[s.qualChip, on && s.qualChipOn]} onPress={() => toggleQual(q.preset)}>
                      <Text style={s.qualIcon}>{preset?.icon}</Text>
                      <Text style={[s.qualName, on && s.qualNameOn]}>{q.name}</Text>
                      <Text style={s.qualEmojis}>{preset?.emojis.join(' ')}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {step === 2 && (
              <View style={s.chipsWrap}>
                {allTags.map(name => {
                  const on = selectedTags.has(name);
                  return (
                    <Pressable key={name} style={[s.chip, on && s.chipOn]} onPress={() => toggleTag(name)}>
                      <Text style={[s.chipText, on && s.chipTextOn]}>{name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {step === 0 && (
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={catInput}
                onChangeText={setCatInput}
                placeholder={w.addPlaceholder}
                placeholderTextColor={c.muted}
                onSubmitEditing={addCat}
                returnKeyType="done"
              />
              <Pressable style={s.addBtn} onPress={addCat}>
                <Text style={s.addBtnText}>+</Text>
              </Pressable>
            </View>
          )}

          {step === 2 && (
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={tagInput}
                onChangeText={setTagInput}
                placeholder={w.addPlaceholder}
                placeholderTextColor={c.muted}
                onSubmitEditing={addTag}
                returnKeyType="done"
              />
              <Pressable style={s.addBtn} onPress={addTag}>
                <Text style={s.addBtnText}>+</Text>
              </Pressable>
            </View>
          )}

          <View style={s.btnRow}>
            {step > 0 && (
              <Pressable style={s.btnSecondary} onPress={() => setStep(s => s - 1)}>
                <Text style={s.btnSecondaryText}>{w.btnBack}</Text>
              </Pressable>
            )}
            <Pressable
              style={s.btnPrimary}
              onPress={isLast ? handleDone : () => setStep(s => s + 1)}
              disabled={saving}
            >
              <Text style={s.btnPrimaryText}>{isLast ? w.btnDone : w.btnNext}</Text>
            </Pressable>
          </View>

          <View style={s.dots}>
            {Array.from({ length: total }).map((_, i) => (
              <View key={i} style={[s.dot, i === step && s.dotActive]} />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const CAT_FALLBACK_COLORS = [
  '#C9504C', '#84C94C', '#C94C9D', '#4CC9C9', '#C9A84C', '#9D4CC9',
];
