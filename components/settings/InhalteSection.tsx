import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { useColors } from '../theme';
import { useT } from '../../i18n';
import {
  createCategory, deleteCategory, getCategories,
  renameCategory, updateCategoryColor, type Category,
} from '../../db/categories';
import { getTags, renameTag, deleteTag, type Tag } from '../../db/tags';
import {
  getQualifiers, createQualifier, updateQualifier,
  setQualifierActive, deleteQualifier,
  getCategoryQualifierIds, setCategoryQualifiers,
  type Qualifier,
} from '../../db/qualifiers';
import { EMOJI_PRESETS } from '../qualifiers';

const DEFAULT_CAT_COLOR = '#C9A84C';

const COLOR_PICKER_PALETTE = [
  '#FF3B30', '#FF6B6B', '#C94C4C', '#C94C6A', '#FF2D55',
  '#C94C9D', '#AF52DE', '#9D4CC9', '#8E44AD', '#5856D6',
  '#007AFF', '#4C9DC9', '#3498DB', '#1A5276', '#5AC8FA',
  '#4CC9C9', '#1ABC9C', '#34C759', '#4CC984', '#84C94C',
  '#2ECC71', '#27AE60', '#8BC34A', '#F9A825', '#FFCC00',
  '#C9A84C', '#FF9500', '#F39C12', '#FF6B00', '#C9844C',
  '#C9504C', '#D35400', '#C97C4C', '#8E8E93', '#636366',
  '#48484A', '#3A3A3C', '#1C1C1E', '#AEAEB2', '#E5E5EA',
];
const isValidHex = (s: string) => /^#[0-9A-Fa-f]{6}$/.test(s);

