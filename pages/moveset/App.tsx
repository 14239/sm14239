import { useEffect, useMemo, useState } from 'react'
import {
  loadLearnset, loadMoves, loadPokemon, loadVersionGroups,
  type Learnset, type MoveTable, type PokemonTable, type VersionGroup,
} from '@shared/data'
import './moveset.css'

const MAX_MOVES = 4
const DEFAULT_VG = 4 // 크리스탈

export function App() {
  const [groups, setGroups] = useState<VersionGroup[]>([])
  const [pokemon, setPokemon] = useState<PokemonTable>({})
  const [moves, setMoves] = useState<MoveTable>({})
  const [vg, setVg] = useState(DEFAULT_VG)
  const [learnset, setLearnset] = useState<Learnset | null>(null)
  const [picked, setPicked] = useState<number[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    Promise.all([loadVersionGroups(), loadPokemon(), loadMoves()]).then(([g, p, m]) => {
      setGroups(g)
      setPokemon(p)
      setMoves(m)
    })
  }, [])

  useEffect(() => {
    setLearnset(null)
    loadLearnset(vg).then(setLearnset)
  }, [vg])

  // 이 버전에서 배울 수 있는 기술만 후보로
  const available = useMemo(() => {
    if (!learnset) return []
    const ids = new Set<number>()
    for (const list of Object.values(learnset)) for (const [m] of list) ids.add(m)
    return [...ids].filter((id) => moves[id]).sort((a, b) => moves[a][0].localeCompare(moves[b][0], 'ko'))
  }, [learnset, moves])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return available
      .filter((id) => !picked.includes(id))
      .filter((id) => moves[id][0].includes(q) || moves[id][1].toLowerCase().includes(q))
      .slice(0, 12)
  }, [query, available, picked, moves])

  const results = useMemo(() => {
    if (!learnset || picked.length === 0) return []
    return Object.entries(learnset)
      .filter(([, list]) => picked.every((m) => list.some(([id]) => id === m)))
      .map(([id]) => Number(id))
      .filter((id) => pokemon[id])
      .sort((a, b) => pokemon[a][2] - pokemon[b][2] || a - b)
  }, [learnset, picked, pokemon])

  const pick = (id: number) => {
    if (picked.length >= MAX_MOVES) return
    setPicked([...picked, id])
    setQuery('')
  }

  return (
    <div className="moveset">
      <div className="card controls">
        <label>
          버전
          <select value={vg} onChange={(e) => setVg(Number(e.target.value))}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.gen}세대 · {g.ko}</option>
            ))}
          </select>
        </label>

        <div className="picked">
          {picked.map((id) => (
            <button key={id} className="chip" onClick={() => setPicked(picked.filter((m) => m !== id))}>
              {moves[id]?.[0]} ✕
            </button>
          ))}
          {picked.length < MAX_MOVES && (
            <div className="search">
              <input
                value={query}
                placeholder={learnset ? '기술 이름 (한/영)' : '불러오는 중…'}
                disabled={!learnset}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && suggestions[0] && pick(suggestions[0])}
              />
              {suggestions.length > 0 && (
                <ul className="suggest card">
                  {suggestions.map((id) => (
                    <li key={id}>
                      <button onClick={() => pick(id)}>
                        {moves[id][0]} <span className="muted">{moves[id][1]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {picked.length > 0 && (
        <section>
          <h2>{results.length}마리</h2>
          <ul className="results">
            {results.map((id) => (
              <li key={id} className="card">
                <span className="muted">#{pokemon[id][2]}</span> {pokemon[id][0]}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
