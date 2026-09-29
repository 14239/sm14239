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
  {
    slug: 'party',
    title: '파티 검색',
    description: '슬롯별 조건과 파티 전체 조건(Any)을 동시에 만족하는 파티 구성 찾기',
  },
  {
    slug: 'pickup',
    title: '줍기 시뮬레이터',
    description: '과사열매 + 줍기 무한 PP 전략 시뮬레이션 (망망이·두르쥐 VS 해피너스), PP 카운터',
  },
  {
    slug: 'wild',
    title: '야생 테이블 · 시뮬레이션',
    description: '출현 정보로 레벨별 야생 기술표를 만들고, 올리르바 앙코르 전략 플로우차트로 판정',
  },
]
