import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { useColors } from './theme';
import { useT } from '../i18n';
import { reverseGeocode } from '../utils/location';

interface Props {
  visible: boolean;
  initialLat?: number;
  initialLng?: number;
  onSelect: (lat: number, lng: number, name: string) => void;
  onClose: () => void;
}

function buildPickerHtml(lat: number, lng: number, zoom: number, accent: string): string {
  const markerInit = zoom > 6
    ? `marker=L.marker([${lat},${lng}],{icon:icon}).addTo(map);`
    : '';
  return `<!DOCTYPE html><html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{width:100%;height:100%}
#hint{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:1000;
background:rgba(15,27,45,0.88);color:#fff;padding:6px 16px;border-radius:20px;
font-size:14px;pointer-events:none;white-space:nowrap}
.leaflet-control-zoom a{background:#1A2D47!important;color:${accent}!important;border:1px solid #2A3F5A!important}
</style>
</head><body>
<div id="hint">Auf Karte tippen</div>
<div id="map"></div>
<script>
var acc='${accent}';
var map=L.map('map',{zoomControl:true}).setView([${lat},${lng}],${zoom});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
var icon=L.divIcon({className:'',html:'<div style="width:22px;height:22px;border-radius:50%;background:'+acc+';border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>',iconSize:[22,22],iconAnchor:[11,11]});
var marker=null;
${markerInit}
map.on('click',function(e){
  if(marker)marker.setLatLng(e.latlng);
  else marker=L.marker(e.latlng,{icon:icon}).addTo(map);
  document.getElementById('hint').style.display='none';
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'pick',lat:e.latlng.lat,lng:e.latlng.lng}));
});
</script></body></html>`;
}

export function LocationPickerModal({ visible, initialLat, initialLng, onSelect, onClose }: Props) {
  const c = useColors();
  const t = useT();
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (visible) {
      setPending(initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null);
    }
  }, [visible, initialLat, initialLng]);

  const centerLat = initialLat ?? 51.1657;
  const centerLng = initialLng ?? 10.4515;
  const zoom = initialLat != null ? 13 : 6;
  const html = useMemo(
    () => buildPickerHtml(centerLat, centerLng, zoom, c.accent),
    [centerLat, centerLng, zoom, c.accent]
  );

  async function handleConfirm() {
    if (!pending) return;
    setGeocoding(true);
    const name = await reverseGeocode(pending.lat, pending.lng);
    setGeocoding(false);
    onSelect(pending.lat, pending.lng, name);
  }

  function handleMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'pick') setPending({ lat: msg.lat, lng: msg.lng });
    } catch {}
  }

  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    title: { fontSize: 16, fontWeight: '700', color: c.text },
    cancelBtn: { fontSize: 14, color: c.muted, minWidth: 72 },
    confirmBtn: { fontSize: 14, fontWeight: '700', minWidth: 72, textAlign: 'right' },
  }), [c]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.cancelBtn}>{t.common.cancel}</Text>
          </Pressable>
          <Text style={styles.title}>{t.entry.locationPickerTitle}</Text>
          {geocoding
            ? <ActivityIndicator size="small" color={c.accent} style={{ minWidth: 72 }} />
            : (
              <Pressable onPress={handleConfirm} disabled={!pending} hitSlop={12}>
                <Text style={[styles.confirmBtn, { color: pending ? c.accent : c.muted }]}>
                  {t.entry.locationPickerConfirm}
                </Text>
              </Pressable>
            )
          }
        </View>
        <WebView
          style={{ flex: 1 }}
          source={{ html }}
          onMessage={handleMessage}
          javaScriptEnabled
          originWhitelist={['*']}
        />
      </SafeAreaView>
    </Modal>
  );
}
