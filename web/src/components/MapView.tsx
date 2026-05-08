import { useEffect, useRef, useMemo, useState } from 'react'
import L from 'leaflet'
import type { Entry } from '../types'
import { getEntriesWithLocation, getCategories, getQualifiers, type LocationFilter } from '../db/database'
import type { Category, Qualifier } from '../types'

const EMOJI_PRESETS: Record<string, { icon: string; emojis: string[] }> = {
  mood:   { icon: '🌤️', emojis: ['😢','😕','😐','🙂','😄'] },
  health: { icon: '💪', emojis: ['🤒','🤧','😐','😊','💪'] },
  sleep:  { icon: '💤', emojis: ['😫','😪','😑','😌','🌟'] },
  energy: { icon: '⚡', emojis: ['🪫','😩','🌀','⚡','🚀'] },
  pain:   { icon: '🩹', emojis: ['😖','😣','😬','😌','✅'] },
  stress: { icon: '🧘', emojis: ['🤯','😤','😬','😌','🧘'] },
}

type Period = 'week' | 'month' | 'year' | 'all'

function periodRange(p: Period) {
  const now = Date.now()
  const day = 86400_000
  if (p === 'week')  return { from: now - 7 * day, to: now }
  if (p === 'month') return { from: now - 30 * day, to: now }
  if (p === 'year')  return { from: now - 365 * day, to: now }
  return { from: 0, to: Number.MAX_SAFE_INTEGER }
}

const periodLabel: Record<Period, string> = { week: '7 Tage', month: '30 Tage', year: '365 Tage', all: 'Gesamt' }

interface QualifierFilter { qualifierId: number; minValue: number; maxValue: number }

