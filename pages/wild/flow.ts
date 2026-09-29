// 야생 시뮬레이션 플로우차트 (Blazor 원본 Wild-Simulation.razor + FlowNode.cs 이식).
// 스칼렛·바이올렛에서 올리르바를 중심으로 야생 포켓몬의 기술을 앙코르로 고정하는 전략의 판단 흐름.
// 좌표·분기 순서·데미지 공식(C# 정수 나눗셈, 은행가 반올림 포함)을 원본과 같게 유지한다.

import type { MoveTable, PokemonTable } from '@shared/data'
import { DANGER_ABILITIES, DANGER_MOVES } from './danger'

export type NodeType = 'start' | 'decision' | 'action'

export interface NodePokemon { name: string; color: string }

export type Survival = '버팀' | '화상 걸면 버팀' | '못 버팀'

/** 시뮬레이션할 야생 포켓몬 (특성 하나 기준) */
export interface WildMon {
  key: string
  id: number
  name: string
  level: number
  types: number[]
  ability: number
  moves: number[]
  possibleMoves: number[]
  moveDamages: Map<number, number>
  nodeList: number[]
  fling: Survival | null
  arbolivaDamage: number | null
}

interface Child {
  node: number
  cond: ((p: WildMon) => boolean) | null
  label: string | null
}

export interface FlowNode {
  id: number
  type: NodeType
  title: string
  /** 부모 기준 상대 좌표 */
  x: number
  y: number
  isLong?: boolean
  pokemon?: NodePokemon
  children: Child[]
  selectMoves?: (p: WildMon) => number[]
}

/** 올리르바 턴당 회복량: 광합성(3턴마다 1/2 → 턴당 57) + 그래스필드(1/16 → 21) */
export const ARBOLIVA_HEAL = 78

const P = {
  arboliva: { name: '올리르바', color: '#91B763' },
  gholdengo: { name: '대로트', color: '#778F72' },
  golduck: { name: '골덕', color: '#6390F0' },
  clefable: { name: '픽시', color: '#D685AD' },
  lilligant: { name: '드레디어', color: '#7AC74C' },
  drifblim: { name: '둥실라이드', color: '#8E73C5' },
  grimmsnarl: { name: '태깅구르', color: '#A33EA1' },
  sableye: { name: '깜까미', color: '#72576F' },
  flutterMane: { name: '날개치는머리', color: '#A56EA2' },
  hawlucha: { name: '루차불', color: '#C22E28' },
} satisfies Record<string, NodePokemon>

// ── 위험 기술/특성 분류
const moveIds = (pred: (m: (typeof DANGER_MOVES)[number]) => boolean) => DANGER_MOVES.filter(pred).map((m) => m[4])
const tier = (...ts: number[]) => moveIds((m) => ts.includes(m[0]))

export interface Ids {
  ghost: number[]; trap: number[]; explosion: number[]; gift: number[]
  atkUp: number[]; defDown: number[]; statChange: number[]; selfDefLower: number[]
  recoil: number[]; thrash: number[]; priority: number[]; burn: number[]; speed: number[]
  pp5: number[]; allDanger: number[]
  gas: number[]; tauntImmune: number[]; cantChange: number[]; skillSwap: number[]; dangerAbil: number[]
}

export function buildIds(moves: MoveTable): Ids {
  const pp5 = Object.entries(moves).filter(([, m]) => m[5] === 5).map(([id]) => Number(id))
  const abil = (pred: (a: (typeof DANGER_ABILITIES)[number]) => boolean) => DANGER_ABILITIES.filter(pred).map((a) => a[2])
  return {
    ghost: moveIds((m) => m[2] === '교체불가기술' || m[2] === '목숨걸기'),
    trap: moveIds((m) => m[2] === '교체불가기술'),
    explosion: moveIds((m) => m[1] === '사용 절대금지' && m[2] === '폭발기술'),
    gift: moveIds((m) => m[1] === '사용 절대금지' && m[2] === '희생변화기'),
    atkUp: tier(7),
    defDown: tier(6),
    statChange: tier(6, 7),
    recoil: tier(11),
    thrash: tier(12),
    priority: tier(8, 9, 10),
    burn: tier(4),
    speed: tier(3),
    selfDefLower: tier(13),
    pp5,
    allDanger: [...DANGER_MOVES.map((m) => m[4]), ...pp5],
    gas: abil((a) => a[1] === '화학변화가스'),
    tauntImmune: abil((a) => a[0] === '도발불가'),
    cantChange: abil((a) => a[3] === '교체불가'),
    skillSwap: abil((a) => a[3] === '동료만들기'),
    dangerAbil: abil((a) => ['우선도변화', '기술방해', '도구방해', '감염특성'].includes(a[0])),
  }
}

