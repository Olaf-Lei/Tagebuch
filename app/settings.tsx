import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Clipboard, Image, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../components/theme';
import { useTheme, type ThemePreference } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useT } from '../i18n';
import {
  createCategory, deleteCategory, getCategories,
  renameCategory, type Category,
} from '../db/categories';
import { getTags, renameTag, deleteTag, type Tag } from '../db/tags';
import { loadConfig, saveConfig, getLastSync, syncNow, restoreNow, type WebDavConfig } from '../sync/webdav';
import { getSyncLog, clearSyncLog, type SyncLogEntry } from '../sync/syncLog';
import { exportJSON, exportCSV } from '../utils/export';
import { getAutoSyncInterval, setAutoSyncInterval } from '../sync/backgroundSync';
import { useBiometric } from '../contexts/BiometricContext';
import { isEncryptionEnabled, setEncryptionEnabled, resetEncryptionKey, exportEncKey, importEncKey } from '../utils/crypto';
import { setFallbackPassword, checkFallbackPassword, hasFallbackPassword, generateRecoveryCode, setRecoveryCode, hasRecoveryCode } from '../utils/auth';
import { getReminderEnabled, getReminderTime, scheduleReminder, cancelReminder, requestPermission } from '../utils/notifications';

type SectionKey = 'inhalte' | 'sync' | 'sicherheit' | 'erinnerungen' | 'darstellung' | 'export' | 'about';

