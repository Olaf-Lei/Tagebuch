import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../components/theme';
import {
  createCategory, deleteCategory, getCategories,
  renameCategory, type Category,
} from '../db/categories';
import { getTags, renameTag, deleteTag, type Tag } from '../db/tags';
import { loadConfig, saveConfig, getLastSync, syncNow, type WebDavConfig } from '../sync/webdav';

export default function SettingsScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const [tags, setTags] = useState<Tag[]>([]);
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingTagName, setEditingTagName] = useState('');

  const [config, setConfig] = useState<Partial<WebDavConfig>>({});
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories);
    getTags().then(setTags);
    loadConfig().then(setConfig);
    getLastSync().then(setLastSync);
  }, []);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    await createCategory(newCatName.trim());
    setNewCatName('');
    getCategories().then(setCategories);
  };

  const startRename = (cat: Category) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const confirmRename = async () => {
    if (!editingId || !editingName.trim()) return;
    await renameCategory(editingId, editingName.trim());
    setEditingId(null);
    getCategories().then(setCategories);
  };

  const confirmCatDelete = (cat: Category) => {
    Alert.alert(`„${cat.name}" löschen?`, 'Die Kategorie wird aus allen Einträgen entfernt.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          await deleteCategory(cat.id);
          getCategories().then(setCategories);
        },
      },
    ]);
  };

  const confirmTagRename = async () => {
    if (!editingTagId || !editingTagName.trim()) return;
    await renameTag(editingTagId, editingTagName.trim());
    setEditingTagId(null);
    getTags().then(setTags);
  };

  const confirmTagDelete = (tag: Tag) => {
    Alert.alert(`„#${tag.name}" löschen?`, 'Der Tag wird aus allen Einträgen entfernt.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          await deleteTag(tag.id);
          getTags().then(setTags);
        },
      },
    ]);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncNow();
      const updated = await getLastSync();
      setLastSync(updated);
      Alert.alert('Sync erfolgreich', `Zuletzt synchronisiert: ${updated}`);
    } catch (e: any) {
      Alert.alert('Sync fehlgeschlagen', e.message ?? 'Unbekannter Fehler');
    } finally {
      setSyncing(false);
    }
  };

  const saveNextcloud = async () => {
    if (!config.url || !config.username || !config.password) {
      Alert.alert('Fehlende Angaben', 'URL, Benutzername und Passwort sind erforderlich.');
      return;
    }
    await saveConfig(config as WebDavConfig);
    Alert.alert('Gespeichert');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Categories */}
          <Text style={styles.section}>Kategorien</Text>
          {categories.map((cat) => (
            <View key={cat.id} style={styles.catRow}>
              {editingId === cat.id ? (
                <>
                  <TextInput
                    style={styles.catInput}
                    value={editingName}
                    onChangeText={setEditingName}
                    onSubmitEditing={confirmRename}
                    autoFocus
                  />
                  <Pressable style={styles.catAction} onPress={confirmRename}>
                    <Text style={styles.accentText}>OK</Text>
                  </Pressable>
                  <Pressable style={styles.catAction} onPress={() => setEditingId(null)}>
                    <Text style={styles.mutedText}>✕</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <Pressable style={styles.catAction} onPress={() => startRename(cat)}>
                    <Text style={styles.mutedText}>✎</Text>
                  </Pressable>
                  <Pressable style={styles.catAction} onPress={() => confirmCatDelete(cat)}>
                    <Text style={styles.dangerText}>✕</Text>
                  </Pressable>
                </>
              )}
            </View>
          ))}
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              value={newCatName}
              onChangeText={setNewCatName}
              placeholder="Neue Kategorie…"
              placeholderTextColor={colors.muted}
              onSubmitEditing={addCategory}
              returnKeyType="done"
            />
            <Pressable style={styles.addButton} onPress={addCategory}>
              <Text style={styles.addButtonText}>＋</Text>
            </Pressable>
          </View>

          {/* Tags */}
          {tags.length > 0 && (
            <>
              <Text style={styles.section}>Tags</Text>
              {tags.map((tag) => (
                <View key={tag.id} style={styles.catRow}>
                  {editingTagId === tag.id ? (
                    <>
                      <TextInput
                        style={styles.catInput}
                        value={editingTagName}
                        onChangeText={setEditingTagName}
                        onSubmitEditing={confirmTagRename}
                        autoFocus
                        autoCapitalize="none"
                      />
                      <Pressable style={styles.catAction} onPress={confirmTagRename}>
                        <Text style={styles.accentText}>OK</Text>
                      </Pressable>
                      <Pressable style={styles.catAction} onPress={() => setEditingTagId(null)}>
                        <Text style={styles.mutedText}>✕</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text style={styles.catName}>#{tag.name}</Text>
                      <Pressable style={styles.catAction} onPress={() => { setEditingTagId(tag.id); setEditingTagName(tag.name); }}>
                        <Text style={styles.mutedText}>✎</Text>
                      </Pressable>
                      <Pressable style={styles.catAction} onPress={() => confirmTagDelete(tag)}>
                        <Text style={styles.dangerText}>✕</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              ))}
            </>
          )}

          {/* Nextcloud */}
          <Text style={styles.section}>Nextcloud</Text>
          <Text style={styles.fieldLabel}>URL (z. B. https://cloud.example.com)</Text>
          <TextInput
            style={styles.field}
            value={config.url ?? ''}
            onChangeText={(v) => setConfig((c) => ({ ...c, url: v }))}
            placeholder="https://…"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Text style={styles.fieldLabel}>Benutzername</Text>
          <TextInput
            style={styles.field}
            value={config.username ?? ''}
            onChangeText={(v) => setConfig((c) => ({ ...c, username: v }))}
            placeholder="user"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <Text style={styles.fieldLabel}>Passwort</Text>
          <TextInput
            style={styles.field}
            value={config.password ?? ''}
            onChangeText={(v) => setConfig((c) => ({ ...c, password: v }))}
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            secureTextEntry
          />
          <Text style={styles.fieldLabel}>Pfad auf Nextcloud</Text>
          <TextInput
            style={styles.field}
            value={config.path ?? '/Tagebuch/'}
            onChangeText={(v) => setConfig((c) => ({ ...c, path: v }))}
            placeholder="/Tagebuch/"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <Pressable style={styles.saveButton} onPress={saveNextcloud}>
            <Text style={styles.saveText}>Zugangsdaten speichern</Text>
          </Pressable>

          <View style={styles.syncRow}>
            <Pressable style={styles.syncButton} onPress={handleSync} disabled={syncing}>
              {syncing
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.syncText}>Jetzt synchronisieren</Text>
              }
            </Pressable>
            {lastSync && (
              <Text style={styles.lastSync}>Zuletzt: {lastSync}</Text>
            )}
          </View>

          {/* Placeholder encryption */}
          <Text style={styles.section}>Verschlüsselung</Text>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Nicht aktiv in v1</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  section: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 2,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    gap: 4,
  },
  catName: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 8 },
  catInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: colors.accent,
  },
  catAction: { padding: 8 },
  accentText: { color: colors.accent, fontSize: 14 },
  mutedText: { color: colors.muted, fontSize: 16 },
  dangerText: { color: colors.danger, fontSize: 16 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 22 },
  fieldLabel: { fontSize: 12, color: colors.muted, marginTop: 4 },
  field: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  saveButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  saveText: { color: colors.accent, fontSize: 15 },
  syncRow: { gap: 8, marginTop: 4 },
  syncButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  syncText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  lastSync: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  placeholder: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  placeholderText: { color: colors.muted, fontSize: 14 },
});
