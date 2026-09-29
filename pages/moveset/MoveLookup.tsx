import { useMemo, useState } from 'react'
import type { BaseData } from '@shared/data'

/** 기술 이름(줄마다 하나) → 기술 ID 변환. 위험 기술 목록 같은 데이터를 만들 때 쓰는 도구. */
export function MoveLookup({ base }: { base: BaseData }) {
  const [text, setText] = useState('')
  const index = useMemo(() => {
    const map = new Map<string, number>()
    for (const [id, m] of Object.entries(base.moves)) {
      map.set(m[0].replace(/\s/g, ''), +id)
      map.set(m[1].toLowerCase().replace(/\s/g, ''), +id)
    }
    return map
  }, [base])

  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const out = lines.map((l) => index.get(l.trim().toLowerCase().replace(/\s/g, ''))?.toString() ?? `? ${l}`)

  return (
    <details className="card">
      <summary>기술 이름 → ID 변환 (도구)</summary>
      <div className="lookup">
        <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="기술 이름을 한 줄에 하나씩 (한/영)" />
        <textarea rows={8} readOnly value={out.join('\n')} />
      </div>
    </details>
  )
}
