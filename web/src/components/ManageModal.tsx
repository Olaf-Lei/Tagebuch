import { useState, useEffect } from 'react'
import type { Category, Tag, Qualifier } from '../types'
import {
  getCategories, getTags, getAllQualifiers, getCategoryQualifierMap,
  createCategory, updateCategory, deleteCategory,
  createTag, updateTag, deleteTag,
  createQualifier, updateQualifier, setQualifierActive, deleteQualifier,
  setCategoryQualifiers,
} from '../db/database'

const EMOJI_PRESETS: Record<string, { label: string; icon: string; emojis: string[] }> = {
  mood:   { label: 'Laune',    icon: '🌤️', emojis: ['😢', '😕', '😐', '🙂', '😄'] },
  health: { label: 'Befinden', icon: '💪',  emojis: ['🤒', '🤧', '😐', '😊', '💪'] },
  sleep:  { label: 'Schlaf',   icon: '💤',  emojis: ['😫', '😪', '😑', '😌', '🌟'] },
  energy: { label: 'Energie',  icon: '⚡',  emojis: ['🪫', '😩', '🌀', '⚡', '🚀'] },
  pain:   { label: 'Schmerz',  icon: '🩹',  emojis: ['😖', '😣', '😬', '😌', '✅'] },
  stress: { label: 'Stress',   icon: '🧘',  emojis: ['🤯', '😤', '😬', '😌', '🧘'] },
}

function getEmojisForPreset(emojiPreset: string): string[] {
  if (EMOJI_PRESETS[emojiPreset]) return EMOJI_PRESETS[emojiPreset].emojis
  try {
    const arr = JSON.parse(emojiPreset)
    if (Array.isArray(arr) && arr.length === 5) return arr
  } catch {}
  return ['❓', '❓', '❓', '❓', '❓']
}

function getIconForPreset(emojiPreset: string): string {
  if (EMOJI_PRESETS[emojiPreset]) return EMOJI_PRESETS[emojiPreset].icon
  try {
    const arr = JSON.parse(emojiPreset)
    if (Array.isArray(arr) && arr.length === 5) return arr[2]
  } catch {}
  return '⭐'
}

const COLOR_PALETTE = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#C77DFF','#FF9F45','#06D6A0','#EF476F','#118AB2','#FFB703','#A8DADC','#E9C46A']

interface Props {
  onClose: () => void
  onChanged: () => void
}

type Tab = 'categories' | 'tags' | 'qualifiers'

