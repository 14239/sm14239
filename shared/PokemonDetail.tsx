import { abilitiesAt, MOVE_METHODS, typesAt, type BaseData, type Learnset } from './data'
import { nm, useLang } from './lang'
import { Modal } from './Modal'
import { TypeBadge } from './TypeBadge'

const STAT_LABELS = ['HP', '공격', '방어', '특공', '특방', '스피드']

/** 포켓몬 상세: 타입, 특성, 종족값, 해당 버전 전체 습득 기술 */
export function PokemonDetail({ id, base, learnset, gen, onClose }: {
  id: number
  base: BaseData
  learnset: Learnset | null
  gen: number
  onClose: () => void
}) {
  const lang = useLang()
  const p = base.pokemon[id]
  if (!p) return null
  const abil = abilitiesAt(p, gen)
  const moves = learnset?.[id] ?? []

  return (
    <Modal onClose={onClose}>
      <h2 className="detail-title">
        <span className="muted">#{p.s}</span> {nm(p.n, lang)}
        {typesAt(p, gen).map((t) => <TypeBadge key={t} id={t} types={base.types} />)}
      </h2>

      {gen >= 3 && (
        <p className="detail-abilities">
          {abil.map((a, i) => a ? (
            <span key={i}>{i === 2 ? '숨겨진 특성: ' : ''}{nm(base.abilities[a], lang, String(a))}</span>
          ) : null)}
        </p>
      )}

      <div className="stat-grid">
        {p.st.map((v, i) => (
          <div key={i} className="stat-row">
            <span>{STAT_LABELS[i]}</span>
            <b>{v}</b>
            <span className="stat-bar"><span style={{ width: `${Math.min(100, (v / 200) * 100)}%` }} /></span>
          </div>
        ))}
        <div className="stat-row"><span>합계</span><b>{p.st.reduce((a, b) => a + b, 0)}</b><span /></div>
      </div>

      <table className="table">
        <thead>
          <tr><th>방법</th><th>레벨</th><th>기술</th><th>타입</th><th>위력</th><th>PP</th></tr>
        </thead>
        <tbody>
          {moves.map(([m, method, level], i) => {
            const mv = base.moves[m]
            return (
              <tr key={i}>
                <td>{nm(MOVE_METHODS[method], lang, String(method))}</td>
                <td>{method === 1 ? (level === 0 ? '진화' : level) : ''}</td>
                <td>{nm(mv, lang, String(m))}</td>
                <td>{mv && <TypeBadge id={mv[2]} types={base.types} />}</td>
                <td>{mv?.[4] ?? '-'}</td>
                <td>{mv?.[5] ?? '-'}</td>
              </tr>
            )
          })}
          {moves.length === 0 && <tr><td colSpan={6} className="muted">이 버전에는 기술 데이터가 없습니다.</td></tr>}
        </tbody>
      </table>
    </Modal>
  )
}
