// public/data 의 JSON 로더. 같은 파일은 한 번만 받는다.
// 데이터는 scripts/build_data.py 가 PokeAPI CSV에서 생성한다 (런타임 API 호출 없음).

/** id -> [한글명, 영문명, 종족(도감)번호] */
export type PokemonTable = Record<string, [string, string, number]>
/** id -> [한글명, 영문명, 타입id, 등장세대] */
export type MoveTable = Record<string, [string, string, number, number]>
export interface VersionGroup {
  id: number
  gen: number
  identifier: string
  ko: string
  en: string
  /** false면 PokeAPI에 기술 습득 데이터가 아직 없음 (learnsets/<id>.json 없음) */
  hasLearnset: boolean
}
/** pokemonId -> [moveId, methodId, level][] */
export type Learnset = Record<string, [number, number, number][]>

export const MoveMethod = { LevelUp: 1, Egg: 2, Tutor: 3, Machine: 4 } as const

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
export const loadVersionGroups = () => load<VersionGroup[]>('version-groups.json')
export const loadLearnset = (vg: number) => load<Learnset>(`learnsets/${vg}.json`)
