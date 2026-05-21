import { useRef, useEffect, useCallback } from 'react'

interface Props {
  minTs: number
  maxTs: number
  from: number
  to: number
  onChange: (from: number, to: number) => void
}

function tsToLabel(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`
}

export default function DateRangeSlider({ minTs, maxTs, from, to, onChange }: Props) {
  const railRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<'from' | 'to' | null>(null)

  const span = maxTs - minTs || 1

  const fromPct = Math.max(0, Math.min(100, ((from - minTs) / span) * 100))
  const toPct   = Math.max(0, Math.min(100, ((to   - minTs) / span) * 100))

  const pctToTs = useCallback((clientX: number): number => {
    const rail = railRef.current
    if (!rail) return minTs
    const rect = rail.getBoundingClientRect()
    const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(minTs + pct * span)
  }, [minTs, span])

  const snapToDay = (ts: number) => {
    const d = new Date(ts)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }

  const onMove = useCallback((clientX: number) => {
    if (!dragging.current) return
    const ts = snapToDay(pctToTs(clientX))
    if (dragging.current === 'from') onChange(Math.min(ts, snapToDay(to)), snapToDay(to))
    else                             onChange(snapToDay(from), Math.max(ts, snapToDay(from)))
  }, [pctToTs, from, to, onChange])

  useEffect(() => {
    const mm = (e: MouseEvent)  => onMove(e.clientX)
    const tm = (e: TouchEvent)  => { e.preventDefault(); onMove(e.touches[0].clientX) }
    const up = ()               => { dragging.current = null }
    window.addEventListener('mousemove', mm)
    window.addEventListener('touchmove', tm, { passive: false })
    window.addEventListener('mouseup',   up)
    window.addEventListener('touchend',  up)
    return () => {
      window.removeEventListener('mousemove', mm)
      window.removeEventListener('touchmove', tm)
      window.removeEventListener('mouseup',   up)
      window.removeEventListener('touchend',  up)
    }
  }, [onMove])

  const onRailClick = (e: React.MouseEvent) => {
    if (dragging.current) return
    const ts = snapToDay(pctToTs(e.clientX))
    const distFrom = Math.abs(ts - from)
    const distTo   = Math.abs(ts - to)
    if (distFrom <= distTo) onChange(Math.min(ts, snapToDay(to)), snapToDay(to))
    else                    onChange(snapToDay(from), Math.max(ts, snapToDay(from)))
  }

  // Generate ~6 tick labels
  const ticks: { pct: number; label: string }[] = []
  const count = 6
  for (let i = 0; i <= count; i++) {
    const ts = minTs + (i / count) * span
    ticks.push({ pct: (i / count) * 100, label: tsToLabel(ts) })
  }

  return (
    <div style={{ padding: '4px 12px 0', userSelect: 'none' }}>
      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={lbl}>{tsToLabel(from)}</span>
        <span style={{ ...lbl, color: 'var(--accent)', fontWeight: 700 }}>
          {tsToLabel(from)} – {tsToLabel(to)}
        </span>
        <span style={lbl}>{tsToLabel(to)}</span>
      </div>

      {/* Rail */}
      <div
        ref={railRef}
        onClick={onRailClick}
        style={{ position: 'relative', height: 36, cursor: 'pointer' }}
      >
        {/* Track */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '50%',
          transform: 'translateY(-50%)', height: 4,
          background: 'var(--border)', borderRadius: 2,
        }} />
        {/* Fill */}
        <div style={{
          position: 'absolute', top: '50%', transform: 'translateY(-50%)',
          left: `${fromPct}%`, width: `${toPct - fromPct}%`,
          height: 4, background: 'var(--accent)', borderRadius: 2, opacity: 0.7,
        }} />
        {/* Thumb From */}
        <div
          onMouseDown={e => { dragging.current = 'from'; e.preventDefault(); e.stopPropagation() }}
          onTouchStart={e => { dragging.current = 'from'; e.stopPropagation() }}
          style={{ ...thumb, left: `${fromPct}%` }}
        />
        {/* Thumb To */}
        <div
          onMouseDown={e => { dragging.current = 'to'; e.preventDefault(); e.stopPropagation() }}
          onTouchStart={e => { dragging.current = 'to'; e.stopPropagation() }}
          style={{ ...thumb, left: `${toPct}%` }}
        />
      </div>

      {/* Ticks */}
      <div style={{ position: 'relative', height: 18, marginTop: 2 }}>
        {ticks.map((t, i) => (
          <span key={i} style={{
            position: 'absolute', left: `${t.pct}%`, transform: 'translateX(-50%)',
            fontSize: 10, color: 'var(--text2)', whiteSpace: 'nowrap',
          }}>{t.label}</span>
        ))}
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { fontSize: 11, color: 'var(--text2)' }

const thumb: React.CSSProperties = {
  position: 'absolute', top: '50%',
  transform: 'translate(-50%, -50%)',
  width: 20, height: 20, borderRadius: '50%',
  background: 'var(--accent)', border: '2px solid var(--surface)',
  boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
  cursor: 'grab', zIndex: 2, touchAction: 'none',
}
