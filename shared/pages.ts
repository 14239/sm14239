// 허브에 노출할 페이지 목록. 새 페이지를 만들면 여기 한 줄 추가.
export interface PageInfo {
  slug: string
  title: string
  description: string
}

export const pages: PageInfo[] = [
  {
    slug: 'moveset',
    title: '포켓몬 검색',
    description: '버전별로 타입·특성·기술 조건에 맞는 포켓몬 찾기',
  },
]
