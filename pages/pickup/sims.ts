// 픽업(과사열매) 무한 PP 시뮬레이션. Blazor 원본(Pickup-Simulation1~4)의 로직을 그대로 옮겼다.
// 각 시나리오는 한 판을 끝까지 돌리고 (끝난 턴, 종료 사유, 로그)를 돌려준다.

class Move {
  constructor(public name: string, public pp: number, public max: number) {}
  use() {
    this.pp--
  }
}

class Mon {
  hasBerry = false
  usedBerryThisTurn = false
  yawnCounter = 0
  encoreCounter = 0
  isAsleep = false
  isHit = false
  sleepTurnsLeft = 0
  constructor(public name: string, public moves: Move[]) {}
  move(name: string) {
    return this.moves.find((m) => m.name === name)
  }
  ppString() {
    return this.moves.map((m) => `${m.name}(${m.pp}/${m.max})`).join(', ')
  }
}

/** C# new Random().Next(min, max) — max 미포함 */
const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min))

export type EndReason = '열매 소실' | '상대 PP 소진' | '앙코르 종료 후 공격' | '무한 지속 (턴 제한 도달)'

export interface SimResult {
  turns: number
  reason: EndReason
  log: string[]
}

const LOG_LIMIT = 1000

abstract class Simulation {
  protected log: string[] = []
  protected turns = 0
  protected reason: EndReason = '무한 지속 (턴 제한 도달)'
  protected abstract player: Mon
  protected abstract opponent: Mon
  protected abstract maxTurns: number

  protected abstract playerTurn(): void
  protected abstract opponentTurn(): void
  /** 턴 끝 상태 처리 (하품/앙코르 카운트) */
  protected abstract endOfTurnStatus(): void

  run(): SimResult {
    for (this.turns = 0; this.turns < this.maxTurns; this.turns++) {
      this.log.push(`턴 ${this.turns + 1} 시작`)
      this.playerTurn()
      this.checkBerry(this.player)
      this.checkBerry(this.opponent)
      this.opponentTurn()
      this.checkBerry(this.player)
      this.checkBerry(this.opponent)
      this.endOfTurnStatus()
      this.pickup()
      this.checkBerry(this.player)
      this.checkBerry(this.opponent)
      if (this.isOver()) break
      if (this.log.length > LOG_LIMIT * 2) this.log = this.log.slice(-LOG_LIMIT)
    }
    return { turns: this.turns + 1, reason: this.reason, log: this.log.slice(-LOG_LIMIT) }
  }

  protected swapBerry() {
    const o = this.opponent.hasBerry
    this.opponent.hasBerry = this.player.hasBerry
    this.player.hasBerry = o
  }

  protected checkBerry(mon: Mon) {
    if (mon.hasBerry && mon.moves.some((m) => m.pp === 0)) {
      mon.hasBerry = false
      mon.usedBerryThisTurn = true
      const empty = mon.moves.find((m) => m.pp === 0)
      if (empty) {
        empty.pp = Math.min(empty.max, empty.pp + 10)
        this.log.push(`${mon.name}가 과사열매를 사용해 ${empty.name}의 PP를 회복했다!`)
      }
    }
  }

  protected pickup() {
    if (!this.player.hasBerry && (this.player.usedBerryThisTurn || this.opponent.usedBerryThisTurn)) {
      this.player.hasBerry = true
      this.log.push(`${this.player.name}가 과사열매를 회수했다!`)
    }
    this.player.usedBerryThisTurn = false
    this.opponent.usedBerryThisTurn = false
  }

  protected isOver(): boolean {
    if (!this.player.hasBerry && !this.opponent.hasBerry) {
      this.log.push(`${this.turns + 1}턴에 과사열매가 사라졌다!`)
      this.reason = '열매 소실'
      return true
    }
    if (this.opponent.moves.every((m) => m.pp === 0)) {
      this.log.push(`${this.opponent.name}의 모든 기술의 PP가 소진되었다!`)
      this.reason = '상대 PP 소진'
      return true
    }
    return false
  }

  /** 잠든 상대는 행동하지 않고, 아니면 PP 남은 기술 중 무작위 사용 */
  protected sleepyOpponentTurn(onMove?: (m: Move) => void) {
    const opp = this.opponent
    if (opp.isAsleep) {
      if (opp.sleepTurnsLeft <= 0) {
        opp.isAsleep = false
        this.log.push(`${opp.name}가 깨어났다!`)
      } else {
        this.log.push(`${opp.name}는 잠들어있다!`)
        this.log.push(`${opp.name}의 기술 PP: ${opp.ppString()}`)
        opp.sleepTurnsLeft--
        return
      }
    }
    const available = opp.moves.filter((m) => m.pp > 0)
    if (available.length > 0) {
      const move = available[rand(0, available.length)]
      move.use()
      this.log.push(`${opp.name}가 ${move.name}을 사용했다!`)
      onMove?.(move)
      this.log.push(`${opp.name}의 기술 PP: ${opp.ppString()}`)
    }
  }

