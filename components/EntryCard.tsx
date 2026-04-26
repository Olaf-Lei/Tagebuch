import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Entry } from '../db/entries';
import { HEALTH_EMOJIS, MOOD_EMOJIS, emojiForLevel } from './qualifiers';
import { useColors } from './theme';

interface Props {
  entry: Entry;
  highlight?: string;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function HighlightedText({
  text, highlight, style, highlightStyle, numberOfLines,
}: {
  text: string;
  highlight: string;
  style: object;
  highlightStyle: object;
  numberOfLines?: number;
}) {
  if (!highlight.trim()) return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;

  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) =>
        regex.test(part)
          ? <Text key={i} style={highlightStyle}>{part}</Text>
          : part
      )}
    </Text>
  );
}

export function EntryCard({ entry, highlight }: Props) {
  const router = useRouter();
  const c = useColors();
  const styles = useMemo(() => StyleSheet.create({
    card: { backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 10, gap: 6 },
    pressed: { opacity: 0.75 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    timestamp: { fontSize: 12, color: c.muted },
    qualifiers: { flexDirection: 'row', gap: 4 },
    qualifierEmoji: { fontSize: 15 },
    preview: { fontSize: 15, color: c.text, lineHeight: 21 },
    highlight: { backgroundColor: c.accent + '55', color: c.text, borderRadius: 2 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
    categoryBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    tagBadge: { backgroundColor: c.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    tagText: { fontSize: 12, color: c.muted },
    locationBadge: { backgroundColor: c.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    locationText: { fontSize: 12, color: c.muted },
  }), [c]);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push(`/entry/${entry.id}`)}
    >
      <View style={styles.headerRow}>
        <Text style={styles.timestamp}>{formatDate(entry.timestamp)}</Text>
        {(entry.mood || entry.health) ? (
          <View style={styles.qualifiers}>
            {entry.mood ? <Text style={styles.qualifierEmoji}>{emojiForLevel(MOOD_EMOJIS, entry.mood)}</Text> : null}
            {entry.health ? <Text style={styles.qualifierEmoji}>{emojiForLevel(HEALTH_EMOJIS, entry.health)}</Text> : null}
          </View>
        ) : null}
      </View>
      {highlight ? (
        <HighlightedText
          text={entry.text}
          highlight={highlight}
          style={styles.preview}
          highlightStyle={styles.highlight}
          numberOfLines={3}
        />
      ) : (
        <Text style={styles.preview} numberOfLines={3}>{entry.text}</Text>
      )}
      {(entry.categories.length > 0 || entry.tags.length > 0) && (
        <View style={styles.badges}>
          {entry.categories.map((cat) => {
            const col = cat.color ?? c.accent;
            return (
              <View key={cat.name} style={[styles.categoryBadge, { backgroundColor: col + '33' }]}>
                <Text style={{ fontSize: 12, color: col }}>{cat.name}</Text>
              </View>
            );
          })}
          {entry.tags.map((t) => (
            <View key={t} style={styles.tagBadge}>
              <Text style={styles.tagText}>#{t}</Text>
            </View>
          ))}
          {entry.locationName && (
            <View style={styles.locationBadge}>
              <Text style={styles.locationText}>📍 {entry.locationName}</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}
