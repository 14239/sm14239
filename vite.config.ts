import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

// pages/ 아래 폴더 하나 = 페이지 하나. index.html 이 있는 폴더는 자동으로 빌드에 포함된다.
const pagesDir = resolve(__dirname, 'pages')
const input: Record<string, string> = { hub: resolve(pagesDir, 'index.html') }
for (const name of readdirSync(pagesDir)) {
  const html = resolve(pagesDir, name, 'index.html')
  if (existsSync(html)) input[name] = html
}

export default defineConfig({
  // 배포 경로는 GitHub Actions(configure-pages)가 BASE_PATH로 넘긴다.
  // 리포가 14239.github.io 거나 커스텀 도메인이면 '/', 아니면 '/리포이름/'
  base: process.env.BASE_PATH ? `${process.env.BASE_PATH.replace(/\/$/, '')}/` : '/',
  root: pagesDir,
  publicDir: resolve(__dirname, 'public'),
  plugins: [react()],
  resolve: { alias: { '@shared': resolve(__dirname, 'shared') } },
  build: { outDir: resolve(__dirname, 'dist'), emptyOutDir: true, rollupOptions: { input } },
})
