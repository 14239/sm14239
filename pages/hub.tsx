import { Layout } from '@shared/Layout'
import { mount } from '@shared/mount'
import { pages } from '@shared/pages'
import './hub.css'

mount(
  <Layout>
    <h1>SM14239 도구 모음</h1>
    <ul className="hub-list">
      {pages.map((p) => (
        <li key={p.slug}>
          <a className="card hub-card" href={`${import.meta.env.BASE_URL}${p.slug}/`}>
            <strong>{p.title}</strong>
            <span className="muted">{p.description}</span>
          </a>
        </li>
      ))}
    </ul>
  </Layout>,
)
