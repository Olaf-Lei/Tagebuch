import { Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DropdownPicker } from '../components/DropdownPicker';
import { EntryCard } from '../components/EntryCard';
import { useColors } from '../components/theme';
import { getCategories, type Category } from '../db/categories';
import { useEntries } from '../hooks/useEntries';
import { useTags } from '../hooks/useTags';

export default function IndexScreen() {
  const router = useRouter();
  const c = useColors();
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
    settingsBtn: {
      position: 'absolute', bottom: fabBottom + 4, left: 20, width: 52, height: 52,
      borderRadius: 26, backgroundColor: c.surface, borderWidth: 1,
      borderColor: c.border, alignItems: 'center', justifyContent: 'center',
    },
    settingsText: { fontSize: 22, color: c.muted },
  }), [c, fabBottom]);

  type DateRange = 'all' | 'today' | 'week' | 'month';
  const DATE_RANGES: { key: DateRange; label: string }[] = [
    { key: 'all', label: 'Alles' },
    { key: 'today', label: 'Heute' },
    { key: 'week', label: 'Woche' },
    { key: 'month', label: 'Monat' },
  ];

  function dateRangeTimes(range: DateRange): { startTime?: number; endTime?: number } {
    const now = new Date();
    if (range === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return { startTime: start };
    }
    if (range === 'week') {
      const dow = (now.getDay() + 6) % 7; // Mon=0
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
  const allTags = useTags();

  useEffect(() => { getCategories().then(setCategories); }, []);

  const { entries, loading, reload } = useEntries({
    search,
    categoryIds: selectedCategories.length ? selectedCategories : undefined,
    tagIds: selectedTags.length ? selectedTags : undefined,
    ...dateRangeTimes(dateRange),
  });

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{
        headerTitle: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image
              source={require('../assets/icon.png')}
              style={{ width: 28, height: 28, borderRadius: 6 }}
            />
            <Text style={{ fontSize: 17, fontWeight: '600', color: c.text }}>Tagebuch</Text>
          </View>
        ),
        headerRight: () => (
          <View style={{ flexDirection: 'row' }}>
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
          placeholder="Suchen…"
          placeholderTextColor={c.muted}
          clearButtonMode="while-editing"
        />
      </View>
      <View style={styles.filterRow}>
        <DropdownPicker
          options={categories}
          selected={selectedCategories}
          onChange={setSelectedCategories}
          placeholder="Kategorien"
          multi
        />
        {allTags.length > 0 && (
          <DropdownPicker
            options={allTags}
            selected={selectedTags}
            onChange={setSelectedTags}
            placeholder="Tags"
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
            <Text style={styles.empty}>Noch keine Einträge.</Text>
          }
        />
      )}
      <Pressable style={styles.fab} onPress={() => router.push('/new')}>
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
      <Pressable style={styles.settingsBtn} onPress={() => router.push('/settings')}>
        <Text style={styles.settingsText}>⚙</Text>
      </Pressable>
    </SafeAreaView>
  );
}