export default function ManageModal({ onClose, onChanged }: Props) {
  const [tab, setTab] = useState<Tab>('categories')
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [qualifiers, setQualifiers] = useState<Qualifier[]>([])
  const [catQualMap, setCatQualMap] = useState<Record<number, number[]>>({})

  function reload() {
    setCategories(getCategories())
    setTags(getTags())
    setQualifiers(getAllQualifiers())
    setCatQualMap(getCategoryQualifierMap())
  }

  useEffect(() => { reload() }, [])

  function commit(fn: () => void) {
    fn()
    reload()
    onChanged()
  }

  const s: Record<string, React.CSSProperties> = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    modal: { background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' },
    tabs: { display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px', gap: 4 },
    tab: { padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
    body: { flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 },
    row: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg)', borderRadius: 10 },
    nameText: { flex: 1, fontSize: 14, color: 'var(--text)' },
    iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '2px 6px', color: 'var(--text2)' },
    addRow: { display: 'flex', gap: 8 },
    input: { flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: 'var(--text)' },
    btn: { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
    btnSmall: { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
    btnDanger: { background: 'var(--error,#FF3B30)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
    colorDot: { width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: '1px solid var(--border)' },
    select: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14, color: 'var(--text)', cursor: 'pointer' },
    subPanel: { marginTop: 4, padding: '10px 12px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 },
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Verwalten</span>
          <button style={{ ...s.iconBtn, fontSize: 20 }} onClick={onClose}>✕</button>
        </div>
        <div style={s.tabs}>
          {([['categories', 'Kategorien'], ['tags', 'Tags'], ['qualifiers', 'Bewertungen']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} style={{ ...s.tab, borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent', color: tab === key ? 'var(--accent)' : 'var(--text2)' }} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>
        <div style={s.body}>
          {tab === 'categories' && <CategoriesTab categories={categories} qualifiers={qualifiers} catQualMap={catQualMap} commit={commit} s={s} />}
          {tab === 'tags' && <TagsTab tags={tags} commit={commit} s={s} />}
          {tab === 'qualifiers' && <QualifiersTab qualifiers={qualifiers} commit={commit} s={s} />}
        </div>
      </div>
    </div>
  )
}

// ── Kategorien ──────────────────────────────────────────────────────────────

function CategoriesTab({ categories, qualifiers, catQualMap, commit, s }: {
  categories: Category[], qualifiers: Qualifier[], catQualMap: Record<number, number[]>,
  commit: (fn: () => void) => void, s: Record<string, React.CSSProperties>
}) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0])
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [expandedLinks, setExpandedLinks] = useState<number | null>(null)

  function add() {
    if (!newName.trim()) return
    commit(() => createCategory(newName, newColor))
    setNewName('')
  }

  function startEdit(c: Category) {
    setEditId(c.id); setEditName(c.name); setEditColor(c.color ?? COLOR_PALETTE[0])
    setExpandedLinks(null)
  }

  function saveEdit() {
    if (!editName.trim() || editId == null) return
    commit(() => updateCategory(editId, editName, editColor))
    setEditId(null)
  }

  function del(c: Category) {
    if (!confirm(`Kategorie "${c.name}" löschen? Sie wird aus allen Einträgen entfernt.`)) return
    commit(() => deleteCategory(c.id))
    if (editId === c.id) setEditId(null)
    if (expandedLinks === c.id) setExpandedLinks(null)
  }

  return (
    <>
      <div style={s.addRow}>
        <input style={s.input} placeholder="Neue Kategorie…" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <ColorPicker value={newColor} onChange={setNewColor} />
        <button style={s.btn} onClick={add}>+</button>
      </div>
      {categories.map(c => (
        <div key={c.id}>
          {editId === c.id ? (
            <div style={{ ...s.row, flexWrap: 'wrap', gap: 8 }}>
              <input style={{ ...s.input, flex: '1 1 120px' }} value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()} autoFocus />
              <ColorPicker value={editColor} onChange={setEditColor} />
              <button style={s.btnSmall} onClick={saveEdit}>✓</button>
              <button style={{ ...s.iconBtn }} onClick={() => setEditId(null)}>✕</button>
            </div>
          ) : (
            <div style={s.row}>
              <span style={{ ...s.colorDot, background: c.color ?? '#888' }} />
              <span style={s.nameText}>{c.name}</span>
              <button style={s.iconBtn} title="Qualifier-Links" onClick={() => setExpandedLinks(expandedLinks === c.id ? null : c.id)}>📊</button>
              <button style={s.iconBtn} onClick={() => startEdit(c)}>✏️</button>
              <button style={s.iconBtn} onClick={() => del(c)}>🗑️</button>
            </div>
          )}
          {expandedLinks === c.id && (
            <div style={s.subPanel}>
              <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Verknüpfte Bewertungen (erscheinen oben im Formular)</span>
              {qualifiers.length === 0
                ? <span style={{ fontSize: 13, color: 'var(--text2)' }}>Keine Bewertungen vorhanden.</span>
                : qualifiers.map(q => {
                    const linked = (catQualMap[c.id] ?? []).includes(q.id)
                    return (
                      <label key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
                        <input type="checkbox" checked={linked} onChange={e => {
                          const current = catQualMap[c.id] ?? []
                          const next = e.target.checked ? [...current, q.id] : current.filter(id => id !== q.id)
                          commit(() => setCategoryQualifiers(c.id, next))
                        }} />
                        {getIconForPreset(q.emoji_preset)} {q.name}
                      </label>
                    )
                  })}
            </div>
          )}
        </div>
      ))}
      {categories.length === 0 && <span style={{ color: 'var(--text2)', fontSize: 14 }}>Noch keine Kategorien.</span>}
    </>
  )
}

// ── Tags ──────────────────────────────────────────────────────────────────

function TagsTab({ tags, commit, s }: { tags: Tag[], commit: (fn: () => void) => void, s: Record<string, React.CSSProperties> }) {
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  function add() {
    if (!newName.trim()) return
    commit(() => createTag(newName))
    setNewName('')
  }

  function startEdit(t: Tag) { setEditId(t.id); setEditName(t.name) }

  function saveEdit() {
    if (!editName.trim() || editId == null) return
    commit(() => updateTag(editId, editName))
    setEditId(null)
  }

  function del(t: Tag) {
    if (!confirm(`Tag "#${t.name}" löschen? Er wird aus allen Einträgen entfernt.`)) return
    commit(() => deleteTag(t.id))
    if (editId === t.id) setEditId(null)
  }

  return (
    <>
      <div style={s.addRow}>
        <input style={s.input} placeholder="Neues Tag…" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <button style={s.btn} onClick={add}>+</button>
      </div>
      {tags.map(t => (
        <div key={t.id} style={s.row}>
          {editId === t.id ? (
            <>
              <input style={s.input} value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()} autoFocus />
              <button style={s.btnSmall} onClick={saveEdit}>✓</button>
              <button style={s.iconBtn} onClick={() => setEditId(null)}>✕</button>
            </>
          ) : (
            <>
              <span style={s.nameText}>#{t.name}</span>
              <button style={s.iconBtn} onClick={() => startEdit(t)}>✏️</button>
              <button style={s.iconBtn} onClick={() => del(t)}>🗑️</button>
            </>
          )}
        </div>
      ))}
      {tags.length === 0 && <span style={{ color: 'var(--text2)', fontSize: 14 }}>Noch keine Tags.</span>}
    </>
  )
}

// ── Qualifiers ───────────────────────────────────────────────────────────────

function QualifiersTab({ qualifiers, commit, s }: { qualifiers: Qualifier[], commit: (fn: () => void) => void, s: Record<string, React.CSSProperties> }) {
  const [newName, setNewName] = useState('')
  const [newPreset, setNewPreset] = useState('mood')
  const [newCustom, setNewCustom] = useState(['', '', '', '', ''])
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editPreset, setEditPreset] = useState('mood')
  const [editCustom, setEditCustom] = useState(['', '', '', '', ''])

  function add() {
    if (!newName.trim()) return
    const preset = newPreset === 'custom' ? JSON.stringify(newCustom.map(e => e || '❓')) : newPreset
    commit(() => createQualifier(newName, preset))
    setNewName('')
    setNewCustom(['', '', '', '', ''])
  }

  function startEdit(q: Qualifier) {
    setEditId(q.id); setEditName(q.name)
    const isCustom = !EMOJI_PRESETS[q.emoji_preset]
    setEditPreset(isCustom ? 'custom' : q.emoji_preset)
    setEditCustom(isCustom ? getEmojisForPreset(q.emoji_preset) : ['', '', '', '', ''])
  }

  function saveEdit() {
    if (!editName.trim() || editId == null) return
    const preset = editPreset === 'custom' ? JSON.stringify(editCustom.map(e => e || '❓')) : editPreset
    commit(() => updateQualifier(editId, editName, preset))
    setEditId(null)
  }

  function del(q: Qualifier) {
    if (!confirm(`Bewertung "${q.name}" löschen? Alle gespeicherten Werte gehen verloren.`)) return
    commit(() => deleteQualifier(q.id))
    if (editId === q.id) setEditId(null)
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={s.addRow}>
          <input style={s.input} placeholder="Name…" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <button style={s.btn} onClick={add}>+</button>
        </div>
        <PresetPicker value={newPreset} customEmojis={newCustom}
          onChange={key => { setNewPreset(key); if (key !== 'custom') setNewCustom(['', '', '', '', '']) }}
          onCustomChange={(i, v) => { const n = [...newCustom]; n[i] = v; setNewCustom(n) }}
          s={s} />
      </div>
      {qualifiers.map(q => (
        <div key={q.id}>
          {editId === q.id ? (
            <div style={{ ...s.row, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={s.input} value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()} autoFocus />
                <button style={s.btnSmall} onClick={saveEdit}>✓</button>
                <button style={s.iconBtn} onClick={() => setEditId(null)}>✕</button>
              </div>
              <PresetPicker value={editPreset} customEmojis={editCustom}
                onChange={key => { setEditPreset(key); if (key !== 'custom') setEditCustom(['', '', '', '', '']) }}
                onCustomChange={(i, v) => { const n = [...editCustom]; n[i] = v; setEditCustom(n) }}
                s={s} />
            </div>
          ) : (
            <div style={s.row}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{getIconForPreset(q.emoji_preset)}</span>
              <span style={s.nameText}>{q.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{getEmojisForPreset(q.emoji_preset).join('')}</span>
              <button
                style={{ ...s.iconBtn, color: q.active ? '#34C759' : 'var(--text2)' }}
                title={q.active ? 'Aktiv — deaktivieren' : 'Inaktiv — aktivieren'}
                onClick={() => commit(() => setQualifierActive(q.id, !q.active))}
              >{q.active ? '●' : '○'}</button>
              <button style={s.iconBtn} onClick={() => startEdit(q)}>✏️</button>
              <button style={s.iconBtn} onClick={() => del(q)}>🗑️</button>
            </div>
          )}
        </div>
      ))}
      {qualifiers.length === 0 && <span style={{ color: 'var(--text2)', fontSize: 14 }}>Noch keine Bewertungen.</span>}
    </>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {COLOR_PALETTE.map(c => (
        <button key={c} onClick={() => onChange(c)} style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: c === value ? '2px solid var(--text)' : '2px solid transparent', cursor: 'pointer', padding: 0, flexShrink: 0 }} />
      ))}
      <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width: 24, height: 24, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} title="Eigene Farbe" />
    </div>
  )
}