/** C# Math.Round 기본값 (MidpointRounding.ToEven) */
function roundEven(x: number) {
  const r = Math.round(x)
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r
}

export class WildFlow {
  nodes: FlowNode[] = []
  private byId = new Map<number, FlowNode>()
  private parent = new Map<number, number>()

  constructor(private moves: MoveTable, private pokemon: PokemonTable, private ids: Ids) {
    this.build()
    // 원본 GetAbsoluteX: 자신을 자식으로 가진 노드 중 목록에서 가장 앞선 노드가 부모
    for (const n of this.nodes) {
      for (const c of n.children) if (!this.parent.has(c.node)) this.parent.set(c.node, n.id)
    }
  }

  node(id: number) {
    return this.byId.get(id)!
  }

  abs(id: number): { x: number; y: number } {
    const n = this.node(id)
    const pid = this.parent.get(id)
    if (pid === undefined) return { x: n.x, y: n.y }
    const p = this.abs(pid)
    return { x: n.x + p.x, y: n.y + p.y }
  }

  // ── 조건 헬퍼
  private damageOk = (p: WildMon, m: number) => {
    const d = p.moveDamages.get(m)
    return d === undefined || d < ARBOLIVA_HEAL
  }
  private checkMoves = (p: WildMon, ids: number[]) => p.possibleMoves.some((m) => ids.includes(m))
  private checkMovesWithDamage = (p: WildMon, ids: number[]) => p.possibleMoves.some((m) => ids.includes(m) && this.damageOk(p, m))
  /** 위험 기술이 아닌 기술이 전부 회복량 이상 데미지면 true */
  private checkAllMoves = (p: WildMon, ids: number[]) => p.possibleMoves.every((m) => ids.includes(m) || !this.damageOk(p, m))
  private checkAbilities = (p: WildMon, ids: number[]) => ids.includes(p.ability)
  /** 첫 기술이 격투/비행/독/벌레/불꽃/얼음 공격기 → 물 테라스탈 */
  private checkMoveType = (p: WildMon) => {
    const m = this.moves[p.possibleMoves[0]]
    return !!m && m[8] !== 1 && [2, 3, 4, 7, 10, 15].includes(m[2])
  }
  private check4StatusMoves = (p: WildMon) => {
    for (const id of p.possibleMoves) {
      if (id === -1) continue
      const m = this.moves[id]
      if (m && m[8] !== 1) {
        if (this.damageOk(p, id)) return false
        if (!this.checkMoves(p, this.ids.allDanger)) return false
      }
    }
    return true
  }

