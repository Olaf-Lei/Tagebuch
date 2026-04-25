import { Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryPicker } from '../components/CategoryPicker';
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
    categoryBar: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 4 },
    tagBar: { paddingHorizontal: 14, paddingBottom: 4 },
    dateBar: { paddingHorizontal: 14, paddingBottom: 6 },
    dateChip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    dateChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    dateChipText: { fontSize: 13, color: c.muted },
    dateChipTextActive: { color: '#fff', fontWeight: '600' },
    dateRow: { flexDirection: 'row', gap: 8 },
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
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [selectedTag, setSelectedTag] = useState<number | undefined>();
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const allTags = useTags();

  useEffect(() => { getCategories().then(setCategories); }, []);

  const { entries, loading, reload } = useEntries({
    search, categoryId: selectedCategory, tagId: selectedTag, ...dateRangeTimes(dateRange),
  });

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const filterCategories = categories.map((cat) => ({ ...cat }));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{
        headerRight: () => (
          <Pressable onPress={() => router.push('/calendar')} style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ fontSize: 20, color: c.accent }}>📅</Text>
          </Pressable>
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
      <View style={styles.categoryBar}>
        <CategoryPicker
          categories={[{ id: 0, name: 'Alle' }, ...filterCategories]}
          selected={selectedCategory ? [selectedCategory] : [0]}
          onChange={(ids) => {
            const last = ids[ids.length - 1];
            setSelectedCategory(last === 0 ? undefined : last);
          }}
        />
      </View>
      {allTags.length > 0 && (
        <View style={styles.tagBar}>
          <CategoryPicker
            categories={[{ id: 0, name: 'Alle Tags' }, ...allTags]}
            selected={selectedTag ? [selectedTag] : [0]}
            onChange={(ids) => {
              const last = ids[ids.length - 1];
              setSelectedTag(last === 0 ? undefined : last);
            }}
          />
        </View>
      )}
      <View style={styles.dateBar}>
        <View style={styles.dateRow}>
          {DATE_RANGES.map(({ key, label }) => (
            <Pressable
              key={key}
              style={[styles.dateChip, dateRange === key && styles.dateChipActive]}
              onPress={() => setDateRange(key)}
            >
              <Text style={[styles.dateChipText, dateRange === key && styles.dateChipTextActive]}>
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
          renderItem={({ item }) => <EntryCard entry={item} />}
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

