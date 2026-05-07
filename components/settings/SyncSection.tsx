import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Clipboard, FlatList, KeyboardAvoidingView,
  Modal, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '../theme';
import { useT } from '../../i18n';
import { loadConfig, saveConfig, getLastSync, syncNow, restoreNow, pushNow, type WebDavConfig } from '../../sync/webdav';
import * as gdrive from '../../sync/googledrive';
import { getSyncLog, clearSyncLog, type SyncLogEntry } from '../../sync/syncLog';
import { getAutoSyncInterval, setAutoSyncInterval } from '../../sync/backgroundSync';

interface Props {
  encEnabled: boolean;
}

export function SyncSection({ encEnabled }: Props) {
  const c = useColors();
  const t = useT();
  const router = useRouter();

  const [openGdrive, setOpenGdrive] = useState(false);
  const [openNextcloud, setOpenNextcloud] = useState(false);

  const [config, setConfig] = useState<Partial<WebDavConfig>>({});
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [autoSyncInterval, setAutoSyncIntervalState] = useState(0);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [logExpanded, setLogExpanded] = useState(false);

  const [gdriveConnected, setGDriveConnected] = useState(false);
  const [gdriveEmail, setGDriveEmail] = useState<string | null>(null);
  const [gdriveConnecting, setGDriveConnecting] = useState(false);
  const [gdriveSyncing, setGDriveSyncing] = useState(false);
  const [gdriveRestoring, setGDriveRestoring] = useState(false);
  const [gdrivePushing, setGDrivePushing] = useState(false);
  const [gdriveLastSync, setGDriveLastSync] = useState<string | null>(null);
  const [gdriveHintExpanded, setGDriveHintExpanded] = useState(false);
  const [gdriveFolder, setGDriveFolder] = useState<{ id: string; name: string } | null>(null);
  const [gdriveFolderModal, setGDriveFolderModal] = useState(false);
  const [gdriveFolders, setGDriveFolders] = useState<{ id: string; name: string }[]>([]);
  const [gdriveFolderLoading, setGDriveFolderLoading] = useState(false);
  const [gdriveNavStack, setGDriveNavStack] = useState<{ id: string; name: string }[]>([]);
  const [gdriveNewFolderMode, setGDriveNewFolderMode] = useState(false);
  const [gdriveNewFolderName, setGDriveNewFolderName] = useState('');
  const [gdriveNewFolderCreating, setGDriveNewFolderCreating] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    subLabel: { fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 },
    fieldLabel: { fontSize: 12, color: c.muted, marginTop: 4 },
    field: { backgroundColor: c.bg, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: c.text },
    saveButton: { borderWidth: 1, borderColor: c.accent, borderRadius: 10, padding: 16, alignItems: 'center' },
    saveText: { color: c.accent, fontSize: 16 },
    syncButton: { backgroundColor: c.accent, borderRadius: 10, padding: 16, alignItems: 'center' },
    syncText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    lastSync: { fontSize: 12, color: c.muted, textAlign: 'center' },
    warnText: { fontSize: 12, color: c.muted },
    accentText: { color: c.accent, fontSize: 15 },
    mutedText: { color: c.muted, fontSize: 14 },
    catName: { flex: 1, fontSize: 15, color: c.text, paddingVertical: 8 },
    intervalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    intervalChip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 11 },
    intervalChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    intervalChipText: { fontSize: 14, color: c.muted },
    intervalChipTextActive: { color: '#fff', fontWeight: '600' },
    logBox: { backgroundColor: c.bg, borderRadius: 8, padding: 10, gap: 4 },
    logEntry: { fontSize: 11, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier', color: c.text },
    logEntryError: { color: c.danger },
    logEntryInfo: { color: c.muted },
    logEmpty: { fontSize: 13, color: c.muted, textAlign: 'center', padding: 10 },
    logActionRow: { flexDirection: 'row', gap: 8 },
    logActionBtn: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10, alignItems: 'center' },
    logActionBtnText: { color: c.muted, fontSize: 13 },
    subSectionHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.bg, borderRadius: 8,
      paddingHorizontal: 14, paddingVertical: 14, marginTop: 4,
    },
    subSectionHeaderText: { fontSize: 13, fontWeight: '600', color: c.text, textTransform: 'uppercase', letterSpacing: 0.6 },
    subSectionChevron: { fontSize: 16, color: c.muted },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: c.surface, borderRadius: 16, padding: 24, gap: 12 },
    modalTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    modalInput: { backgroundColor: c.bg, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.text },
    modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalBtn: { flex: 1, backgroundColor: c.accent, borderRadius: 10, padding: 13, alignItems: 'center' },
    modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    modalCancel: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 13, alignItems: 'center' },
    modalCancelText: { color: c.muted, fontSize: 15 },
  }), [c]);

  const SYNC_INTERVALS = [
    { label: t.settings.syncOff, value: 0 },
    { label: t.settings.sync15m, value: 15 },
    { label: t.settings.sync1h, value: 60 },
    { label: t.settings.sync6h, value: 360 },
    { label: t.settings.sync24h, value: 1440 },
  ];

  useEffect(() => {
    loadConfig().then(setConfig);
    getLastSync().then(setLastSync);
    getAutoSyncInterval().then(setAutoSyncIntervalState);
    getSyncLog().then(setSyncLog);
    gdrive.isConnected().then(setGDriveConnected);
    gdrive.getConnectedEmail().then(setGDriveEmail);
    gdrive.getLastSync().then(setGDriveLastSync);
    gdrive.getDriveFolder().then(setGDriveFolder);
  }, []);

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
    Alert.alert(t.settings.restoreConfirmTitle, t.settings.restoreConfirmMsg, [
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
    ]);
  };

  const handlePush = () => {
    Alert.alert(t.settings.pushLocalTitle, t.settings.pushLocalMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.settings.pushLocalBtn, style: 'destructive', onPress: async () => {
          setPushing(true);
          try {
            await pushNow();
            const updated = await getLastSync();
            setLastSync(updated);
            Alert.alert(t.common.done, t.settings.pushLocalSuccess);
          } catch (e: any) {
            Alert.alert(t.common.error, e.message ?? t.settings.unknownError);
          } finally {
            setPushing(false);
            await refreshLog();
          }
        },
      },
    ]);
  };

  const handleGDrivePush = () => {
    Alert.alert(t.settings.pushLocalTitle, t.settings.pushLocalGDriveMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.settings.pushLocalBtn, style: 'destructive', onPress: async () => {
          setGDrivePushing(true);
          try {
            await gdrive.pushNow();
            const updated = await gdrive.getLastSync();
            setGDriveLastSync(updated);
            Alert.alert(t.common.done, t.settings.pushLocalSuccess);
          } catch (e: any) {
            Alert.alert(t.common.error, e.message ?? t.settings.unknownError);
          } finally {
            setGDrivePushing(false);
            await refreshLog();
          }
        },
      },
    ]);
  };

  const handleGDriveConnect = async () => {
    setGDriveConnecting(true);
    try {
      await gdrive.authenticate();
      setGDriveConnected(true);
      const email = await gdrive.getConnectedEmail();
      setGDriveEmail(email);
      handleGDriveFolderPick();
    } catch (e: any) {
      Alert.alert(t.settings.gdriveConnectError, e.message ?? t.settings.unknownError);
    } finally {
      setGDriveConnecting(false);
    }
  };

  const handleGDriveDisconnect = async () => {
    await gdrive.signOut();
    setGDriveConnected(false);
    setGDriveEmail(null);
    setGDriveLastSync(null);
    setGDriveFolder(null);
  };

  const handleGDriveFolderPick = async () => {
    setGDriveFolderLoading(true);
    setGDriveFolders([]);
    setGDriveNavStack([]);
    setGDriveNewFolderMode(false);
    setGDriveNewFolderName('');
    setGDriveFolderModal(true);
    try {
      const folders = await gdrive.listDriveFolders('root');
      setGDriveFolders(folders);
    } catch (e: any) {
      Alert.alert(t.common.error, e.message ?? t.settings.unknownError);
      setGDriveFolderModal(false);
    } finally {
      setGDriveFolderLoading(false);
    }
  };

  const handleGDriveFolderNavigate = async (folder: { id: string; name: string }) => {
    setGDriveFolderLoading(true);
    setGDriveNavStack((prev) => [...prev, folder]);
    try {
      const folders = await gdrive.listDriveFolders(folder.id);
      setGDriveFolders(folders);
    } catch (e: any) {
      Alert.alert(t.common.error, e.message ?? t.settings.unknownError);
      setGDriveNavStack((prev) => prev.slice(0, -1));
    } finally {
      setGDriveFolderLoading(false);
    }
  };

  const handleGDriveFolderBack = async () => {
    const newStack = gdriveNavStack.slice(0, -1);
    setGDriveNavStack(newStack);
    setGDriveFolderLoading(true);
    try {
      const parentId = newStack.length > 0 ? newStack[newStack.length - 1].id : 'root';
      const folders = await gdrive.listDriveFolders(parentId);
      setGDriveFolders(folders);
    } catch (e: any) {
      Alert.alert(t.common.error, e.message ?? t.settings.unknownError);
    } finally {
      setGDriveFolderLoading(false);
    }
  };

  const handleGDriveFolderCreate = async () => {
    const name = gdriveNewFolderName.trim();
    if (!name) return;
    setGDriveNewFolderCreating(true);
    try {
      const parentId = gdriveNavStack[gdriveNavStack.length - 1]?.id ?? 'root';
      const newFolder = await gdrive.createDriveFolder(name, parentId);
      setGDriveNewFolderMode(false);
      setGDriveNewFolderName('');
      await handleGDriveFolderNavigate(newFolder);
    } catch (e: any) {
      Alert.alert(t.common.error, e.message ?? t.settings.unknownError);
    } finally {
      setGDriveNewFolderCreating(false);
    }
  };

  const handleGDriveFolderSelect = async (id: string | null, name: string) => {
    setGDriveFolderModal(false);
    if (id === null) {
      await gdrive.clearDriveFolder();
      setGDriveFolder(null);
    } else {
      await gdrive.setDriveFolder(id, name);
      setGDriveFolder({ id, name });
    }
  };

  const handleGDriveSync = async () => {
    setGDriveSyncing(true);
    try {
      await gdrive.syncNow();
      const updated = await gdrive.getLastSync();
      setGDriveLastSync(updated);
      Alert.alert(t.settings.gdriveSyncSuccessTitle, t.settings.syncSuccessMsg(updated ?? ''));
    } catch (e: any) {
      Alert.alert(t.settings.gdriveSyncFailTitle, e.message ?? t.settings.unknownError);
    } finally {
      setGDriveSyncing(false);
      await refreshLog();
    }
  };

  const handleGDriveRestore = () => {
    Alert.alert(t.settings.gdriveRestoreConfirmTitle, t.settings.gdriveRestoreConfirmMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.settings.restoreBtn, style: 'destructive', onPress: async () => {
          setGDriveRestoring(true);
          try {
            await gdrive.restoreNow();
            await refreshLog();
            Alert.alert(t.settings.restoredTitle, t.settings.restoredMsg, [
              { text: t.common.ok, onPress: () => router.replace('/') },
            ]);
          } catch (e: any) {
            await refreshLog();
            Alert.alert(t.settings.restoreErrorTitle, e.message ?? t.settings.restoreErrorMsg);
          } finally {
            setGDriveRestoring(false);
          }
        },
      },
    ]);
  };

  const saveNextcloud = async () => {
    if (!config.url || !config.username || !config.password) {
      Alert.alert(t.settings.missingFieldsTitle, t.settings.missingFieldsMsg);
      return;
    }
    await saveConfig(config as WebDavConfig);
    Alert.alert(t.settings.savedAlert);
  };

  return (
    <>
      {/* Google Drive */}
      <Pressable style={styles.subSectionHeader} onPress={() => setOpenGdrive(v => !v)}>
        <Text style={styles.subSectionHeaderText}>{t.settings.subGDrive}</Text>
        <Text style={styles.subSectionChevron}>{openGdrive ? '▾' : '▸'}</Text>
      </Pressable>
      {openGdrive && (
        <View style={{ gap: 8, marginTop: 4 }}>
          {!encEnabled && <Text style={styles.warnText}>{t.settings.syncEncryptionHint}</Text>}
          {!gdriveConnected ? (
            <Pressable style={styles.syncButton} onPress={handleGDriveConnect} disabled={gdriveConnecting}>
              {gdriveConnecting ? <ActivityIndicator color="#fff" /> : <Text style={styles.syncText}>{t.settings.gdriveConnect}</Text>}
            </Pressable>
          ) : (
            <>
              <Text style={[styles.lastSync, { marginTop: 2 }]}>{t.settings.gdriveConnectedAs(gdriveEmail ?? '')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.lastSync, { flex: 1 }]}>{t.settings.gdriveFolderLabel}: {gdriveFolder?.name ?? t.settings.gdriveFolderRoot}</Text>
                <Pressable onPress={handleGDriveFolderPick}>
                  <Text style={styles.accentText}>{t.settings.gdriveFolderPick}</Text>
                </Pressable>
              </View>
              <Pressable style={styles.saveButton} onPress={handleGDriveDisconnect}>
                <Text style={styles.saveText}>{t.settings.gdriveDisconnect}</Text>
              </Pressable>
              <Pressable style={styles.syncButton} onPress={handleGDriveSync} disabled={gdriveSyncing || gdriveRestoring}>
                {gdriveSyncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.syncText}>{t.settings.gdriveSyncNow}</Text>}
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleGDriveRestore} disabled={gdriveSyncing || gdriveRestoring || gdrivePushing}>
                {gdriveRestoring ? <ActivityIndicator color={c.accent} /> : <Text style={styles.saveText}>{t.settings.gdriveRestore}</Text>}
              </Pressable>
              <Pressable style={[styles.saveButton, { marginTop: 2, borderColor: c.danger }]} onPress={handleGDrivePush} disabled={gdriveSyncing || gdriveRestoring || gdrivePushing}>
                {gdrivePushing ? <ActivityIndicator color={c.danger} /> : <Text style={[styles.saveText, { color: c.danger }]}>⬆ {t.settings.pushLocalTitle}</Text>}
              </Pressable>
              {gdriveLastSync && <Text style={styles.lastSync}>{t.settings.gdriveLastSync}{gdriveLastSync}</Text>}
            </>
          )}
          <Pressable onPress={() => setGDriveHintExpanded(v => !v)}>
            <Text style={styles.subLabel}>{t.settings.gdriveSetupHint} {gdriveHintExpanded ? '▾' : '▸'}</Text>
          </Pressable>
          {gdriveHintExpanded && <Text style={styles.warnText}>{t.settings.gdriveSetupHintText}</Text>}
        </View>
      )}

      {/* Nextcloud / WebDAV */}
      <Pressable style={styles.subSectionHeader} onPress={() => setOpenNextcloud(v => !v)}>
        <Text style={styles.subSectionHeaderText}>{t.settings.subNextcloud}</Text>
        <Text style={styles.subSectionChevron}>{openNextcloud ? '▾' : '▸'}</Text>
      </Pressable>
      {openNextcloud && (
        <View style={{ gap: 8, marginTop: 4 }}>
          {!encEnabled && <Text style={styles.warnText}>{t.settings.syncEncryptionHint}</Text>}
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
          <Pressable style={[styles.syncButton, { marginTop: 2 }]} onPress={handleSync} disabled={syncing || restoring}>
            {syncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.syncText}>{t.settings.btnSyncNow}</Text>}
          </Pressable>
          <Pressable style={styles.saveButton} onPress={handleRestore} disabled={syncing || restoring || pushing}>
            {restoring ? <ActivityIndicator color={c.accent} /> : <Text style={styles.saveText}>{t.settings.btnRestore}</Text>}
          </Pressable>
          <Pressable style={[styles.saveButton, { marginTop: 2, borderColor: c.danger }]} onPress={handlePush} disabled={syncing || restoring || pushing}>
            {pushing ? <ActivityIndicator color={c.danger} /> : <Text style={[styles.saveText, { color: c.danger }]}>⬆ {t.settings.pushLocalTitle}</Text>}
          </Pressable>
          {lastSync && <Text style={styles.lastSync}>{t.settings.lastSync}{lastSync}</Text>}
        </View>
      )}

      {/* Auto-Sync */}
      <Text style={[styles.subLabel, { marginTop: 14 }]}>{t.settings.subAutoSync}</Text>
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

      {/* Sync-Log */}
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

      {/* Google Drive Ordner-Modal */}
      <Modal visible={gdriveFolderModal} transparent animationType="fade" onRequestClose={() => setGDriveFolderModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalBox, { maxHeight: '82%' }]}>
            <Text style={styles.modalTitle}>{t.settings.gdriveFolderPickTitle}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Text style={[styles.mutedText, { fontSize: 12 }]}>📁 {t.settings.gdriveFolderRoot}</Text>
              {gdriveNavStack.map((f) => (
                <Text key={f.id} style={[styles.mutedText, { fontSize: 12 }]}> › {f.name}</Text>
              ))}
            </View>
            <View style={{ maxHeight: 220, minHeight: 60 }}>
              {gdriveFolderLoading ? (
                <View style={{ alignItems: 'center', padding: 16 }}>
                  <ActivityIndicator color={c.accent} />
                  <Text style={[styles.mutedText, { marginTop: 8 }]}>{t.settings.gdriveFolderLoading}</Text>
                </View>
              ) : (
                <FlatList
                  data={gdriveFolders}
                  keyExtractor={(item) => item.id}
                  ListEmptyComponent={<Text style={[styles.mutedText, { paddingVertical: 12 }]}>{t.settings.gdriveFolderNoSubfolders}</Text>}
                  renderItem={({ item }) => (
                    <Pressable
                      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: c.border, opacity: pressed ? 0.6 : 1 }]}
                      onPress={() => handleGDriveFolderNavigate(item)}
                    >
                      <Text style={[styles.catName, item.id === gdriveFolder?.id && { color: c.accent }]}>📂 {item.name}</Text>
                      <Text style={[styles.mutedText, { fontSize: 16 }]}>›</Text>
                    </Pressable>
                  )}
                />
              )}
            </View>
            {gdriveNewFolderMode ? (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  value={gdriveNewFolderName}
                  onChangeText={setGDriveNewFolderName}
                  placeholder={t.settings.gdriveFolderNewPlaceholder}
                  placeholderTextColor={c.muted}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleGDriveFolderCreate}
                />
                <Pressable
                  style={[styles.modalBtn, { flex: 0, paddingHorizontal: 16 }]}
                  onPress={handleGDriveFolderCreate}
                  disabled={gdriveNewFolderCreating || !gdriveNewFolderName.trim()}
                >
                  {gdriveNewFolderCreating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalBtnText}>{t.settings.gdriveFolderNewCreate}</Text>}
                </Pressable>
                <Pressable onPress={() => { setGDriveNewFolderMode(false); setGDriveNewFolderName(''); }}>
                  <Text style={[styles.modalCancelText, { paddingHorizontal: 4 }]}>✕</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setGDriveNewFolderMode(true)} disabled={gdriveFolderLoading}>
                <Text style={[styles.accentText, { fontSize: 13 }]}>{t.settings.gdriveFolderNewBtn}</Text>
              </Pressable>
            )}
            <View style={{ gap: 8, flexShrink: 0 }}>
              <Pressable
                style={styles.modalBtn}
                onPress={() => {
                  const cur = gdriveNavStack[gdriveNavStack.length - 1] ?? null;
                  handleGDriveFolderSelect(cur?.id ?? null, cur?.name ?? t.settings.gdriveFolderRoot);
                }}
              >
                <Text style={styles.modalBtnText}>{t.settings.gdriveFolderSelectThis}</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {gdriveNavStack.length > 0 && (
                  <Pressable style={[styles.modalCancel, { flex: 1 }]} onPress={handleGDriveFolderBack}>
                    <Text style={styles.modalCancelText}>{t.settings.gdriveFolderBack}</Text>
                  </Pressable>
                )}
                <Pressable style={[styles.modalCancel, { flex: 1 }]} onPress={() => setGDriveFolderModal(false)}>
                  <Text style={styles.modalCancelText}>{t.common.cancel}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
