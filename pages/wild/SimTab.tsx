import { useMemo, useState } from 'react'
import { parseCsv } from '@shared/csv'
import type { BaseData } from '@shared/data'
import { nm, useLang } from '@shared/lang'
import { Modal } from '@shared/Modal'
import { FlowChart } from './FlowChart'
import { ARBOLIVA_HEAL, buildIds, toWildMons, WildFlow, type WildMon } from './flow'
import { simCsvToRows, type WildRow } from './table'

const PAGE = 20
const SIM_GEN = 9

export function SimTab({ base, rows, onRows }: { base: BaseData; rows: WildRow[]; onRows: (rows: WildRow[]) => void }) {
  const lang = useLang()
  const flow = useMemo(() => new WildFlow(base.moves, base.pokemon, buildIds(base.moves)), [base])
  const mons = useMemo(() => toWildMons(rows), [rows])
  const [version, setVersion] = useState(0) // 시뮬레이션 결과 갱신 트리거
  const [path, setPath] = useState<{ key: string; nodes: number[]; edges: string[] } | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [logFor, setLogFor] = useState<WildMon | null>(null)
  const [chroma, setChroma] = useState(false)

  const simulated = mons.some((m) => m.fling !== null)

  const runAll = () => {
    for (const m of mons) flow.run(m)
    setVersion((v) => v + 1)
  }
  const runOne = (m: WildMon) => {
    const r = flow.run(m)
    setPath({ key: m.key, ...r })
    setVersion((v) => v + 1)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return mons.filter((m) =>
      selected.every((n) => m.nodeList.includes(n)) &&
      (!q || m.name.toLowerCase().includes(q) || (base.pokemon[m.id]?.n[lang] ?? '').includes(q)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mons, selected, query, version, base, lang])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const shown = filtered.slice(page * PAGE, page * PAGE + PAGE)
  const moveName = (id: number | undefined) => (id === undefined || id === -1 ? '-' : nm(base.moves[id], lang, String(id)))
  const toggleNode = (id: number) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
    setPage(0)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    onRows(simCsvToRows(parseCsv(await file.text()), base, SIM_GEN))
    setPath(null)
  }

  const current = path ? mons.find((m) => m.key === path.key) : null

  return (
    <div className="stack">
      <div className="card stack">
        <div className="row">
          <label className="file-btn btn ghost">
            시뮬레이션 CSV 열기
            <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} hidden />
          </label>
          <button className="btn" disabled={!mons.length} onClick={runAll}>전체 시뮬레이션</button>
          <label><input type="checkbox" checked={chroma} onChange={(e) => setChroma(e.target.checked)} /> 크로마키 배경 (방송용)</label>
          <span className="muted">{mons.length}마리 (특성별) · 회복량 기준 {ARBOLIVA_HEAL}</span>
        </div>
        <p className="muted small">
          야생 테이블 탭에서 "시뮬레이션으로 보내기"를 누르거나 저장한 CSV를 여세요. 노드를 누르면 그 노드를 지나간 포켓몬만 표에 남습니다.
        </p>
      </div>

      <div className="flow-head">
        {current
          ? <b>{current.name} · Lv {current.level} · {nm(base.abilities[current.ability], lang)}</b>
          : <span className="muted">표에서 "경로"를 누르면 판단 경로가 강조됩니다.</span>}
      </div>
      <FlowChart flow={flow} pathNodes={path?.nodes ?? []} pathEdges={path?.edges ?? []} selected={selected} onToggle={toggleNode} chroma={chroma} />

      {selected.length > 0 && (
        <div className="row">
          <span className="muted">노드 필터:</span>
          {selected.map((id) => <button key={id} className="chip" onClick={() => toggleNode(id)}>{flow.node(id).title} ✕</button>)}
          <button className="link" onClick={() => setSelected([])}>모두 해제</button>
        </div>
      )}

      {mons.length > 0 && (
        <>
          <div className="row">
            <input value={query} placeholder="이름 검색" onChange={(e) => { setQuery(e.target.value); setPage(0) }} />
            <span className="muted">{filtered.length}마리</span>
            {!simulated && <span className="muted">아직 시뮬레이션 전입니다.</span>}
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th><th>이름</th><th>Lv</th><th>특성</th>
                  <th>기술1</th><th>기술2</th><th>기술3</th><th>기술4</th>
                  <th>고정된 기술</th><th>내구력</th><th>올리르바 데미지</th><th />
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.key} className={path?.key === m.key ? 'current' : ''}>
                    <td className="muted">{m.id}</td>
                    <td>{m.name}</td>
                    <td>{m.level}</td>
                    <td>{nm(base.abilities[m.ability], lang, String(m.ability))}</td>
                    {m.moves.map((id, i) => <td key={i}>{moveName(id)}</td>)}
                    <td><b>{m.fling === null ? '' : moveName(m.possibleMoves[0])}</b></td>
                    <td>{m.fling ?? ''}</td>
                    <td>{m.arbolivaDamage === null ? (m.fling === null ? '' : '-') : m.arbolivaDamage}</td>
                    <td className="actions">
                      <button className="link" onClick={() => runOne(m)}>경로</button>
                      <button className="link" disabled={!m.nodeList.length} onClick={() => setLogFor(m)}>로그</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="row pager">
              <button className="link" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button>
              <span>{page + 1} / {pages}</span>
              <button className="link" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>다음</button>
            </div>
          )}
        </>
      )}

      {logFor && (
        <Modal onClose={() => setLogFor(null)}>
          <h3>{logFor.name} · Lv {logFor.level}</h3>
          <p className="muted">{nm(base.abilities[logFor.ability], lang)} · 내구력 {logFor.fling} · 고정 기술 {moveName(logFor.possibleMoves[0])}</p>
          <ol>{logFor.nodeList.map((id, i) => <li key={i}>{flow.node(id).title}</li>)}</ol>
        </Modal>
      )}
    </div>
  )
}
