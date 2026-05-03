import { Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Modal, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import QRCode from 'react-native-qrcode-svg';
import { DropdownPicker } from '../components/DropdownPicker';
import { EntryCard } from '../components/EntryCard';
import { HelpModal } from '../components/HelpModal';
import { useColors } from '../components/theme';
import { useLayout } from '../hooks/useLayout';
import { getCategories, type Category } from '../db/categories';
import { useEntries } from '../hooks/useEntries';
import { useTags } from '../hooks/useTags';
import { useQualifiers } from '../hooks/useQualifiers';
import { useT } from '../i18n';
import { addSyncListener, loadConfig, syncNow as ncSyncNow, getLastSync as ncGetLastSync, getLastSyncMs as ncGetLastSyncMs } from '../sync/webdav';
import * as gdrive from '../sync/googledrive';
import { exportEncKey } from '../utils/crypto';

const HELP_SHOWN_KEY = 'help_shown';

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
    dateBar: { paddingHorizontal: 14, paddingBottom: 6 },
    segmented: { flexDirection: 'row', backgroundColor: c.surface, borderRadius: 10, padding: 3 },
    segment: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
    segmentActive: { backgroundColor: c.accent },
    segmentText: { fontSize: 13, color: c.muted },
    segmentTextActive: { color: '#fff', fontWeight: '600' },
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

  type DateRange = 'all' | 'today' | 'week' | 'month';

  function dateRangeTimes(range: DateRange): { startTime?: number; endTime?: number } {
    const now = new Date();
    if (range === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return { startTime: start };
    }
    if (range === 'week') {
      const dow = (now.getDay() + 6) % 7;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow).getTime();
      return { startTime: start };
    }
    if (range === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return { startTime: start };
    }
    return {};
  }

  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [webLoginQR, setWebLoginQR] = useState<string | null>(null);

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
    setWebLoginQR(JSON.stringify(payload));
    setShowBurgerMenu(false);
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
    SecureStore.getItemAsync(HELP_SHOWN_KEY).then((val) => {
      if (!val) {
        setShowHelp(true);
        SecureStore.setItemAsync(HELP_SHOWN_KEY, 'true');
      }
    });
  }, []);

  const { entries, loading, reload } = useEntries({
    search,
    categoryIds: selectedCategories.length ? selectedCategories : undefined,
    tagIds: selectedTags.length ? selectedTags : undefined,
    ...dateRangeTimes(dateRange),
  });

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const DATE_RANGES: { key: DateRange; label: string }[] = [
    { key: 'all', label: t.list.dateAll },
    { key: 'today', label: t.list.dateToday },
    { key: 'week', label: t.list.dateWeek },
    { key: 'month', label: t.list.dateMonth },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{
        headerLeft: () => (
          <Pressable onPress={() => setShowBurgerMenu(true)} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text style={{ fontSize: 22, color: c.muted }}>☰</Text>
          </Pressable>
        ),
        headerTitle: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image
              source={require('../assets/icon.png')}
              style={{ width: 28, height: 28, borderRadius: 6 }}
            />
            <Text style={{ fontSize: 17, fontWeight: '600', color: c.text }}>{t.appName}</Text>
          </View>
        ),
        headerRight: () => (
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
            options={categories}
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
        <View style={styles.dateBar}>
          <View style={styles.segmented}>
            {DATE_RANGES.map(({ key, label }) => (
              <Pressable
                key={key}
                style={[styles.segment, dateRange === key && styles.segmentActive]}
                onPress={() => setDateRange(key)}
              >
                <Text style={[styles.segmentText, dateRange === key && styles.segmentTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      {loading ? (
        <ActivityIndicator style={styles.loader} color={c.accent} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => String(e.id)}
          renderItem={({ item }) => <EntryCard entry={item} highlight={search} qualifiers={qualifiers} />}
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
              { label: t.nav.calendar, icon: '📅', route: '/calendar' },
              { label: t.nav.map, icon: '🗺️', route: '/map' },
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

      <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />

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
            <Pressable style={{ borderWidth: 1, borderColor: c.accent, borderRadius: 10, padding: 14, width: '100%', alignItems: 'center' }} onPress={() => setWebLoginQR(null)}>
              <Text style={{ color: c.accent, fontSize: 16 }}>{t.settings.webLoginQRClose}</Text>
            </Pressable>
          </View>
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
