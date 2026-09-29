import type { ReactNode } from 'react'
import './base.css'

export function Layout({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <>
      <header className="site-header">
        <a className="brand" href={import.meta.env.BASE_URL}>SM14239</a>
        {title && <span className="page-title">{title}</span>}
        <a className="yt" href="https://www.youtube.com/@SM14239" target="_blank" rel="noreferrer">YouTube</a>
      </header>
      <main className="site-main">{children}</main>
    </>
  )
}
