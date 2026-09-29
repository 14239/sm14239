import { useState } from 'react'
import { useBase } from '@shared/hooks'
import { SimTab } from './SimTab'
import { TableTab } from './TableTab'
import type { WildRow } from './table'
import './wild.css'

export function App() {
  const { data: base, error } = useBase()
  const [tab, setTab] = useState<'table' | 'sim'>('table')
  // 테이블 탭에서 만든 표를 시뮬레이션 탭으로 넘긴다
  const [simRows, setSimRows] = useState<WildRow[]>([])

  if (error) return <p className="error">{error}</p>
  if (!base) return <p className="muted">불러오는 중…</p>

  return (
    <div className="wild stack">
      <div className="tabs">
        <button className={tab === 'table' ? 'tab active' : 'tab'} onClick={() => setTab('table')}>야생 테이블</button>
        <button className={tab === 'sim' ? 'tab active' : 'tab'} onClick={() => setTab('sim')}>
          야생 시뮬레이션{simRows.length ? ` (${simRows.length})` : ''}
        </button>
      </div>
      <div hidden={tab !== 'table'}>
        <TableTab base={base} onSend={(rows) => { setSimRows(rows); setTab('sim') }} />
      </div>
      <div hidden={tab !== 'sim'}>
        <SimTab base={base} rows={simRows} onRows={setSimRows} />
      </div>
    </div>
  )
}
