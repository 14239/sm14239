import { useRef, useState } from 'react'
import { PPCounter } from './PPCounter'
import { SCENARIOS, type SimResult } from './sims'
import './pickup.css'

interface Stats {
  turns: number[]
  reasons: Record<string, number>
}

const emptyStats = (): Stats => ({ turns: [], reasons: {} })

export function App() {
  const [tab, setTab] = useState<'sim' | 'pp'>('sim')
  return (
    <div className="pickup stack">
      <div className="tabs">
        <button className={tab === 'sim' ? 'tab active' : 'tab'} onClick={() => setTab('sim')}>줍기 시뮬레이터</button>
        <button className={tab === 'pp' ? 'tab active' : 'tab'} onClick={() => setTab('pp')}>PP 카운터</button>
      </div>
      {tab === 'sim' ? <Simulator /> : <PPCounter />}
    </div>
  )
}

function Simulator() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id)
  const [stats, setStats] = useState<Record<string, Stats>>({})
  const [last, setLast] = useState<SimResult | null>(null)
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null)
  const stopRef = useRef(false)

  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!
  const st = stats[scenarioId] ?? emptyStats()

  const record = (r: SimResult) => {
    setStats((all) => {
      const prev = all[scenarioId] ?? emptyStats()
      return {
        ...all,
        [scenarioId]: {
          turns: [...prev.turns, r.turns],
          reasons: { ...prev.reasons, [r.reason]: (prev.reasons[r.reason] ?? 0) + 1 },
        },
      }
    })
    setLast(r)
  }

  // 한 판이 수만 턴까지 갈 수 있어서 한 판씩 나눠 돌리며 화면을 갱신한다
  const runMany = (n: number) => {
    stopRef.current = false
    let done = 0
    setRunning({ done, total: n })
    const step = () => {
      if (stopRef.current || done >= n) {
        setRunning(null)
        return
      }
      record(scenario.run())
      done++
      setRunning({ done, total: n })
      setTimeout(step, 0)
    }
    setTimeout(step, 0)
  }

  const sorted = [...st.turns].sort((a, b) => a - b)
  const avg = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0

  return (
    <>
      <div className="card stack">
        <label className="field">
          <span>시나리오</span>
          <select value={scenarioId} disabled={!!running} onChange={(e) => { setScenarioId(e.target.value); setLast(null) }}>
            {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </label>
        <div className="scenario-info">
          <b>{scenario.subtitle}</b>
          <span className="muted">{scenario.player}</span>
          <span className="muted">{scenario.opponent}</span>
        </div>
        <div className="row">
          <button className="btn" disabled={!!running} onClick={() => runMany(1)}>시뮬레이션 1회</button>
          <button className="btn ghost" disabled={!!running} onClick={() => runMany(10)}>10회</button>
          <button className="btn ghost" disabled={!!running} onClick={() => runMany(100)}>100회</button>
          {running && <button className="btn ghost" onClick={() => { stopRef.current = true }}>중지</button>}
          <button className="link" disabled={!!running} onClick={() => { setStats({ ...stats, [scenarioId]: emptyStats() }); setLast(null) }}>기록 초기화</button>
          {running && <span className="muted">{running.done} / {running.total}</span>}
        </div>
      </div>

      <div className="card">
        <h3>누적 결과</h3>
        <div className="stats">
          <div><span className="muted">시도</span><b>{sorted.length}</b></div>
          <div><span className="muted">최소 턴</span><b>{sorted[0] ?? '-'}</b></div>
          <div><span className="muted">최대 턴</span><b>{sorted.at(-1) ?? '-'}</b></div>
          <div><span className="muted">평균 턴</span><b>{sorted.length ? avg.toFixed(1) : '-'}</b></div>
          <div><span className="muted">중앙값</span><b>{sorted.length ? median : '-'}</b></div>
        </div>
        {Object.keys(st.reasons).length > 0 && (
          <p className="reasons">
            {Object.entries(st.reasons).map(([r, n]) => (
              <span key={r}>{r}: <b>{n}</b> ({((n / sorted.length) * 100).toFixed(1)}%)</span>
            ))}
          </p>
        )}
      </div>

      {last && (
        <details className="card" open={last.log.length < 400}>
          <summary>마지막 판 로그 — {last.turns}턴, {last.reason} {last.log.length >= 1000 && '(마지막 1000줄)'}</summary>
          <ol className="sim-log">
            {last.log.map((line, i) => <li key={i} className={line.startsWith('턴 ') ? 'turn' : line.includes('!!!') ? 'hot' : ''}>{line}</li>)}
          </ol>
        </details>
      )}
    </>
  )
}
