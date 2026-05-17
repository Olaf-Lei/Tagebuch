import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../components/theme';
import { useLayout } from '../hooks/useLayout';
import { getStats, getQualifierTrend, getPreviousPeriodCount, getQualifierStats, getHourDistribution, getWeekdayDistribution, getAvgTextLength, getQualifierByCategory, type Stats, type QualifierTrendSeries, type QualifierDistribution, type QualifierByCat, type PeriodGroupBy } from '../db/stats';
import { EMOJI_PRESETS, qualifierLabel } from '../components/qualifiers';
import { categoryLabel } from '../db/categories';
import { useT } from '../i18n';

// ── Filter ────────────────────────────────────────────────────────────────────

type FilterKey = 'day' | 'week' | 'month' | 'year' | 'custom';

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

function formatPeriodLabel(label: string, locale: string, weekPrefix: string): string {
  if (/^\d{2}:\d{2}$/.test(label)) return label;
  if (/^\d{4}-W\d{2}$/.test(label)) return `${weekPrefix}${label.split('-W')[1]}`;
  if (/^\d{4}-\d{2}$/.test(label)) {
    const [y, m] = label.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const [, m, d] = label.split('-').map(Number);
    return `${d}.${m}.`;
  }
  return label;
}

// ── Trend chart (multi-curve, no SVG) ────────────────────────────────────────

const QUALIFIER_COLORS = ['#C9A84C', '#4CAF50', '#2196F3', '#FF5722', '#9C27B0', '#FF9800'];

function TrendChart({ series, c, noDataLabel }: {
  series: QualifierTrendSeries[];
  c: ReturnType<typeof useColors>;
  noDataLabel: string;
}) {
  const t = useT();
  const [chartWidth, setChartWidth] = useState(0);
  const CHART_H = 130;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 22;
  const INNER_H = CHART_H - PAD_TOP - PAD_BOTTOM;

  const hasAnyData = series.some(s => s.points.some(p => p.avg !== null));
  if (!hasAnyData) {
    return (
      <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', paddingVertical: 24 }}>
        {noDataLabel}
      </Text>
    );
  }

  const allLabels = [...new Set(series.flatMap(s => s.points.map(p => p.label)))].sort();
  const n = Math.max(allLabels.length - 1, 1);
  const toX = (i: number) => (i / n) * chartWidth;
  const toY = (v: number) => PAD_TOP + INNER_H - ((v - 1) / 4) * INNER_H;

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

  const xLabels: { i: number; label: string }[] = [];
  if (allLabels.length >= 1) xLabels.push({ i: 0, label: allLabels[0] });
  if (allLabels.length >= 3) {
    const mid = Math.floor((allLabels.length - 1) / 2);
    xLabels.push({ i: mid, label: allLabels[mid] });
  }
  if (allLabels.length >= 2) xLabels.push({ i: allLabels.length - 1, label: allLabels[allLabels.length - 1] });

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
            {series.map((s, si) => {
              const color = QUALIFIER_COLORS[si % QUALIFIER_COLORS.length];
              const pts = allLabels
                .map((label, i) => {
                  const p = s.points.find(p => p.label === label);
                  return p && p.avg != null ? { i, v: p.avg } : null;
                })
                .filter(Boolean) as { i: number; v: number }[];
              return <React.Fragment key={s.qualifier.id}>{renderCurve(pts, color)}</React.Fragment>;
            })}
            {xLabels.map(({ i, label }) => (
              <Text key={i} style={{
                position: 'absolute',
                left: toX(i) - 22, top: CHART_H - PAD_BOTTOM + 5,
                width: 44, fontSize: 9, color: c.muted, textAlign: 'center',
              }}>{label}</Text>
            ))}
            {[1, 3, 5].map(v => (
              <Text key={v} style={{
                position: 'absolute', left: -18, top: toY(v) - 7,
                width: 16, fontSize: 9, color: c.muted, textAlign: 'right',
              }}>{v}</Text>
            ))}
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 6 }}>
        {series.map((s, si) => {
          if (!s.points.some(p => p.avg != null)) return null;
          const preset = EMOJI_PRESETS[s.qualifier.emoji_preset];
          const color = QUALIFIER_COLORS[si % QUALIFIER_COLORS.length];
          return (
            <View key={s.qualifier.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 14, height: 3, backgroundColor: color, borderRadius: 1.5 }} />
              <Text style={{ fontSize: 11, color: c.muted }}>
                {preset?.icon} {qualifierLabel(s.qualifier.name, s.qualifier.emoji_preset, t)}
              </Text>
            </View>
          );
        })}
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

