import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'

async function nominatimReverse(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'de' } }
    )
    const d = await r.json()
    return (
      d.address?.city ?? d.address?.town ?? d.address?.village ??
      d.address?.suburb ?? d.address?.county ??
      `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    )
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}

interface Props {
  initialLat?: number | null
  initialLng?: number | null
  onSelect: (lat: number, lng: number, name: string) => void
  onClose: () => void
}

export function LocationPickerModal({ initialLat, initialLng, onSelect, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null
  )
  const [geocoding, setGeocoding] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current).setView(
      [initialLat ?? 51.1657, initialLng ?? 10.4515],
      initialLat != null ? 13 : 6
    )
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map)

    const icon = L.divIcon({
      className: '',
      html: '<div style="width:22px;height:22px;border-radius:50%;background:#C9A84C;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    })

    if (initialLat != null && initialLng != null) {
      markerRef.current = L.marker([initialLat, initialLng], { icon }).addTo(map)
    }

    map.on('click', (e) => {
      const { lat, lng } = e.latlng
      if (markerRef.current) markerRef.current.setLatLng(e.latlng)
      else markerRef.current = L.marker(e.latlng, { icon }).addTo(map)
      setPending({ lat, lng })
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  async function handleConfirm() {
    if (!pending) return
    setGeocoding(true)
    const name = await nominatimReverse(pending.lat, pending.lng)
    setGeocoding(false)
    onSelect(pending.lat, pending.lng, name)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 14, cursor: 'pointer', padding: 4 }}>
          ✕ Abbrechen
        </button>
        <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>Ort wählen</span>
        <button
          onClick={handleConfirm}
          disabled={!pending || geocoding}
          style={{ background: 'none', border: 'none', fontSize: 14, fontWeight: 700, cursor: pending && !geocoding ? 'pointer' : 'default', color: pending && !geocoding ? 'var(--accent)' : 'var(--text2)', padding: 4 }}
        >
          {geocoding ? '…' : 'Übernehmen'}
        </button>
      </div>
      {!pending && (
        <div style={{ position: 'absolute', top: 58, left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(15,27,45,0.88)', color: '#fff', padding: '6px 16px', borderRadius: 20, fontSize: 13, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          Auf Karte klicken, um Ort zu wählen
        </div>
      )}
      <div ref={containerRef} style={{ flex: 1 }} />
    </div>
  )
}
