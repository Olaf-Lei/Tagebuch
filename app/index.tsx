import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryPicker } from '../components/CategoryPicker';
import { EntryCard } from '../components/EntryCard';
import { colors } from '../components/theme';
import { getCategories, type Category } from '../db/categories';
import { useEntries } from '../hooks/useEntries';
import { useTags } from '../hooks/useTags';

export default function IndexScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [selectedTag, setSelectedTag] = useState<number | undefined>();
  const [categories, setCategories] = useState<Category[]>([]);
  const allTags = useTags();

  useEffect(() => { getCategories().then(setCategories); }, []);

  const { entries, loading, reload } = useEntries({ search, categoryId: selectedCategory, tagId: selectedTag });

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const filterCategories = categories.map((c) => ({ ...c }));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.filterBar}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Suchen…"
          placeholderTextColor={colors.muted}
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
      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accent} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  filterBar: { paddingHorizontal: 14, paddingTop: 10 },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  categoryBar: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 4 },
  tagBar: { paddingHorizontal: 14, paddingBottom: 6 },
  list: { paddingHorizontal: 14, paddingBottom: 100 },
  loader: { flex: 1 },
  empty: {
    textAlign: 'center',
    marginTop: 80,
    color: colors.muted,
    fontSize: 15,
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
  settingsBtn: {
    position: 'absolute',
    bottom: 32,
    left: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsText: { fontSize: 22, color: colors.muted },
});
