import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { useColors } from '../components/theme';
import { EMOJI_PRESETS } from '../components/qualifiers';
import { getEntriesWithLocation, type LocationEntry } from '../db/entries';
import { getCategories, type Category } from '../db/categories';
import { getActiveQualifiers, type Qualifier } from '../db/qualifiers';
import { useT } from '../i18n';

type DateRange = 'all' | 'today' | 'week' | 'month';

interface QualifierFilter {
  qualifierId: number;
  minValue: number;
  maxValue: number;
}

function dateRangeTimes(range: DateRange): { startTime?: number; endTime?: number } {
  const now = new Date();
  if (range === 'today') {
    return { startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() };
  }
  if (range === 'week') {
    const dow = (now.getDay() + 6) % 7;
    return { startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow).getTime() };
  }
  if (range === 'month') {
    return { startTime: new Date(now.getFullYear(), now.getMonth(), 1).getTime() };
  }
  return {};
}

function buildMapHtml(entries: LocationEntry[], accent: string): string {
  const markers = entries.map((e) => ({
    id: e.id,
    lat: e.latitude,
    lng: e.longitude,
    date: new Date(e.timestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    preview: e.text.length > 60 ? e.text.slice(0, 60) + '…' : e.text,
    location: e.locationName ?? '',
  }));

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; }
  .leaflet-popup-content-wrapper {
    background: #1A2D47;
    color: #fff;
    border-radius: 10px;
    border: 1px solid #2A3F5A;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
  }
  .leaflet-popup-tip { background: #1A2D47; }
  .leaflet-popup-content { margin: 10px 14px; }
  .popup-date { font-size: 11px; color: ${accent}; font-weight: 600; margin-bottom: 4px; }
  .popup-loc { font-size: 11px; color: #8A9BB0; margin-bottom: 6px; }
  .popup-text { font-size: 13px; color: #fff; line-height: 1.4; margin-bottom: 8px; }
  .popup-btn {
    display: block; width: 100%;
    background: ${accent}; color: #fff;
    border: none; border-radius: 6px;
    padding: 6px 0; font-size: 13px; font-weight: 600;
    cursor: pointer; text-align: center;
  }
  .marker-cluster-small, .marker-cluster-medium, .marker-cluster-large {
    background-color: rgba(201,168,76,0.3);
  }
  .marker-cluster-small div, .marker-cluster-medium div, .marker-cluster-large div {
    background-color: ${accent};
    color: #fff;
    font-weight: 700;
  }
</style>
</head>
<body>
<div id="map"></div>
<script>
  const entries = ${JSON.stringify(markers)};
  const map = L.map('map', { zoomControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(map);

  const icon = L.divIcon({
    className: '',
    html: '<div style="width:14px;height:14px;border-radius:50%;background:${accent};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  const cluster = L.markerClusterGroup({ maxClusterRadius: 40 });

  entries.forEach(function(e) {
    const marker = L.marker([e.lat, e.lng], { icon: icon });
    const loc = e.location ? '<div class="popup-loc">📍 ' + e.location + '</div>' : '';
    marker.bindPopup(
      '<div class="popup-date">' + e.date + '</div>' +
      loc +
      '<div class="popup-text">' + e.preview + '</div>' +
      '<button class="popup-btn" onclick="openEntry(' + e.id + ')">Öffnen →</button>',
      { maxWidth: 240, minWidth: 180 }
    );
    cluster.addLayer(marker);
  });

  map.addLayer(cluster);

  if (entries.length > 0) {
    map.fitBounds(cluster.getBounds(), { padding: [40, 40], maxZoom: 14 });
  } else {
    map.setView([51.1657, 10.4515], 6);
  }

  function openEntry(id) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'open', id: id }));
  }
</script>
</body>
</html>`;
}

// ── Filter Modal ──────────────────────────────────────────────────────────────

function FilterModal({
  visible,
  categories,
  qualifiers,
  pendingCategoryIds,
  pendingQualifierFilter,
  onToggleCategory,
  onSelectQualifier,
  onSetMin,
  onSetMax,
  onReset,
  onApply,
  onClose,
  c,
  t,
}: {
  visible: boolean;
  categories: Category[];
  qualifiers: Qualifier[];
  pendingCategoryIds: number[];
  pendingQualifierFilter: QualifierFilter | null;
  onToggleCategory: (id: number) => void;
  onSelectQualifier: (id: number | null) => void;
  onSetMin: (v: number) => void;
  onSetMax: (v: number) => void;
  onReset: () => void;
  onApply: () => void;
  onClose: () => void;
  c: ReturnType<typeof useColors>;
  t: ReturnType<typeof useT>;
}) {
  const selectedQualifier = pendingQualifierFilter
    ? qualifiers.find(q => q.id === pendingQualifierFilter.qualifierId)
    : null;

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: {
      backgroundColor: c.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18,
      padding: 20, paddingBottom: 36, gap: 18,
    },
    title: { fontSize: 17, fontWeight: '700', color: c.text },
    sectionLabel: { fontSize: 11, fontWeight: '700', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
    chipActive: { borderColor: 'transparent' },
    chipText: { fontSize: 13, color: c.text },
    emojiRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
    emojiBtn: {
      width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
    },
    emojiBtnActive: { backgroundColor: c.accent, borderColor: c.accent },
    emojiText: { fontSize: 22 },
    rangeLabel: { fontSize: 12, color: c.muted, marginBottom: 4, marginTop: 4 },
    btnRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
    btnReset: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 14, alignItems: 'center' },
    btnResetText: { color: c.muted, fontSize: 15 },
    btnApply: { flex: 1, backgroundColor: c.accent, borderRadius: 12, padding: 14, alignItems: 'center' },
    btnApplyText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  }), [c]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={e => e.stopPropagation()}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{t.map.filterBtn}</Text>

            {categories.length > 0 && (
              <View>
                <Text style={styles.sectionLabel}>{t.map.filterCategories}</Text>
                <View style={styles.chipRow}>
                  {categories.map(cat => {
                    const active = pendingCategoryIds.includes(cat.id);
                    const bg = active ? (cat.color ?? c.accent) : undefined;
                    return (
                      <Pressable
                        key={cat.id}
                        style={[styles.chip, active && styles.chipActive, active && { backgroundColor: bg }]}
                        onPress={() => onToggleCategory(cat.id)}
                      >
                        <Text style={[styles.chipText, active && { color: '#fff', fontWeight: '600' }]}>
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {qualifiers.length > 0 && (
              <View>
                <Text style={styles.sectionLabel}>{t.map.filterQualifier}</Text>
                <View style={[styles.chipRow, { marginBottom: 10 }]}>
                  <Pressable
                    style={[styles.chip, !pendingQualifierFilter && styles.chipActive, !pendingQualifierFilter && { backgroundColor: c.accent }]}
                    onPress={() => onSelectQualifier(null)}
                  >
                    <Text style={[styles.chipText, !pendingQualifierFilter && { color: '#fff', fontWeight: '600' }]}>
                      {t.map.filterQualifierNone}
                    </Text>
                  </Pressable>
                  {qualifiers.map(q => {
                    const preset = EMOJI_PRESETS[q.emoji_preset];
                    const active = pendingQualifierFilter?.qualifierId === q.id;
                    return (
                      <Pressable
                        key={q.id}
                        style={[styles.chip, active && styles.chipActive, active && { backgroundColor: c.accent }]}
                        onPress={() => onSelectQualifier(q.id)}
                      >
                        <Text style={[styles.chipText, active && { color: '#fff', fontWeight: '600' }]}>
                          {preset?.icon} {q.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {pendingQualifierFilter && selectedQualifier && (() => {
                  const preset = EMOJI_PRESETS[selectedQualifier.emoji_preset];
                  return (
                    <View style={{ gap: 4 }}>
                      <Text style={styles.rangeLabel}>{t.map.filterQualifierMin}</Text>
                      <View style={styles.emojiRow}>
                        {[1, 2, 3, 4, 5].map(v => {
                          const active = pendingQualifierFilter.minValue === v;
                          const inRange = v >= pendingQualifierFilter.minValue && v <= pendingQualifierFilter.maxValue;
                          return (
                            <Pressable
                              key={v}
                              style={[styles.emojiBtn, active && styles.emojiBtnActive, !active && inRange && { borderColor: c.accent }]}
                              onPress={() => onSetMin(v)}
                            >
                              <Text style={[styles.emojiText, { opacity: inRange ? 1 : 0.3 }]}>
                                {preset?.emojis[v - 1] ?? String(v)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text style={styles.rangeLabel}>{t.map.filterQualifierMax}</Text>
                      <View style={styles.emojiRow}>
                        {[1, 2, 3, 4, 5].map(v => {
                          const active = pendingQualifierFilter.maxValue === v;
                          const inRange = v >= pendingQualifierFilter.minValue && v <= pendingQualifierFilter.maxValue;
                          return (
                            <Pressable
                              key={v}
                              style={[styles.emojiBtn, active && styles.emojiBtnActive, !active && inRange && { borderColor: c.accent }]}
                              onPress={() => onSetMax(v)}
                            >
                              <Text style={[styles.emojiText, { opacity: inRange ? 1 : 0.3 }]}>
                                {preset?.emojis[v - 1] ?? String(v)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })()}
              </View>
            )}

            <View style={styles.btnRow}>
              <Pressable style={styles.btnReset} onPress={onReset}>
                <Text style={styles.btnResetText}>{t.map.filterReset}</Text>
              </Pressable>
              <Pressable style={styles.btnApply} onPress={onApply}>
                <Text style={styles.btnApplyText}>{t.map.filterApply}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const router = useRouter();
  const c = useColors();
  const t = useT();

  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [entries, setEntries] = useState<LocationEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [qualifierFilter, setQualifierFilter] = useState<QualifierFilter | null>(null);

  const [pendingCategoryIds, setPendingCategoryIds] = useState<number[]>([]);
  const [pendingQualifierFilter, setPendingQualifierFilter] = useState<QualifierFilter | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [qualifiers, setQualifiers] = useState<Qualifier[]>([]);

  useEffect(() => {
    getCategories().then(setCategories);
    getActiveQualifiers().then(setQualifiers);
  }, []);

  useEffect(() => {
    setReady(false);
    getEntriesWithLocation({
      ...dateRangeTimes(dateRange),
      categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
      qualifierFilter: qualifierFilter ?? undefined,
    }).then((rows) => {
      setEntries(rows);
      setReady(true);
    });
  }, [dateRange, selectedCategoryIds, qualifierFilter]);

  const filterCount = (selectedCategoryIds.length > 0 ? 1 : 0) + (qualifierFilter ? 1 : 0);

  const openFilter = () => {
    setPendingCategoryIds(selectedCategoryIds);
    setPendingQualifierFilter(qualifierFilter);
    setShowFilter(true);
  };

  const applyFilter = () => {
    setSelectedCategoryIds(pendingCategoryIds);
    setQualifierFilter(pendingQualifierFilter);
    setShowFilter(false);
  };

  const resetFilter = () => {
    setPendingCategoryIds([]);
    setPendingQualifierFilter(null);
  };

  const toggleCategory = (id: number) => {
    setPendingCategoryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectQualifier = (id: number | null) => {
    if (id === null) {
      setPendingQualifierFilter(null);
    } else if (pendingQualifierFilter?.qualifierId === id) {
      setPendingQualifierFilter(null);
    } else {
      setPendingQualifierFilter({ qualifierId: id, minValue: 1, maxValue: 5 });
    }
  };

  const setMin = (v: number) => {
    setPendingQualifierFilter(f => f ? { ...f, minValue: v, maxValue: Math.max(f.maxValue, v) } : f);
  };

  const setMax = (v: number) => {
    setPendingQualifierFilter(f => f ? { ...f, maxValue: v, minValue: Math.min(f.minValue, v) } : f);
  };

  const html = useMemo(() => buildMapHtml(entries, c.accent), [entries, c.accent]);

  const DATE_RANGES: { key: DateRange; label: string }[] = [
    { key: 'all', label: t.map.dateAll },
    { key: 'today', label: t.map.dateToday },
    { key: 'week', label: t.map.dateWeek },
    { key: 'month', label: t.map.dateMonth },
  ];

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    headerBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: 8,
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    segmented: { flex: 1, flexDirection: 'row', backgroundColor: c.bg, borderRadius: 10, padding: 3 },
    segment: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 8 },
    segmentActive: { backgroundColor: c.accent },
    segmentText: { fontSize: 13, color: c.muted },
    segmentTextActive: { color: '#fff', fontWeight: '600' },
    filterBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: 20, borderWidth: 1,
      borderColor: filterCount > 0 ? c.accent : c.border,
      backgroundColor: filterCount > 0 ? c.accent + '22' : 'transparent',
    },
    filterBtnText: { fontSize: 13, fontWeight: '600', color: filterCount > 0 ? c.accent : c.muted },
    filterBadge: {
      backgroundColor: c.accent, borderRadius: 8,
      minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 4,
    },
    filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    webview: { flex: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: c.muted, fontSize: 15, textAlign: 'center', paddingHorizontal: 32 },
  }), [c, filterCount]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: t.nav.map }} />

      <View style={styles.headerBar}>
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
        <Pressable style={styles.filterBtn} onPress={openFilter}>
          <Text style={styles.filterBtnText}>{t.map.filterBtn}</Text>
          {filterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{filterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {ready && entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t.map.noEntries}</Text>
        </View>
      ) : (
        <WebView
          style={styles.webview}
          source={{ html }}
          originWhitelist={['*']}
          javaScriptEnabled
          onMessage={(e) => {
            try {
              const msg = JSON.parse(e.nativeEvent.data);
              if (msg.type === 'open') router.push(`/entry/${msg.id}`);
            } catch {}
          }}
        />
      )}

      <FilterModal
        visible={showFilter}
        categories={categories}
        qualifiers={qualifiers}
        pendingCategoryIds={pendingCategoryIds}
        pendingQualifierFilter={pendingQualifierFilter}
        onToggleCategory={toggleCategory}
        onSelectQualifier={selectQualifier}
        onSetMin={setMin}
        onSetMax={setMax}
        onReset={resetFilter}
        onApply={applyFilter}
        onClose={() => setShowFilter(false)}
        c={c}
        t={t}
      />
    </SafeAreaView>
  );
}
