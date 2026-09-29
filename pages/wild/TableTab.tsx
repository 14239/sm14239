import { useMemo, useState } from 'react'
import { downloadText, parseCsv, toCsv } from '@shared/csv'
import type { BaseData } from '@shared/data'
import { useLearnset } from '@shared/hooks'
import { nm, useLang } from '@shared/lang'
import { TypeBadge } from '@shared/TypeBadge'
import { VersionSelect } from '@shared/VersionSelect'
import { buildWildTable, parseEncounters, rowsToSimCsv, type Encounter, type WildRow } from './table'

const DEFAULT_VG = 25 // 스칼렛·바이올렛

type SortKey = 'id' | 'name' | 'level'

export function TableTab({ base, onSend }: { base: BaseData; onSend: (rows: WildRow[]) => void }) {
  const lang = useLang()
  const [vg, setVg] = useState(DEFAULT_VG)
  const { data: learnset, error } = useLearnset(vg)
  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [fileName, setFileName] = useState('')
  const [asId, setAsId] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean } | null>(null)

  const gen = base.groups.find((g) => g.id === vg)?.gen ?? 9

  const table = useMemo(
    () => (learnset && encounters.length ? buildWildTable(encounters, base, learnset, gen) : null),
    [learnset, encounters, base, gen],
  )

  const rows = useMemo(() => {
    if (!table) return []
    if (!sort) return table.rows
    const dir = sort.asc ? 1 : -1
    return [...table.rows].sort((a, b) =>
      sort.key === 'id' ? dir * (a.id - b.id) : sort.key === 'level' ? dir * (a.level - b.level) : dir * a.name.localeCompare(b.name))
  }, [table, sort])

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setFileName(file.name)
    setEncounters(parseEncounters(parseCsv(await file.text())))
  }

  const sortBy = (key: SortKey) => setSort((s) => ({ key, asc: s?.key === key ? !s.asc : true }))
  const arrow = (key: SortKey) => (sort?.key === key ? (sort.asc ? ' ▲' : ' ▼') : '')
  const ability = (id: number) => (!id ? '' : asId ? id : nm(base.abilities[id], lang, String(id)))
  const move = (id: number) => (id === -1 ? '' : asId ? id : nm(base.moves[id], lang, String(id)))

  return (
    <div className="stack">
      <div className="card stack">
        <div className="row">
          <VersionSelect groups={base.groups} value={vg} onChange={setVg} />
          <label className="file-btn btn ghost">
            출현 정보 CSV 열기
            <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} hidden />
          </label>
          {fileName && <span className="muted">{fileName} · {encounters.length}건</span>}
          <label><input type="checkbox" checked={asId} onChange={(e) => setAsId(e.target.checked)} /> ID로 표시</label>
        </div>
        <p className="muted small">
          CSV 형식: 장소, 세부 장소, 이름(영문), 버전1, 버전2, 레벨 범위(예: 12-15) … — 첫 줄은 헤더.
          폼은 이름 칸에 여러 줄(예: "Tauros↵Paldean Form")로 적습니다. 기술은 해당 레벨까지 레벨업으로 배운 마지막 4개입니다.
        </p>
        {error && <p className="error">{error}</p>}
      </div>

      {table && (
        <>
          <div className="row">
            <h3>{rows.length}줄</h3>
            <button className="btn" onClick={() => onSend(table.rows)}>시뮬레이션으로 보내기</button>
            <button className="btn ghost" onClick={() => downloadText('wild-table.csv', toCsv(rowsToSimCsv(table.rows, base)))}>CSV 저장 (시뮬레이션 형식)</button>
          </div>
          {table.unmatched.length > 0 && (
            <p className="error small">찾지 못한 이름 {table.unmatched.length}개: {table.unmatched.join(', ')}</p>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => sortBy('id')}>ID{arrow('id')}</th>
                  <th className="sortable" onClick={() => sortBy('name')}>이름{arrow('name')}</th>
                  <th className="sortable" onClick={() => sortBy('level')}>Lv{arrow('level')}</th>
                  <th>타입</th><th>특성1</th><th>특성2</th><th>숨겨진 특성</th>
                  <th>기술1</th><th>기술2</th><th>기술3</th><th>기술4</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="muted">{r.id}</td>
                    <td>{r.name} <span className="muted small">{base.pokemon[r.id]?.n[lang]}</span></td>
                    <td>{r.level}</td>
                    <td>{r.types.map((t) => <TypeBadge key={t} id={t} types={base.types} />)}</td>
                    {r.abilities.map((a, j) => <td key={j}>{ability(a)}</td>)}
                    {r.moves.map((m, j) => <td key={j}>{move(m)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
