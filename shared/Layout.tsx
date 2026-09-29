import type { ReactNode } from 'react'
import { setLang, useLang } from './lang'
import './base.css'

export function Layout({ title, wide, children }: { title?: string; wide?: boolean; children: ReactNode }) {
  const lang = useLang()
  return (
    <>
      <header className="site-header">
        <a className="brand" href={import.meta.env.BASE_URL}>SM14239</a>
        {title && <span className="page-title">{title}</span>}
        <span className="spacer" />
        <button className="lang-toggle" onClick={() => setLang(lang ? 0 : 1)} title="표시 언어">
          {lang ? 'EN' : '한'}
        </button>
        <a className="yt" href="https://www.youtube.com/@SM14239" target="_blank" rel="noreferrer">YouTube</a>
      </header>
      <main className={wide ? 'site-main wide' : 'site-main'}>{children}</main>
    </>
  )
}
