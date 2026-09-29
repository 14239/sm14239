// 야생 테이블: 출현 정보 CSV → (포켓몬, 레벨)별 타입·특성·기술 4개 표.
// Blazor 원본 Wild-Table.razor 의 매칭 규칙을 따른다.

import { abilitiesAt, MoveMethod, typesAt, type BaseData, type Learnset, type PokemonEntry } from '@shared/data'

export interface Encounter {
  location: string
  subLocation: string
  /** CSV 원문 이름 (영문, 폼은 여러 줄) */
  name: string
  levelRange: string
}

/** 야생 시뮬레이션 입력으로도 쓰는 한 줄 */
export interface WildRow {
  id: number
  name: string
  level: number
  types: number[]
  /** [특성1, 특성2, 숨겨진] (0 = 없음) */
  abilities: [number, number, number]
  /** 4칸, 빈 칸은 -1 */
  moves: number[]
}

/** 출현 CSV: 장소, 세부 장소, 이름, 버전1, 버전2, 레벨 범위, ... (첫 줄은 헤더) */
export function parseEncounters(rows: string[][]): Encounter[] {
  return rows.slice(1).filter((r) => r.length >= 6).map((r) => ({
    location: r[0].trim(),
    subLocation: r[1].trim(),
    name: r[2].trim(),
    levelRange: r[5].trim(),
  }))
}

export function levelsFromRange(range: string): number[] {
  if (range.includes('×')) return []
  const m = range.replace(/"/g, '').match(/^(\d+)\s*[-–~]\s*(\d+)$/)
  if (m) {
    const [start, end] = [Number(m[1]), Number(m[2])]
    if (end < start) return []
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }
  const single = Number(range)
  return Number.isInteger(single) && single > 0 ? [single] : []
}

/** source 의 글자 중 target 에도 있는 글자 수 (중복은 한 번씩 소모) */
function matchingCharCount(source: string, target: string) {
  let count = 0
  let rest = target
  for (const ch of source) {
    const i = rest.indexOf(ch)
    if (i >= 0) {
      count++
      rest = rest.slice(0, i) + rest.slice(i + 1)
    }
  }
  return count
}

/** 이름 → PokeAPI 포켓몬. 한 줄 이름은 identifier 완전 일치, 폼(여러 줄)은 글자 겹침이 가장 많은 후보 */
export function matchPokemon(name: string, base: BaseData, learnset: Learnset): [number, PokemonEntry] | null {
  const formatted = name.replace(/ /g, '-').replace(/é/g, 'e').toLowerCase()
  const primary = formatted.split(/\r?\n|\r/)[0]
  const multiLine = /\r|\n/.test(name)
  const entries = Object.entries(base.pokemon).map(([id, p]) => [Number(id), p] as [number, PokemonEntry])

  if (!multiLine) {
    const exact = entries.find(([, p]) => p.i === primary)
    if (exact) return exact
  }
  const hasLevelUp = (id: number) => learnset[id]?.some(([, method]) => method === MoveMethod.LevelUp)
  const candidates = entries.filter(([id, p]) => p.i.includes(primary) && hasLevelUp(id))
  if (!multiLine) return candidates[0] ?? null
  let best: [number, PokemonEntry] | null = null
  let bestScore = -1
  for (const c of candidates) {
    const score = matchingCharCount(c[1].i, formatted)
    if (score > bestScore) {
      best = c
      bestScore = score
    }
  }
  return best
}

/** 그 레벨에 야생으로 나올 때 기술: 레벨업 기술 중 레벨 이하에서 마지막으로 배운 4개 */
export function wildMoves(learnset: Learnset, id: number, level: number): number[] {
  const levelUp = (learnset[id] ?? []).filter(([, method, lv]) => method === MoveMethod.LevelUp && lv <= level)
  const picked: number[] = []
  for (let i = levelUp.length - 1; i >= 0 && picked.length < 4; i--) {
    const m = levelUp[i][0]
    if (!picked.includes(m)) picked.push(m)
  }
  picked.reverse()
  while (picked.length < 4) picked.push(-1)
  return picked
}

export function buildWildTable(encounters: Encounter[], base: BaseData, learnset: Learnset, gen: number) {
  const rows: WildRow[] = []
  const unmatched: string[] = []
  const seen = new Set<string>()
  for (const e of encounters) {
    const match = matchPokemon(e.name, base, learnset)
    if (!match) {
      unmatched.push(e.name.replace(/\s+/g, ' '))
      continue
    }
    const [id, p] = match
    for (const level of levelsFromRange(e.levelRange)) {
      const key = `${id}:${level}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({
        id,
        name: e.name.replace(/\s*[\r\n]+\s*/g, ' '),
        level,
        types: typesAt(p, gen),
        abilities: abilitiesAt(p, gen),
        moves: wildMoves(learnset, id, level),
      })
    }
  }
  return { rows, unmatched: [...new Set(unmatched)] }
}

/** 시뮬레이션 입력 CSV 형식 (원본과 동일): Id,Name,Level,Type1,Type2,Ability1,Ability2,HiddenAbility,Move1..4 */
export const SIM_CSV_HEADER = ['Id', 'Name', 'Level', 'Type1', 'Type2', 'Ability1', 'Ability2', 'HiddenAbility', 'Move1', 'Move2', 'Move3', 'Move4']

export function rowsToSimCsv(rows: WildRow[], base: BaseData): (string | number)[][] {
  return [
    SIM_CSV_HEADER,
    ...rows.map((r) => [
      r.id, r.name, r.level,
      base.types[r.types[0]]?.[0] ?? '', base.types[r.types[1]]?.[0] ?? '',
      r.abilities[0] || -1, r.abilities[1] || -1, r.abilities[2] || -1,
      ...r.moves,
    ]),
  ]
}

export function simCsvToRows(rows: string[][], base: BaseData, gen: number): WildRow[] {
  return rows.slice(1).filter((v) => v.length >= 12).map((v) => {
    const id = Number(v[0])
    const p = base.pokemon[id]
    const num = (s: string) => (Number.isFinite(Number(s)) && s.trim() !== '' ? Number(s) : -1)
    return {
      id,
      name: v[1].trim(),
      level: Number(v[2]),
      types: p ? typesAt(p, gen) : [],
      abilities: [Math.max(0, num(v[5])), Math.max(0, num(v[6])), Math.max(0, num(v[7]))],
      moves: [num(v[8]), num(v[9]), num(v[10]), num(v[11])],
    }
  })
}