function SectionHeader({
  title, open, onToggle, styles,
}: {
  title: string; open: boolean; onToggle: () => void;
  styles: { header: object; headerText: object; chevron: object };
}) {
  return (
    <Pressable style={styles.header} onPress={onToggle}>
      <Text style={styles.headerText}>{title}</Text>
      <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const c = useColors();
  const t = useT();
  const { mode, preference: themePref, setPreference: setThemePref } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { enabled: bioEnabled, available: bioAvailable, setEnabled: setBioEnabled } = useBiometric();
  const router = useRouter();

  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    inhalte: true,
    sync: false,
    sicherheit: false,
    erinnerungen: false,
    darstellung: false,
    export: false,
    about: false,
  });
  const toggle = (k: SectionKey) => setOpen((s) => ({ ...s, [k]: !s[k] }));

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    content: { padding: 16, gap: 0, paddingBottom: 40 },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 13, marginTop: 10,
    },
    sectionHeaderText: {
      fontSize: 13, fontWeight: '700', color: c.text, textTransform: 'uppercase', letterSpacing: 0.8,
    },
    sectionChevron: { fontSize: 16, color: c.muted },
    sectionBody: {
      backgroundColor: c.surface, borderRadius: 10, marginTop: 2,
      paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14, gap: 8,
    },
    catRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg,
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
      flex: 1, backgroundColor: c.bg, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.text,
    },
    addButton: { backgroundColor: c.accent, borderRadius: 8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    addButtonText: { color: '#fff', fontSize: 22 },
    subLabel: { fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 },
    fieldLabel: { fontSize: 12, color: c.muted, marginTop: 4 },
    field: { backgroundColor: c.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.text },
    saveButton: { borderWidth: 1, borderColor: c.accent, borderRadius: 10, padding: 13, alignItems: 'center' },
    saveText: { color: c.accent, fontSize: 15 },
    syncButton: { backgroundColor: c.accent, borderRadius: 10, padding: 14, alignItems: 'center' },
    syncText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    lastSync: { fontSize: 12, color: c.muted, textAlign: 'center' },
    placeholder: { backgroundColor: c.bg, borderRadius: 8, padding: 14, alignItems: 'center' },
    intervalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    intervalChip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
    intervalChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    intervalChipText: { fontSize: 13, color: c.muted },
    intervalChipTextActive: { color: '#fff', fontWeight: '600' },
    exportRow: { flexDirection: 'row', gap: 10 },
    exportBtn: { flex: 1, borderWidth: 1, borderColor: c.accent, borderRadius: 10, padding: 13, alignItems: 'center' },
    exportBtnText: { color: c.accent, fontSize: 14, fontWeight: '600' },
    switchRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.bg, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12,
    },
    switchLabel: { fontSize: 15, color: c.text },
    warnText: { fontSize: 12, color: c.muted },
    resetBtn: { borderWidth: 1, borderColor: c.danger, borderRadius: 10, padding: 12, alignItems: 'center' },
    resetBtnText: { color: c.danger, fontSize: 14 },
    aboutBlock: { alignItems: 'center', gap: 4, paddingVertical: 4 },
    aboutIcon: { width: 72, height: 72, borderRadius: 16, marginBottom: 8 },
    aboutTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    aboutLine: { fontSize: 13, color: c.muted, textAlign: 'center' },
    recoveryCode: { fontSize: 28, fontWeight: '700', color: c.accent, textAlign: 'center', letterSpacing: 4, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier', paddingVertical: 8 },
    recoveryHint: { fontSize: 12, color: c.muted, textAlign: 'center' },
    logBox: { backgroundColor: c.bg, borderRadius: 8, padding: 10, gap: 4 },
    logEntry: { fontSize: 11, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier', color: c.text },
    logEntryError: { color: c.danger },
    logEntryInfo: { color: c.muted },
    logEmpty: { fontSize: 13, color: c.muted, textAlign: 'center', padding: 10 },
    logActionRow: { flexDirection: 'row', gap: 8 },
    logActionBtn: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10, alignItems: 'center' },
    logActionBtnText: { color: c.muted, fontSize: 13 },
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

  const headerStyles = { header: styles.sectionHeader, headerText: styles.sectionHeaderText, chevron: styles.sectionChevron };

  // ── State ────────────────────────────────────────────────────────────────────

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
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [logExpanded, setLogExpanded] = useState(false);
  const [recoveryCode, setRecoveryCodeState] = useState<string | null>(null);
  const [hasRecovery, setHasRecovery] = useState(false);

  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(20);
  const [reminderMinute, setReminderMinute] = useState(0);

  const [pwModal, setPwModal] = useState<'set' | 'change' | 'reset' | null>(null);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');

  const [encKeyModal, setEncKeyModal] = useState<'export' | 'import' | null>(null);
  const [exportedKey, setExportedKey] = useState<string | null>(null);
  const [importKeyText, setImportKeyText] = useState('');
  const [importKeyError, setImportKeyError] = useState('');

  const SYNC_INTERVALS = [
    { label: t.settings.syncOff, value: 0 },
    { label: t.settings.sync15m, value: 15 },
    { label: t.settings.sync1h, value: 60 },
    { label: t.settings.sync6h, value: 360 },
    { label: t.settings.sync24h, value: 1440 },
  ];

  useEffect(() => {
    getCategories().then(setCategories);
    getTags().then(setTags);
    loadConfig().then(setConfig);
    getLastSync().then(setLastSync);
    getAutoSyncInterval().then(setAutoSyncIntervalState);
    isEncryptionEnabled().then(setEncEnabledState);
    getSyncLog().then(setSyncLog);
    hasRecoveryCode().then(setHasRecovery);
    getReminderEnabled().then(setReminderEnabled);
    getReminderTime().then(({ hour, minute }) => { setReminderHour(hour); setReminderMinute(minute); });
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────

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

  const handleBioToggle = async (v: boolean) => {
    if (v) {
      const hasPw = await hasFallbackPassword();
      if (!hasPw) { setPwModal('set'); return; }
    }
    await setBioEnabled(v);
  };

  const closePwModal = () => {
    setPwModal(null);
    setPwCurrent(''); setPwNew(''); setPwConfirm(''); setPwError('');
  };

  const handleSavePassword = async () => {
    if (pwNew.length < 4) { setPwError(t.settings.pwErrorMinLength); return; }
    if (pwNew !== pwConfirm) { setPwError(t.settings.pwErrorMismatch); return; }
    if (pwModal === 'change') {
      const ok = await checkFallbackPassword(pwCurrent);
      if (!ok) { setPwError(t.settings.pwErrorWrong); return; }
    }
    await setFallbackPassword(pwNew);
    if (pwModal === 'set') await setBioEnabled(true);
    closePwModal();
    Alert.alert(t.settings.pwSaved);
  };

  const handleBioReset = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t.settings.btnResetWithBiometric,
      disableDeviceFallback: true,
    });
    if (result.success) { setPwModal('reset'); }
    else { Alert.alert(t.settings.bioResetAbortTitle, t.settings.bioResetAbortMsg); }
  };

  const handleGenerateRecovery = async () => {
    const code = await generateRecoveryCode();
    await setRecoveryCode(code);
    setHasRecovery(true);
    setRecoveryCodeState(code);
  };

  const handleShowExportKey = async () => {
    const key = await exportEncKey();
    setExportedKey(key);
    setEncKeyModal('export');
  };

  const handleCopyKey = () => {
    if (exportedKey) {
      Clipboard.setString(exportedKey);
      Alert.alert(t.settings.logCopied);
    }
  };

  const handleImportKey = async () => {
    setImportKeyError('');
    try {
      await importEncKey(importKeyText);
      setEncEnabledState(true);
      setEncKeyModal(null);
      setImportKeyText('');
      Alert.alert(t.settings.importKeySuccess);
    } catch {
      setImportKeyError(t.settings.importKeyError);
    }
  };

  const handleReminderToggle = async (v: boolean) => {
    if (v) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(t.settings.reminderNoPermissionTitle, t.settings.reminderNoPermissionMsg);
        return;
      }
      await scheduleReminder(reminderHour, reminderMinute);
    } else {
      await cancelReminder();
    }
    setReminderEnabled(v);
  };

  const applyReminderTime = async (hour: number, minute: number) => {
    setReminderHour(hour);
    setReminderMinute(minute);
    if (reminderEnabled) await scheduleReminder(hour, minute);
  };

  const handleExport = (format: 'json' | 'csv') => {
    const fn = format === 'json' ? exportJSON : exportCSV;
    fn().catch((e) => Alert.alert(t.settings.exportFailTitle, e.message ?? String(e)));
  };

  const refreshLog = async () => {
    const log = await getSyncLog();
    setSyncLog(log);
    setLogExpanded(true);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncNow();
      const updated = await getLastSync();
      setLastSync(updated);
      Alert.alert(t.settings.syncSuccessTitle, t.settings.syncSuccessMsg(updated ?? ''));
    } catch (e: any) {
      Alert.alert(t.settings.syncFailTitle, e.message ?? t.settings.unknownError);
    } finally {
      setSyncing(false);
      await refreshLog();
    }
  };

  const handleRestore = () => {
    Alert.alert(
      t.settings.restoreConfirmTitle,
      t.settings.restoreConfirmMsg,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.settings.restoreBtn, style: 'destructive', onPress: async () => {
            setRestoring(true);
            try {
              await restoreNow();
              await refreshLog();
              Alert.alert(t.settings.restoredTitle, t.settings.restoredMsg, [
                { text: t.common.ok, onPress: () => router.replace('/') },
              ]);
            } catch (e: any) {
              await refreshLog();
              Alert.alert(t.settings.restoreErrorTitle, e.message ?? t.settings.restoreErrorMsg);
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
      Alert.alert(t.settings.missingFieldsTitle, t.settings.missingFieldsMsg);
      return;
    }
    await saveConfig(config as WebDavConfig);
    Alert.alert(t.settings.savedAlert);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* ── Inhalte ── */}
          <SectionHeader title={t.settings.sectionContent} open={open.inhalte} onToggle={() => toggle('inhalte')} styles={headerStyles} />
          {open.inhalte && (
            <View style={styles.sectionBody}>
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
                      <Text style={styles.catName}>{cat.name}</Text>
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
            </View>
          )}

          {/* ── Sync & Backup ── */}
          <SectionHeader title={t.settings.sectionSync} open={open.sync} onToggle={() => toggle('sync')} styles={headerStyles} />
          {open.sync && (
            <View style={styles.sectionBody}>
              <Text style={styles.subLabel}>{t.settings.subNextcloud}</Text>
              <Text style={styles.fieldLabel}>{t.settings.fieldUrl}</Text>
              <TextInput style={styles.field} value={config.url ?? ''} onChangeText={(v) => setConfig((p) => ({ ...p, url: v }))} placeholder="https://…" placeholderTextColor={c.muted} autoCapitalize="none" keyboardType="url" />
              <Text style={styles.fieldLabel}>{t.settings.fieldUsername}</Text>
              <TextInput style={styles.field} value={config.username ?? ''} onChangeText={(v) => setConfig((p) => ({ ...p, username: v }))} placeholder="user" placeholderTextColor={c.muted} autoCapitalize="none" />
              <Text style={styles.fieldLabel}>{t.settings.fieldPassword}</Text>
              <TextInput style={styles.field} value={config.password ?? ''} onChangeText={(v) => setConfig((p) => ({ ...p, password: v }))} placeholder="••••••••" placeholderTextColor={c.muted} secureTextEntry />
              <Text style={styles.fieldLabel}>{t.settings.fieldPath}</Text>
              <TextInput style={styles.field} value={config.path ?? '/Tagebuch/'} onChangeText={(v) => setConfig((p) => ({ ...p, path: v }))} placeholder="/Tagebuch/" placeholderTextColor={c.muted} autoCapitalize="none" />
              <Pressable style={styles.saveButton} onPress={saveNextcloud}>
                <Text style={styles.saveText}>{t.settings.btnSaveCredentials}</Text>
              </Pressable>

              <Pressable style={[styles.syncButton, { marginTop: 6 }]} onPress={handleSync} disabled={syncing || restoring}>
                {syncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.syncText}>{t.settings.btnSyncNow}</Text>}
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleRestore} disabled={syncing || restoring}>
                {restoring ? <ActivityIndicator color={c.accent} /> : <Text style={styles.saveText}>{t.settings.btnRestore}</Text>}
              </Pressable>
              {lastSync && <Text style={styles.lastSync}>{t.settings.lastSync}{lastSync}</Text>}

              <Text style={[styles.subLabel, { marginTop: 10 }]}>{t.settings.subAutoSync}</Text>
              <View style={styles.intervalRow}>
                {SYNC_INTERVALS.map(({ label, value }) => (
                  <Pressable
                    key={value}
                    style={[styles.intervalChip, autoSyncInterval === value && styles.intervalChipActive]}
                    onPress={async () => { await setAutoSyncInterval(value); setAutoSyncIntervalState(value); }}
                  >
                    <Text style={[styles.intervalChipText, autoSyncInterval === value && styles.intervalChipTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable style={{ marginTop: 10 }} onPress={() => setLogExpanded((v) => !v)}>
                <Text style={styles.subLabel}>{t.settings.subSyncLog} {logExpanded ? '▾' : '▸'}</Text>
              </Pressable>
              {logExpanded && (
                <>
                  <View style={styles.logBox}>
                    {syncLog.length === 0 ? (
                      <Text style={styles.logEmpty}>{t.settings.logEmpty}</Text>
                    ) : (
                      syncLog.map((entry, i) => (
                        <Text key={i} style={[styles.logEntry, entry.level === 'error' ? styles.logEntryError : styles.logEntryInfo]}>
                          {entry.time.replace('T', ' ').slice(0, 19)}  {entry.level === 'error' ? '✕' : '·'}  {entry.message}
                        </Text>
                      ))
                    )}
                  </View>
                  <View style={styles.logActionRow}>
                    <Pressable style={styles.logActionBtn} onPress={() => {
                      const txt = syncLog.map((e) => `${e.time} [${e.level}] ${e.message}`).join('\n');
                      Clipboard.setString(txt);
                      Alert.alert(t.settings.logCopied, t.settings.logCopiedMsg);
                    }}>
                      <Text style={styles.logActionBtnText}>{t.settings.logCopy}</Text>
                    </Pressable>
                    <Pressable style={styles.logActionBtn} onPress={async () => { await clearSyncLog(); setSyncLog([]); }}>
                      <Text style={styles.logActionBtnText}>{t.settings.logClear}</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── Sicherheit ── */}
          <SectionHeader title={t.settings.sectionSecurity} open={open.sicherheit} onToggle={() => toggle('sicherheit')} styles={headerStyles} />
          {open.sicherheit && (
            <View style={styles.sectionBody}>
              <Text style={styles.subLabel}>{t.settings.subBiometric}</Text>
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, !bioAvailable && { color: c.muted }]}>{t.settings.biometricActive}</Text>
                <Switch value={bioEnabled} onValueChange={handleBioToggle} disabled={!bioAvailable} trackColor={{ false: c.border, true: c.accent }} thumbColor="#fff" />
              </View>
              {!bioAvailable && <Text style={styles.warnText}>{t.settings.biometricUnavailable}</Text>}
              {bioEnabled && (
                <>
                  <Pressable style={styles.saveButton} onPress={() => setPwModal('change')}>
                    <Text style={styles.saveText}>{t.settings.btnChangePassword}</Text>
                  </Pressable>
                  <Pressable style={styles.saveButton} onPress={handleBioReset}>
                    <Text style={styles.saveText}>{t.settings.btnResetWithBiometric}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.saveButton}
                    onPress={() => Alert.alert(
                      hasRecovery ? t.settings.recoveryReplaceTitle : t.settings.recoveryGenerateTitle,
                      hasRecovery ? t.settings.recoveryReplaceMsg : t.settings.recoveryGenerateMsg,
                      [
                        { text: t.common.cancel, style: 'cancel' },
                        { text: hasRecovery ? t.settings.recoveryReplaceBtn : t.settings.recoveryGenerateBtn, onPress: handleGenerateRecovery },
                      ],
                    )}
                  >
                    <Text style={styles.saveText}>{hasRecovery ? t.settings.btnReplaceRecovery : t.settings.btnGenerateRecovery}</Text>
                  </Pressable>
                  {recoveryCode && (
                    <View style={[styles.placeholder, { gap: 6 }]}>
                      <Text style={styles.recoveryCode}>{recoveryCode}</Text>
                      <Text style={styles.recoveryHint}>{t.settings.recoveryHint}</Text>
                      <Pressable onPress={() => setRecoveryCodeState(null)}>
                        <Text style={[styles.accentText, { textAlign: 'center', marginTop: 4 }]}>{t.settings.btnRecoveryDismiss}</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}

              <Text style={[styles.subLabel, { marginTop: 10 }]}>{t.settings.subEncryption}</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t.settings.encryptionLabel}</Text>
                <Switch
                  value={encEnabled}
                  onValueChange={async (v) => { await setEncryptionEnabled(v); setEncEnabledState(v); }}
                  trackColor={{ false: c.border, true: c.accent }}
                  thumbColor="#fff"
                />
              </View>
              <Text style={styles.warnText}>{t.settings.encryptionWarn}</Text>
              {encEnabled && (
                <>
                  <Pressable style={styles.saveButton} onPress={handleShowExportKey}>
                    <Text style={styles.saveText}>{t.settings.btnExportKey}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.resetBtn}
                    onPress={() => Alert.alert(
                      t.settings.keyResetTitle,
                      t.settings.keyResetMsg,
                      [
                        { text: t.common.cancel, style: 'cancel' },
                        { text: t.settings.keyResetBtn, style: 'destructive', onPress: () => resetEncryptionKey() },
                      ],
                    )}
                  >
                    <Text style={styles.resetBtnText}>{t.settings.btnResetKey}</Text>
                  </Pressable>
                </>
              )}
              <Pressable style={styles.saveButton} onPress={() => { setImportKeyText(''); setImportKeyError(''); setEncKeyModal('import'); }}>
                <Text style={styles.saveText}>{t.settings.btnImportKey}</Text>
              </Pressable>
            </View>
          )}

          {/* ── Erinnerungen ── */}
          <SectionHeader title={t.settings.sectionReminders} open={open.erinnerungen} onToggle={() => toggle('erinnerungen')} styles={headerStyles} />
          {open.erinnerungen && (
            <View style={styles.sectionBody}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t.settings.reminderLabel}</Text>
                <Switch value={reminderEnabled} onValueChange={handleReminderToggle} trackColor={{ false: c.border, true: c.accent }} thumbColor="#fff" />
              </View>
              <Text style={styles.subLabel}>{t.settings.reminderTime}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Pressable onPress={() => applyReminderTime((reminderHour + 23) % 24, reminderMinute)} style={styles.intervalChip}>
                    <Text style={styles.intervalChipText}>−</Text>
                  </Pressable>
                  <Text style={[styles.switchLabel, { minWidth: 28, textAlign: 'center' }]}>
                    {String(reminderHour).padStart(2, '0')}
                  </Text>
                  <Pressable onPress={() => applyReminderTime((reminderHour + 1) % 24, reminderMinute)} style={styles.intervalChip}>
                    <Text style={styles.intervalChipText}>＋</Text>
                  </Pressable>
                </View>
                <Text style={styles.switchLabel}>:</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Pressable onPress={() => applyReminderTime(reminderHour, (reminderMinute + 55) % 60)} style={styles.intervalChip}>
                    <Text style={styles.intervalChipText}>−</Text>
                  </Pressable>
                  <Text style={[styles.switchLabel, { minWidth: 28, textAlign: 'center' }]}>
                    {String(reminderMinute).padStart(2, '0')}
                  </Text>
                  <Pressable onPress={() => applyReminderTime(reminderHour, (reminderMinute + 5) % 60)} style={styles.intervalChip}>
                    <Text style={styles.intervalChipText}>＋</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* ── Darstellung ── */}
          <SectionHeader title={t.settings.sectionAppearance} open={open.darstellung} onToggle={() => toggle('darstellung')} styles={headerStyles} />
          {open.darstellung && (
            <View style={styles.sectionBody}>
              <Text style={styles.subLabel}>{t.settings.subColorMode}</Text>
              <View style={styles.intervalRow}>
                {([
                  { key: 'system', label: t.settings.themeSystem },
                  { key: 'dark',   label: t.settings.themeDark },
                  { key: 'light',  label: t.settings.themeLight },
                ] as { key: ThemePreference; label: string }[]).map(({ key, label }) => (
                  <Pressable
                    key={key}
                    style={[styles.intervalChip, themePref === key && styles.intervalChipActive]}
                    onPress={() => setThemePref(key)}
                  >
                    <Text style={[styles.intervalChipText, themePref === key && styles.intervalChipTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.subLabel, { marginTop: 10 }]}>{t.settings.subLanguage}</Text>
              <View style={styles.intervalRow}>
                {([
                  { key: 'de', label: t.settings.langDE },
                  { key: 'en', label: t.settings.langEN },
                ] as { key: 'de' | 'en'; label: string }[]).map(({ key, label }) => (
                  <Pressable
                    key={key}
                    style={[styles.intervalChip, language === key && styles.intervalChipActive]}
                    onPress={() => setLanguage(key)}
                  >
                    <Text style={[styles.intervalChipText, language === key && styles.intervalChipTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* ── Export ── */}
          <SectionHeader title={t.settings.sectionExport} open={open.export} onToggle={() => toggle('export')} styles={headerStyles} />
          {open.export && (
            <View style={styles.sectionBody}>
              <View style={styles.exportRow}>
                <Pressable style={styles.exportBtn} onPress={() => handleExport('json')}>
                  <Text style={styles.exportBtnText}>JSON</Text>
                </Pressable>
                <Pressable style={styles.exportBtn} onPress={() => handleExport('csv')}>
                  <Text style={styles.exportBtnText}>CSV</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── Über die App ── */}
          <SectionHeader title={t.settings.sectionAbout} open={open.about} onToggle={() => toggle('about')} styles={headerStyles} />
          {open.about && (
            <View style={styles.sectionBody}>
              <View style={styles.aboutBlock}>
                <Image source={require('../assets/icon.png')} style={styles.aboutIcon} />
                <Text style={styles.aboutTitle}>{t.appName}</Text>
                <Text style={styles.aboutLine}>Version {Constants.expoConfig?.version ?? '–'}</Text>
                <Text style={styles.aboutLine}>{t.settings.aboutDeveloper}</Text>
                <Text style={styles.aboutLine}>{t.settings.aboutBuild}</Text>
                <Text style={styles.aboutLine}>{t.settings.aboutTagline}</Text>
              </View>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Password modal */}
      <Modal visible={pwModal !== null} transparent animationType="fade" onRequestClose={closePwModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {pwModal === 'set' ? t.settings.pwSetTitle
                : pwModal === 'reset' ? t.settings.pwResetTitle
                : t.settings.pwChangeTitle}
            </Text>
            {pwModal === 'change' && (
              <TextInput style={styles.modalInput} value={pwCurrent} onChangeText={(v) => { setPwCurrent(v); setPwError(''); }} placeholder={t.settings.pwCurrentPlaceholder} placeholderTextColor={c.muted} secureTextEntry />
            )}
            <TextInput style={styles.modalInput} value={pwNew} onChangeText={(v) => { setPwNew(v); setPwError(''); }} placeholder={t.settings.pwNewPlaceholder} placeholderTextColor={c.muted} secureTextEntry />
            <TextInput style={styles.modalInput} value={pwConfirm} onChangeText={(v) => { setPwConfirm(v); setPwError(''); }} placeholder={t.settings.pwConfirmPlaceholder} placeholderTextColor={c.muted} secureTextEntry onSubmitEditing={handleSavePassword} returnKeyType="done" />
            {!!pwError && <Text style={styles.modalError}>{pwError}</Text>}
            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalCancel} onPress={closePwModal}><Text style={styles.modalCancelText}>{t.common.cancel}</Text></Pressable>
              <Pressable style={styles.modalBtn} onPress={handleSavePassword}><Text style={styles.modalBtnText}>{t.common.save}</Text></Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Schlüssel exportieren ── */}
      <Modal visible={encKeyModal === 'export'} transparent animationType="fade" onRequestClose={() => setEncKeyModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEncKeyModal(null)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t.settings.exportKeyTitle}</Text>
            <Text style={styles.warnText}>{t.settings.exportKeyHint}</Text>
            <Pressable style={[styles.modalInput, { justifyContent: 'center' }]} onPress={handleCopyKey}>
              <Text style={[styles.recoveryCode, { fontSize: 11, letterSpacing: 1 }]} numberOfLines={3} selectable>
                {exportedKey ?? '–'}
              </Text>
            </Pressable>
            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalCancel} onPress={() => setEncKeyModal(null)}>
                <Text style={styles.modalCancelText}>{t.common.ok}</Text>
              </Pressable>
              <Pressable style={styles.modalBtn} onPress={handleCopyKey}>
                <Text style={styles.modalBtnText}>{t.settings.logCopy}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Schlüssel importieren ── */}
      <Modal visible={encKeyModal === 'import'} transparent animationType="fade" onRequestClose={() => setEncKeyModal(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={{ flex: 1 }} onPress={() => setEncKeyModal(null)} />
          <View style={[styles.modalBox, { marginHorizontal: 24, marginBottom: 24 }]}>
            <Text style={styles.modalTitle}>{t.settings.importKeyTitle}</Text>
            <Text style={styles.warnText}>{t.settings.importKeyHint}</Text>
            <TextInput
              style={styles.modalInput}
              value={importKeyText}
              onChangeText={(v) => { setImportKeyText(v); setImportKeyError(''); }}
              placeholder={t.settings.importKeyPlaceholder}
              placeholderTextColor={c.muted}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              numberOfLines={2}
            />
            {!!importKeyError && <Text style={styles.modalError}>{importKeyError}</Text>}
            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalCancel} onPress={() => setEncKeyModal(null)}>
                <Text style={styles.modalCancelText}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable style={styles.modalBtn} onPress={handleImportKey}>
                <Text style={styles.modalBtnText}>{t.settings.btnImportKey}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