function PresetPicker({ value, customEmojis, onChange, onCustomChange, s }: {
  value: string
  customEmojis: string[]
  onChange: (p: string) => void
  onCustomChange: (i: number, v: string) => void
  s: Record<string, React.CSSProperties>
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {Object.entries(EMOJI_PRESETS).map(([key, p]) => (
        <button key={key} onClick={() => onChange(key)} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
          borderRadius: 8, cursor: 'pointer', textAlign: 'left',
          background: value === key ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
          border: value === key ? '1px solid var(--accent)' : '1px solid transparent',
        }}>
          <span style={{ width: 52, fontSize: 12, color: 'var(--text2)' }}>{p.label}</span>
          {p.emojis.map((e, i) => <span key={i} style={{ fontSize: 18 }}>{e}</span>)}
        </button>
      ))}
      <button onClick={() => onChange('custom')} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
        borderRadius: 8, cursor: 'pointer', textAlign: 'left',
        background: value === 'custom' ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
        border: value === 'custom' ? '1px solid var(--accent)' : '1px solid transparent',
      }}>
        <span style={{ width: 52, fontSize: 12, color: 'var(--text2)' }}>Eigene</span>
        {value === 'custom'
          ? [0, 1, 2, 3, 4].map(i => (
              <input key={i} value={customEmojis[i] ?? ''} maxLength={2}
                onChange={e => onCustomChange(i, e.target.value)}
                onClick={e => e.stopPropagation()}
                style={{ width: 34, height: 34, border: '1px solid var(--border)', borderRadius: 6, textAlign: 'center', fontSize: 18, background: 'var(--bg)', color: 'var(--text)' }} />
            ))
          : <span style={{ fontSize: 12, color: 'var(--text2)' }}>✏️ Eigene Emojis</span>
        }
      </button>
    </div>
  )
}
