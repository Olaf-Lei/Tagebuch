import { Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { DropdownPicker } from '../components/DropdownPicker';
import { EntryCard } from '../components/EntryCard';
import { HelpModal } from '../components/HelpModal';
import { useColors } from '../components/theme';
import { getCategories, type Category } from '../db/categories';
import { useEntries } from '../hooks/useEntries';
import { useTags } from '../hooks/useTags';
import { useT } from '../i18n';
import { addSyncListener, syncIfConfigured } from '../sync/webdav';

const HELP_SHOWN_KEY = 'help_shown';

export default function IndexScreen() {
  const router = useRouter();
  const c = useColors();
  const t = useT();
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
  const [syncing, setSyncing] = useState(false);
  const allTags = useTags();

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try { await syncIfConfigured(); } finally { setSyncing(false); }
  }, [syncing]);

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
          <Pressable onPress={() => router.push('/settings')} style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ fontSize: 20, color: c.muted }}>☰</Text>
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
            <Pressable onPress={handleSync} disabled={syncing} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
              <Text style={{ fontSize: 18, color: syncing ? c.muted : c.accent }}>↻</Text>
            </Pressable>
            <Pressable onPress={() => setShowHelp(true)} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
              <Text style={{ fontSize: 17, color: c.muted, fontWeight: '600' }}>?</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/stats')} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
              <Text style={{ fontSize: 19, color: c.accent }}>📊</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/calendar')} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
              <Text style={{ fontSize: 19, color: c.accent }}>📅</Text>
            </Pressable>
          </View>
        ),
      }} />
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
      {loading ? (
        <ActivityIndicator style={styles.loader} color={c.accent} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => String(e.id)}
          renderItem={({ item }) => <EntryCard entry={item} highlight={search} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{t.list.empty}</Text>
          }
        />
      )}
      <Pressable style={styles.fab} onPress={() => router.push('/new')}>
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
<HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
    </SafeAreaView>
  );
}