  private build() {
    const ids = this.ids
    const H = ARBOLIVA_HEAL
    const add = (n: Omit<FlowNode, 'children'>) => {
      const node: FlowNode = { ...n, children: [] }
      this.nodes.push(node)
      this.byId.set(node.id, node)
      return node
    }
    const keep = (list: number[]) => (p: WildMon) => p.possibleMoves.filter((m) => list.includes(m))

    // 노드 추가 순서가 좌표 계산(부모 찾기)에 영향을 주므로 원본 순서를 그대로 유지
    const start = add({ id: 0, type: 'start', title: '시작', x: 8000, y: 1000, selectMoves: (p) => p.possibleMoves.filter((m) => m !== -1) })
    const d1 = add({ id: 1, type: 'decision', title: '목숨걸기나 교체불가기 보유?', x: 0, y: 100 })
    const d1y = add({ id: 2, type: 'action', title: '고스트 선두 or 테라스탈', x: -150, y: 100 })
    const d2 = add({ id: 3, type: 'decision', title: '폭발기 보유?', x: 0, y: 200 })
    const d21 = add({ id: 4, type: 'decision', title: '화학변화가스?', x: -300, y: 100 })
    const d21y1 = add({ id: 5, type: 'action', title: '둥실라이드 봉인', pokemon: P.drifblim, x: -300, y: 300 })
    const d21y2 = add({ id: 6, type: 'action', title: '드레디어 앙코르 동료만들기', pokemon: P.lilligant, x: 0, y: 300 })
    const d21n = add({ id: 7, type: 'action', title: '골덕 선두', pokemon: P.golduck, x: 150, y: 100 })
    const d3 = add({ id: 8, type: 'decision', title: '멸망의노래 or 추억의선물?', x: 0, y: 300 })
    const d31 = add({ id: 9, type: 'decision', title: '도발 써도 됨?', x: -150, y: 100 })
    const d31y = add({ id: 10, type: 'action', title: '날개치는머리 봉인', pokemon: P.flutterMane, x: 150, y: 200,
      selectMoves: (p) => p.possibleMoves.filter((m) => m !== 195 && m !== 262) })
    const d32 = add({ id: 11, type: 'decision', title: '도발 무시 특성?', x: -150, y: 100 })
    const notStatus = (p: WildMon) => p.possibleMoves.filter((m) => this.moves[m]?.[8] !== 1)
    const d32y = add({ id: 12, type: 'action', title: '루차불 도발', pokemon: P.hawlucha, x: -150, y: 100, selectMoves: notStatus })
    const d32n = add({ id: 13, type: 'action', title: '도발', x: 150, y: 100, selectMoves: notStatus })
    const d4 = add({ id: 14, type: 'decision', title: '전부 위험기술?', x: 600, y: 400 })
    const d4n = add({ id: 15, type: 'action', title: '안전한 기술 앙코르', x: 300, y: 200,
      selectMoves: (p) => p.possibleMoves
        .filter((m) => m !== -1 && !ids.allDanger.includes(m) && p.moveDamages.has(m))
        .sort((a, b) => p.moveDamages.get(a)! - p.moveDamages.get(b)!) })
    const dPri = add({ id: 27, type: 'decision', title: `${H}뎀 미만 선공기 있음?`, x: -150, y: 100 })
    const dDef = add({ id: 16, type: 'decision', title: '방/특방 감소 기술 있음?', x: -150, y: 100 })
    const dDefY1 = add({ id: 17, type: 'decision', title: `6랭크 깎여도 ${H}뎀 미만?`, x: 300, y: 100 })
    const dDefY2 = add({ id: 18, type: 'action', title: '앙코르로 고정', x: 0, y: 300, selectMoves: keep(ids.statChange) })
    const dRecoilSwap = add({ id: 19, type: 'decision', title: '특성 교체 가능?', x: -150, y: 200,
      selectMoves: (p) => p.possibleMoves.filter((m) => !ids.statChange.includes(m)) })
    const dRecoil = add({ id: 20, type: 'decision', title: `${H}뎀 미만 반동기 있음?`, x: -300, y: 100 })
    const dRecoilY1 = add({ id: 21, type: 'action', title: '반동기 앙코르', x: -150, y: 100, selectMoves: keep(ids.recoil) })
    const dRecoilY2 = add({ id: 22, type: 'action', title: '픽시 스킬스왑', pokemon: P.clefable, x: 0, y: 200 })
    const dThrash = add({ id: 23, type: 'decision', title: `${H}뎀 미만 난동기 있음?`, x: 150, y: 100 })
    const dThrashY1 = add({ id: 24, type: 'action', title: '난동기 앙코르', x: -150, y: 100, selectMoves: keep(ids.thrash) })
    const dThrashY2 = add({ id: 25, type: 'action', title: '드레디어 동료만들기', pokemon: P.lilligant, x: 0, y: 100 })
    const dThrashY3 = add({ id: 26, type: 'action', title: '골덕 앙코르', pokemon: P.golduck, x: 150, y: 200 })
    const dPriY = add({ id: 28, type: 'action', title: '선공기 쓴 턴에 앙코르', x: 300, y: 100, selectMoves: keep(ids.priority) })
    const dBurn = add({ id: 29, type: 'decision', title: `${H}뎀 미만 상태이상기 있음?`, x: 150, y: 300 })
    const dBurnY1 = add({ id: 30, type: 'action', title: '올리르바 화상 걸어두기', pokemon: P.arboliva, x: 225, y: 100 })
    const dBurnY2 = add({ id: 31, type: 'action', title: '상태이상 기술 앙코르', x: 0, y: 100, selectMoves: keep(ids.burn) })
    const dSpeed = add({ id: 32, type: 'decision', title: '스피드 변화 기술 있음?', x: -150, y: 200 })
    const dSpeedY = add({ id: 33, type: 'action', title: '깜까미 앙코르', pokemon: P.sableye, x: -150, y: 100, selectMoves: keep(ids.speed) })
    const dTrap = add({ id: 67, type: 'decision', title: `${H}뎀 미만 교체불가기 있음?`, x: 150, y: 100 })
    const dTrapY = add({ id: 68, type: 'action', title: '교체불가기 고정', x: 150, y: 100, selectMoves: keep(ids.trap) })
    const dPP5 = add({ id: 34, type: 'decision', title: `${H}뎀 미만 PP 5 기술 있음?`, x: -150, y: 100 })
    const dPP5Y = add({ id: 35, type: 'action', title: 'PP 5 기술 고정', x: 150, y: 200, selectMoves: keep(ids.pp5) })
    const unplayable = add({ id: 36, type: 'start', title: '모든 기술이 위험함', x: -150, y: 100 })
    const dAbilSwap = add({ id: 37, type: 'decision', title: '특성 교체 가능?', x: -300, y: 300 })
    const impossible = add({ id: 38, type: 'start', title: '플랜A B 둘 다 불가능', x: -150, y: 100 })

    // 플랜 A
    const aStart = add({ id: 39, type: 'action', title: '반드시 플랜 A 필요', x: 150, y: 100 })
    const aSoak = add({ id: 40, type: 'action', title: '골덕 물붓기', pokemon: P.golduck, x: 0, y: 200 })
    const aEncore = add({ id: 41, type: 'action', title: '앙코르 갱신', x: 0, y: 100 })
    const aSkillSwapQ = add({ id: 42, type: 'decision', title: '스킬스왑 사용 가능?', x: 0, y: 100 })
    const aSkillSwapN = add({ id: 43, type: 'action', title: '드레디어 동료만들기', pokemon: P.lilligant, x: 150, y: 100 })
    const aFaster = add({ id: 44, type: 'decision', title: '상대가 대로트보다 빠름?', x: -150, y: 200 })
    const aFasterY1 = add({ id: 45, type: 'action', title: '태깅구르 트릭', pokemon: P.grimmsnarl, x: -150, y: 100 })
    const aFasterY2 = add({ id: 46, type: 'action', title: '태깅구르 겁나는얼굴', pokemon: P.grimmsnarl, x: 0, y: 100 })
    const aFasterN = add({ id: 47, type: 'action', title: '대로트 구애안경 트릭', pokemon: P.gholdengo, x: 150, y: 100 })
    const aSkillSwap = add({ id: 48, type: 'action', title: '대로트 스킬스왑', pokemon: P.gholdengo, x: 150, y: 100 })
    const aLeppa = add({ id: 49, type: 'action', title: '깜까미 앙코르 트릭', pokemon: P.sableye, x: 0, y: 100 })
    const aTera = add({ id: 50, type: 'decision', title: '격투/비행/독/벌레/불꽃/얼음?', x: 0, y: 100 })
    const aTeraY = add({ id: 51, type: 'action', title: '올리르바 물 테라스탈', pokemon: P.arboliva, x: -150, y: 100 })
    const aEnd = add({ id: 52, type: 'start', title: '플랜A 시작', x: 150, y: 200 })

    // 플랜 B
    const bStart = add({ id: 53, type: 'action', title: '반드시 플랜 B 필요', x: 0, y: 1100 })
    const bFling = add({ id: 54, type: 'decision', title: '올리르바 내던지기 버팀?', x: 0, y: 100, isLong: true })
    const bBurn = add({ id: 55, type: 'action', title: '올리르바 화상 걸어두기', pokemon: P.arboliva, x: -150, y: 100 })
    const dFling = add({ id: 56, type: 'decision', title: '올리르바 내던지기 버팀?', x: 0, y: 1000, isLong: true })
    const dFlingBurn = add({ id: 57, type: 'action', title: '올리르바 화상 걸어두기', pokemon: P.arboliva, x: 150, y: 100 })
    const bAbility = add({ id: 58, type: 'decision', title: '위험한 특성?', x: 600, y: 1900, isLong: true })
    const bSkillSwap = add({ id: 59, type: 'action', title: '골덕 스킬스왑', pokemon: P.golduck, x: -150, y: 100 })
    const bSoak = add({ id: 60, type: 'action', title: '골덕 물붓기', pokemon: P.golduck, x: 150, y: 200 })
    const bFaster = add({ id: 61, type: 'decision', title: '상대가 대로트보다 빠름?', x: -150, y: 200 })
    const bFasterY = add({ id: 62, type: 'action', title: '태깅구르 트릭', pokemon: P.grimmsnarl, x: -150, y: 100 })
    const bFasterN = add({ id: 63, type: 'action', title: '대로트 구애안경 트릭', pokemon: P.gholdengo, x: 150, y: 100 })
    const bTera = add({ id: 64, type: 'decision', title: '격투/비행/독/벌레/불꽃/얼음?', x: 0, y: 100 })
    const bTeraY = add({ id: 65, type: 'action', title: '올리르바 물 테라스탈', pokemon: P.arboliva, x: -150, y: 100 })
    const bEnd = add({ id: 66, type: 'start', title: '플랜B 시작', x: 150, y: 200 })

    const link = (from: FlowNode, to: FlowNode, cond: Child['cond'] = null, label: string | null = null) =>
      from.children.push({ node: to.id, cond, label })
    const yes = 'Yes'
    const no = 'No'

    link(start, d1)
    link(d1, d1y, (p) => this.checkMoves(p, ids.ghost), yes)
    link(d1, d2, (p) => !this.checkMoves(p, ids.ghost), no)
    link(d1y, d2)

    link(d2, d21, (p) => this.checkMoves(p, ids.explosion), yes)
    link(d2, d3, (p) => !this.checkMoves(p, ids.explosion), no)
    link(d21, d21y1, (p) => this.checkAbilities(p, ids.gas), yes)
    link(d21, d21n, (p) => !this.checkAbilities(p, ids.gas), no)
    link(d21y1, d21y2, null, '드레디어 교체')
    link(d21n, d3)

    link(d3, d31, (p) => this.checkMoves(p, ids.gift), yes)
    link(d3, d4, (p) => !this.checkMoves(p, ids.gift), no)
    link(d31, d31y, (p) => this.check4StatusMoves(p), no)
    link(d31, d32, (p) => !this.check4StatusMoves(p), yes)
    link(d31y, d4, null, '골덕 교체')
    link(d32, d32y, (p) => this.checkAbilities(p, ids.tauntImmune), yes)
    link(d32, d32n, (p) => !this.checkAbilities(p, ids.tauntImmune), no)
    link(d32y, d4)
    link(d32n, d4)

    link(d4, dPri, (p) => this.checkAllMoves(p, ids.allDanger), yes)
    link(d4, d4n, (p) => !this.checkAllMoves(p, ids.allDanger), no)

    link(dPri, dDef, (p) => !this.checkMovesWithDamage(p, ids.priority), no)
    link(dPri, dPriY, (p) => this.checkMovesWithDamage(p, ids.priority), yes)

    const statChangeWeak = (p: WildMon) =>
      p.possibleMoves.some((m) => ids.statChange.includes(m) && p.moveDamages.has(m) && p.moveDamages.get(m)! < H)
    link(dDef, dDefY1, (p) => this.checkMoves(p, ids.statChange), yes)
    link(dDef, dRecoilSwap, (p) => !this.checkMoves(p, ids.statChange), no)
    link(dDefY1, dDefY2, statChangeWeak, yes)
    link(dDefY1, dRecoilSwap, (p) => !statChangeWeak(p), no)

    link(dRecoilSwap, dRecoil, (p) => !this.checkAbilities(p, ids.cantChange), yes)
    link(dRecoilSwap, dBurn, (p) => this.checkAbilities(p, ids.cantChange), no)

    link(dRecoil, dThrash, (p) => !this.checkMovesWithDamage(p, ids.recoil), no)
    link(dRecoil, dRecoilY1, (p) => this.checkMovesWithDamage(p, ids.recoil), yes)
    link(dRecoilY1, dRecoilY2)

    link(dThrash, dBurn, (p) => !this.checkMovesWithDamage(p, ids.thrash), no)
    link(dThrash, dThrashY1, (p) => this.checkMovesWithDamage(p, ids.thrash), yes)
    link(dThrashY1, dThrashY2)

    link(dRecoilY2, dThrashY3)
    link(dThrashY2, dThrashY3, null, '골덕 교체')

    link(dBurn, dBurnY1, (p) => this.checkMovesWithDamage(p, ids.burn), yes)
    link(dBurn, dSpeed, (p) => !this.checkMovesWithDamage(p, ids.burn), no)
    link(dBurnY1, dBurnY2)

    link(dSpeed, dSpeedY, (p) => this.checkMoves(p, ids.speed), yes)
    link(dSpeed, dTrap, (p) => !this.checkMoves(p, ids.speed), no)

    link(dTrap, dTrapY, (p) => this.checkMovesWithDamage(p, ids.trap), yes)
    link(dTrap, dPP5, (p) => !this.checkMovesWithDamage(p, ids.trap), no)

    link(dPP5, dPP5Y, (p) => this.checkMovesWithDamage(p, ids.pp5), yes)
    link(dPP5Y, aStart)
    link(dPP5, unplayable, (p) => !this.checkMovesWithDamage(p, ids.pp5), no)

    // 특성 바꿀 수 있는지로 모으기
    link(d4n, dFling)
    link(dDefY2, dFling)
    link(dBurnY2, dFling)
    link(dPriY, dFling)
    link(dTrapY, dFling)

    // 반드시 플랜 B
    link(dSpeedY, bStart)
    link(dThrashY3, bStart)
    link(d21y2, bStart)

    link(bStart, bFling)
    link(bFling, bAbility, (p) => p.fling === '버팀', yes)
    link(bFling, bBurn, (p) => p.fling === '화상 걸면 버팀', '화상 걸면 버팀')
    link(bFling, impossible, (p) => p.fling === '못 버팀', no)
    link(bBurn, bAbility)

    // 플랜 A
    link(aStart, dAbilSwap)
    link(dAbilSwap, impossible, (p) => this.checkAbilities(p, ids.cantChange), no)
    link(dAbilSwap, aSoak, (p) => !this.checkAbilities(p, ids.cantChange), yes)
    link(aSoak, aEncore)
    link(aEncore, aSkillSwapQ)
    link(aSkillSwapQ, aFaster, (p) => !this.checkAbilities(p, ids.skillSwap), yes)
    link(aSkillSwapQ, aSkillSwapN, (p) => this.checkAbilities(p, ids.skillSwap), no)
    link(aSkillSwapN, aFaster)
    const fasterA = (p: WildMon) => this.checkMoves(p, ids.speed) || this.checkMoves(p, ids.priority)
    link(aFaster, aFasterY1, fasterA, yes)
    link(aFasterY1, aFasterY2)
    link(aFaster, aFasterN, (p) => !fasterA(p), no)
    link(aFasterY2, aSkillSwap)
    link(aFasterN, aSkillSwap)
    link(aSkillSwap, aLeppa)
    link(aLeppa, aTera)
    link(aTera, aEnd, (p) => !this.checkMoveType(p), no)
    link(aTera, aTeraY, (p) => this.checkMoveType(p), yes)
    link(aTeraY, aEnd)

    // 플랜 B
    link(dFling, bAbility, (p) => p.fling === '버팀', yes)
    link(dFling, dFlingBurn, (p) => p.fling === '화상 걸면 버팀', '화상 걸면 버팀')
    link(dFling, aStart, (p) => p.fling === '못 버팀', no)
    link(dFlingBurn, bAbility)
    const dangerAbility = (p: WildMon) =>
      this.checkAbilities(p, ids.dangerAbil) && ![dThrashY2.id, dRecoilY2.id, d21y2.id].some((n) => p.nodeList.includes(n))
    link(bAbility, bSkillSwap, dangerAbility, yes)
    link(bAbility, bSoak, (p) => !dangerAbility(p), no)
    link(bSkillSwap, bSoak)
    link(bSoak, bFaster)
    const fasterB = (p: WildMon) => p.possibleMoves.length > 0 && (ids.priority.includes(p.possibleMoves[0]) || ids.speed.includes(p.possibleMoves[0]))
    link(bFaster, bFasterY, fasterB, yes)
    link(bFasterY, bTera)
    link(bFaster, bFasterN, (p) => !fasterB(p), no)
    link(bFasterN, bTera)
    link(bTera, bEnd, (p) => !this.checkMoveType(p), no)
    link(bTera, bTeraY, (p) => this.checkMoveType(p), yes)
    link(bTeraY, bEnd)
  }

