import { useEffect, useState } from 'react'
import { loadBase, loadLearnset, type BaseData, type Learnset } from './data'

/** 공용 테이블(포켓몬·기술·특성·타입·버전) 로드 */
export function useBase() {
  const [data, setData] = useState<BaseData | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadBase().then(setData).catch((e) => setError(String(e)))
  }, [])
  return { data, error }
}

/** 버전 그룹 습득표 로드. 버전이 바뀌면 다시 받는다. */
export function useLearnset(vg: number) {
  const [state, setState] = useState<{ vg: number; data: Learnset | null; error: string | null }>({
    vg, data: null, error: null,
  })
  useEffect(() => {
    let alive = true
    setState({ vg, data: null, error: null })
    loadLearnset(vg)
      .then((data) => alive && setState({ vg, data, error: null }))
      .catch(() => alive && setState({ vg, data: null, error: '이 버전의 기술 데이터를 불러오지 못했습니다.' }))
    return () => {
      alive = false
    }
  }, [vg])
  return state.vg === vg ? state : { vg, data: null, error: null }
}
