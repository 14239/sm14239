import type { VersionGroup } from './data'
import { useLang } from './lang'

export function VersionSelect({ groups, value, onChange }: {
  groups: VersionGroup[]
  value: number
  onChange: (vg: number) => void
}) {
  const lang = useLang()
  return (
    <label className="field">
      <span>버전</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {groups.map((g) => (
          <option key={g.id} value={g.id} disabled={!g.hasLearnset}>
            {g.gen}세대 · {lang ? g.en : g.ko}{g.hasLearnset ? '' : ' (데이터 없음)'}
          </option>
        ))}
      </select>
    </label>
  )
}
