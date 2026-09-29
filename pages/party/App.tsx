import { useMemo, useState } from 'react'
import { abilitiesAt, MOVE_METHODS, SMEARGLE, typesAt, type BaseData, type Learnset } from '@shared/data'
import { useBase, useLearnset } from '@shared/hooks'
import { nm, useLang, type Lang } from '@shared/lang'
import { Picker, type PickerItem } from '@shared/Picker'
import { PokemonDetail } from '@shared/PokemonDetail'
import { TypeBadge } from '@shared/TypeBadge'
import { VersionSelect } from '@shared/VersionSelect'
import { solve, type Candidate, type Cond, type SlotResult, type SlotSpec, type SolveResult } from './solve'
import './party.css'

const DEFAULT_VG = 25 // 스칼렛·바이올렛
const COMMON_METHODS = [1, 2, 3, 4]
const ALL_METHODS = Object.keys(MOVE_METHODS).map(Number)
const PREVIEW = 30

const emptySlot = (): SlotSpec => ({ types: [], abilities: [], moves: [] })

interface Items { types: PickerItem[]; abilities: PickerItem[]; moves: PickerItem[] }

export function App() {
  const lang = useLang()
  const { data: base, error: baseError } = useBase()
  const [vg, setVg] = useState(DEFAULT_VG)
  const { data: learnset, error } = useLearnset(vg)
  const [methods, setMethods] = useState<number[]>(COMMON_METHODS)
  const [sketch, setSketch] = useState(true)
  const [any, setAny] = useState<SlotSpec>(emptySlot())
  const [slots, setSlots] = useState<SlotSpec[]>([emptySlot()])
  const [result, setResult] = useState<SolveResult | null>(null)
  const [detail, setDetail] = useState<number | null>(null)

  const gen = base?.groups.find((g) => g.id === vg)?.gen ?? 9

  const items = useMemo<Items>(() => {
    if (!base) return { types: [], abilities: [], moves: [] }
    const toItem = (id: string | number, n: readonly [string, string, ...unknown[]]): PickerItem =>
      ({ id: +id, label: n[lang], alt: n[lang ? 0 : 1] })
    const byLabel = (a: PickerItem, b: PickerItem) => a.label.localeCompare(b.label, 'ko')
    const moveIds = new Set<number>()
    for (const list of Object.values(learnset ?? {})) for (const [m] of list) moveIds.add(m)
    return {
      types: Object.entries(base.types).map(([id, n]) => toItem(id, n)),
      abilities: Object.entries(base.abilities).filter(([, a]) => a[2] <= gen).map(([id, a]) => toItem(id, a)).sort(byLabel),
      moves: [...moveIds].filter((id) => base.moves[id]).map((id) => toItem(id, base.moves[id])).sort(byLabel),
    }
  }, [base, learnset, lang, gen])

  const candidates = useMemo<Candidate[]>(() => {
    if (!base || !learnset) return []
    return Object.entries(learnset).filter(([pid]) => base.pokemon[pid]).map(([pid, list]) => {
      const p = base.pokemon[pid]
      return {
        id: +pid,
        types: typesAt(p, gen),
        abilities: abilitiesAt(p, gen).filter(Boolean),
        moves: new Set(list.filter(([, method]) => methods.includes(method)).map(([m]) => m)),
      }
    })
  }, [base, learnset, gen, methods])

  if (baseError) return <p className="error">{baseError}</p>
  if (!base) return <p className="muted">불러오는 중…</p>

  const run = () => {
    const anyConds: Cond[] = [
      ...any.types.map((id) => ({ kind: 'type' as const, id })),
      ...any.abilities.map((id) => ({ kind: 'ability' as const, id })),
      ...any.moves.map((id) => ({ kind: 'move' as const, id })),
    ]
    const sketchId = sketch && learnset?.[SMEARGLE] ? SMEARGLE : null
    setResult(solve(candidates, slots, anyConds, sketchId))
  }

  const updateSlot = (i: number, s: SlotSpec) => setSlots(slots.map((x, j) => (j === i ? s : x)))
  const toggleMethod = (m: number) => setMethods((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]))

  return (
    <div className="party stack">
      <div className="card stack">
        <div className="row">
          <VersionSelect groups={base.groups} value={vg} onChange={(v) => { setVg(v); setResult(null) }} />
          <label><input type="checkbox" checked={sketch} onChange={(e) => setSketch(e.target.checked)} /> 루브도는 스케치로 모든 기술 가능</label>
          <details>
            <summary>습득 방법 ({methods.length}/{ALL_METHODS.length})</summary>
            <div className="methods">
              {ALL_METHODS.map((m) => (
                <label key={m}><input type="checkbox" checked={methods.includes(m)} onChange={() => toggleMethod(m)} /> {MOVE_METHODS[m][lang]}</label>
              ))}
            </div>
          </details>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card stack">
        <h3>Any <span className="muted small">파티 중 한 마리만 만족하면 되는 조건 (슬롯에 자동 배치)</span></h3>
        <SlotEditor spec={any} items={items} gen={gen} unlimited onChange={setAny} />
      </div>

      {slots.map((s, i) => (
        <div key={i} className="card stack">
          <h3>슬롯 {i + 1}</h3>
          <SlotEditor spec={s} items={items} gen={gen} onChange={(v) => updateSlot(i, v)} />
        </div>
      ))}

      <div className="row">
        <button className="btn ghost" disabled={slots.length >= 6} onClick={() => setSlots([...slots, emptySlot()])}>+ 슬롯</button>
        <button className="btn ghost" disabled={slots.length <= 1} onClick={() => setSlots(slots.slice(0, -1))}>− 슬롯</button>
        <button className="btn" disabled={!learnset} onClick={run}>파티 검색</button>
      </div>

      {result && !result.ok && <p className="error">{result.reason}</p>}
      {result?.ok && (
        <section className="stack">
          {result.slots.map((r, i) => (
            <SlotResultView key={i} index={i} spec={slots[i]} result={r} base={base} learnset={learnset} gen={gen}
              lang={lang} methods={methods} onDetail={setDetail} />
          ))}
        </section>
      )}

      {detail !== null && (
        <PokemonDetail id={detail} base={base} learnset={learnset} gen={gen} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}

function SlotEditor({ spec, items, gen, unlimited, onChange }: {
  spec: SlotSpec
  items: Items
  gen: number
  unlimited?: boolean
  onChange: (s: SlotSpec) => void
}) {
  return (
    <div className="slot-editor">
      <Picker label="타입" items={items.types} value={spec.types} max={unlimited ? undefined : 2}
        onChange={(types) => onChange({ ...spec, types })} />
      {gen >= 3 && (
        <Picker label="특성" items={items.abilities} value={spec.abilities} max={unlimited ? undefined : 1}
          onChange={(abilities) => onChange({ ...spec, abilities })} />
      )}
      <Picker label="기술" items={items.moves} value={spec.moves} max={unlimited ? undefined : 4}
        onChange={(moves) => onChange({ ...spec, moves })} />
    </div>
  )
}

function SlotResultView({ index, spec, result, base, learnset, gen, lang, methods, onDetail }: {
  index: number
  spec: SlotSpec
  result: SlotResult
  base: BaseData
  learnset: Learnset | null
  gen: number
  lang: Lang
  methods: number[]
  onDetail: (id: number) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const moves = [...spec.moves, ...result.assigned.filter((c) => c.kind === 'move').map((c) => c.id)]
  const condLabel = (c: Cond) =>
    nm(c.kind === 'type' ? base.types[c.id] : c.kind === 'ability' ? base.abilities[c.id] : base.moves[c.id], lang, String(c.id))
  const sorted = [...result.candidates].sort((a, b) => base.pokemon[a].s - base.pokemon[b].s || a - b)
  const shown = showAll ? sorted : sorted.slice(0, PREVIEW)

  return (
    <div className="card">
      <h3>
        슬롯 {index + 1} <span className="muted small">{result.free ? '아무 포켓몬' : `${result.candidates.length}마리`}</span>
      </h3>
      {result.assigned.length > 0 && (
        <p className="assigned">Any에서 배치: {result.assigned.map((c, i) => <span key={i} className="chip static">{condLabel(c)}</span>)}</p>
      )}
      {!result.free && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>No.</th><th>이름</th><th>타입</th>{gen >= 3 && <th>특성</th>}{moves.length > 0 && <th>기술</th>}</tr>
            </thead>
            <tbody>
              {shown.map((id) => {
                const p = base.pokemon[id]
                const list = learnset?.[id] ?? []
                return (
                  <tr key={id}>
                    <td className="muted">{p.s}</td>
                    <td><button className="link" onClick={() => onDetail(id)}>{p.n[lang]}</button></td>
                    <td>{typesAt(p, gen).map((t) => <TypeBadge key={t} id={t} types={base.types} />)}</td>
                    {gen >= 3 && <td className="small">{abilitiesAt(p, gen).filter(Boolean).map((a) => nm(base.abilities[a], lang)).join(', ')}</td>}
                    {moves.length > 0 && (
                      <td className="small">
                        {moves.map((m) => {
                          const how = list.find(([mid, method]) => mid === m && methods.includes(method))
                          const label = how
                            ? `${MOVE_METHODS[how[1]]?.[lang] ?? how[1]}${how[1] === 1 ? ` ${how[2] || '진화'}` : ''}`
                            : id === SMEARGLE ? '스케치' : ''
                          return <div key={m}>{nm(base.moves[m], lang)} <span className="muted">{label}</span></div>
                        })}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {sorted.length > PREVIEW && (
            <button className="link" onClick={() => setShowAll(!showAll)}>
              {showAll ? '접기' : `${sorted.length - PREVIEW}마리 더 보기`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
