// 파티 검색 풀이.
// 슬롯마다 자기 조건(타입·특성·기술)이 있고, "Any" 조건은 파티 중 한 마리만 만족하면 된다.
// Any 조건을 슬롯에 배치하는 모든 경우를 백트래킹으로 찾되, 각 슬롯은
//   - 후보 포켓몬이 한 마리 이상 남아야 하고
//   - 기술은 (자기 기술 + 배치된 Any 기술) 4개 이하여야 한다.

export type CondKind = 'type' | 'ability' | 'move'
export interface Cond { kind: CondKind; id: number }

export interface SlotSpec { types: number[]; abilities: number[]; moves: number[] }

export interface Candidate {
  id: number
  types: number[]
  abilities: number[]
  moves: Set<number>
}

export interface SlotResult {
  /** 이 슬롯에 배치된 Any 조건 */
  assigned: Cond[]
  /** 조건을 만족하는 포켓몬 id */
  candidates: number[]
  /** 아무 조건도 없는 슬롯 */
  free: boolean
}

export type SolveResult =
  | { ok: true; slots: SlotResult[] }
  | { ok: false; reason: string }

const MAX_STEPS = 200_000

function matches(c: Candidate, cond: Cond, anyMove: (id: number) => boolean): boolean {
  if (cond.kind === 'type') return c.types.includes(cond.id)
  if (cond.kind === 'ability') return c.abilities.includes(cond.id)
  return c.moves.has(cond.id) || anyMove(c.id)
}

export function solve(all: Candidate[], slots: SlotSpec[], anyConds: Cond[], sketchId: number | null): SolveResult {
  const anyMove = (id: number) => id === sketchId
  const own: Cond[][] = slots.map((s) => [
    ...s.types.map((id) => ({ kind: 'type' as const, id })),
    ...s.abilities.map((id) => ({ kind: 'ability' as const, id })),
    ...s.moves.map((id) => ({ kind: 'move' as const, id })),
  ])

  const base = own.map((conds) => all.filter((c) => conds.every((k) => matches(c, k, anyMove))))
  const emptySlot = base.findIndex((b) => b.length === 0)
  if (emptySlot >= 0) return { ok: false, reason: `슬롯 ${emptySlot + 1}의 조건을 만족하는 포켓몬이 없습니다.` }

  // 만족하는 포켓몬이 적은(까다로운) 조건부터 배치
  const order = anyConds
    .map((cond) => ({ cond, n: all.filter((c) => matches(c, cond, anyMove)).length }))
    .sort((a, b) => a.n - b.n)
  const unsat = order.find((o) => o.n === 0)
  if (unsat) return { ok: false, reason: 'Any 조건 중 이 버전에서 아무도 만족하지 못하는 조건이 있습니다.' }

  const moveCount = slots.map((s) => s.moves.length)
  const assigned: Cond[][] = slots.map(() => [])
  const current = base.map((b) => b)
  let steps = 0

  const dfs = (i: number): boolean | null => {
    if (i === order.length) return true
    if (++steps > MAX_STEPS) return null
    const cond = order[i].cond
    let triedFree = false
    for (let s = 0; s < slots.length; s++) {
      // 아직 아무 조건도 없는 슬롯끼리는 서로 같으므로 한 번만 시도
      const isFree = own[s].length === 0 && assigned[s].length === 0
      if (isFree) {
        if (triedFree) continue
        triedFree = true
      }
      if (cond.kind === 'move' && moveCount[s] >= 4) continue
      const next = current[s].filter((c) => matches(c, cond, anyMove))
      if (next.length === 0) continue

      const prev = current[s]
      current[s] = next
      assigned[s].push(cond)
      if (cond.kind === 'move') moveCount[s]++
      const r = dfs(i + 1)
      if (r !== false) return r
      current[s] = prev
      assigned[s].pop()
      if (cond.kind === 'move') moveCount[s]--
    }
    return false
  }

  const r = dfs(0)
  if (r === null) return { ok: false, reason: '경우의 수가 너무 많아 탐색을 중단했습니다. 조건을 줄이거나 슬롯 조건을 더 구체적으로 지정해 주세요.' }
  if (!r) return { ok: false, reason: '모든 조건을 만족하는 파티 구성이 없습니다. (슬롯 수, 슬롯당 기술 4개 제한을 확인해 주세요)' }

  return {
    ok: true,
    slots: slots.map((_, s) => ({
      assigned: assigned[s],
      candidates: current[s].map((c) => c.id),
      free: own[s].length === 0 && assigned[s].length === 0,
    })),
  }
}