  /** 하품 카운트가 끝나면 상대가 1~3턴 잠든다 */
  protected yawnStatus() {
    const opp = this.opponent
    if (opp.yawnCounter !== 0) {
      opp.yawnCounter--
      if (opp.yawnCounter === 0) {
        opp.isAsleep = true
        opp.sleepTurnsLeft = rand(1, 4)
        this.log.push(`${opp.name}가 잠들어 버렸다!`)
      }
    }
  }

  protected opponentHasEmptyMove() {
    return this.opponent.moves.some((m) => m.pp === 0)
  }

  /** 잠든 망망이의 턴 처리 (2·3차전 공통). 잠들어 있으면 true */
  protected sleepingPlayer(talkOptions: number) {
    const p = this.player
    if (p.isAsleep) {
      if (p.sleepTurnsLeft <= 0) {
        p.isAsleep = false
        this.log.push(`${p.name}가 깨어났다!`)
      } else {
        this.log.push(`${p.name}는 잠들어있다!`)
        p.sleepTurnsLeft--
      }
    }
    if (!p.isAsleep) return false

    const trick = p.move('트릭')!
    const talk = p.move('잠꼬대')
    // 트릭이 1 남아서 잠꼬대로 열매를 줘야 할 때
    if (talk && trick.pp === 1 && p.hasBerry && talk.pp > 1) {
      talk.use()
      const pp = `(남은 PP : ${talk.pp} / ${talk.max})`
      switch (rand(0, talkOptions)) {
        case 0:
          this.log.push(`!!! ${p.name} 잠꼬대로 트릭 사용! ${pp}`)
          this.swapBerry()
          break
        case 1:
          this.log.push(`!!! ${p.name} 잠꼬대로 잠자기 사용! ${pp}`)
          break
        case 2:
          this.log.push(`!!! ${p.name} 잠꼬대로 하품 사용! ${pp}`)
          if (this.opponent.yawnCounter === 0) this.opponent.yawnCounter = 2
          break
      }
    }
    return true
  }

  /** 트릭 PP 2(열매 있음) / 1(열매 없음) 남았을 때 연속 사용 */
  protected trickChain(trick: Move, extra = true): boolean {
    const p = this.player
    if (trick.pp === 2 && p.hasBerry && extra) {
      trick.use()
      this.log.push(`!!! ${p.name}의 ${trick.name} 연속 사용 2! (남은 PP : ${trick.pp} / ${trick.max})`)
      this.swapBerry()
      return true
    }
    if (trick.pp === 1 && !p.hasBerry) {
      trick.use()
      this.log.push(`!!! ${p.name}의 ${trick.name} 연속 사용 1! (남은 PP : ${trick.pp} / ${trick.max})`)
      this.swapBerry()
      return true
    }
    return false
  }

  protected trickNormally(trick: Move) {
    trick.use()
    this.swapBerry()
    const p = this.player
    this.log.push(`${p.name}가 ${trick.name}을 사용해 열매를 ${p.hasBerry ? '가져왔다' : '넘겼다'}! (남은 PP : ${trick.pp} / ${trick.max})`)
  }
}

const happiny = (lightScreenPP = 30) =>
  new Mon('해피너스', [new Move('빛의장막', lightScreenPP, 30), new Move('이판사판태클', 15, 15), new Move('알낳기', 5, 5)])

/** 1차전: 망망이 트릭 + 하품(즉시 수면으로 계산) */
class Sim1 extends Simulation {
  protected maxTurns = 60000
  protected player = Object.assign(new Mon('망망이', [new Move('트릭', 10, 10), new Move('하품', 10, 10)]), { hasBerry: true })
  protected opponent = happiny()

  protected playerTurn() {
    const p = this.player
    const opp = this.opponent
    const trick = p.move('트릭')!
    const yawn = p.move('하품')!
    const isTrick = this.opponentHasEmptyMove()

    if (!opp.isAsleep && yawn.pp > 0 && !(yawn.pp === 1 && !p.hasBerry) && opp.yawnCounter === 0) {
      yawn.use()
      this.log.push(`${p.name}가 하품을 사용했다! (남은 PP : ${yawn.pp} / ${yawn.max})`)
      // 즉시수면 (버섯포자 형)
      if (!opp.isAsleep) {
        opp.isAsleep = true
        opp.sleepTurnsLeft = rand(1, 4)
        this.log.push(`${opp.name}가 잠들어 버렸다!`)
      }
    } else if (this.trickChain(trick)) {
      // 연속 사용
    } else if (p.hasBerry && isTrick && trick.pp > 0) {
      this.trickNormally(trick)
    } else {
      this.log.push(`${p.name}는 아무것도 하지 않았다!`)
    }
  }

