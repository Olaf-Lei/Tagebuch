import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../components/theme';
import { getStats, getMoodHealthTrend, type Stats, type TrendPoint, type PeriodGroupBy } from '../db/stats';

// ── Filter ────────────────────────────────────────────────────────────────────

type FilterKey = 'day' | 'week' | 'month' | 'year' | 'custom';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'day', label: 'Tag' },
  { key: 'week', label: 'Woche' },
  { key: 'month', label: 'Monat' },
  { key: 'year', label: 'Jahr' },
  { key: 'custom', label: 'Frei' },
];

function getRange(
  filter: FilterKey,
  customFrom?: Date,
  customTo?: Date,
): { from: number; to: number; groupBy: PeriodGroupBy; trendGroupBy: PeriodGroupBy } {
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  switch (filter) {
    case 'day':
      return { from: todayStart.getTime(), to: now, groupBy: 'hour', trendGroupBy: 'hour' };
    case 'week':
      return { from: now - 7 * 86400000, to: now, groupBy: 'day', trendGroupBy: 'day' };
    case 'month':
      return { from: now - 30 * 86400000, to: now, groupBy: 'day', trendGroupBy: 'day' };
    case 'year':
      return { from: now - 365 * 86400000, to: now, groupBy: 'month', trendGroupBy: 'week' };
    case 'custom': {
      const from = customFrom?.getTime() ?? now - 30 * 86400000;
      const toDate = customTo ? new Date(customTo) : new Date();
      toDate.setHours(23, 59, 59, 999);
      const to = toDate.getTime();
      const days = (to - from) / 86400000;
      const groupBy: PeriodGroupBy = days <= 31 ? 'day' : days <= 365 ? 'week' : 'month';
      return { from, to, groupBy, trendGroupBy: groupBy };
    }
  }
}

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

// ── Label formatting ──────────────────────────────────────────────────────────

function formatPeriodLabel(label: string): string {
  if (/^\d{2}:\d{2}$/.test(label)) return label;
  if (/^\d{4}-W\d{2}$/.test(label)) return `KW${label.split('-W')[1]}`;
  if (/^\d{4}-\d{2}$/.test(label)) {
    const [y, m] = label.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const [, m, d] = label.split('-').map(Number);
    return `${d}.${m}.`;
  }
  return label;
}

// ── Trend chart (two curves, no SVG) ─────────────────────────────────────────

