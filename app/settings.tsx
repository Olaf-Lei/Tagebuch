import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { useColors } from '../components/theme';
import { useTheme, type ThemePreference } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useT } from '../i18n';
import { loadConfig } from '../sync/webdav';
import { isEncryptionEnabled, exportEncKey } from '../utils/crypto';
import { exportJSON, exportCSV } from '../utils/export';
import { getReminderEnabled, getReminderTime, scheduleReminder, cancelReminder, requestPermission } from '../utils/notifications';
import { InhalteSection } from '../components/settings/InhalteSection';
import { SyncSection } from '../components/settings/SyncSection';
import { SicherheitSection } from '../components/settings/SicherheitSection';
import { seedDemoData } from '../db/demoSeed';

type SectionKey = 'inhalte' | 'sync' | 'sicherheit' | 'erinnerungen' | 'darstellung' | 'export' | 'experten' | 'about';

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
  const { preference: themePref, setPreference: setThemePref } = useTheme();
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    inhalte: false, sync: false, sicherheit: false,
    erinnerungen: false, darstellung: false, export: false, experten: false, about: false,
  });
  const toggle = (k: SectionKey) => setOpen((s) => ({ ...s, [k]: !s[k] }));

  const [encEnabled, setEncEnabled] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(20);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [webFrontendUrl, setWebFrontendUrl] = useState('');
  const [webLoginQR, setWebLoginQR] = useState<string | null>(null);
  const [relayCode, setRelayCode] = useState<string | null>(null);
  const [relayLoading, setRelayLoading] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    content: { padding: 16, gap: 0, paddingBottom: 40 },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderRadius: 10,
      paddingHorizontal: 16, paddingVertical: 16, marginTop: 10,
    },
    sectionHeaderText: { fontSize: 14, fontWeight: '700', color: c.text, textTransform: 'uppercase', letterSpacing: 0.8 },
    sectionChevron: { fontSize: 18, color: c.muted },
    sectionBody: {
      backgroundColor: c.surface, borderRadius: 10, marginTop: 2,
      paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14, gap: 8,
    },
    subLabel: { fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 },
    intervalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    intervalChip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 11 },
    intervalChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    intervalChipText: { fontSize: 14, color: c.muted },
    intervalChipTextActive: { color: '#fff', fontWeight: '600' },
    exportRow: { flexDirection: 'row', gap: 10 },
    exportBtn: { flex: 1, borderWidth: 1, borderColor: c.accent, borderRadius: 10, padding: 13, alignItems: 'center' },
    exportBtnText: { color: c.accent, fontSize: 14, fontWeight: '600' },
    switchRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.bg, borderRadius: 8, paddingVertical: 14, paddingHorizontal: 14,
    },
    switchLabel: { fontSize: 16, color: c.text },
    warnText: { fontSize: 12, color: c.muted },
    syncButton: { backgroundColor: c.accent, borderRadius: 10, padding: 16, alignItems: 'center' },
    syncText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    field: { backgroundColor: c.bg, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: c.text },
    fieldLabel: { fontSize: 12, color: c.muted, marginTop: 4 },
    aboutBlock: { alignItems: 'center', gap: 6, paddingVertical: 8 },
    aboutIcon: { width: 128, height: 128, borderRadius: 26, marginBottom: 12, elevation: 12, shadowColor: '#C9A84C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
    aboutTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    aboutLine: { fontSize: 13, color: c.muted, textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: c.surface, borderRadius: 16, padding: 24, gap: 12 },
    modalTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    modalCancel: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 13, alignItems: 'center' },
    modalCancelText: { color: c.muted, fontSize: 15 },
    saveButton: { borderWidth: 1, borderColor: c.accent, borderRadius: 10, padding: 16, alignItems: 'center' },
    saveText: { color: c.accent, fontSize: 16 },
  }), [c]);

  const headerStyles = { header: styles.sectionHeader, headerText: styles.sectionHeaderText, chevron: styles.sectionChevron };

  useEffect(() => {
    isEncryptionEnabled().then(setEncEnabled);
    getReminderEnabled().then(setReminderEnabled);
    getReminderTime().then(({ hour, minute }) => { setReminderHour(hour); setReminderMinute(minute); });
    SecureStore.getItemAsync('web_frontend_url').then(v => setWebFrontendUrl(v ?? ''));
  }, []);

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

  const handleShowWebLoginQR = async () => {
    const cfg = await loadConfig();
    const encKey = await exportEncKey();
    const payload: Record<string, unknown> = { v: 1 };
    if (cfg.url) payload.nc = { url: cfg.url, user: cfg.username, pass: cfg.password, path: cfg.path };
    if (encKey) payload.encKey = encKey;
    if (!payload.nc && !encKey) { Alert.alert(t.settings.webLoginQRTitle, t.settings.webLoginQRNoConfig); return; }
    setWebLoginQR(JSON.stringify(payload));
  };

  const handleGenerateRelayCode = async () => {
    setRelayCode(null);
    setRelayLoading(true);
    try {
      const cfg = await loadConfig();
      const encKey = await exportEncKey();
      const payload: Record<string, unknown> = { v: 1 };
      if (cfg.url) payload.nc = { url: cfg.url, user: cfg.username, pass: cfg.password, path: cfg.path };
      if (encKey) payload.encKey = encKey;
      if (!payload.nc && !encKey) { Alert.alert(t.settings.webLoginQRTitle, t.settings.webLoginQRNoConfig); setRelayLoading(false); return; }
      const res = await fetch(`${webFrontendUrl.replace(/\/$/, '')}/proxy.php?action=store_code`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.code) throw new Error(json.error ?? t.common.error);
      setRelayCode(json.code);
    } catch {
      Alert.alert(t.settings.webLoginQRTitle, t.settings.webLoginRelayError);
    } finally {
      setRelayLoading(false);
    }
  };

  const handleLoadDemoData = () => {
    Alert.alert(t.settings.demoSeedConfirmTitle, t.settings.demoSeedConfirmMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.ok,
        onPress: () => seedDemoData().then(() => Alert.alert('', t.settings.demoSeedSuccess)),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* ── Inhalte ── */}
          <SectionHeader title={t.settings.sectionContent} open={open.inhalte} onToggle={() => toggle('inhalte')} styles={headerStyles} />
          {open.inhalte && (
            <View style={styles.sectionBody}>
              <InhalteSection />
            </View>
          )}

          {/* ── Sync & Backup ── */}
          <SectionHeader title={t.settings.sectionSync} open={open.sync} onToggle={() => toggle('sync')} styles={headerStyles} />
          {open.sync && (
            <View style={styles.sectionBody}>
              <SyncSection encEnabled={encEnabled} />
            </View>
          )}

          {/* ── Sicherheit ── */}
          <SectionHeader title={t.settings.sectionSecurity} open={open.sicherheit} onToggle={() => toggle('sicherheit')} styles={headerStyles} />
          {open.sicherheit && (
            <View style={styles.sectionBody}>
              <SicherheitSection encEnabled={encEnabled} onEncEnabledChange={setEncEnabled} />
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

          {/* ── Experten ── */}
          <SectionHeader title={t.settings.sectionExperten} open={open.experten} onToggle={() => toggle('experten')} styles={headerStyles} />
          {open.experten && (
            <View style={styles.sectionBody}>
              <Text style={styles.subLabel}>{t.settings.subWebTagebuch}</Text>
              <Text style={styles.fieldLabel}>{t.settings.webFrontendUrlLabel}</Text>
              <TextInput
                style={styles.field}
                value={webFrontendUrl}
                onChangeText={setWebFrontendUrl}
                onBlur={() => SecureStore.setItemAsync('web_frontend_url', webFrontendUrl.trim())}
                placeholder={t.settings.webFrontendUrlPlaceholder}
                placeholderTextColor={c.muted}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Pressable style={[styles.syncButton, { marginTop: 4 }]} onPress={handleShowWebLoginQR}>
                <Text style={styles.syncText}>{t.settings.webLoginQR}</Text>
              </Pressable>
              <Text style={[styles.subLabel, { marginTop: 20 }]}>Demo</Text>
              <Pressable style={[styles.saveButton, { marginTop: 4 }]} onPress={handleLoadDemoData}>
                <Text style={[styles.syncText, { color: c.accent }]}>{t.settings.demoSeedBtn}</Text>
              </Pressable>
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

      {/* Web-Login QR Modal */}
      <Modal visible={!!webLoginQR} transparent animationType="fade" onRequestClose={() => { setWebLoginQR(null); setRelayCode(null); }}>
        <Pressable style={styles.modalOverlay} onPress={() => { setWebLoginQR(null); setRelayCode(null); }}>
          <Pressable onPress={e => e.stopPropagation()} style={{ width: '100%', maxHeight: '90%' }}>
            <ScrollView contentContainerStyle={[styles.modalBox, { alignItems: 'center' }]} showsVerticalScrollIndicator={false} bounces={false}>
              <Text style={styles.modalTitle}>{t.settings.webLoginQRTitle}</Text>
              {webLoginQR && <QRCode value={webLoginQR} size={200} backgroundColor={c.surface} color={c.text} />}
              <Text style={[{ fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center', marginTop: 10 }]}>
                {webFrontendUrl ? webFrontendUrl : t.settings.webLoginQRHint}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, width: '100%' }}>
                <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
                <Text style={{ color: c.muted, fontSize: 12 }}>{t.common.or}</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
              </View>
              {relayCode ? (
                <>
                  <Text style={{ fontSize: 36, fontWeight: '800', letterSpacing: 8, color: c.accent, marginTop: 12 }}>{relayCode}</Text>
                  <Text style={[{ fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center', marginTop: 6 }]}>{t.settings.webLoginRelayHint}</Text>
                </>
              ) : webFrontendUrl ? (
                <Pressable style={[styles.syncButton, { marginTop: 12, width: '100%' }]} onPress={handleGenerateRelayCode} disabled={relayLoading}>
                  <Text style={styles.syncText}>{relayLoading ? t.settings.webLoginRelayLoading : t.settings.webLoginRelayBtn}</Text>
                </Pressable>
              ) : (
                <Text style={[styles.warnText, { textAlign: 'center', marginTop: 8 }]}>{t.settings.webLoginRelayNoUrl}</Text>
              )}
              <Pressable style={[styles.modalCancel, { marginTop: 10, width: '100%' }]} onPress={() => { setWebLoginQR(null); setRelayCode(null); }}>
                <Text style={styles.modalCancelText}>{t.settings.webLoginQRClose}</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