  protected opponentTurn() {
    this.sleepyOpponentTurn()
  }

  protected endOfTurnStatus() {
    this.yawnStatus()
  }
}

/** 2차전: 잠자기·잠꼬대 추가, 하품은 다음 턴 수면 */
class Sim2 extends Simulation {
  protected maxTurns = 100000
  protected player = Object.assign(
    new Mon('망망이', [new Move('트릭', 10, 10), new Move('잠자기', 5, 5), new Move('잠꼬대', 10, 10), new Move('하품', 10, 10)]),
    { hasBerry: true },
  )
  protected opponent = happiny()

  protected playerTurn() {
    const p = this.player
    const opp = this.opponent
    const trick = p.move('트릭')!
    const rest = p.move('잠자기')!
    const talk = p.move('잠꼬대')!
    const yawn = p.move('하품')!
    const isTrick = this.opponentHasEmptyMove()

    if (this.sleepingPlayer(3)) return

    if (!opp.isAsleep && yawn.pp > 0 && !(yawn.pp === 1 && !p.hasBerry) && opp.yawnCounter === 0) {
      yawn.use()
      this.log.push(`${p.name}가 하품을 사용했다! (남은 PP : ${yawn.pp} / ${yawn.max})`)
      if (opp.yawnCounter === 0) opp.yawnCounter = 2
    } else if (this.trickChain(trick)) {
      // 연속 사용
    } else if (talk.pp === 1) {
      // 잠꼬대가 1 남았을 때는 잠자기 전에 미리 써서 충전
      talk.use()
      this.log.push(`${p.name}가 잠꼬대를 사용했으나 실패했다! (남은 PP : ${talk.pp} / ${talk.max})`)
    } else if (trick.pp === 1 && p.hasBerry && rest.pp > 0) {
      // 열매가 있는데 트릭이 1 남으면 잠꼬대로 주고 트릭으로 받아와야 함
      rest.use()
      this.log.push(`${p.name}가 잠자기를 사용했다! (남은 PP : ${rest.pp} / ${rest.max})`)
      p.isAsleep = true
      p.sleepTurnsLeft = 2
    } else if (p.hasBerry && isTrick && trick.pp > 0) {
      this.trickNormally(trick)
    } else {
      this.log.push(`${p.name}는 아무것도 하지 않았다!`)
    }
  }

  protected opponentTurn() {
    this.sleepyOpponentTurn()
  }

  protected endOfTurnStatus() {
    this.yawnStatus()
  }
}

/** 3차전: 하품 제외, 잠자기는 이판사판태클로 맞은 뒤에만 성공 */
class Sim3 extends Simulation {
  protected maxTurns = 100000
  protected player = Object.assign(
    new Mon('망망이', [new Move('트릭', 10, 10), new Move('잠자기', 5, 5), new Move('잠꼬대', 10, 10)]),
    { hasBerry: true },
  )
  protected opponent = happiny()

  protected playerTurn() {
    const p = this.player
    const trick = p.move('트릭')!
    const rest = p.move('잠자기')!
    const talk = p.move('잠꼬대')!
    const isTrick = this.opponentHasEmptyMove()

    if (this.sleepingPlayer(2)) return

    if (this.trickChain(trick)) {
      // 연속 사용
    } else if (talk.pp === 1) {
      talk.use()
      this.log.push(`${p.name}가 잠꼬대를 사용했으나 실패했다! (남은 PP : ${talk.pp} / ${talk.max})`)
    } else if (trick.pp === 1 && p.hasBerry && rest.pp > 0) {
      rest.use()
      if (p.isHit) {
        this.log.push(`${p.name}가 잠자기를 사용했다! (남은 PP : ${rest.pp} / ${rest.max})`)
        p.isAsleep = true
        p.sleepTurnsLeft = 2
        p.isHit = false
      } else {
        this.log.push(`${p.name}가 잠자기를 사용했지만 실패했다! (남은 PP : ${rest.pp} / ${rest.max})`)
      }
    } else if (p.hasBerry && isTrick && trick.pp > 0) {
      this.trickNormally(trick)
    } else {
      this.log.push(`${p.name}는 아무것도 하지 않았다!`)
    }
  }

  protected opponentTurn() {
    this.sleepyOpponentTurn((m) => {
      if (m.name === '이판사판태클') this.player.isHit = true
    })
  }

  protected endOfTurnStatus() {
    this.yawnStatus()
  }
}