export default function MapView({ onOpenEntry }: { onOpenEntry: (id: number) => void }) {
  const [period, setPeriod] = useState<Period>('all')
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  const [qualifierFilter, setQualifierFilter] = useState<QualifierFilter | null>(null)

  const [pendingCategoryIds, setPendingCategoryIds] = useState<number[]>([])
  const [pendingQualifierFilter, setPendingQualifierFilter] = useState<QualifierFilter | null>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [qualifiers, setQualifiers] = useState<Qualifier[]>([])

  const filter: LocationFilter = useMemo(() => ({
    ...periodRange(period),
    categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
    qualifierFilter: qualifierFilter ?? undefined,
  }), [period, selectedCategoryIds, qualifierFilter])

  const entries = useMemo(() => getEntriesWithLocation(filter), [filter])

  const mapDiv = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.CircleMarker[]>([])

  useEffect(() => {
    setCategories(getCategories())
    setQualifiers(getQualifiers())
  }, [])

  useEffect(() => {
    if (!mapDiv.current) return
    const map = L.map(mapDiv.current, { zoomControl: true }).setView([51.3, 10.5], 6)
    mapRef.current = map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map)
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    const bounds: [number, number][] = []

    entries.forEach((entry: Entry) => {
      if (entry.latitude == null || entry.longitude == null) return
      const lat = entry.latitude, lon = entry.longitude
      bounds.push([lat, lon])

      const date = new Date(entry.timestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const preview = entry.text.length > 100 ? entry.text.slice(0, 100) + '…' : entry.text
      const loc = entry.location_name ? `<br><small style="color:#8A9BB0">📍 ${entry.location_name}</small>` : ''

      const marker = L.circleMarker([lat, lon], {
        radius: 9, fillColor: '#C9A84C', color: '#0F1B2D', weight: 2, fillOpacity: 0.9
      })
        .addTo(map)
        .bindPopup(
          `<div style="max-width:220px;font-family:inherit">` +
          `<div style="font-size:12px;color:#8A9BB0;margin-bottom:4px">${date}${loc}</div>` +
          `<div style="font-size:14px;line-height:1.4">${preview}</div>` +
          `<button onclick="window.__tagebuchOpenEntry(${entry.id})" style="margin-top:8px;background:#C9A84C;border:none;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:13px;font-weight:700">Öffnen</button>` +
          `</div>`,
          { maxWidth: 240 }
        )
      markersRef.current.push(marker)
    })

    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 14 })
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 13)
    }
  }, [entries])

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__tagebuchOpenEntry = (id: number) => {
      onOpenEntry(id)
      mapRef.current?.closePopup()
    }
    return () => { delete (window as unknown as Record<string, unknown>).__tagebuchOpenEntry }
  }, [onOpenEntry])

  const filterCount = (selectedCategoryIds.length > 0 ? 1 : 0) + (qualifierFilter ? 1 : 0)

  const openFilter = () => {
    setPendingCategoryIds(selectedCategoryIds)
    setPendingQualifierFilter(qualifierFilter)
    setShowFilterPanel(true)
  }

  const applyFilter = () => {
    setSelectedCategoryIds(pendingCategoryIds)
    setQualifierFilter(pendingQualifierFilter)
    setShowFilterPanel(false)
  }

  const resetFilter = () => {
    setPendingCategoryIds([])
    setPendingQualifierFilter(null)
  }

  const toggleCategory = (id: number) => {
    setPendingCategoryIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const selectQualifier = (id: number | null) => {
    if (id === null || pendingQualifierFilter?.qualifierId === id) {
      setPendingQualifierFilter(null)
    } else {
      setPendingQualifierFilter({ qualifierId: id, minValue: 1, maxValue: 5 })
    }
  }

  const setMin = (v: number) => {
    setPendingQualifierFilter(f => f ? { ...f, minValue: v, maxValue: Math.max(f.maxValue, v) } : f)
  }

  const setMax = (v: number) => {
    setPendingQualifierFilter(f => f ? { ...f, maxValue: v, minValue: Math.min(f.minValue, v) } : f)
  }

  const selectedQualifier = pendingQualifierFilter
    ? qualifiers.find(q => q.id === pendingQualifierFilter.qualifierId)
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', position: 'relative' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', flexWrap: 'wrap', background: 'var(--bg)', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
        {(['week','month','year','all'] as Period[]).map(p => (
          <button key={p}
            style={{ border: '1px solid var(--accent)', borderRadius: 20, padding: '5px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                     background: period === p ? 'var(--accent)' : 'transparent', color: period === p ? '#0F1B2D' : 'var(--text2)' }}
            onClick={() => setPeriod(p)}>
            {periodLabel[p]}
          </button>
        ))}

        <button
          onClick={openFilter}
          style={{
            border: `1px solid ${filterCount > 0 ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 20, padding: '5px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: filterCount > 0 ? 'rgba(201,168,76,0.15)' : 'transparent',
            color: filterCount > 0 ? 'var(--accent)' : 'var(--text2)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
          Filter
          {filterCount > 0 && (
            <span style={{ background: 'var(--accent)', color: '#0F1B2D', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>
              {filterCount}
            </span>
          )}
        </button>

        <span style={{ color: 'var(--text2)', fontSize: 13, marginLeft: 4 }}>
          {entries.length} Standort{entries.length !== 1 ? 'e' : ''}
        </span>
      </div>

      {/* Filter-Panel */}
      {showFilterPanel && (
        <div style={{
          position: 'absolute', top: 52, left: 0, right: 0, zIndex: 1000,
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>

          {categories.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Kategorien
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {categories.map(cat => {
                  const active = pendingCategoryIds.includes(cat.id)
                  return (
                    <button key={cat.id} onClick={() => toggleCategory(cat.id)}
                      style={{
                        border: `1px solid ${active ? 'transparent' : 'var(--border)'}`,
                        borderRadius: 20, padding: '5px 14px', fontSize: 13, cursor: 'pointer',
                        background: active ? (cat.color ?? 'var(--accent)') : 'transparent',
                        color: active ? '#fff' : 'var(--text)',
                        fontWeight: active ? 600 : 400,
                      }}>
                      {cat.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {qualifiers.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Bewertung
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <button onClick={() => selectQualifier(null)}
                  style={{
                    border: `1px solid ${!pendingQualifierFilter ? 'transparent' : 'var(--border)'}`,
                    borderRadius: 20, padding: '5px 14px', fontSize: 13, cursor: 'pointer',
                    background: !pendingQualifierFilter ? 'var(--accent)' : 'transparent',
                    color: !pendingQualifierFilter ? '#0F1B2D' : 'var(--text2)', fontWeight: 600,
                  }}>
                  Keine
                </button>
                {qualifiers.map(q => {
                  const preset = EMOJI_PRESETS[q.emoji_preset]
                  const active = pendingQualifierFilter?.qualifierId === q.id
                  return (
                    <button key={q.id} onClick={() => selectQualifier(q.id)}
                      style={{
                        border: `1px solid ${active ? 'transparent' : 'var(--border)'}`,
                        borderRadius: 20, padding: '5px 14px', fontSize: 13, cursor: 'pointer',
                        background: active ? 'var(--accent)' : 'transparent',
                        color: active ? '#0F1B2D' : 'var(--text)', fontWeight: active ? 600 : 400,
                      }}>
                      {preset?.icon} {q.name}
                    </button>
                  )
                })}
              </div>

              {pendingQualifierFilter && selectedQualifier && (() => {
                const preset = EMOJI_PRESETS[selectedQualifier.emoji_preset]
                return (
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    {(['Von', 'Bis'] as const).map(label => {
                      const isMin = label === 'Von'
                      const current = isMin ? pendingQualifierFilter.minValue : pendingQualifierFilter.maxValue
                      return (
                        <div key={label}>
                          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>{label}</div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {[1,2,3,4,5].map(v => {
                              const inRange = v >= pendingQualifierFilter.minValue && v <= pendingQualifierFilter.maxValue
                              const active = current === v
                              return (
                                <button key={v}
                                  onClick={() => isMin ? setMin(v) : setMax(v)}
                                  style={{
                                    width: 44, height: 44, borderRadius: 22, border: `2px solid ${active ? 'var(--accent)' : inRange ? 'var(--accent)' : 'var(--border)'}`,
                                    background: active ? 'var(--accent)' : 'transparent',
                                    cursor: 'pointer', fontSize: 22,
                                    opacity: inRange ? 1 : 0.3,
                                    transition: 'opacity 0.15s',
                                  }}>
                                  {preset?.emojis[v - 1] ?? v}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={resetFilter}
              style={{ flex: 1, padding: '10px', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', background: 'transparent', color: 'var(--text2)', fontSize: 14 }}>
              Zurücksetzen
            </button>
            <button onClick={applyFilter}
              style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 10, cursor: 'pointer', background: 'var(--accent)', color: '#0F1B2D', fontSize: 14, fontWeight: 700 }}>
              Anwenden
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <p style={{ color: 'var(--text2)', textAlign: 'center', marginTop: 60, fontSize: 14, position: 'absolute', width: '100%', pointerEvents: 'none', zIndex: 1 }}>
          Keine Einträge mit Standort im gewählten Zeitraum.
        </p>
      )}
      <div ref={mapDiv} style={{ flex: 1 }} />
    </div>
  )
}
