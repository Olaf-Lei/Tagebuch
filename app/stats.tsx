import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HEALTH_EMOJIS, MOOD_EMOJIS, emojiForLevel } from '../components/qualifiers';
import { useColors } from '../components/theme';
import { getStats, type Stats } from '../db/stats';

// ── Heatmap ──────────────────────────────────────────────────────────────────

function buildHeatmapGrid(perDay: { day: string; count: number }[]): ({ date: string; count: number } | null)[][] {
  const countMap = new Map(perDay.map((d) => [d.day, d.count]));
  const today = new Date();
  // Align to last Sunday so grid ends on current week's Sunday
  const dow = today.getDay(); // 0=Sun
  const endSunday = new Date(today);
  endSunday.setDate(today.getDate() + (dow === 0 ? 0 : 7 - dow));

  const cols = 26;
  const grid: ({ date: string; count: number } | null)[][] = [];

  for (let col = cols - 1; col >= 0; col--) {
    const week: ({ date: string; count: number } | null)[] = [];
    for (let row = 0; row < 7; row++) { // 0=Sun
      const d = new Date(endSunday);
      d.setDate(endSunday.getDate() - col * 7 - (6 - row));
      const p = (n: number) => String(n).padStart(2, '0');
      const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      const future = d > today;
      week.push(future ? null : { date: key, count: countMap.get(key) ?? 0 });
    }
    grid.push(week);
  }
  return grid;
}

function Heatmap({ perDay, c }: { perDay: Stats['perDay']; c: ReturnType<typeof useColors> }) {
  const grid = useMemo(() => buildHeatmapGrid(perDay), [perDay]);
  const cellSize = 11;
  const gap = 2;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap }}>
        {grid.map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'column', gap }}>
            {week.map((cell, di) => {
              const bg = !cell
                ? 'transparent'
                : cell.count === 0
                  ? c.border
                  : cell.count === 1
                    ? c.accent + '77'
                    : c.accent;
              return <View key={di} style={{ width: cellSize, height: cellSize, borderRadius: 2, backgroundColor: bg }} />;
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

function BarChart({ items, c }: { items: { label: string; count: number }[]; c: ReturnType<typeof useColors> }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <View style={{ gap: 6 }}>
      {items.map(({ label, count }) => (
        <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ width: 72, fontSize: 12, color: c.muted, textAlign: 'right' }}>{label}</Text>
          <View style={{ flex: 1, height: 14, backgroundColor: c.border, borderRadius: 7, overflow: 'hidden' }}>
            <View style={{ width: `${(count / max) * 100}%`, height: '100%', backgroundColor: c.accent, borderRadius: 7 }} />
          </View>
          <Text style={{ width: 28, fontSize: 12, color: c.muted }}>{count}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

function monthShort(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
}

export default function StatsScreen() {
  const c = useColors();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { getStats().then(setStats); }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, gap: 20, paddingBottom: 40 },
    cardRow: { flexDirection: 'row', gap: 10 },
    card: { flex: 1, backgroundColor: c.surface, borderRadius: 12, padding: 14, alignItems: 'center', gap: 4 },
    cardNum: { fontSize: 28, fontWeight: '700', color: c.accent },
    cardLabel: { fontSize: 12, color: c.muted, textAlign: 'center' },
    section: {
      fontSize: 11, fontWeight: '700', color: c.muted,
      textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
    },
    block: { backgroundColor: c.surface, borderRadius: 12, padding: 14 },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { fontSize: 13, color: c.muted, textAlign: 'center', paddingVertical: 8 },
  }), [c]);

  if (!stats) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loader}><ActivityIndicator color={c.accent} /></View>
      </SafeAreaView>
    );
  }

  const monthItems = [...stats.perMonth].reverse().map((m) => ({ label: monthShort(m.month), count: m.count }));
  const catItems = stats.perCategory.map((x) => ({ label: x.name, count: x.count }));
  const tagItems = stats.perTag.map((x) => ({ label: `#${x.name}`, count: x.count }));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Kennzahlen */}
        <View style={styles.cardRow}>
          <View style={styles.card}>
            <Text style={styles.cardNum}>{stats.total}</Text>
            <Text style={styles.cardLabel}>Einträge{'\n'}gesamt</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardNum}>{stats.activeDays}</Text>
            <Text style={styles.cardLabel}>Tage{'\n'}aktiv</Text>
          </View>
        </View>
        <View style={styles.cardRow}>
          <View style={styles.card}>
            <Text style={styles.cardNum}>{stats.currentStreak}</Text>
            <Text style={styles.cardLabel}>Tage{'\n'}Serie</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardNum}>{stats.longestStreak}</Text>
            <Text style={styles.cardLabel}>Tage{'\n'}Rekord</Text>
          </View>
        </View>
        {(stats.avgMood !== null || stats.avgHealth !== null) && (
          <View style={styles.cardRow}>
            {stats.avgMood !== null && (
              <View style={styles.card}>
                <Text style={styles.cardNum}>{emojiForLevel(MOOD_EMOJIS, Math.round(stats.avgMood))}</Text>
                <Text style={styles.cardLabel}>Ø Laune{'\n'}({stats.avgMood.toFixed(1)})</Text>
              </View>
            )}
            {stats.avgHealth !== null && (
              <View style={styles.card}>
                <Text style={styles.cardNum}>{emojiForLevel(HEALTH_EMOJIS, Math.round(stats.avgHealth))}</Text>
                <Text style={styles.cardLabel}>Ø Befinden{'\n'}({stats.avgHealth.toFixed(1)})</Text>
              </View>
            )}
          </View>
        )}

        {/* Heatmap */}
        <View>
          <Text style={styles.section}>Aktivität – letzte 26 Wochen</Text>
          <View style={styles.block}>
            <Heatmap perDay={stats.perDay} c={c} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
              <Text style={{ fontSize: 10, color: c.muted }}>wenig</Text>
              {[c.border, c.accent + '55', c.accent + '99', c.accent].map((bg, i) => (
                <View key={i} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: bg }} />
              ))}
              <Text style={{ fontSize: 10, color: c.muted }}>viel</Text>
            </View>
          </View>
        </View>

        {/* Einträge pro Monat */}
        {monthItems.length > 0 && (
          <View>
            <Text style={styles.section}>Einträge pro Monat</Text>
            <View style={styles.block}>
              <BarChart items={monthItems} c={c} />
            </View>
          </View>
        )}

        {/* Kategorien */}
        {catItems.length > 0 && (
          <View>
            <Text style={styles.section}>Top-Kategorien</Text>
            <View style={styles.block}>
              <BarChart items={catItems} c={c} />
            </View>
          </View>
        )}

        {/* Tags */}
        {tagItems.length > 0 && (
          <View>
            <Text style={styles.section}>Top-Tags</Text>
            <View style={styles.block}>
              <BarChart items={tagItems} c={c} />
            </View>
          </View>
        )}

        {stats.total === 0 && (
          <Text style={styles.empty}>Noch keine Einträge – Statistiken erscheinen sobald du anfängst zu schreiben.</Text>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