function TrendChart({ trend, c }: { trend: TrendPoint[]; c: ReturnType<typeof useColors> }) {
  const [chartWidth, setChartWidth] = useState(0);
  const CHART_H = 130;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 22;
  const INNER_H = CHART_H - PAD_TOP - PAD_BOTTOM;

  const hasMood = trend.some(p => p.avgMood !== null);
  const hasHealth = trend.some(p => p.avgHealth !== null);

  if (!hasMood && !hasHealth) {
    return (
      <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', paddingVertical: 24 }}>
        Keine Laune/Befinden-Daten für diesen Zeitraum
      </Text>
    );
  }

  const n = Math.max(trend.length - 1, 1);
  const toX = (i: number) => (i / n) * chartWidth;
  const toY = (v: number) => PAD_TOP + INNER_H - ((v - 1) / 4) * INNER_H;

  const MOOD_COLOR = c.accent;
  const HEALTH_COLOR = '#4CAF50';

  const renderCurve = (pts: { i: number; v: number }[], color: string) => {
    if (pts.length === 0) return null;
    const screen = pts.map(p => ({ x: toX(p.i), y: toY(p.v) }));
    return (
      <>
        {screen.slice(0, -1).map((p, idx) => {
          const q = screen[idx + 1];
          const dx = q.x - p.x; const dy = q.y - p.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          return (
            <View key={`s${idx}`} style={{
              position: 'absolute',
              left: (p.x + q.x) / 2 - len / 2,
              top: (p.y + q.y) / 2 - 1.5,
              width: len, height: 3,
              backgroundColor: color, borderRadius: 1.5,
              transform: [{ rotate: `${angle}deg` }],
            }} />
          );
        })}
        {screen.map((p, idx) => (
          <View key={`d${idx}`} style={{
            position: 'absolute',
            left: p.x - 3, top: p.y - 3,
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: color,
          }} />
        ))}
      </>
    );
  };

  const moodPts = trend.map((p, i) => p.avgMood !== null ? { i, v: p.avgMood as number } : null).filter(Boolean) as { i: number; v: number }[];
  const healthPts = trend.map((p, i) => p.avgHealth !== null ? { i, v: p.avgHealth as number } : null).filter(Boolean) as { i: number; v: number }[];

  // Pick 3 evenly-spaced x-axis labels
  const xLabels: { i: number; label: string }[] = [];
  if (trend.length >= 1) xLabels.push({ i: 0, label: formatPeriodLabel(trend[0].label) });
  if (trend.length >= 3) {
    const mid = Math.floor((trend.length - 1) / 2);
    xLabels.push({ i: mid, label: formatPeriodLabel(trend[mid].label) });
  }
  if (trend.length >= 2) xLabels.push({ i: trend.length - 1, label: formatPeriodLabel(trend[trend.length - 1].label) });

  return (
    <View>
      <View onLayout={e => setChartWidth(e.nativeEvent.layout.width)} style={{ height: CHART_H }}>
        {chartWidth > 0 && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            {[1, 2, 3, 4, 5].map(v => (
              <View key={v} style={{
                position: 'absolute', left: 0, right: 0,
                top: toY(v), height: 1,
                backgroundColor: c.border, opacity: v % 2 === 1 ? 0.6 : 0.25,
              }} />
            ))}
            {renderCurve(moodPts, MOOD_COLOR)}
            {renderCurve(healthPts, HEALTH_COLOR)}
            {xLabels.map(({ i, label }) => (
              <Text key={i} style={{
                position: 'absolute',
                left: toX(i) - 22, top: CHART_H - PAD_BOTTOM + 5,
                width: 44, fontSize: 9, color: c.muted, textAlign: 'center',
              }}>{label}</Text>
            ))}
            {/* Y-axis hint */}
            {[1, 3, 5].map(v => (
              <Text key={v} style={{
                position: 'absolute', left: -18, top: toY(v) - 7,
                width: 16, fontSize: 9, color: c.muted, textAlign: 'right',
              }}>{v}</Text>
            ))}
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 6 }}>
        {hasMood && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 14, height: 3, backgroundColor: MOOD_COLOR, borderRadius: 1.5 }} />
            <Text style={{ fontSize: 11, color: c.muted }}>Laune</Text>
          </View>
        )}
        {hasHealth && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 14, height: 3, backgroundColor: HEALTH_COLOR, borderRadius: 1.5 }} />
            <Text style={{ fontSize: 11, color: c.muted }}>Befinden</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

function buildHeatmapGrid(
  perDay: { day: string; count: number }[],
  fromMs: number,
  toMs: number,
) {
  const countMap = new Map(perDay.map(d => [d.day, d.count]));
  const today = new Date(); today.setHours(23, 59, 59, 999);

  const toDate = new Date(toMs);
  const dow = toDate.getDay();
  const endSunday = new Date(toDate);
  if (dow !== 0) endSunday.setDate(toDate.getDate() + (7 - dow));

  const diffMs = endSunday.getTime() - fromMs;
  const cols = Math.max(Math.min(Math.ceil(diffMs / (7 * 86400000)), 52), 1);

  const grid: ({ date: string; count: number } | null)[][] = [];
  for (let col = cols - 1; col >= 0; col--) {
    const week: ({ date: string; count: number } | null)[] = [];
    for (let row = 0; row < 7; row++) {
      const d = new Date(endSunday);
      d.setDate(endSunday.getDate() - col * 7 - (6 - row));
      const p = (n: number) => String(n).padStart(2, '0');
      const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      const future = d > today;
      const before = d.getTime() < fromMs;
      week.push((future || before) ? null : { date: key, count: countMap.get(key) ?? 0 });
    }
    grid.push(week);
  }
  return grid;
}

