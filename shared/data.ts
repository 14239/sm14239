// public/data 의 JSON 로더와 조회 헬퍼. 같은 파일은 한 번만 받는다.
// 데이터는 scripts/build_data.py 가 PokeAPI CSV에서 생성한다 (런타임 API 호출 없음).

/** [한글명, 영문명] */
export type Names = [string, string]

export interface PokemonEntry {
  /** 이름 [한, 영] (폼이면 폼 이름 포함) */
  n: Names
  /** 영문 identifier (예: raichu-alola) */
  i: string
  /** 종족(도감) 번호 */
  s: number
  /** 현재 타입 id 1~2개 */
  t: number[]
  /** 현재 특성 [1, 2, 숨겨진] (0 = 없음) */
  a: [number, number, number]
  /** 종족값 [H, A, B, C, D, S] */
  st: number[]
  /** 과거 타입: [그 세대까지, 타입1, 타입2?][] */
  pt?: number[][]
  /** 과거 특성: [그 세대까지, 슬롯(1~3), 특성id(0=없음)][] */
  pa?: number[][]
  /** 기본 폼이 아님 */
  f?: 1
}
export type PokemonTable = Record<string, PokemonEntry>

/** id -> [한, 영, 타입, 세대, 위력, PP, 명중, 우선도, 분류(1변화 2물리 3특수)] */
export type MoveTable = Record<string, [string, string, number, number, number | null, number | null, number | null, number, number]>
/** id -> [한, 영, 등장세대] */
export type AbilityTable = Record<string, [string, string, number]>
/** id -> [한, 영] */
export type TypeTable = Record<string, Names>

export interface VersionGroup {
  id: number
  gen: number
  identifier: string
  ko: string
  en: string
  /** false면 PokeAPI에 기술 습득 데이터가 아직 없음 (learnsets/<id>.json 없음) */
  hasLearnset: boolean
}
/** pokemonId -> [moveId, methodId, level][]  (방법·레벨·게임 내 순서로 정렬됨) */
export type Learnset = Record<string, [number, number, number][]>

export const MoveMethod = { LevelUp: 1, Egg: 2, Tutor: 3, Machine: 4 } as const

export const MOVE_METHODS: Record<number, Names> = {
  1: ['레벨업', 'Level Up'],
  2: ['알기술', 'Egg'],
  3: ['기술가르침', 'Tutor'],
  4: ['기술머신', 'TM'],
  5: ['스타디움', 'Stadium'],
  6: ['전기구슬', 'Light Ball'],
  7: ['콜로세움 정화', 'Colosseum'],
  8: ['XD 다크', 'XD Shadow'],
  9: ['XD 리라이브', 'XD Purification'],
  10: ['폼체인지', 'Form Change'],
  11: ['지가르데 큐브', 'Zygarde Cube'],
  12: ['트레이닝', 'Train'],
}

export const SMEARGLE = 235

const cache = new Map<string, Promise<unknown>>()

function load<T>(path: string): Promise<T> {
  let p = cache.get(path)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/${path}`).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`)
      return r.json()
    })
    cache.set(path, p)
  }
  return p as Promise<T>
}

export const loadPokemon = () => load<PokemonTable>('pokemon.json')
export const loadMoves = () => load<MoveTable>('moves.json')
export const loadAbilities = () => load<AbilityTable>('abilities.json')
export const loadTypes = () => load<TypeTable>('types.json')
export const loadVersionGroups = () => load<VersionGroup[]>('version-groups.json')
export const loadLearnset = (vg: number) => load<Learnset>(`learnsets/${vg}.json`)

export interface BaseData {
  pokemon: PokemonTable
  moves: MoveTable
  abilities: AbilityTable
  types: TypeTable
  groups: VersionGroup[]
}

export const loadBase = (): Promise<BaseData> =>
  Promise.all([loadPokemon(), loadMoves(), loadAbilities(), loadTypes(), loadVersionGroups()]).then(
    ([pokemon, moves, abilities, types, groups]) => ({ pokemon, moves, abilities, types, groups }),
  )

/** 해당 세대 기준 타입 (페어리 이전의 노말 등 과거 타입 반영) */
export function typesAt(p: PokemonEntry, gen: number): number[] {
  const past = p.pt?.find(([g]) => g >= gen)
  return past ? past.slice(1) : p.t
}

/** 해당 세대 기준 특성 [1, 2, 숨겨진] (0 = 없음). 1·2세대는 특성이 없다. */
export function abilitiesAt(p: PokemonEntry, gen: number): [number, number, number] {
  if (gen < 3) return [0, 0, 0]
  const a: [number, number, number] = [...p.a]
  for (let slot = 1; slot <= 3; slot++) {
    const past = p.pa?.filter(([g, s]) => s === slot && g >= gen).sort((x, y) => x[0] - y[0])[0]
    if (past) a[slot - 1] = past[2]
  }
  return a
}
