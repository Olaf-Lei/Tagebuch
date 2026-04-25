import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../components/theme';
import { useTheme } from '../contexts/ThemeContext';
import {
  createCategory, deleteCategory, getCategories,
  renameCategory, type Category,
} from '../db/categories';
import { getTags, renameTag, deleteTag, type Tag } from '../db/tags';
import { loadConfig, saveConfig, getLastSync, syncNow, restoreNow, type WebDavConfig } from '../sync/webdav';
import { exportJSON, exportCSV } from '../utils/export';
import { getAutoSyncInterval, setAutoSyncInterval } from '../sync/backgroundSync';
import { useBiometric } from '../contexts/BiometricContext';
import { isEncryptionEnabled, setEncryptionEnabled, resetEncryptionKey } from '../utils/crypto';
import { setFallbackPassword, checkFallbackPassword, hasFallbackPassword } from '../utils/auth';

export default function SettingsScreen() {
  const c = useColors();
  const { mode, toggle } = useTheme();
  const { enabled: bioEnabled, available: bioAvailable, setEnabled: setBioEnabled } = useBiometric();
  const router = useRouter();
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    content: { padding: 16, gap: 10, paddingBottom: 40 },
    section: {
      fontSize: 11, fontWeight: '700', color: c.muted, textTransform: 'uppercase',
      letterSpacing: 1, marginTop: 16, marginBottom: 2,
    },
    catRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
      borderRadius: 8, paddingVertical: 4, paddingHorizontal: 12, gap: 4,
    },
    catName: { flex: 1, fontSize: 15, color: c.text, paddingVertical: 8 },
    catInput: { flex: 1, fontSize: 15, color: c.text, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.accent },
    catAction: { padding: 13, margin: -5 },
    accentText: { color: c.accent, fontSize: 14 },
    mutedText: { color: c.muted, fontSize: 16 },
    dangerText: { color: c.danger, fontSize: 16 },
    addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    addInput: {
      flex: 1, backgroundColor: c.surface, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.text,
    },
    addButton: { backgroundColor: c.accent, borderRadius: 8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    addButtonText: { color: '#fff', fontSize: 22 },
    fieldLabel: { fontSize: 12, color: c.muted, marginTop: 4 },
    field: { backgroundColor: c.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.text },
    saveButton: { borderWidth: 1, borderColor: c.accent, borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 4 },
    saveText: { color: c.accent, fontSize: 15 },
    syncRow: { gap: 8, marginTop: 4 },
    syncButton: { backgroundColor: c.accent, borderRadius: 10, padding: 14, alignItems: 'center' },
    syncText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    lastSync: { fontSize: 12, color: c.muted, textAlign: 'center' },
    placeholder: { backgroundColor: c.surface, borderRadius: 8, padding: 14, alignItems: 'center' },
    placeholderText: { color: c.muted, fontSize: 14 },
    intervalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    intervalChip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
    intervalChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    intervalChipText: { fontSize: 13, color: c.muted },
    intervalChipTextActive: { color: '#fff', fontWeight: '600' },
    exportRow: { flexDirection: 'row', gap: 10 },
    exportBtn: { flex: 1, borderWidth: 1, borderColor: c.accent, borderRadius: 10, padding: 13, alignItems: 'center' },
    exportBtnText: { color: c.accent, fontSize: 14, fontWeight: '600' },
    aboutBlock: { backgroundColor: c.surface, borderRadius: 12, padding: 16, gap: 4 },
    aboutTitle: { fontSize: 16, fontWeight: '700', color: c.text },
    aboutLine: { fontSize: 13, color: c.muted },
    themeRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12,
    },
    themeLabel: { fontSize: 15, color: c.text },
    warnText: { fontSize: 12, color: c.muted, marginTop: 2 },
    resetBtn: { borderWidth: 1, borderColor: c.danger, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 4 },
    resetBtnText: { color: c.danger, fontSize: 14 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: c.surface, borderRadius: 16, padding: 24, gap: 12 },
    modalTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    modalInput: { backgroundColor: c.bg, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.text },
    modalError: { fontSize: 13, color: c.danger },
    modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalBtn: { flex: 1, backgroundColor: c.accent, borderRadius: 10, padding: 13, alignItems: 'center' },
    modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    modalCancel: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 13, alignItems: 'center' },
    modalCancelText: { color: c.muted, fontSize: 15 },
  }), [c]);

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
  const [restoring, setRestoring] = useState(false);
  const [autoSyncInterval, setAutoSyncIntervalState] = useState(0);
  const [encEnabled, setEncEnabledState] = useState(false);

  // Password modal: 'set' = first setup, 'change' = change existing, 'reset' = biometric-verified reset
  const [pwModal, setPwModal] = useState<'set' | 'change' | 'reset' | null>(null);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');

  const SYNC_INTERVALS = [
    { label: 'Aus', value: 0 },
    { label: '15 Min', value: 15 },
    { label: '1 Std', value: 60 },
    { label: '6 Std', value: 360 },
    { label: '24 Std', value: 1440 },
  ];

  useEffect(() => {
    getCategories().then(setCategories);
    getTags().then(setTags);
    loadConfig().then(setConfig);
    getLastSync().then(setLastSync);
    getAutoSyncInterval().then(setAutoSyncIntervalState);
    isEncryptionEnabled().then(setEncEnabledState);
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

  const handleBioToggle = async (v: boolean) => {
    if (v) {
      const hasPw = await hasFallbackPassword();
      if (!hasPw) {
        // Must set password first
        setPwModal('set');
        return;
      }
    }
    await setBioEnabled(v);
  };

  const closePwModal = () => {
    setPwModal(null);
    setPwCurrent(''); setPwNew(''); setPwConfirm(''); setPwError('');
  };

  const handleSavePassword = async () => {
    if (pwNew.length < 4) { setPwError('Mindestens 4 Zeichen'); return; }
    if (pwNew !== pwConfirm) { setPwError('Passwörter stimmen nicht überein'); return; }
    if (pwModal === 'change') {
      const ok = await checkFallbackPassword(pwCurrent);
      if (!ok) { setPwError('Aktuelles Passwort falsch'); return; }
    }
    await setFallbackPassword(pwNew);
    if (pwModal === 'set') await setBioEnabled(true);
    closePwModal();
    Alert.alert('Passwort gespeichert');
  };

  const handleBioReset = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Passwort zurücksetzen – Identität bestätigen',
      disableDeviceFallback: true,
    });
    if (result.success) {
      setPwModal('reset');
    } else {
      Alert.alert('Abgebrochen', 'Biometrische Bestätigung fehlgeschlagen.');
    }
  };

  const handleExport = (format: 'json' | 'csv') => {
    const fn = format === 'json' ? exportJSON : exportCSV;
    fn().catch((e) => Alert.alert('Export fehlgeschlagen', e.message ?? String(e)));
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

  const handleRestore = () => {
    Alert.alert(
      'Aus Nextcloud wiederherstellen?',
      'Alle lokalen Daten werden durch das Backup ersetzt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Wiederherstellen', style: 'destructive', onPress: async () => {
            setRestoring(true);
            try {
              await restoreNow();
              Alert.alert('Wiederhergestellt', 'Daten wurden aus dem Backup geladen.', [
                { text: 'OK', onPress: () => router.replace('/') },
              ]);
            } catch (e: any) {
              Alert.alert('Fehler', e.message ?? 'Wiederherstellung fehlgeschlagen.');
            } finally {
              setRestoring(false);
            }
          },
        },
      ],
    );
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
              placeholderTextColor={c.muted}
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
          <Text style={styles.fieldLabel}>Nextcloud-URL (z. B. https://cloud.example.com)</Text>
          <TextInput
            style={styles.field}
            value={config.url ?? ''}
            onChangeText={(v) => setConfig((c) => ({ ...c, url: v }))}
            placeholder="https://…"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Text style={styles.fieldLabel}>Benutzername</Text>
          <TextInput
            style={styles.field}
            value={config.username ?? ''}
            onChangeText={(v) => setConfig((c) => ({ ...c, username: v }))}
            placeholder="user"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
          />
          <Text style={styles.fieldLabel}>Passwort</Text>
          <TextInput
            style={styles.field}
            value={config.password ?? ''}
            onChangeText={(v) => setConfig((c) => ({ ...c, password: v }))}
            placeholder="••••••••"
            placeholderTextColor={c.muted}
            secureTextEntry
          />
          <Text style={styles.fieldLabel}>Pfad auf Nextcloud</Text>
          <TextInput
            style={styles.field}
            value={config.path ?? '/Tagebuch/'}
            onChangeText={(v) => setConfig((c) => ({ ...c, path: v }))}
            placeholder="/Tagebuch/"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
          />
          <Pressable style={styles.saveButton} onPress={saveNextcloud}>
            <Text style={styles.saveText}>Zugangsdaten speichern</Text>
          </Pressable>

          <View style={styles.syncRow}>
            <Pressable style={styles.syncButton} onPress={handleSync} disabled={syncing || restoring}>
              {syncing
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.syncText}>Jetzt synchronisieren</Text>
              }
            </Pressable>
            <Pressable style={styles.saveButton} onPress={handleRestore} disabled={syncing || restoring}>
              {restoring
                ? <ActivityIndicator color={c.accent} />
                : <Text style={styles.saveText}>Aus Nextcloud wiederherstellen</Text>
              }
            </Pressable>
            {lastSync && (
              <Text style={styles.lastSync}>Zuletzt: {lastSync}</Text>
            )}
          </View>

          {/* Auto-Sync */}
          <Text style={styles.section}>Auto-Sync</Text>
          <View style={styles.intervalRow}>
            {SYNC_INTERVALS.map(({ label, value }) => (
              <Pressable
                key={value}
                style={[styles.intervalChip, autoSyncInterval === value && styles.intervalChipActive]}
                onPress={async () => {
                  await setAutoSyncInterval(value);
                  setAutoSyncIntervalState(value);
                }}
              >
                <Text style={[styles.intervalChipText, autoSyncInterval === value && styles.intervalChipTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Darstellung */}
          <Text style={styles.section}>Darstellung</Text>
          <View style={styles.themeRow}>
            <Text style={styles.themeLabel}>Heller Modus</Text>
            <Switch
              value={mode === 'light'}
              onValueChange={toggle}
              trackColor={{ false: c.border, true: c.accent }}
              thumbColor="#fff"
            />
          </View>

          {/* Biometrie */}
          <Text style={styles.section}>Biometrie</Text>
          <View style={styles.themeRow}>
            <Text style={[styles.themeLabel, !bioAvailable && { color: c.muted }]}>
              Biometrie-Lock
            </Text>
            <Switch
              value={bioEnabled}
              onValueChange={handleBioToggle}
              disabled={!bioAvailable}
              trackColor={{ false: c.border, true: c.accent }}
              thumbColor="#fff"
            />
          </View>
          {!bioAvailable && (
            <Text style={styles.warnText}>Kein Fingerabdruck oder Gesichtserkennung eingerichtet.</Text>
          )}
          {bioEnabled && (
            <>
              <Pressable style={styles.saveButton} onPress={() => setPwModal('change')}>
                <Text style={styles.saveText}>Passwort ändern</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleBioReset}>
                <Text style={styles.saveText}>Passwort vergessen? Per Biometrie zurücksetzen</Text>
              </Pressable>
            </>
          )}

          {/* Verschlüsselung */}
          <Text style={styles.section}>Verschlüsselung</Text>
          <View style={styles.themeRow}>
            <Text style={styles.themeLabel}>Verschlüsselung vor Upload</Text>
            <Switch
              value={encEnabled}
              onValueChange={async (v) => {
                await setEncryptionEnabled(v);
                setEncEnabledState(v);
              }}
              trackColor={{ false: c.border, true: c.accent }}
              thumbColor="#fff"
            />
          </View>
          <Text style={styles.warnText}>
            Verschlüsselte Backups können nur auf diesem Gerät wiederhergestellt werden.
          </Text>
          {encEnabled && (
            <Pressable
              style={styles.resetBtn}
              onPress={() => Alert.alert(
                'Schlüssel zurücksetzen?',
                'Bestehende Backups auf Nextcloud können danach nicht mehr entschlüsselt werden.',
                [
                  { text: 'Abbrechen', style: 'cancel' },
                  { text: 'Zurücksetzen', style: 'destructive', onPress: () => resetEncryptionKey() },
                ],
              )}
            >
              <Text style={styles.resetBtnText}>Schlüssel zurücksetzen</Text>
            </Pressable>
          )}

          {/* Export */}
          <Text style={styles.section}>Export</Text>
          <View style={styles.exportRow}>
            <Pressable style={styles.exportBtn} onPress={() => handleExport('json')}>
              <Text style={styles.exportBtnText}>JSON</Text>
            </Pressable>
            <Pressable style={styles.exportBtn} onPress={() => handleExport('csv')}>
              <Text style={styles.exportBtnText}>CSV</Text>
            </Pressable>
          </View>

          {/* About */}
          <Text style={styles.section}>Über die App</Text>
          <View style={styles.aboutBlock}>
            <Text style={styles.aboutTitle}>Tagebuch</Text>
            <Text style={styles.aboutLine}>Version {Constants.expoConfig?.version ?? '–'}</Text>
            <Text style={styles.aboutLine}>Lokale Daten · Kein Cloud-Zwang</Text>
            <Text style={styles.aboutLine}>v2 Beta · Gebaut mit Expo SDK 55</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Password modal */}
      <Modal visible={pwModal !== null} transparent animationType="fade" onRequestClose={closePwModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {pwModal === 'set' ? 'Fallback-Passwort festlegen'
                : pwModal === 'reset' ? 'Neues Passwort festlegen'
                : 'Passwort ändern'}
            </Text>
            {pwModal === 'change' && (
              <TextInput
                style={styles.modalInput}
                value={pwCurrent}
                onChangeText={(v) => { setPwCurrent(v); setPwError(''); }}
                placeholder="Aktuelles Passwort"
                placeholderTextColor={c.muted}
                secureTextEntry
              />
            )}
            <TextInput
              style={styles.modalInput}
              value={pwNew}
              onChangeText={(v) => { setPwNew(v); setPwError(''); }}
              placeholder="Neues Passwort (min. 4 Zeichen)"
              placeholderTextColor={c.muted}
              secureTextEntry
            />
            <TextInput
              style={styles.modalInput}
              value={pwConfirm}
              onChangeText={(v) => { setPwConfirm(v); setPwError(''); }}
              placeholder="Passwort wiederholen"
              placeholderTextColor={c.muted}
              secureTextEntry
              onSubmitEditing={handleSavePassword}
              returnKeyType="done"
            />
            {!!pwError && <Text style={styles.modalError}>{pwError}</Text>}
            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalCancel} onPress={closePwModal}>
                <Text style={styles.modalCancelText}>Abbrechen</Text>
              </Pressable>
              <Pressable style={styles.modalBtn} onPress={handleSavePassword}>
                <Text style={styles.modalBtnText}>Speichern</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

