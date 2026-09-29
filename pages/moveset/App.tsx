import { useMemo, useState } from 'react'
import { abilitiesAt, MOVE_METHODS, typesAt } from '@shared/data'
import { useBase, useLearnset } from '@shared/hooks'
import { nm, useLang } from '@shared/lang'
import { Picker, type PickerItem } from '@shared/Picker'
import { PokemonDetail } from '@shared/PokemonDetail'
import { TypeBadge } from '@shared/TypeBadge'
import { VersionSelect } from '@shared/VersionSelect'
import { MoveLookup } from './MoveLookup'
import './moveset.css'

const DEFAULT_VG = 4 // 크리스탈
const ALL_METHODS = Object.keys(MOVE_METHODS).map(Number)
const COMMON_METHODS = [1, 2, 3, 4]

type SortKey = 'dex' | 'name' | 'count'

export function App() {
  const lang = useLang()
  const { data: base, error: baseError } = useBase()
  const [vg, setVg] = useState(DEFAULT_VG)
  const { data: learnset, error } = useLearnset(vg)

  const [types, setTypes] = useState<number[]>([])
  const [abilities, setAbilities] = useState<number[]>([])
  const [moves, setMoves] = useState<number[]>([])
  const [methods, setMethods] = useState<number[]>(COMMON_METHODS)
  const [requireAll, setRequireAll] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'count', asc: false })
  const [detail, setDetail] = useState<number | null>(null)

  const gen = base?.groups.find((g) => g.id === vg)?.gen ?? 9

  const typeItems = useMemo<PickerItem[]>(() => !base ? [] :
    Object.entries(base.types).map(([id, n]) => ({ id: +id, label: n[lang], alt: n[lang ? 0 : 1] })), [base, lang])

  const abilityItems = useMemo<PickerItem[]>(() => !base ? [] :
    Object.entries(base.abilities).filter(([, a]) => a[2] <= gen)
      .map(([id, a]) => ({ id: +id, label: a[lang], alt: a[lang ? 0 : 1] }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ko')), [base, lang, gen])

  // 이 버전에서 누군가 배울 수 있는 기술만 후보로
  const moveItems = useMemo<PickerItem[]>(() => {
    if (!base || !learnset) return []
    const ids = new Set<number>()
    for (const list of Object.values(learnset)) for (const [m] of list) ids.add(m)
    return [...ids].filter((id) => base.moves[id])
      .map((id) => ({ id, label: base.moves[id][lang], alt: base.moves[id][lang ? 0 : 1] }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ko'))
  }, [base, learnset, lang])

  const results = useMemo(() => {
    if (!base || !learnset) return []
    if (!types.length && !abilities.length && !moves.length) return []
    const rows = []
    for (const [pid, list] of Object.entries(learnset)) {
      const p = base.pokemon[pid]
      if (!p) continue
      const t = typesAt(p, gen)
      if (!types.every((x) => t.includes(x))) continue
      const a = abilitiesAt(p, gen)
      if (abilities.length && !abilities.some((x) => a.includes(x))) continue
      const hits = list.filter(([m, method]) => moves.includes(m) && methods.includes(method))
      const count = new Set(hits.map(([m]) => m)).size
      if (moves.length && (requireAll ? count < moves.length : count === 0)) continue
      rows.push({ id: +pid, p, t, a, hits, count })
    }
    const dir = sort.asc ? 1 : -1
    return rows.sort((x, y) => {
      const byDex = x.p.s - y.p.s || x.id - y.id
      if (sort.key === 'name') return dir * x.p.n[lang].localeCompare(y.p.n[lang], 'ko') || byDex
      if (sort.key === 'count') return dir * (x.count - y.count) || byDex
      return dir * byDex
    })
  }, [base, learnset, gen, types, abilities, moves, methods, requireAll, sort, lang])

  if (baseError) return <p className="error">{baseError}</p>
  if (!base) return <p className="muted">불러오는 중…</p>

  const sortBy = (key: SortKey) => setSort((s) => ({ key, asc: s.key === key ? !s.asc : key !== 'count' }))
  const arrow = (key: SortKey) => sort.key === key ? (sort.asc ? ' ▲' : ' ▼') : ''
  const toggleMethod = (m: number) => setMethods((ms) => ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m])

  return (
    <div className="moveset stack">
      <div className="card stack">
        <VersionSelect groups={base.groups} value={vg} onChange={setVg} />
        <div className="filters">
          <Picker label="타입 (모두 가진)" items={typeItems} value={types} onChange={setTypes} max={2} />
          {gen >= 3 && <Picker label="특성 (하나라도)" items={abilityItems} value={abilities} onChange={setAbilities} />}
          <Picker label="기술" items={moveItems} value={moves} onChange={setMoves}
            disabled={!learnset} placeholder={learnset ? undefined : error ? '불러오기 실패' : '불러오는 중…'} />
        </div>
        <div className="row">
          <label><input type="checkbox" checked={requireAll} onChange={(e) => setRequireAll(e.target.checked)} /> 고른 기술을 전부 배우는 포켓몬만</label>
          <details>
            <summary>습득 방법 ({methods.length}/{ALL_METHODS.length})</summary>
            <div className="methods">
              <button className="link" onClick={() => setMethods(ALL_METHODS)}>전체</button>
              <button className="link" onClick={() => setMethods(COMMON_METHODS)}>기본 4종</button>
              <button className="link" onClick={() => setMethods([1])}>레벨업만</button>
              {ALL_METHODS.map((m) => (
                <label key={m}><input type="checkbox" checked={methods.includes(m)} onChange={() => toggleMethod(m)} /> {MOVE_METHODS[m][lang]}</label>
              ))}
            </div>
          </details>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      {(types.length > 0 || abilities.length > 0 || moves.length > 0) && (
        <section>
          <h2>{results.length}마리</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => sortBy('dex')}>No.{arrow('dex')}</th>
                  <th className="sortable" onClick={() => sortBy('name')}>이름{arrow('name')}</th>
                  <th>타입</th>
                  {gen >= 3 && <><th>특성1</th><th>특성2</th><th>숨겨진 특성</th></>}
                  {moves.length > 0 && <>
                    <th className="sortable" onClick={() => sortBy('count')}>일치{arrow('count')}</th>
                    <th>기술 (방법 · 레벨)</th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id}>
                    <td className="muted">{r.p.s}</td>
                    <td><button className="link" onClick={() => setDetail(r.id)}>{r.p.n[lang]}</button></td>
                    <td>{r.t.map((t) => <TypeBadge key={t} id={t} types={base.types} />)}</td>
                    {gen >= 3 && r.a.map((a, i) => <td key={i}>{a ? nm(base.abilities[a], lang, String(a)) : ''}</td>)}
                    {moves.length > 0 && <>
                      <td>{r.count}/{moves.length}</td>
                      <td className="hit-list">
                        {r.hits.map(([m, method, level], i) => (
                          <div key={i}>
                            {nm(base.moves[m], lang, String(m))}{' '}
                            <span className="muted">{MOVE_METHODS[method]?.[lang]}{method === 1 ? ` ${level === 0 ? '진화' : level}` : ''}</span>
                          </div>
                        ))}
                      </td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <MoveLookup base={base} />

      {detail !== null && (
        <PokemonDetail id={detail} base={base} learnset={learnset} gen={gen} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}