export function InhalteSection() {
  const c = useColors();
  const t = useT();

  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [colorPickerCat, setColorPickerCat] = useState<Category | null>(null);
  const [colorPickerHex, setColorPickerHex] = useState(DEFAULT_CAT_COLOR);

  const [tags, setTags] = useState<Tag[]>([]);
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingTagName, setEditingTagName] = useState('');

  const [qualifiers, setQualifiers] = useState<Qualifier[]>([]);
  const [newQualName, setNewQualName] = useState('');
  const [newQualPreset, setNewQualPreset] = useState('mood');
  const [editingQualId, setEditingQualId] = useState<number | null>(null);
  const [editingQualName, setEditingQualName] = useState('');
  const [editingQualPreset, setEditingQualPreset] = useState('mood');

  const [catQualModal, setCatQualModal] = useState<Category | null>(null);
  const [catQualSelected, setCatQualSelected] = useState<number[]>([]);

  const styles = useMemo(() => StyleSheet.create({
    catRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg,
      borderRadius: 8, paddingVertical: 4, paddingHorizontal: 12, gap: 4,
    },
    colorSwatch: { width: 22, height: 22, borderRadius: 11 },
    catName: { flex: 1, fontSize: 15, color: c.text, paddingVertical: 8 },
    catInput: { flex: 1, fontSize: 15, color: c.text, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.accent },
    catAction: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    accentText: { color: c.accent, fontSize: 15 },
    mutedText: { color: c.muted, fontSize: 22 },
    dangerText: { color: c.danger, fontSize: 22 },
    addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    addInput: {
      flex: 1, backgroundColor: c.bg, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.text,
    },
    addButton: { backgroundColor: c.accent, borderRadius: 8, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    addButtonText: { color: '#fff', fontSize: 22 },
    subLabel: { fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 },
    warnText: { fontSize: 12, color: c.muted },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: c.surface, borderRadius: 16, padding: 24, gap: 12 },
    modalTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    modalInput: { backgroundColor: c.bg, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.text },
    modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalBtn: { flex: 1, backgroundColor: c.accent, borderRadius: 10, padding: 13, alignItems: 'center' },
    modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    modalCancel: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 13, alignItems: 'center' },
    modalCancelText: { color: c.muted, fontSize: 15 },
    colorGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
    colorGridSwatch: { width: 40, height: 40, borderRadius: 20 },
    colorGridSwatchSelected: { borderWidth: 3, borderColor: '#fff', transform: [{ scale: 1.15 }] },
    colorPreview: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: c.border },
  }), [c]);

  useEffect(() => {
    getCategories().then(setCategories);
    getTags().then(setTags);
    getQualifiers().then(setQualifiers);
  }, []);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    await createCategory(newCatName.trim());
    setNewCatName('');
    getCategories().then(setCategories);
  };

  const confirmRename = async () => {
    if (!editingId || !editingName.trim()) return;
    await renameCategory(editingId, editingName.trim());
    setEditingId(null);
    getCategories().then(setCategories);
  };

  const openColorPicker = (cat: Category) => {
    setColorPickerCat(cat);
    setColorPickerHex((cat.color ?? DEFAULT_CAT_COLOR).toUpperCase());
  };

  const confirmColorPick = async () => {
    if (!colorPickerCat || !isValidHex(colorPickerHex)) return;
    await updateCategoryColor(colorPickerCat.id, colorPickerHex);
    setColorPickerCat(null);
    getCategories().then(setCategories);
  };

  const confirmCatDelete = (cat: Category) => {
    Alert.alert(t.settings.deleteCategoryTitle(cat.name), t.settings.deleteCategoryMsg, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: async () => { await deleteCategory(cat.id); getCategories().then(setCategories); } },
    ]);
  };

  const confirmTagRename = async () => {
    if (!editingTagId || !editingTagName.trim()) return;
    await renameTag(editingTagId, editingTagName.trim());
    setEditingTagId(null);
    getTags().then(setTags);
  };

  const confirmTagDelete = (tag: Tag) => {
    Alert.alert(t.settings.deleteTagTitle(tag.name), t.settings.deleteTagMsg, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: async () => { await deleteTag(tag.id); getTags().then(setTags); } },
    ]);
  };

  const addQualifier = async () => {
    if (!newQualName.trim()) return;
    await createQualifier(newQualName.trim(), newQualPreset);
    setNewQualName('');
    setNewQualPreset('mood');
    getQualifiers().then(setQualifiers);
  };

  const confirmQualDelete = (q: Qualifier) => {
    Alert.alert(t.settings.deleteQualifierTitle(q.name), t.settings.deleteQualifierMsg, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: async () => { await deleteQualifier(q.id); getQualifiers().then(setQualifiers); } },
    ]);
  };

  const saveQualEdit = async () => {
    if (editingQualId === null) return;
    await updateQualifier(editingQualId, editingQualName, editingQualPreset);
    setEditingQualId(null);
    getQualifiers().then(setQualifiers);
  };

  const openCatQualModal = async (cat: Category) => {
    const ids = await getCategoryQualifierIds(cat.id);
    setCatQualSelected(ids);
    setCatQualModal(cat);
  };

  const saveCatQualModal = async () => {
    if (!catQualModal) return;
    await setCategoryQualifiers(catQualModal.id, catQualSelected);
    setCatQualModal(null);
  };

  const hexValid = isValidHex(colorPickerHex);

  return (
    <>
      <Text style={styles.subLabel}>{t.settings.subCategories}</Text>
      {categories.map((cat) => (
        <View key={cat.id} style={styles.catRow}>
          {editingId === cat.id ? (
            <>
              <TextInput style={styles.catInput} value={editingName} onChangeText={setEditingName} onSubmitEditing={confirmRename} autoFocus />
              <Pressable style={styles.catAction} onPress={confirmRename}><Text style={styles.accentText}>{t.common.ok}</Text></Pressable>
              <Pressable style={styles.catAction} onPress={() => setEditingId(null)}><Text style={styles.mutedText}>✕</Text></Pressable>
            </>
          ) : (
            <>
              <Pressable style={[styles.colorSwatch, { backgroundColor: cat.color ?? c.accent }]} onPress={() => openColorPicker(cat)} />
              <Text style={styles.catName}>{cat.name}</Text>
              <Pressable style={styles.catAction} onPress={() => openCatQualModal(cat)}>
                <Text style={{ fontSize: 15, color: c.muted }}>📊</Text>
              </Pressable>
              <Pressable style={styles.catAction} onPress={() => { setEditingId(cat.id); setEditingName(cat.name); }}><Text style={styles.mutedText}>✎</Text></Pressable>
              <Pressable style={styles.catAction} onPress={() => confirmCatDelete(cat)}><Text style={styles.dangerText}>✕</Text></Pressable>
            </>
          )}
        </View>
      ))}
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput} value={newCatName} onChangeText={setNewCatName}
          placeholder={t.settings.newCategoryPlaceholder} placeholderTextColor={c.muted}
          onSubmitEditing={addCategory} returnKeyType="done"
        />
        <Pressable style={styles.addButton} onPress={addCategory}>
          <Text style={styles.addButtonText}>＋</Text>
        </Pressable>
      </View>

      {tags.length > 0 && (
        <>
          <Text style={[styles.subLabel, { marginTop: 10 }]}>{t.settings.subTags}</Text>
          {tags.map((tag) => (
            <View key={tag.id} style={styles.catRow}>
              {editingTagId === tag.id ? (
                <>
                  <TextInput style={styles.catInput} value={editingTagName} onChangeText={setEditingTagName} onSubmitEditing={confirmTagRename} autoFocus autoCapitalize="none" />
                  <Pressable style={styles.catAction} onPress={confirmTagRename}><Text style={styles.accentText}>{t.common.ok}</Text></Pressable>
                  <Pressable style={styles.catAction} onPress={() => setEditingTagId(null)}><Text style={styles.mutedText}>✕</Text></Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.catName}>#{tag.name}</Text>
                  <Pressable style={styles.catAction} onPress={() => { setEditingTagId(tag.id); setEditingTagName(tag.name); }}><Text style={styles.mutedText}>✎</Text></Pressable>
                  <Pressable style={styles.catAction} onPress={() => confirmTagDelete(tag)}><Text style={styles.dangerText}>✕</Text></Pressable>
                </>
              )}
            </View>
          ))}
        </>
      )}

      <Text style={[styles.subLabel, { marginTop: 10 }]}>{t.settings.subQualifiers}</Text>
      {qualifiers.map((q) =>
        editingQualId === q.id ? (
          <View key={q.id} style={{ backgroundColor: c.bg, borderRadius: 10, padding: 12, gap: 8 }}>
            <TextInput style={[styles.catInput, { marginHorizontal: 0 }]} value={editingQualName} onChangeText={setEditingQualName} autoFocus returnKeyType="done" />
            <View style={{ gap: 4 }}>
              {Object.entries(EMOJI_PRESETS).map(([key, preset]) => (
                <Pressable key={key} onPress={() => setEditingQualPreset(key)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
                    backgroundColor: editingQualPreset === key ? c.accent + '22' : 'transparent',
                    borderWidth: 1, borderColor: editingQualPreset === key ? c.accent : 'transparent' }}>
                  <Text style={{ width: 58, fontSize: 12, color: c.muted }}>{preset.label}</Text>
                  {preset.emojis.map((e, i) => <Text key={i} style={{ fontSize: 20 }}>{e}</Text>)}
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <Pressable style={styles.catAction} onPress={() => setEditingQualId(null)}><Text style={styles.mutedText}>✕</Text></Pressable>
              <Pressable style={styles.catAction} onPress={saveQualEdit}><Text style={styles.accentText}>{t.common.ok}</Text></Pressable>
            </View>
          </View>
        ) : (
          <View key={q.id} style={styles.catRow}>
            <View style={{ flexDirection: 'row', gap: 1, marginRight: 6 }}>
              {(EMOJI_PRESETS[q.emoji_preset]?.emojis ?? ['❓', '❓', '❓', '❓', '❓']).map((e, i) => (
                <Text key={i} style={{ fontSize: 13 }}>{e}</Text>
              ))}
            </View>
            <Text style={[styles.catName, { fontSize: 13 }]}>{q.name}</Text>
            <Switch
              value={q.active === 1}
              onValueChange={async (v) => { await setQualifierActive(q.id, v); getQualifiers().then(setQualifiers); }}
              trackColor={{ false: c.border, true: c.accent + '88' }}
              thumbColor={q.active === 1 ? c.accent : c.muted}
            />
            <Pressable style={styles.catAction} onPress={() => { setEditingQualId(q.id); setEditingQualName(q.name); setEditingQualPreset(q.emoji_preset); }}><Text style={styles.mutedText}>✎</Text></Pressable>
            <Pressable style={styles.catAction} onPress={() => confirmQualDelete(q)}><Text style={styles.dangerText}>✕</Text></Pressable>
          </View>
        )
      )}
      {(() => {
        const available = Object.entries(EMOJI_PRESETS).filter(
          ([, preset]) => !qualifiers.some(q => q.name === preset.label)
        );
        if (available.length === 0) return null;
        return (
          <View style={{ marginTop: 8, gap: 6 }}>
            <Text style={styles.subLabel}>{t.settings.qualifierQuickAdd}</Text>
            <View style={{ gap: 4 }}>
              {available.map(([key, preset]) => (
                <Pressable key={key}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: c.border }}
                  onPress={async () => { await createQualifier(preset.label, key); getQualifiers().then(setQualifiers); }}>
                  <Text style={{ width: 58, fontSize: 12, color: c.muted }}>{preset.label}</Text>
                  {preset.emojis.map((e, i) => <Text key={i} style={{ fontSize: 20 }}>{e}</Text>)}
                  <Text style={{ marginLeft: 4, fontSize: 12, color: c.accent }}>＋</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })()}
      <View style={{ gap: 4, marginTop: 8 }}>
        <TextInput
          style={styles.addInput} value={newQualName} onChangeText={setNewQualName}
          placeholder={t.settings.newQualifierPlaceholder} placeholderTextColor={c.muted}
          returnKeyType="done"
        />
        <View style={{ gap: 4 }}>
          {Object.entries(EMOJI_PRESETS).map(([key, preset]) => (
            <Pressable key={key} onPress={() => setNewQualPreset(key)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
                backgroundColor: newQualPreset === key ? c.accent + '22' : 'transparent',
                borderWidth: 1, borderColor: newQualPreset === key ? c.accent : 'transparent' }}>
              <Text style={{ width: 58, fontSize: 12, color: c.muted }}>{preset.label}</Text>
              {preset.emojis.map((e, i) => <Text key={i} style={{ fontSize: 20 }}>{e}</Text>)}
            </Pressable>
          ))}
        </View>
        <Pressable style={[styles.addButton, { alignSelf: 'flex-end', width: 'auto', paddingHorizontal: 20 }]} onPress={addQualifier} disabled={!newQualName.trim()}>
          <Text style={styles.addButtonText}>＋ {newQualName.trim() || t.settings.newQualifierPlaceholder}</Text>
        </Pressable>
      </View>

      <Modal visible={catQualModal !== null} transparent animationType="fade" onRequestClose={() => setCatQualModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCatQualModal(null)}>
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>{catQualModal ? t.settings.categoryQualifiersTitle(catQualModal.name) : ''}</Text>
              <Text style={[styles.warnText, { marginBottom: 4 }]}>{t.settings.categoryQualifiersHint}</Text>
              {qualifiers.map((q) => {
                const preset = EMOJI_PRESETS[q.emoji_preset];
                const checked = catQualSelected.includes(q.id);
                return (
                  <Pressable key={q.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
                    onPress={() => setCatQualSelected(prev => checked ? prev.filter(id => id !== q.id) : [...prev, q.id])}>
                    <Text style={{ fontSize: 20 }}>{checked ? '☑' : '☐'}</Text>
                    <Text style={{ fontSize: 17 }}>{preset?.icon}</Text>
                    <Text style={{ fontSize: 15, color: c.text }}>{q.name}</Text>
                  </Pressable>
                );
              })}
              <View style={[styles.modalBtnRow, { marginTop: 8 }]}>
                <Pressable style={styles.modalCancel} onPress={() => setCatQualModal(null)}>
                  <Text style={styles.modalCancelText}>{t.common.cancel}</Text>
                </Pressable>
                <Pressable style={styles.modalBtn} onPress={saveCatQualModal}>
                  <Text style={styles.modalBtnText}>{t.common.save}</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={colorPickerCat !== null} transparent animationType="fade" onRequestClose={() => setColorPickerCat(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t.settings.colorPickerTitle}</Text>
            <View style={styles.colorGrid}>
              {COLOR_PICKER_PALETTE.map((col) => (
                <Pressable
                  key={col}
                  style={[styles.colorGridSwatch, { backgroundColor: col }, colorPickerHex === col && styles.colorGridSwatchSelected]}
                  onPress={() => setColorPickerHex(col)}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={[styles.colorPreview, { backgroundColor: hexValid ? colorPickerHex : c.border }]} />
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                value={colorPickerHex}
                onChangeText={v => setColorPickerHex(v.toUpperCase())}
                placeholder="#RRGGBB"
                placeholderTextColor={c.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={7}
              />
            </View>
            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalCancel} onPress={() => setColorPickerCat(null)}>
                <Text style={styles.modalCancelText}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, !hexValid && { opacity: 0.4 }]} onPress={confirmColorPick} disabled={!hexValid}>
                <Text style={styles.modalBtnText}>{t.common.ok}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
