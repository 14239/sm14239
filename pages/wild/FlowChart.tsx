import { useEffect, useMemo, useRef, type PointerEvent } from 'react'
import type { WildFlow } from './flow'

const NODE_H = 60
// 글자 폭(14px) 기준. 마름모는 가운데만 넓으므로 더 넓게
const nodeWidth = (title: string, type: string) =>
  type === 'decision' ? Math.max(200, title.length * 14 * 1.7 + 30) : Math.max(120, title.length * 14 + 24)

function isDark(color: string) {
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5
}

interface Props {
  flow: WildFlow
  /** 강조할 경로 (선택한 포켓몬) */
  pathNodes: number[]
  pathEdges: string[]
  selected: number[]
  onToggle: (id: number) => void
  chroma: boolean
}

/** 원본처럼 부모 기준 좌표로 배치한 플로우차트. 휠로 확대/축소, 드래그로 이동, 노드 클릭으로 필터 */
export function FlowChart({ flow, pathNodes, pathEdges, selected, onToggle, chroma }: Props) {
  const layout = useMemo(() => {
    const pos = new Map(flow.nodes.map((n) => [n.id, flow.abs(n.id)]))
    const xs = [...pos.values()].map((p) => p.x)
    const ys = [...pos.values()].map((p) => p.y)
    const pad = 200
    const box = { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 }
    return { pos, box }
  }, [flow])

  // 확대/이동은 React 렌더 없이 viewBox 속성만 바꾼다 (노드가 많아 매번 다시 그리면 마우스를 못 따라감)
  const svgRef = useRef<SVGSVGElement>(null)
  const view = useRef(layout.box)
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const dragged = useRef(false)

  const apply = () => {
    const v = view.current
    svgRef.current?.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`)
  }
  const reset = () => {
    view.current = layout.box
    apply()
  }
  useEffect(reset, [layout]) // eslint-disable-line react-hooks/exhaustive-deps

  /** 화면 1px 당 SVG 단위 (preserveAspectRatio meet 기준) */
  const unitsPerPx = () => {
    const rect = svgRef.current!.getBoundingClientRect()
    return Math.max(view.current.w / rect.width, view.current.h / rect.height)
  }
  const toSvg = (clientX: number, clientY: number) => {
    const pt = new DOMPoint(clientX, clientY).matrixTransform(svgRef.current!.getScreenCTM()!.inverse())
    return { x: pt.x, y: pt.y }
  }

  // 휠은 passive가 아닌 네이티브 리스너로 받아야 페이지 스크롤을 막을 수 있다
  useEffect(() => {
    const svg = svgRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const v = view.current
      const f = Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 200) * 0.0015)
      const w = Math.min(layout.box.w * 2, Math.max(300, v.w * f))
      const k = w / v.w
      const p = toSvg(e.clientX, e.clientY)
      view.current = { x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k, w, h: v.h * k }
      apply()
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [layout]) // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: false }
    dragged.current = false
  }
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (!d.moved) {
      if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) < 4) return
      d.moved = true
      dragged.current = true
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    }
    const u = unitsPerPx()
    view.current = { ...view.current, x: view.current.x - (e.clientX - d.x) * u, y: view.current.y - (e.clientY - d.y) * u }
    d.x = e.clientX
    d.y = e.clientY
    apply()
  }
  const endDrag = () => {
    drag.current = null
  }
  const click = (id: number) => {
    if (!dragged.current) onToggle(id)
  }

  const onPath = new Set(pathNodes)
  const onPathEdge = new Set(pathEdges)
  const sel = new Set(selected)

  const arrows = (highlighted: boolean) =>
    flow.nodes.flatMap((n) => n.children.map((c) => {
      const lit = onPathEdge.has(`${n.id}-${c.node}`)
      if (lit !== highlighted) return null
      const s = layout.pos.get(n.id)!
      const t = layout.pos.get(c.node)!
      const child = flow.node(c.node)
      const dx = t.x - s.x
      const dy = t.y - s.y
      const [v1, v2, labelY] = child.isLong ? [dy - 50, 50, t.y - 50] : [50, dy - 50, s.y + 50]
      const d = `M ${s.x} ${s.y} v ${v1} ${dx !== 0 ? `h ${dx} ` : ''}v ${v2}`
      const labelX = s.x + (dx > 0 ? 50 : dx < 0 ? -50 : 0)
      return (
        <g key={`${n.id}-${c.node}`}>
          <path d={d} className={lit ? 'edge lit' : 'edge'} />
          {c.label && (dx === 0
            ? <text x={labelX + 6} y={s.y + 100} className="edge-label">{c.label}</text>
            : <text x={labelX} y={labelY} className="edge-label" textAnchor="middle">{c.label}</text>)}
        </g>
      )
    }))

  return (
    <div className={chroma ? 'flow-wrap chroma' : 'flow-wrap'}>
      <svg
        ref={svgRef}
        viewBox={`${layout.box.x} ${layout.box.y} ${layout.box.w} ${layout.box.h}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        {arrows(false)}
        {arrows(true)}
        {flow.nodes.map((n) => {
          const { x, y } = layout.pos.get(n.id)!
          const w = nodeWidth(n.title, n.type)
          const fill = n.pokemon?.color ?? '#EEEEEE'
          const cls = `node ${onPath.has(n.id) ? 'lit' : ''} ${sel.has(n.id) ? 'sel' : ''}`
          const shape = n.type === 'decision'
            ? <polygon points={`${x},${y - 30} ${x + w / 2},${y} ${x},${y + 30} ${x - w / 2},${y}`} className={cls} fill={fill} />
            : n.type === 'start'
              ? <rect x={x - w / 2} y={y - NODE_H / 2} width={w} height={NODE_H} rx={30} className={cls} fill={fill} />
              : <rect x={x - w / 2} y={y - NODE_H / 2} width={w} height={NODE_H} className={cls} fill={fill} />
          return (
            <g key={n.id} className="node-g" onClick={() => click(n.id)}>
              {shape}
              <text x={x} y={y} className={sel.has(n.id) ? 'node-text sel' : 'node-text'} fill={isDark(fill) ? '#fff' : '#000'}
                textAnchor="middle" dominantBaseline="middle">{n.title}</text>
            </g>
          )
        })}
      </svg>
      <button className="flow-reset" onClick={reset}>전체 보기</button>
    </div>
  )
}
