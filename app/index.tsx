import { Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Modal, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import QRCode from 'react-native-qrcode-svg';
import { DropdownPicker } from '../components/DropdownPicker';
import { EntryCard } from '../components/EntryCard';
import { HelpModal } from '../components/HelpModal';
import { SetupWizard, WIZARD_DONE_KEY, ONBOARDING_DONE_KEY } from '../components/SetupWizard';
import { useColors } from '../components/theme';
import { useLayout } from '../hooks/useLayout';
import { getCategories, categoryLabel, type Category } from '../db/categories';
import { useEntries } from '../hooks/useEntries';
import { useTags } from '../hooks/useTags';
import { useQualifiers } from '../hooks/useQualifiers';
import { useT } from '../i18n';
import { deleteEntries } from '../db/entries';
import { addSyncListener, loadConfig, syncNow as ncSyncNow, getLastSync as ncGetLastSync, getLastSyncMs as ncGetLastSyncMs } from '../sync/webdav';
import * as gdrive from '../sync/googledrive';
import { exportEncKey } from '../utils/crypto';

const HELP_SHOWN_LEGACY_KEY = 'help_shown'; // Migration: alter Key

export default function IndexScreen() {
  const router = useRouter();
  const c = useColors();
  const t = useT();
  const { isWide, listMaxWidth } = useLayout();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const fabBottom = Math.max(bottomInset, 16) + 12;
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    filterBar: { paddingHorizontal: 14, paddingTop: 10 },
    searchInput: {
      backgroundColor: c.surface, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: c.text,
    },
    filterRow: { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 6, paddingBottom: 4, gap: 8 },
    chip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 13, color: c.muted },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    customRange: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: c.surface, borderRadius: 8, padding: 10,
      marginHorizontal: 14, marginBottom: 6,
    },
    customRangeText: { fontSize: 13, color: c.text, flex: 1 },
    list: { paddingHorizontal: 14, paddingBottom: 100 },
    loader: { flex: 1 },
    empty: { textAlign: 'center', marginTop: 80, color: c.muted, fontSize: 15 },
    fab: {
      position: 'absolute', bottom: fabBottom, right: 20, width: 60, height: 60,
      borderRadius: 30, backgroundColor: c.accent, alignItems: 'center',
      justifyContent: 'center', elevation: 6,
    },
    fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
  }), [c, fabBottom]);

  type DateRange = 'all' | 'today' | 'week' | 'month' | 'custom';

  function parseDateDE(s: string): Date | null {
    const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!m) return null;
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDateDE(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  function dateRangeTimes(range: DateRange, from?: Date, to?: Date): { startTime?: number; endTime?: number } {
    const now = new Date();
    if (range === 'today') {
      return { startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() };
    }
    if (range === 'week') {
      const dow = (now.getDay() + 6) % 7;
      return { startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow).getTime() };
    }
    if (range === 'month') {
      return { startTime: new Date(now.getFullYear(), now.getMonth(), 1).getTime() };
    }
    if (range === 'custom') {
      const endDate = to ? new Date(to) : undefined;
      if (endDate) endDate.setHours(23, 59, 59, 999);
      return { startTime: from?.getTime(), endTime: endDate?.getTime() };
    }
    return {};
  }

  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [dateError, setDateError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [webLoginQR, setWebLoginQR] = useState<string | null>(null);
  const [relayCode, setRelayCode] = useState<string | null>(null);
  const [relayLoading, setRelayLoading] = useState(false);

  // Sync-Modal state
  const [ncConfigured, setNcConfigured] = useState(false);
  const [ncLastMs, setNcLastMs] = useState<number | null>(null);
  const [ncLastStr, setNcLastStr] = useState<string | null>(null);
  const [ncSyncing, setNcSyncing] = useState(false);
  const [ncError, setNcError] = useState<string | null>(null);
  const [gdriveConnectedState, setGDriveConnectedState] = useState(false);
  const [gdriveLastMs, setGDriveLastMs] = useState<number | null>(null);
  const [gdriveLastStr, setGDriveLastStr] = useState<string | null>(null);
  const [gdriveSyncingState, setGDriveSyncingState] = useState(false);
  const [gdriveError, setGDriveError] = useState<string | null>(null);

  const allTags = useTags();
  const qualifiers = useQualifiers();

  const loadSyncStatus = useCallback(async () => {
    const [cfg, lastMs, lastStr, connected, gLastMs, gLastStr] = await Promise.all([
      loadConfig(),
      ncGetLastSyncMs(),
      ncGetLastSync(),
      gdrive.isConnected(),
      gdrive.getLastSyncMs(),
      gdrive.getLastSync(),
    ]);
    setNcConfigured(!!(cfg.url && cfg.username && cfg.password));
    setNcLastMs(lastMs);
    setNcLastStr(lastStr);
    setGDriveConnectedState(connected);
    setGDriveLastMs(gLastMs);
    setGDriveLastStr(gLastStr);
  }, []);

  const handleOpenSyncModal = useCallback(async () => {
    await loadSyncStatus();
    setShowSyncModal(true);
  }, [loadSyncStatus]);

  const handleNcSync = async () => {
    setNcError(null);
    setNcSyncing(true);
    try {
      await ncSyncNow();
      const [ms, str] = await Promise.all([ncGetLastSyncMs(), ncGetLastSync()]);
      setNcLastMs(ms);
      setNcLastStr(str);
    } catch (e: any) {
      setNcError(e.message ?? 'Fehler');
    } finally {
      setNcSyncing(false);
    }
  };

  const handleGDriveSync = async () => {
    setGDriveError(null);
    setGDriveSyncingState(true);
    try {
      await gdrive.syncNow();
      const [ms, str] = await Promise.all([gdrive.getLastSyncMs(), gdrive.getLastSync()]);
      setGDriveLastMs(ms);
      setGDriveLastStr(str);
    } catch (e: any) {
      setGDriveError(e.message ?? 'Fehler');
    } finally {
      setGDriveSyncingState(false);
    }
  };

  const enterSelectionMode = (id: number) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleMultiDelete = () => {
    const ids = [...selectedIds];
    Alert.alert(t.list.selectionDeleteConfirm(ids.length), undefined, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete, style: 'destructive',
        onPress: async () => {
          await deleteEntries(ids);
          exitSelectionMode();
          reload();
        },
      },
    ]);
  };

  const handleSyncAll = async () => {
    const tasks: Promise<void>[] = [];
    if (ncConfigured) tasks.push(handleNcSync());
    if (gdriveConnectedState) tasks.push(handleGDriveSync());
    await Promise.allSettled(tasks);
  };

  const handleShowWebLoginQR = async () => {
    const cfg = await loadConfig();
    const encKey = await exportEncKey();
    const payload: Record<string, unknown> = { v: 1 };
    if (cfg.url) payload.nc = { url: cfg.url, user: cfg.username, pass: cfg.password, path: cfg.path };
    if (encKey) payload.encKey = encKey;
    if (!payload.nc && !encKey) return;
    setRelayCode(null);
    setWebLoginQR(JSON.stringify(payload));
    setShowBurgerMenu(false);
  };

  const handleGenerateRelayCode = async () => {
    setRelayLoading(true);
    setRelayCode(null);
    try {
      const webFrontendUrl = (await SecureStore.getItemAsync('web_frontend_url'))?.trim() ?? '';
      if (!webFrontendUrl) return;
      const res = await fetch(`${webFrontendUrl.replace(/\/$/, '')}/proxy.php?action=store_code`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: webLoginQR ?? '{}',
      });
      const json = await res.json();
      if (res.ok && json.code) setRelayCode(json.code);
    } catch {}
    finally { setRelayLoading(false); }
  };

  function trafficLight(lastMs: number | null, syncing: boolean): { color: string; dot: string } {
    if (syncing) return { color: c.accent, dot: '⟳' };
    if (lastMs === null) return { color: c.muted, dot: '⚫' };
    const age = Date.now() - lastMs;
    if (age < 24 * 3600_000) return { color: '#34C759', dot: '🟢' };
    if (age < 72 * 3600_000) return { color: '#FF9500', dot: '🟡' };
    return { color: '#FF3B30', dot: '🔴' };
  }

  useEffect(() => {
    return addSyncListener(() => reload());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  useFocusEffect(useCallback(() => {
    SecureStore.getItemAsync(WIZARD_DONE_KEY).then(async (wizardDone) => {
      if (!wizardDone) {
        setShowWizard(true);
        return;
      }
      const [done, legacy] = await Promise.all([
        SecureStore.getItemAsync(ONBOARDING_DONE_KEY),
        SecureStore.getItemAsync(HELP_SHOWN_LEGACY_KEY),
      ]);
      if (!done && !legacy) setShowHelp(true);
    });
  }, []));

  const { entries, loading, reload } = useEntries({
    search,
    categoryIds: selectedCategories.length ? selectedCategories : undefined,
    tagIds: selectedTags.length ? selectedTags : undefined,
    ...dateRangeTimes(dateRange, customFrom, customTo),
  });

  const openDatePicker = () => {
    const now = new Date();
    const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 30);
    setFromInput(customFrom ? formatDateDE(customFrom) : formatDateDE(monthAgo));
    setToInput(customTo ? formatDateDE(customTo) : formatDateDE(now));
    setDateError('');
    setShowDatePicker(true);
  };

  const applyCustomRange = () => {
    const from = parseDateDE(fromInput);
    const to = parseDateDE(toInput);
    if (!from) { setDateError(t.stats.dateErrorFrom); return; }
    if (!to) { setDateError(t.stats.dateErrorTo); return; }
    if (from > to) { setDateError(t.stats.dateErrorOrder); return; }
    setCustomFrom(from);
    setCustomTo(to);
    setDateRange('custom');
    setShowDatePicker(false);
    setDateError('');
  };

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const DATE_RANGES: { key: DateRange; label: string }[] = [
    { key: 'all', label: t.list.dateAll },
    { key: 'today', label: t.list.dateToday },
    { key: 'week', label: t.list.dateWeek },
    { key: 'month', label: t.list.dateMonth },
    { key: 'custom', label: t.list.dateCustom },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{
        headerLeft: () => selectionMode ? (
          <Pressable onPress={exitSelectionMode} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text style={{ fontSize: 15, color: c.accent }}>{t.common.cancel}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setShowBurgerMenu(true)} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text style={{ fontSize: 22, color: c.muted }}>☰</Text>
          </Pressable>
        ),
        headerTitle: () => selectionMode ? (
          <Text style={{ fontSize: 17, fontWeight: '600', color: c.text }}>
            {t.list.selectionCount(selectedIds.size)}
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image
              source={require('../assets/icon.png')}
              style={{ width: 28, height: 28, borderRadius: 6 }}
            />
            <Text style={{ fontSize: 17, fontWeight: '600', color: c.text }}>{t.appName}</Text>
          </View>
        ),
        headerRight: () => selectionMode ? (
          <View style={{ flexDirection: 'row' }}>
            <Pressable onPress={() => setSelectedIds(new Set(entries.map(e => e.id)))} style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
              <Text style={{ fontSize: 14, color: c.accent }}>{t.list.selectAll}</Text>
            </Pressable>
            <Pressable onPress={handleMultiDelete} disabled={selectedIds.size === 0} style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
              <Text style={{ fontSize: 14, color: selectedIds.size > 0 ? '#FF3B30' : c.muted }}>{t.common.delete}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row' }}>
            <Pressable onPress={handleOpenSyncModal} style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
              <Text style={{ fontSize: 20, color: c.accent }}>↻</Text>
            </Pressable>
            <Pressable onPress={() => setShowHelp(true)} style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
              <Text style={{ fontSize: 18, color: c.muted, fontWeight: '600' }}>?</Text>
            </Pressable>
            <Pressable onPress={() => setShowViewMenu(true)} style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
              <Text style={{ fontSize: 20, color: c.accent }}>📊</Text>
            </Pressable>
          </View>
        ),
      }} />
      <View style={listMaxWidth ? { maxWidth: listMaxWidth, alignSelf: 'center', width: '100%' } : undefined}>
        <View style={styles.filterBar}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t.list.searchPlaceholder}
            placeholderTextColor={c.muted}
            clearButtonMode="while-editing"
          />
        </View>
        <View style={styles.filterRow}>
          <DropdownPicker
            options={categories.map(c => ({ ...c, name: categoryLabel(c, t) }))}
            selected={selectedCategories}
            onChange={setSelectedCategories}
            placeholder={t.list.filterCategories}
            multi
          />
          {allTags.length > 0 && (
            <DropdownPicker
              options={allTags}
              selected={selectedTags}
              onChange={setSelectedTags}
              placeholder={t.list.filterTags}
              multi
            />
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 6, paddingTop: 2, flexDirection: 'row', gap: 6 }}>
          {DATE_RANGES.map(({ key, label }) => (
            <Pressable
              key={key}
              style={[styles.chip, dateRange === key && styles.chipActive]}
              onPress={() => key === 'custom' ? openDatePicker() : setDateRange(key)}
            >
              <Text style={[styles.chipText, dateRange === key && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {dateRange === 'custom' && customFrom && customTo && (
          <Pressable onPress={openDatePicker} style={styles.customRange}>
            <Text style={styles.customRangeText}>
              {formatDateDE(customFrom)} – {formatDateDE(customTo)}
            </Text>
            <Text style={{ fontSize: 12, color: c.muted }}>{t.list.changeRange}</Text>
          </Pressable>
        )}
      </View>
      {loading ? (
        <ActivityIndicator style={styles.loader} color={c.accent} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => String(e.id)}
          renderItem={({ item }) => (
            <EntryCard
              entry={item}
              highlight={search}
              qualifiers={qualifiers}
              selected={selectedIds.has(item.id)}
              selectionMode={selectionMode}
              onLongPress={() => enterSelectionMode(item.id)}
              onSelect={() => toggleSelection(item.id)}
            />
          )}
          contentContainerStyle={[styles.list, listMaxWidth != null && { maxWidth: listMaxWidth, alignSelf: 'center', width: '100%' }]}
          ListEmptyComponent={
            <Text style={styles.empty}>{t.list.empty}</Text>
          }
        />
      )}
      <Pressable style={styles.fab} onPress={() => router.push('/new')}>
        <Text style={styles.fabText}>＋</Text>
      </Pressable>

      <Modal visible={showViewMenu} transparent animationType="fade" onRequestClose={() => setShowViewMenu(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setShowViewMenu(false)}>
          <View style={{
            position: 'absolute', top: 54, right: 8,
            backgroundColor: c.surface, borderRadius: 14, elevation: 10,
            shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8,
            borderWidth: 1, borderColor: c.border, minWidth: 180, overflow: 'hidden',
          }}>
            {([
              { label: t.nav.stats, icon: '📊', route: '/stats' },
              { label: t.nav.map, icon: '🗺️', route: '/map' },
              { label: t.nav.calendar, icon: '📅', route: '/calendar' },
            ] as const).map(({ label, icon, route }, i, arr) => (
              <Pressable
                key={route}
                onPress={() => { setShowViewMenu(false); router.push(route); }}
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingHorizontal: 16, paddingVertical: 14,
                  borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: c.border,
                  backgroundColor: pressed ? c.border : 'transparent',
                }]}
              >
                <Text style={{ fontSize: 20 }}>{icon}</Text>
                <Text style={{ fontSize: 15, color: c.text }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <SetupWizard
        visible={showWizard}
        onDone={() => setShowWizard(false)}
      />
      <HelpModal
        visible={showHelp}
        onClose={() => {
          SecureStore.setItemAsync(ONBOARDING_DONE_KEY, 'true');
          setShowHelp(false);
        }}
      />

      {/* ── Burger-Menü ── */}
      <Modal visible={showBurgerMenu} transparent animationType="fade" onRequestClose={() => setShowBurgerMenu(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setShowBurgerMenu(false)}>
          <View style={{
            position: 'absolute', top: 54, left: 8,
            backgroundColor: c.surface, borderRadius: 14, elevation: 10,
            shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8,
            borderWidth: 1, borderColor: c.border, minWidth: 200, overflow: 'hidden',
          }}>
            {([
              { label: t.burgerMenu.settings, icon: '⚙', onPress: () => { setShowBurgerMenu(false); router.push('/settings'); } },
              { label: t.burgerMenu.webLoginQR, icon: '📷', onPress: handleShowWebLoginQR },
            ]).map(({ label, icon, onPress }, i, arr) => (
              <Pressable
                key={label}
                onPress={onPress}
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingHorizontal: 18, paddingVertical: 16,
                  borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: c.border,
                  backgroundColor: pressed ? c.border : 'transparent',
                }]}
              >
                <Text style={{ fontSize: 20 }}>{icon}</Text>
                <Text style={{ fontSize: 16, color: c.text }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ── Web-Login QR ── */}
      <Modal visible={!!webLoginQR} transparent animationType="fade" onRequestClose={() => setWebLoginQR(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }} onPress={() => setWebLoginQR(null)}>
          <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 24, gap: 14, alignItems: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>{t.settings.webLoginQRTitle}</Text>
            {webLoginQR && <QRCode value={webLoginQR} size={220} backgroundColor={c.surface} color={c.text} />}
            <Text style={{ fontSize: 12, color: c.muted, textAlign: 'center' }}>{t.settings.webLoginQRHint}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
              <Text style={{ color: c.muted, fontSize: 12 }}>oder</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
            </View>
            {relayCode ? (
              <>
                <Text style={{ fontSize: 36, fontWeight: '800', letterSpacing: 8, color: c.accent }}>{relayCode}</Text>
                <Text style={{ fontSize: 12, color: c.muted, textAlign: 'center' }}>{t.settings.webLoginRelayHint}</Text>
              </>
            ) : (
              <Pressable style={{ backgroundColor: c.accent, borderRadius: 10, padding: 14, width: '100%', alignItems: 'center' }} onPress={handleGenerateRelayCode} disabled={relayLoading}>
                {relayLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{t.settings.webLoginRelayBtn}</Text>}
              </Pressable>
            )}
            <Pressable style={{ borderWidth: 1, borderColor: c.accent, borderRadius: 10, padding: 14, width: '100%', alignItems: 'center' }} onPress={() => setWebLoginQR(null)}>
              <Text style={{ color: c.accent, fontSize: 16 }}>{t.settings.webLoginQRClose}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── Datums-Picker ── */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }} onPress={() => setShowDatePicker(false)}>
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 24, gap: 14 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>{t.stats.datePickerTitle}</Text>
              <View>
                <Text style={{ fontSize: 12, color: c.muted, marginBottom: 4 }}>{t.stats.dateFromLabel}</Text>
                <TextInput
                  style={{ backgroundColor: c.bg, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: c.text }}
                  value={fromInput}
                  onChangeText={v => { setFromInput(v); setDateError(''); }}
                  placeholder={t.stats.datePlaceholder}
                  placeholderTextColor={c.muted}
                  keyboardType="numeric"
                />
              </View>
              <View>
                <Text style={{ fontSize: 12, color: c.muted, marginBottom: 4 }}>{t.stats.dateToLabel}</Text>
                <TextInput
                  style={{ backgroundColor: c.bg, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: c.text }}
                  value={toInput}
                  onChangeText={v => { setToInput(v); setDateError(''); }}
                  placeholder={formatDateDE(new Date())}
                  placeholderTextColor={c.muted}
                  keyboardType="numeric"
                  onSubmitEditing={applyCustomRange}
                  returnKeyType="done"
                />
              </View>
              {!!dateError && <Text style={{ fontSize: 13, color: c.danger }}>{dateError}</Text>}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable style={{ flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 13, alignItems: 'center' }} onPress={() => setShowDatePicker(false)}>
                  <Text style={{ color: c.muted, fontSize: 15 }}>{t.common.cancel}</Text>
                </Pressable>
                <Pressable style={{ flex: 1, backgroundColor: c.accent, borderRadius: 10, padding: 13, alignItems: 'center' }} onPress={applyCustomRange}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{t.stats.btnApply}</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Sync-Status-Modal ── */}
      <Modal visible={showSyncModal} transparent animationType="fade" onRequestClose={() => setShowSyncModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }} onPress={() => setShowSyncModal(false)}>
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 24, gap: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>{t.syncStatus.title}</Text>

              {/* Nextcloud */}
              <View style={{ gap: 8, backgroundColor: c.bg, borderRadius: 12, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>☁ {t.syncStatus.ncLabel}</Text>
                  <Text style={{ fontSize: 20 }}>{trafficLight(ncLastMs, ncSyncing).dot}</Text>
                </View>
                <Text style={{ fontSize: 13, color: c.muted }}>
                  {!ncConfigured
                    ? t.syncStatus.notConfigured
                    : ncLastStr
                      ? t.syncStatus.lastSync(ncLastStr)
                      : t.syncStatus.never}
                </Text>
                {ncError && <Text style={{ fontSize: 13, color: '#FF3B30' }}>{t.syncStatus.syncError(ncError)}</Text>}
                {ncConfigured && (
                  <Pressable
                    style={{ backgroundColor: c.accent, borderRadius: 8, padding: 12, alignItems: 'center', opacity: ncSyncing ? 0.6 : 1 }}
                    onPress={handleNcSync}
                    disabled={ncSyncing}
                  >
                    {ncSyncing
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{t.syncStatus.syncNow}</Text>}
                  </Pressable>
                )}
              </View>

              {/* Google Drive */}
              <View style={{ gap: 8, backgroundColor: c.bg, borderRadius: 12, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>⬛ {t.syncStatus.driveLabel}</Text>
                  <Text style={{ fontSize: 20 }}>{trafficLight(gdriveLastMs, gdriveSyncingState).dot}</Text>
                </View>
                <Text style={{ fontSize: 13, color: c.muted }}>
                  {!gdriveConnectedState
                    ? t.syncStatus.notConnected
                    : gdriveLastStr
                      ? t.syncStatus.lastSync(gdriveLastStr)
                      : t.syncStatus.never}
                </Text>
                {gdriveError && <Text style={{ fontSize: 13, color: '#FF3B30' }}>{t.syncStatus.syncError(gdriveError)}</Text>}
                {gdriveConnectedState && (
                  <Pressable
                    style={{ backgroundColor: c.accent, borderRadius: 8, padding: 12, alignItems: 'center', opacity: gdriveSyncingState ? 0.6 : 1 }}
                    onPress={handleGDriveSync}
                    disabled={gdriveSyncingState}
                  >
                    {gdriveSyncingState
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{t.syncStatus.syncNow}</Text>}
                  </Pressable>
                )}
              </View>

              {/* Buttons */}
              {(ncConfigured || gdriveConnectedState) && (
                <Pressable
                  style={{ backgroundColor: c.accent, borderRadius: 10, padding: 14, alignItems: 'center', opacity: (ncSyncing || gdriveSyncingState) ? 0.6 : 1 }}
                  onPress={handleSyncAll}
                  disabled={ncSyncing || gdriveSyncingState}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{t.syncStatus.syncAll}</Text>
                </Pressable>
              )}
              <Pressable
                style={{ borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 14, alignItems: 'center' }}
                onPress={() => setShowSyncModal(false)}
              >
                <Text style={{ color: c.muted, fontSize: 16 }}>{t.syncStatus.close}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
