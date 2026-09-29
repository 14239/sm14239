import type { TypeTable } from './data'
import { nm, useLang } from './lang'

const COLORS: Record<number, string> = {
  1: '#9fa19f', 2: '#ff8000', 3: '#81b9ef', 4: '#9141cb', 5: '#915121', 6: '#afa981',
  7: '#91a119', 8: '#704170', 9: '#60a1b8', 10: '#e62829', 11: '#2980ef', 12: '#3fa129',
  13: '#fac000', 14: '#ef4179', 15: '#3dcef3', 16: '#5060e1', 17: '#624d4e', 18: '#ef70ef',
}

export function TypeBadge({ id, types }: { id: number; types: TypeTable }) {
  const lang = useLang()
  if (!id) return null
  return (
    <span className="type-badge" style={{ background: COLORS[id] ?? '#888' }}>
      {nm(types[id], lang, String(id))}
    </span>
  )
}
