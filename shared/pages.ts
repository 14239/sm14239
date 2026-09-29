// 허브에 노출할 페이지 목록. 새 페이지를 만들면 여기 한 줄 추가.
export interface PageInfo {
  slug: string
  title: string
  description: string
}

export const pages: PageInfo[] = [
  {
    slug: 'moveset',
    title: '기술 역검색',
    description: '고른 기술을 전부 배울 수 있는 포켓몬을 버전별로 찾기',
  },
]
