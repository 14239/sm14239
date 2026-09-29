import { useState } from 'react'

interface PPMove { name: string; max: number; current: number }

const initial = (): PPMove[] => [1, 2, 3, 4].map((i) => ({ name: `기술${i}`, max: 10, current: 10 }))

/** 방송 중 양쪽 기술 PP를 손으로 세는 카운터 */
export function PPCounter() {
  return (
    <div className="pp-grid">
      <PPSide title="내 포켓몬" />
      <PPSide title="상대 포켓몬" />
    </div>
  )
}

function PPSide({ title }: { title: string }) {
  const [moves, setMoves] = useState<PPMove[]>(initial)
  const update = (i: number, patch: Partial<PPMove>) =>
    setMoves(moves.map((m, j) => {
      if (j !== i) return m
      const next = { ...m, ...patch }
      next.max = Math.max(0, next.max)
      next.current = Math.max(0, Math.min(next.current, next.max))
      return next
    }))

  return (
    <div className="card stack">
      <div className="row">
        <h3>{title}</h3>
        <button className="link" onClick={() => setMoves(moves.map((m) => ({ ...m, current: m.max })))}>전부 회복</button>
      </div>
      {moves.map((m, i) => (
        <div key={i} className={m.current === 0 ? 'pp-row empty' : 'pp-row'}>
          <input value={m.name} onChange={(e) => update(i, { name: e.target.value })} />
          <span className="pp-value"><b>{m.current}</b> / <input type="number" min={0} value={m.max} onChange={(e) => update(i, { max: Number(e.target.value) })} /></span>
          <button className="btn ghost" onClick={() => update(i, { current: m.current - 1 })}>−</button>
          <button className="btn ghost" onClick={() => update(i, { current: m.current + 1 })}>+</button>
          <button className="btn ghost" onClick={() => update(i, { current: m.current + 10 })}>과사열매</button>
        </div>
      ))}
    </div>
  )
}