function Heatmap({ perDay, from, to, c }: {
  perDay: Stats['perDay']; from: number; to: number; c: ReturnType<typeof useColors>;
}) {
  const grid = useMemo(() => buildHeatmapGrid(perDay, from, to), [perDay, from, to]);
  const cellSize = 11; const gap = 2;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap }}>
        {grid.map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'column', gap }}>
            {week.map((cell, di) => {
              const bg = !cell ? 'transparent'
                : cell.count === 0 ? c.border
                : cell.count === 1 ? c.accent + '77'
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

function BarChart({ items, c, labelWidth = 72 }: {
  items: { label: string; count: number }[];
  c: ReturnType<typeof useColors>;
  labelWidth?: number;
}) {
  const max = Math.max(...items.map(i => i.count), 1);
  return (
    <View style={{ gap: 6 }}>
      {items.map(({ label, count }) => (
        <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{ width: labelWidth, fontSize: 12, color: c.muted, textAlign: 'right' }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >{label}</Text>
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

export default function StatsScreen() {
  const c = useColors();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('month');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [dateError, setDateError] = useState('');

  const [stats, setStats] = useState<Stats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(
    () => getRange(activeFilter, customFrom, customTo),
    [activeFilter, customFrom, customTo]
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getStats(range.from, range.to, range.groupBy),
      getMoodHealthTrend(range.from, range.to, range.trendGroupBy),
    ]).then(([s, t]) => {
      setStats(s);
      setTrend(t);
      setLoading(false);
    });
  }, [range]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, gap: 20, paddingBottom: 40 },
    filterRow: { flexDirection: 'row', gap: 6 },
    chip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 13, color: c.muted },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    customRange: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: c.surface, borderRadius: 8, padding: 10,
    },
    customRangeText: { fontSize: 13, color: c.text, flex: 1 },
    cardRow: { flexDirection: 'row', gap: 10 },
    card: { flex: 1, backgroundColor: c.surface, borderRadius: 12, padding: 14, alignItems: 'center', gap: 4 },
    cardNum: { fontSize: 28, fontWeight: '700', color: c.accent },
    cardLabel: { fontSize: 12, color: c.muted, textAlign: 'center' },
    section: { fontSize: 11, fontWeight: '700', color: c.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    block: { backgroundColor: c.surface, borderRadius: 12, padding: 14 },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { fontSize: 13, color: c.muted, textAlign: 'center', paddingVertical: 8 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: c.surface, borderRadius: 16, padding: 24, gap: 14 },
    modalTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    modalLabel: { fontSize: 12, color: c.muted, marginBottom: 4 },
    modalInput: {
      backgroundColor: c.bg, borderRadius: 10, borderWidth: 1,
      borderColor: c.border, paddingHorizontal: 14, paddingVertical: 11,
      fontSize: 15, color: c.text,
    },
    modalError: { fontSize: 13, color: c.danger },
    modalBtnRow: { flexDirection: 'row', gap: 10 },
    modalBtn: { flex: 1, backgroundColor: c.accent, borderRadius: 10, padding: 13, alignItems: 'center' },
    modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    modalCancel: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 13, alignItems: 'center' },
    modalCancelText: { color: c.muted, fontSize: 15 },
  }), [c]);

  const applyCustomRange = () => {
    const from = parseDateDE(fromInput);
    const to = parseDateDE(toInput);
    if (!from) { setDateError('Ungültiges Von-Datum (TT.MM.JJJJ)'); return; }
    if (!to) { setDateError('Ungültiges Bis-Datum (TT.MM.JJJJ)'); return; }
    if (from > to) { setDateError('Von muss vor Bis liegen'); return; }
    setCustomFrom(from);
    setCustomTo(to);
    setActiveFilter('custom');
    setShowDatePicker(false);
    setDateError('');
  };

  const openDatePicker = () => {
    const now = new Date();
    const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 30);
    setFromInput(customFrom ? formatDateDE(customFrom) : formatDateDE(monthAgo));
    setToInput(customTo ? formatDateDE(customTo) : formatDateDE(now));
    setDateError('');
    setShowDatePicker(true);
  };

  const periodItems = stats?.perPeriod.map(p => ({
    label: formatPeriodLabel(p.label),
    count: p.count,
  })) ?? [];

  const catItems = stats?.perCategory.map(x => ({ label: x.name, count: x.count })) ?? [];
  const tagItems = stats?.perTag.map(x => ({ label: `#${x.name}`, count: x.count })) ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Filter row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
        contentContainerStyle={[styles.filterRow, { padding: 12, paddingBottom: 4 }]}>
        {FILTERS.map(f => (
          <Pressable
            key={f.key}
            style={[styles.chip, activeFilter === f.key && styles.chipActive]}
            onPress={() => f.key === 'custom' ? openDatePicker() : setActiveFilter(f.key)}
          >
            <Text style={[styles.chipText, activeFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {activeFilter === 'custom' && customFrom && customTo && (
        <Pressable onPress={openDatePicker} style={[styles.customRange, { marginHorizontal: 12, marginBottom: 4 }]}>
          <Text style={styles.customRangeText}>
            {formatDateDE(customFrom)} – {formatDateDE(customTo)}
          </Text>
          <Text style={{ fontSize: 12, color: c.muted }}>ändern</Text>
        </Pressable>
      )}

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={c.accent} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>

          {/* Kennzahlen */}
          <View style={styles.cardRow}>
            <View style={styles.card}>
              <Text style={styles.cardNum}>{stats?.total ?? 0}</Text>
              <Text style={styles.cardLabel}>Einträge</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardNum}>{stats?.activeDays ?? 0}</Text>
              <Text style={styles.cardLabel}>Tage aktiv</Text>
            </View>
          </View>
          {activeFilter !== 'day' && (
            <View style={styles.cardRow}>
              <View style={styles.card}>
                <Text style={styles.cardNum}>{stats?.currentStreak ?? 0}</Text>
                <Text style={styles.cardLabel}>Tage{'\n'}Serie</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardNum}>{stats?.longestStreak ?? 0}</Text>
                <Text style={styles.cardLabel}>Tage{'\n'}Rekord</Text>
              </View>
            </View>
          )}

          {/* Laune & Befinden Verlauf */}
          <View>
            <Text style={styles.section}>Laune & Befinden</Text>
            <View style={[styles.block, { paddingLeft: 24 }]}>
              <TrendChart trend={trend} c={c} />
            </View>
          </View>

          {/* Aktivitäts-Heatmap */}
          {activeFilter !== 'day' && (
            <View>
              <Text style={styles.section}>Aktivität</Text>
              <View style={styles.block}>
                <Heatmap perDay={stats?.perDay ?? []} from={range.from} to={range.to} c={c} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
                  <Text style={{ fontSize: 10, color: c.muted }}>wenig</Text>
                  {[c.border, c.accent + '55', c.accent + '99', c.accent].map((bg, i) => (
                    <View key={i} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: bg }} />
                  ))}
                  <Text style={{ fontSize: 10, color: c.muted }}>viel</Text>
                </View>
              </View>
            </View>
          )}

          {/* Einträge pro Periode */}
          {periodItems.length > 0 && (
            <View>
              <Text style={styles.section}>Einträge pro Zeitraum</Text>
              <View style={styles.block}>
                <BarChart items={periodItems} c={c} />
              </View>
            </View>
          )}

          {/* Kategorien */}
          {catItems.length > 0 && (
            <View>
              <Text style={styles.section}>Top-Kategorien</Text>
              <View style={styles.block}>
                <BarChart items={catItems} c={c} labelWidth={110} />
              </View>
            </View>
          )}

          {/* Tags */}
          {tagItems.length > 0 && (
            <View>
              <Text style={styles.section}>Top-Tags</Text>
              <View style={styles.block}>
                <BarChart items={tagItems} c={c} labelWidth={110} />
              </View>
            </View>
          )}

          {stats?.total === 0 && (
            <Text style={styles.empty}>Keine Einträge in diesem Zeitraum.</Text>
          )}

        </ScrollView>
      )}

      {/* Freier Zeitraum – Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Zeitraum wählen</Text>
              <View>
                <Text style={styles.modalLabel}>Von (TT.MM.JJJJ)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={fromInput}
                  onChangeText={v => { setFromInput(v); setDateError(''); }}
                  placeholder="01.01.2026"
                  placeholderTextColor={c.muted}
                  keyboardType="numeric"
                />
              </View>
              <View>
                <Text style={styles.modalLabel}>Bis (TT.MM.JJJJ)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={toInput}
                  onChangeText={v => { setToInput(v); setDateError(''); }}
                  placeholder={formatDateDE(new Date())}
                  placeholderTextColor={c.muted}
                  keyboardType="numeric"
                  onSubmitEditing={applyCustomRange}
                  returnKeyType="done"
                />
              </View>
              {!!dateError && <Text style={styles.modalError}>{dateError}</Text>}
              <View style={styles.modalBtnRow}>
                <Pressable style={styles.modalCancel} onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.modalCancelText}>Abbrechen</Text>
                </Pressable>
                <Pressable style={styles.modalBtn} onPress={applyCustomRange}>
                  <Text style={styles.modalBtnText}>Anwenden</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
