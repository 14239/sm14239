import { useMemo, useState } from 'react'

export interface PickerItem {
  id: number
  label: string
  /** 검색에만 쓰는 추가 문자열 (영문명 등) */
  alt?: string
}

/** 검색해서 여러 개 고르는 입력. 고른 항목은 칩으로 보이고 누르면 빠진다. */
export function Picker({ label, items, value, onChange, max, placeholder, disabled }: {
  label: string
  items: PickerItem[]
  value: number[]
  onChange: (ids: number[]) => void
  max?: number
  placeholder?: string
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items
      .filter((i) => !value.includes(i.id))
      .filter((i) => i.label.toLowerCase().includes(q) || i.alt?.toLowerCase().includes(q))
      .slice(0, 12)
  }, [query, items, value])

  const full = max !== undefined && value.length >= max
  const add = (id: number) => {
    if (full) return
    onChange(max === 1 ? [id] : [...value, id])
    setQuery('')
  }

  return (
    <div className="picker">
      <span className="picker-label">{label}{max ? ` (최대 ${max})` : ''}</span>
      <div className="picker-box">
        {value.map((id) => (
          <button key={id} className="chip" onClick={() => onChange(value.filter((v) => v !== id))}>
            {byId.get(id)?.label ?? id} ✕
          </button>
        ))}
        {!full && (
          <div className="picker-search">
            <input
              value={query}
              disabled={disabled}
              placeholder={placeholder ?? '검색 (한/영)'}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && suggestions[0] && add(suggestions[0].id)}
            />
            {suggestions.length > 0 && (
              <ul className="suggest card">
                {suggestions.map((i) => (
                  <li key={i.id}>
                    <button onClick={() => add(i.id)}>
                      {i.label} {i.alt && <span className="muted">{i.alt}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
