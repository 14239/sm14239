# SM14239

유튜브 [SM14239](https://www.youtube.com/@SM14239) 관련 웹 도구 모음. → https://14239.github.io/sm14239/

## 구조

```
pages/            페이지 (폴더 하나 = 페이지 하나, URL /sm14239/<폴더>/)
  index.html      허브
  moveset/        기술 역검색
shared/           공통 레이아웃·스타일·데이터 로더
public/data/      페이지용 JSON (scripts/build_data.py 가 생성)
scripts/          데이터 변환 스크립트
```

## 개발

```bash
npm install
npm run dev       # http://localhost:5173/sm14239/
npm run build
```

`main`에 push하면 GitHub Actions가 빌드해서 Pages에 배포한다.

## 새 페이지 추가

1. `pages/<이름>/index.html` + `main.tsx` 만들기 (`moveset/` 복사해서 시작)
2. `shared/pages.ts`에 한 줄 추가 → 허브에 노출

빌드 입력은 `vite.config.ts`가 `pages/*/index.html`을 자동으로 찾는다.

## 포켓몬 데이터

런타임에 PokeAPI를 호출하지 않는다. `scripts/build_data.py`가 PokeAPI GitHub 리포의 CSV를
고정 커밋(`POKEAPI_COMMIT`) 기준으로 한 번 내려받아 필요한 필드만 JSON으로 변환한다.

- `pokemon.json` / `moves.json` / `version-groups.json` — 공용 이름 테이블 (한/영)
- `learnsets/<버전그룹id>.json` — 버전별 기술 습득표 `{포켓몬id: [[기술id, 방법id, 레벨], ...]}`

```bash
npm run data                               # 고정 커밋으로 재생성
python scripts/build_data.py --latest      # 최신 PokeAPI로 갱신 → 출력된 해시를 POKEAPI_COMMIT에 반영
```

데이터 출처: [PokeAPI](https://github.com/PokeAPI/pokeapi) (BSD-3-Clause)
