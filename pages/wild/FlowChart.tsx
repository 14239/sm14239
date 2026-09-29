import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
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

  const [view, setView] = useState(layout.box)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ x: number; y: number; view: typeof view; moved: boolean } | null>(null)

  const toSvg = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: view.x + ((clientX - rect.left) / rect.width) * view.w, y: view.y + ((clientY - rect.top) / rect.height) * view.h }
  }

  const onWheel = (e: WheelEvent) => {
    const f = e.deltaY > 0 ? 1.15 : 1 / 1.15
    const p = toSvg(e.clientX, e.clientY)
    const w = Math.min(layout.box.w * 2, Math.max(300, view.w * f))
    const k = w / view.w
    setView({ x: p.x - (p.x - view.x) * k, y: p.y - (p.y - view.y) * k, w, h: view.h * k })
  }
  const onPointerDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, view, moved: false }
  }
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) {
      if (!d.moved) (e.currentTarget as Element).setPointerCapture(e.pointerId)
      d.moved = true
    }
    if (!d.moved) return
    const rect = svgRef.current!.getBoundingClientRect()
    setView({ ...d.view, x: d.view.x - ((e.clientX - d.x) / rect.width) * d.view.w, y: d.view.y - ((e.clientY - d.y) / rect.height) * d.view.h })
  }
  const endDrag = () => {
    drag.current = null
  }
  const click = (id: number) => {
    if (!drag.current?.moved) onToggle(id)
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
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        onWheel={onWheel}
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
      <button className="flow-reset" onClick={() => setView(layout.box)}>전체 보기</button>
    </div>
  )
}
