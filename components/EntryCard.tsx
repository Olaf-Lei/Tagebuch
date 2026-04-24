import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Entry } from '../db/entries';
import { colors } from './theme';

interface Props {
  entry: Entry;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function EntryCard({ entry }: Props) {
  const router = useRouter();

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push(`/entry/${entry.id}`)}
    >
      <Text style={styles.timestamp}>{formatDate(entry.timestamp)}</Text>
      <Text style={styles.preview} numberOfLines={3}>{entry.text}</Text>
      {(entry.categories.length > 0 || entry.tags.length > 0) && (
        <View style={styles.badges}>
          {entry.categories.map((c) => (
            <View key={c} style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{c}</Text>
            </View>
          ))}
          {entry.tags.map((t) => (
            <View key={t} style={styles.tagBadge}>
              <Text style={styles.tagText}>#{t}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  pressed: { opacity: 0.75 },
  timestamp: { fontSize: 12, color: colors.muted },
  preview: { fontSize: 15, color: colors.text, lineHeight: 21 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  categoryBadge: {
    backgroundColor: colors.accent + '33',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: { fontSize: 12, color: colors.accent },
  tagBadge: {
    backgroundColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 12, color: colors.muted },
});
