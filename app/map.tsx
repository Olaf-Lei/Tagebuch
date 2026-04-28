import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { useColors } from '../components/theme';
import { getEntriesWithLocation, type LocationEntry } from '../db/entries';
import { useT } from '../i18n';

type DateRange = 'all' | 'today' | 'week' | 'month';

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

export default function MapScreen() {
  const router = useRouter();
  const c = useColors();
  const t = useT();

  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [entries, setEntries] = useState<LocationEntry[]>([]);
  const [ready, setReady] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    segmentedBar: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
    segmented: { flexDirection: 'row', backgroundColor: c.bg, borderRadius: 10, padding: 3 },
    segment: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 8 },
    segmentActive: { backgroundColor: c.accent },
    segmentText: { fontSize: 13, color: c.muted },
    segmentTextActive: { color: '#fff', fontWeight: '600' },
    webview: { flex: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: c.muted, fontSize: 15, textAlign: 'center', paddingHorizontal: 32 },
  }), [c]);

  useEffect(() => {
    setReady(false);
    getEntriesWithLocation(dateRangeTimes(dateRange)).then((rows) => {
      setEntries(rows);
      setReady(true);
    });
  }, [dateRange]);

  const html = useMemo(() => buildMapHtml(entries, c.accent), [entries, c.accent]);

  const DATE_RANGES: { key: DateRange; label: string }[] = [
    { key: 'all', label: t.map.dateAll },
    { key: 'today', label: t.map.dateToday },
    { key: 'week', label: t.map.dateWeek },
    { key: 'month', label: t.map.dateMonth },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: t.nav.map }} />

      <View style={styles.segmentedBar}>
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
    </SafeAreaView>
  );
}
