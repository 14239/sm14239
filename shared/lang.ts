import { useSyncExternalStore } from 'react'
import type { Names } from './data'

// 표시 언어 (0 = 한국어, 1 = 영어). 페이지 간 공유하도록 localStorage에 기억한다.
export type Lang = 0 | 1

const KEY = 'sm14239.lang'
const listeners = new Set<() => void>()

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 1 : 0
  } catch {
    return 0
  }
}

let current: Lang = read()

export function setLang(lang: Lang) {
  current = lang
  try {
    localStorage.setItem(KEY, lang ? 'en' : 'ko')
  } catch {
    /* 저장 불가 환경은 무시 */
  }
  listeners.forEach((l) => l())
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}

/** [한, 영, ...] 배열에서 현재 언어 이름 */
export const nm = (names: Names | readonly [string, string, ...unknown[]] | undefined, lang: Lang, fallback = '') =>
  (names?.[lang] as string | undefined) ?? fallback