  // ── 계산

  private stat(id: number, index: number) {
    return this.pokemon[id]?.st[index] ?? 0
  }

  /** 야생 포켓몬 기술이 올리르바(Lv94, 방어 204, 특방 239)에게 주는 데미지 */
  attackDamage(p: WildMon, moveId: number): number {
    const m = this.moves[moveId]
    if (!m) return 0
    const power = m[4] ?? 0
    const L = p.level
    const actualAtk = Math.floor((Math.floor(((this.stat(p.id, 1) * 2 + 31) * L) / 100) + 5) * 1.1)
    const actualSpA = Math.floor((Math.floor(((this.stat(p.id, 3) * 2 + 31) * L) / 100) + 5) * 1.1)
    const atkMul = this.ids.atkUp.includes(moveId) ? 4 : 1
    const defDiv = this.ids.defDown.includes(moveId) ? 4 : 1
    const levelTerm = Math.trunc((2 * L) / 5) + 2
    const calc = (atk: number, def: number) =>
      roundEven((Math.floor(Math.trunc((levelTerm * power * Math.trunc(atk * atkMul)) / Math.trunc(def / defDiv)) / 50 + 2)) * 1.5)

    let dmg = m[8] === 2 ? calc(actualAtk, 204) : m[8] === 3 ? calc(actualSpA, 239) : 0
    const type = m[2]
    if ([5, 9, 12, 13, 15].includes(type)) dmg = roundEven(dmg / 2)
    else if (type === 11) dmg = roundEven((dmg / 4) * 1.5)
    else if (type === 8) dmg = 0
    return dmg
  }