function Heatmap({ perDay, from, to, c, labelLow, labelHigh }: {
  perDay: Stats['perDay']; from: number; to: number;
  c: ReturnType<typeof useColors>;
  labelLow: string; labelHigh: string;
}) {
  const grid = useMemo(() => buildHeatmapGrid(perDay, from, to), [perDay, from, to]);
  const cellSize = 11; const gap = 2;
  return (
    <>
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
        <Text style={{ fontSize: 10, color: c.muted }}>{labelLow}</Text>
        {[c.border, c.accent + '55', c.accent + '99', c.accent].map((bg, i) => (
          <View key={i} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: bg }} />
        ))}
        <Text style={{ fontSize: 10, color: c.muted }}>{labelHigh}</Text>
      </View>
    </>
  );
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

function BarChart({ items, c, labelWidth = 72 }: {
  items: { label: string; count: number; color?: string | null }[];
  c: ReturnType<typeof useColors>;
  labelWidth?: number;
}) {
  const max = Math.max(...items.map(i => i.count), 1);
  return (
    <View style={{ gap: 6 }}>
      {items.map(({ label, count, color }) => (
        <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{ width: labelWidth, fontSize: 12, color: c.muted, textAlign: 'right' }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >{label}</Text>
          <View style={{ flex: 1, height: 14, backgroundColor: c.border, borderRadius: 7, overflow: 'hidden' }}>
            <View style={{ width: `${(count / max) * 100}%`, height: '100%', backgroundColor: color ?? c.accent, borderRadius: 7 }} />
          </View>
          <Text style={{ width: 28, fontSize: 12, color: c.muted }}>{count}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Mini bar chart (vertikal, für Stunden/Wochentage) ─────────────────────────

function MiniBarChart({ data, xLabels, c, barColor }: {
  data: number[];
  xLabels: (string | null)[];
  c: ReturnType<typeof useColors>;
  barColor: string;
}) {
  const BAR_MAX_H = 56;
  const maxCount = Math.max(...data, 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {data.map((count, i) => {
        const barH = count > 0 ? Math.max((count / maxCount) * BAR_MAX_H, 3) : 0;
        const label = xLabels[i] ?? null;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ height: BAR_MAX_H, justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
              <View style={{
                width: '80%', height: barH,
                backgroundColor: count > 0 ? barColor : 'transparent',
                borderRadius: 2,
              }} />
            </View>
            <Text style={{ fontSize: 8, color: label ? c.muted : 'transparent', marginTop: 3, textAlign: 'center' }}>
              {label ?? '.'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Distribution chart ────────────────────────────────────────────────────────

function DistributionChart({ distributions, c }: {
  distributions: QualifierDistribution[];
  c: ReturnType<typeof useColors>;
}) {
  const t = useT();
  const BAR_MAX_H = 48;
  const hasData = distributions.some(qd => qd.dist.some(v => v > 0));
  if (!hasData) return null;

  return (
    <View style={{ gap: 20 }}>
      {distributions.map((qd, qi) => {
        if (qd.dist.every(v => v === 0)) return null;
        const preset = EMOJI_PRESETS[qd.qualifier.emoji_preset];
        const color = QUALIFIER_COLORS[qi % QUALIFIER_COLORS.length];
        const maxCount = Math.max(...qd.dist, 1);
        return (
          <View key={qd.qualifier.id} style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, color: c.muted, fontWeight: '600' }}>
              {preset?.icon ?? ''}{' '}{qualifierLabel(qd.qualifier.name, qd.qualifier.emoji_preset, t)}
              {qd.avg != null
                ? <Text style={{ color, fontWeight: '700' }}> · Ø {qd.avg.toFixed(1)}</Text>
                : null}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {qd.dist.map((count, i) => {
                const emoji = preset?.emojis[i] ?? String(i + 1);
                const barH = count > 0 ? Math.max((count / maxCount) * BAR_MAX_H, 6) : 0;
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: count > 0 ? c.muted : 'transparent', marginBottom: 3 }}>
                      {count}
                    </Text>
                    <View style={{ height: BAR_MAX_H, justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
                      <View style={{
                        width: '72%', height: barH,
                        backgroundColor: count > 0 ? color : 'transparent',
                        borderRadius: 3, opacity: 0.6 + i * 0.08,
                      }} />
                    </View>
                    <Text style={{ fontSize: 18, marginTop: 4 }}>{emoji}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Qualifier × Kategorie Tabelle ─────────────────────────────────────────────

function QualifierCatTable({ data, c }: {
  data: QualifierByCat[];
  c: ReturnType<typeof useColors>;
}) {
  const t = useT();
  const qualifiers = useMemo(() => {
    const seen = new Map<number, { qualifier_id: number; name: string; emoji_preset: string }>();
    for (const cat of data) {
      for (const qa of cat.qualifierAvgs) {
        if (!seen.has(qa.qualifier_id)) seen.set(qa.qualifier_id, qa);
      }
    }
    return Array.from(seen.values());
  }, [data]);

  if (data.length < 2 || qualifiers.length === 0) return null;

  return (
    <View style={{ gap: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 6, borderBottomWidth: 1, borderColor: c.border }}>
        <View style={{ flex: 2 }} />
        {qualifiers.map(q => {
          const preset = EMOJI_PRESETS[q.emoji_preset];
          return (
            <View key={q.qualifier_id} style={{ flex: 1, alignItems: 'center', gap: 1 }}>
              <Text style={{ fontSize: 14 }}>{preset?.icon}</Text>
              <Text style={{ fontSize: 8, color: c.muted, textAlign: 'center' }} numberOfLines={1}>{qualifierLabel(q.name, q.emoji_preset, t)}</Text>
            </View>
          );
        })}
      </View>
      {data.map((cat, ci) => {
        const avgMap = new Map(cat.qualifierAvgs.map(qa => [qa.qualifier_id, qa.avg]));
        return (
          <View key={cat.category.id} style={{
            flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
            borderBottomWidth: ci < data.length - 1 ? 1 : 0, borderColor: c.border + '44',
          }}>
            <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cat.category.color ?? c.accent }} />
              <Text style={{ fontSize: 12, color: c.text, flex: 1 }} numberOfLines={1}>{categoryLabel(cat.category, t)}</Text>
            </View>
            {qualifiers.map(q => {
              const avg = avgMap.get(q.qualifier_id);
              const preset = EMOJI_PRESETS[q.emoji_preset];
              const emoji = avg != null ? preset?.emojis[Math.min(4, Math.max(0, Math.round(avg) - 1))] : null;
              return (
                <View key={q.qualifier_id} style={{ flex: 1, alignItems: 'center', gap: 1 }}>
                  {emoji != null ? (
                    <>
                      <Text style={{ fontSize: 16 }}>{emoji}</Text>
                      <Text style={{ fontSize: 9, color: c.muted }}>{avg!.toFixed(1)}</Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: 13, color: c.border }}>–</Text>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const c = useColors();
  const t = useT();
  const { isWide, listMaxWidth } = useLayout();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('month');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [dateError, setDateError] = useState('');

  const [stats, setStats] = useState<Stats | null>(null);
  const [trendSeries, setTrendSeries] = useState<QualifierTrendSeries[]>([]);
  const [qualDistributions, setQualDistributions] = useState<QualifierDistribution[]>([]);
  const [hourDist, setHourDist] = useState<number[]>([]);
  const [weekdayDist, setWeekdayDist] = useState<number[]>([]);
  const [avgTextLen, setAvgTextLen] = useState<number | null>(null);
  const [qualByCat, setQualByCat] = useState<QualifierByCat[]>([]);
  const [prevCount, setPrevCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'day', label: t.stats.filterDay },
    { key: 'week', label: t.stats.filterWeek },
    { key: 'month', label: t.stats.filterMonth },
    { key: 'year', label: t.stats.filterYear },
    { key: 'custom', label: t.stats.filterCustom },
  ];

  const range = useMemo(
    () => getRange(activeFilter, customFrom, customTo),
    [activeFilter, customFrom, customTo]
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getStats(range.from, range.to, range.groupBy),
      getQualifierTrend(range.from, range.to, range.trendGroupBy),
      getQualifierStats(range.from, range.to),
      getPreviousPeriodCount(range.from, range.to),
      getHourDistribution(range.from, range.to),
      getWeekdayDistribution(range.from, range.to),
      getAvgTextLength(range.from, range.to),
      getQualifierByCategory(range.from, range.to),
    ]).then(([s, ts, qd, pc, hd, wd, atl, qbc]) => {
      setStats(s);
      setTrendSeries(ts);
      setQualDistributions(qd);
      setPrevCount(pc);
      setHourDist(hd);
      setWeekdayDist(wd);
      setAvgTextLen(atl);
      setQualByCat(qbc);
      setLoading(false);
    });
  }, [range]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, gap: 20, paddingBottom: 40 },
    wideContent: { padding: 16, paddingBottom: 40, flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', alignSelf: 'center', width: '100%' },
    wideBlock: { flexBasis: '47%', flexGrow: 1, minWidth: 320 },
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
    cardDelta: { fontSize: 10, textAlign: 'center', marginTop: -2 },
    qualAvgRow: {
      flexDirection: 'row', backgroundColor: c.surface,
      borderRadius: 12, padding: 12, justifyContent: 'space-around', flexWrap: 'wrap', gap: 8,
    },
    qualAvgItem: { alignItems: 'center', gap: 2, minWidth: 60 },
    section: { fontSize: 11, fontWeight: '700', color: c.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    sectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    tooltipBtn: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9, borderWidth: 1, borderColor: c.border },
    tooltipBtnText: { fontSize: 10, color: c.muted, fontWeight: '600' },
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
    if (!from) { setDateError(t.stats.dateErrorFrom); return; }
    if (!to) { setDateError(t.stats.dateErrorTo); return; }
    if (from > to) { setDateError(t.stats.dateErrorOrder); return; }
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

  const weekPrefix = t.calendar.weekPrefix;

  const periodItems = stats?.perPeriod.map(p => ({
    label: formatPeriodLabel(p.label, t.locale, weekPrefix),
    count: p.count,
  })) ?? [];

  const catItems = stats?.perCategory.map(x => ({ label: categoryLabel(x, t), count: x.count, color: x.color })) ?? [];
  const tagItems = stats?.perTag.map(x => ({ label: `#${x.name}`, count: x.count })) ?? [];

  const qualifierAvgs = useMemo(() =>
    trendSeries
      .map((s, idx) => {
        const validPts = s.points.filter(p => p.avg != null);
        if (!validPts.length) return null;
        const avg = validPts.reduce((sum, p) => sum + p.avg!, 0) / validPts.length;
        return { qualifier: s.qualifier, avg, colorIdx: idx };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
    [trendSeries]
  );

  const prevDelta = stats != null && prevCount != null ? stats.total - prevCount : null;

  const hourLabels = Array.from({ length: 24 }, (_, i) => i % 6 === 0 ? `${i}h` : null);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
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
          <Text style={{ fontSize: 12, color: c.muted }}>{t.stats.changeRange}</Text>
        </Pressable>
      )}

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={c.accent} /></View>
      ) : (
        <ScrollView contentContainerStyle={[isWide ? styles.wideContent : styles.content, isWide && listMaxWidth != null && { maxWidth: listMaxWidth }]}>

          <View style={[styles.cardRow, isWide && { flexBasis: '100%' }]}>
            <View style={styles.card}>
              <Text style={styles.cardNum}>{stats?.total ?? 0}</Text>
              <Text style={styles.cardLabel}>{t.stats.cardEntries}</Text>
              {prevDelta != null && (
                <Text style={[styles.cardDelta, { color: prevDelta > 0 ? '#4CAF50' : prevDelta < 0 ? c.danger : c.muted }]}>
                  {t.stats.comparePrev(prevDelta)}
                </Text>
              )}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardNum}>{stats?.activeDays ?? 0}</Text>
              <Text style={styles.cardLabel}>{t.stats.cardActiveDays}</Text>
            </View>
            {activeFilter !== 'day' && <>
              <View style={styles.card}>
                <Text style={styles.cardNum}>{stats?.currentStreak ?? 0}</Text>
                <Text style={styles.cardLabel}>{t.stats.cardStreak}</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardNum}>{stats?.longestStreak ?? 0}</Text>
                <Text style={styles.cardLabel}>{t.stats.cardRecord}</Text>
              </View>
            </>}
          </View>

          {qualifierAvgs.length > 0 && (
            <View style={[isWide && { flexBasis: '100%' }]}>
              <View style={styles.qualAvgRow}>
                {qualifierAvgs.map(({ qualifier, avg, colorIdx }) => {
                  const preset = EMOJI_PRESETS[qualifier.emoji_preset];
                  const level = Math.min(5, Math.max(1, Math.round(avg)));
                  const emoji = preset?.emojis[level - 1] ?? '–';
                  const color = QUALIFIER_COLORS[colorIdx % QUALIFIER_COLORS.length];
                  return (
                    <View key={qualifier.id} style={styles.qualAvgItem}>
                      <Text style={{ fontSize: 22 }}>{emoji}</Text>
                      <Text style={{ fontSize: 15, fontWeight: '700', color }}>{avg.toFixed(1)}</Text>
                      <Text style={{ fontSize: 10, color: c.muted, textAlign: 'center' }}>{qualifierLabel(qualifier.name, qualifier.emoji_preset, t)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {trendSeries.length > 0 && (
            <View style={isWide && styles.wideBlock}>
              <View style={styles.sectionRow}>
                <Text style={[styles.section, { flex: 1, marginBottom: 0 }]}>{t.stats.sectionQualifiers}</Text>
                <Pressable
                  style={styles.tooltipBtn}
                  onPress={() => Alert.alert(t.tooltips.trendTitle, t.tooltips.trendText)}
                  hitSlop={8}
                >
                  <Text style={styles.tooltipBtnText}>?</Text>
                </Pressable>
              </View>
              <View style={[styles.block, { paddingLeft: 24 }]}>
                <TrendChart series={trendSeries} c={c} noDataLabel={t.stats.noMoodData} />
              </View>
            </View>
          )}

          {qualDistributions.some(qd => qd.dist.some(v => v > 0)) && (
            <View style={isWide && styles.wideBlock}>
              <Text style={styles.section}>{t.stats.sectionQualifierDist}</Text>
              <View style={styles.block}>
                <DistributionChart distributions={qualDistributions} c={c} />
              </View>
            </View>
          )}

          {activeFilter !== 'day' && (
            <View style={isWide && styles.wideBlock}>
              <Text style={styles.section}>{t.stats.sectionActivity}</Text>
              <View style={styles.block}>
                <Heatmap
                  perDay={stats?.perDay ?? []} from={range.from} to={range.to} c={c}
                  labelLow={t.stats.heatmapLow} labelHigh={t.stats.heatmapHigh}
                />
              </View>
            </View>
          )}

          {(hourDist.some(v => v > 0) || avgTextLen != null) && (
            <View style={isWide && styles.wideBlock}>
              <Text style={styles.section}>{t.stats.sectionPattern}</Text>
              <View style={[styles.block, { gap: 16 }]}>
                {avgTextLen != null && stats != null && stats.total > 0 && (
                  <Text style={{ fontSize: 12, color: c.muted }}>
                    {t.stats.labelAvgTextLen}:{' '}
                    <Text style={{ color: c.text, fontWeight: '600' }}>
                      {Math.round(avgTextLen)} {t.stats.labelChars}
                    </Text>
                  </Text>
                )}
                {hourDist.some(v => v > 0) && (
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 11, color: c.muted, fontWeight: '600' }}>{t.stats.labelHourDist}</Text>
                    <MiniBarChart data={hourDist} xLabels={hourLabels} c={c} barColor={c.accent} />
                  </View>
                )}
                {activeFilter !== 'day' && weekdayDist.some(v => v > 0) && (
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 11, color: c.muted, fontWeight: '600' }}>{t.stats.labelWeekdayDist}</Text>
                    <MiniBarChart data={weekdayDist} xLabels={t.calendar.weekdays} c={c} barColor={c.accent} />
                  </View>
                )}
              </View>
            </View>
          )}

          {periodItems.length > 0 && (
            <View style={isWide && styles.wideBlock}>
              <Text style={styles.section}>{t.stats.sectionPerPeriod}</Text>
              <View style={styles.block}>
                <BarChart items={periodItems} c={c} />
              </View>
            </View>
          )}

          {catItems.length > 0 && (
            <View style={isWide && styles.wideBlock}>
              <Text style={styles.section}>{t.stats.sectionCategories}</Text>
              <View style={styles.block}>
                <BarChart items={catItems} c={c} labelWidth={110} />
              </View>
            </View>
          )}

          {qualByCat.length >= 2 && (
            <View style={[isWide && styles.wideBlock, { flexBasis: isWide ? '100%' : undefined }]}>
              <Text style={styles.section}>{t.stats.sectionQualifierByCat}</Text>
              <View style={styles.block}>
                <QualifierCatTable data={qualByCat} c={c} />
              </View>
            </View>
          )}

          {tagItems.length > 0 && (
            <View style={isWide && styles.wideBlock}>
              <Text style={styles.section}>{t.stats.sectionTags}</Text>
              <View style={styles.block}>
                <BarChart items={tagItems} c={c} labelWidth={110} />
              </View>
            </View>
          )}

          {stats?.total === 0 && (
            <Text style={[styles.empty, isWide && { flexBasis: '100%' }]}>{t.stats.noEntries}</Text>
          )}

        </ScrollView>
      )}

      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>{t.stats.datePickerTitle}</Text>
              <View>
                <Text style={styles.modalLabel}>{t.stats.dateFromLabel}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={fromInput}
                  onChangeText={v => { setFromInput(v); setDateError(''); }}
                  placeholder={t.stats.datePlaceholder}
                  placeholderTextColor={c.muted}
                  keyboardType="numeric"
                />
              </View>
              <View>
                <Text style={styles.modalLabel}>{t.stats.dateToLabel}</Text>
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
                  <Text style={styles.modalCancelText}>{t.common.cancel}</Text>
                </Pressable>
                <Pressable style={styles.modalBtn} onPress={applyCustomRange}>
                  <Text style={styles.modalBtnText}>{t.stats.btnApply}</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