/** 두르쥐: 앙코르로 빛의장막 고정 + 바꿔치기 + 애교부리기 */
class Sim4 extends Simulation {
  protected maxTurns = 100000
  protected player = Object.assign(
    new Mon('두르쥐', [new Move('바꿔치기', 10, 10), new Move('앙코르', 5, 5), new Move('애교부리기', 19, 20)]),
    { hasBerry: true },
  )
  protected opponent = happiny(29)

  protected playerTurn() {
    const p = this.player
    const opp = this.opponent
    const trick = p.move('바꿔치기')!
    const encore = p.move('앙코르')!
    const charm = p.move('애교부리기')!

    // 상대가 PP 1 이하이고 열매가 없으면 바꿔치기로 줘야 함. 다음 턴 앙코르를 써야 하면 PP 2여도 줘야 함
    const isTrick = opp.moves.some((m) => (m.pp <= 1 || (m.pp <= 2 && opp.encoreCounter <= 1)) && !opp.hasBerry)

    if (encore.pp > 0 && opp.encoreCounter === 0) {
      encore.use()
      this.log.push(`${p.name}의 앙코르 사용 성공!`)
      opp.encoreCounter = 3
    } else if (this.trickChain(trick, opp.encoreCounter >= 2)) {
      // 연속 사용
    } else if (p.hasBerry && trick.pp > 0 && isTrick) {
      this.trickNormally(trick)
    } else if (p.hasBerry && encore.pp === 1) {
      encore.use()
      this.log.push(`!!! ${p.name}의 앙코르 사용 실패!`)
    } else if (charm.pp > 0 && p.hasBerry) {
      charm.use()
      this.log.push(`${p.name}의 애교부리기!`)
    } else {
      this.log.push('이런 상황이 발생하면 안돼')
    }
    this.log.push(`${p.name}의 기술 PP: ${p.ppString()}`)
  }

  protected opponentTurn() {
    const opp = this.opponent
    if (opp.encoreCounter > 0) {
      opp.moves[0].use()
      this.log.push(`${opp.name}가 빛의장막을 사용했다!`)
      this.log.push(`${opp.name}의 기술 PP: ${opp.ppString()}`)
      return
    }
    this.player.isHit = true
    const available = opp.moves.filter((m) => m.pp > 0)
    if (available.length > 0) {
      const move = available[rand(0, available.length)]
      move.use()
      this.log.push(`!!!!앙코르가 끝나고 ${opp.name}가 ${move.name}을 사용했다!`)
      this.log.push(`${opp.name}의 기술 PP: ${opp.ppString()}`)
    }
  }

  protected endOfTurnStatus() {
    const opp = this.opponent
    if (opp.encoreCounter !== 0) {
      opp.encoreCounter--
      if (opp.encoreCounter === 0) this.log.push(`${opp.name}의 앙코르가 끝났다!`)
    }
  }

  protected isOver() {
    if (super.isOver()) return true
    if (this.player.isHit) {
      this.log.push(`${this.opponent.name}의 앙코르가 끝나서 다른 기술을 사용했다!`)
      this.reason = '앙코르 종료 후 공격'
      return true
    }
    return false
  }
}

export interface Scenario {
  id: string
  title: string
  subtitle: string
  player: string
  opponent: string
  run: () => SimResult
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'mangmang-1', title: '망망이 VS 해피너스 - 1차전', subtitle: '트릭 · 하품(즉시 수면)',
    player: '망망이: 트릭 10, 하품 10', opponent: '해피너스: 빛의장막 30, 이판사판태클 15, 알낳기 5',
    run: () => new Sim1().run(),
  },
  {
    id: 'mangmang-2', title: '망망이 VS 해피너스 - 2차전', subtitle: '잠자기 · 잠꼬대 추가',
    player: '망망이: 트릭 10, 잠자기 5, 잠꼬대 10, 하품 10', opponent: '해피너스: 빛의장막 30, 이판사판태클 15, 알낳기 5',
    run: () => new Sim2().run(),
  },
  {
    id: 'mangmang-3', title: '망망이 VS 해피너스 - 3차전', subtitle: '잠자기 실패 반영 (맞은 뒤에만 성공)',
    player: '망망이: 트릭 10, 잠자기 5, 잠꼬대 10', opponent: '해피너스: 빛의장막 30, 이판사판태클 15, 알낳기 5',
    run: () => new Sim3().run(),
  },
  {
    id: 'durgi-1', title: '두르쥐 VS 해피너스 - 1차전', subtitle: '앙코르 · 바꿔치기 · 애교부리기',
    player: '두르쥐: 바꿔치기 10, 앙코르 5, 애교부리기 19/20', opponent: '해피너스: 빛의장막 29/30, 이판사판태클 15, 알낳기 5',
    run: () => new Sim4().run(),
  },
]