  /** 올리르바 내던지기(위력 10… 원본 공식 그대로)를 그래스필드 회복으로 버티는지 */
  flingSurvival(p: WildMon): Survival {
    const hp = this.stat(p.id, 0)
    const def = this.stat(p.id, 2)
    const actualHP = Math.floor(((hp * 2 + 100) * p.level) / 100 + 10)
    const actualDef = Math.floor(((def * 2 * p.level) / 100 + 5) * 0.9)
    const mul = p.possibleMoves.length > 0 && this.ids.selfDefLower.includes(p.possibleMoves[0]) ? 4 : 1
    const calc = Math.floor(47580 / Math.floor(actualDef / mul) / 50 + 2) * 1.5
    const fling = Math.floor(calc)
    const burned = Math.floor(calc / 2)
    const grassy = Math.floor(actualHP / 16) * 9
    if (fling <= grassy) return '버팀'
    if (burned <= grassy) return '화상 걸면 버팀'
    return '못 버팀'
  }

  /** 한 마리 시뮬레이션: 시작 노드부터 조건을 따라 끝까지. 지나간 노드/간선을 돌려준다 */
  run(p: WildMon): { nodes: number[]; edges: string[] } {
    p.moveDamages = new Map(p.moves.filter((m) => m !== -1).map((m) => [m, this.attackDamage(p, m)]))
    p.possibleMoves = [...p.moves]
    p.fling = this.flingSurvival(p)
    p.nodeList = []
    const edges: string[] = []

    let current: FlowNode | undefined = this.nodes[0]
    const guard = new Set<number>()
    while (current && !guard.has(current.id)) {
      guard.add(current.id)
      p.nodeList.push(current.id)
      let next = 0
      if (current.type === 'decision') {
        const i = current.children.findIndex((c) => c.cond?.(p))
        if (i >= 0) next = i
      }
      if (current.selectMoves) p.possibleMoves = current.selectMoves(p)
      const child: Child | undefined = current.children[next]
      if (!child) break
      edges.push(`${current.id}-${child.node}`)
      current = this.node(child.node)
    }
    const first = p.possibleMoves[0]
    p.arbolivaDamage = first !== undefined && p.moveDamages.has(first) ? p.moveDamages.get(first)! : null
    return { nodes: p.nodeList, edges }
  }
}

/** 테이블 한 줄 → 특성별 시뮬레이션 대상 (특성1, 특성2 각각. 숨겨진 특성은 원본처럼 제외) */
export function toWildMons(rows: { id: number; name: string; level: number; types: number[]; abilities: number[]; moves: number[] }[]): WildMon[] {
  const out: WildMon[] = []
  rows.forEach((r, i) => {
    for (const ability of [r.abilities[0], r.abilities[1]]) {
      if (!ability || ability === -1) continue
      out.push({
        key: `${i}-${ability}`, id: r.id, name: r.name, level: r.level, types: r.types, ability,
        moves: [...r.moves], possibleMoves: [...r.moves], moveDamages: new Map(), nodeList: [], fling: null, arbolivaDamage: null,
      })
    }
  })
  return out
}
