# 모임(Moim) — 회사 앞 식당 지도

SK서린빌딩(종로구 종로 26) 임직원의 법인카드 사용 실적을 기반으로 회사 주변 식당을
추천하는 모바일 웹. 기획서는 `데이터 프롬프트 예시.docx`, 원본 데이터는
`20260722사용원가(실적).xlsx` 참고.

> 초기 아이디어 목업(모심/Mosim, 순수 HTML 데모)은 [`mosim-mockup/`](mosim-mockup/) 참고.

## 실행

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 프로덕션 빌드
npm run data    # 엑셀 → src/data/visits.json 재생성
```

## 스택 (school-meal 프로젝트 패턴)

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript strict
- Tailwind CSS v4 (`globals.css`에 `@import "tailwindcss"` 한 줄, 설정 파일 없음)
- 상태관리/페칭 라이브러리 없음 — React 내장 훅만 사용
- 모바일 우선: `layout.tsx`에서 `max-w-[480px] mx-auto` 고정 컬럼, 다크모드 비활성화

## 구조

```
scripts/
  parse-xlsx.mjs        # 엑셀(XML 추출본) → visits.json 생성. 결정적 seed
  data-src/             # 엑셀에서 추출한 sheet1.xml, sharedStrings.xml (저장소 제외)
src/
  app/                  # layout(모바일 컬럼), page
  components/
    MoimApp.tsx         # 필터(목적/예산/거리/음식종류)·정렬·뷰 전환 컨테이너
    RestaurantCard.tsx  # 목록 카드 (방문횟수 랭킹)
    KakaoMap.tsx        # 카카오맵 SDK 실지도 (NEXT_PUBLIC_KAKAO_MAP_KEY 필요)
    MapView.tsx         # SVG 목업 지도 (키 없을 때 폴백)
    DetailSheet.tsx     # 상세 바텀시트 (최근 카드 사용 내역, 예약)
    ReservationForm.tsx # 예약 폼 + 네이버/캐치테이블 딥링크 + 시뮬레이션
  data/
    restaurants.json    # 더미 식당 36곳 (실존 상호 웹 검증, 평점/좌표는 가상)
    visits.json         # 생성물 — 식당별 방문 통계 (실명 마스킹됨)
  lib/
    data.ts             # 타입, 파생 필드(가중평균 평점 등), 상수
    xlsx.ts             # 브라우저 엑셀 파싱 (fflate)
    assign.ts           # 거래→식당 결정적 배정 + 집계
mosim-mockup/           # 팀원 초기 아이디어 목업 (모심 — 단일 HTML 데모)
```

## 데이터 (전부 더미)

- 엑셀 실데이터는 112건(전부 의욕관리비=점심). 식당명이 없어 각 거래를 더미
  식당에 seed 기반으로 배정 → 방문횟수 랭킹 생성
- 경상회의비(저녁 회식) 130건·접대비 70건은 시연용 합성 데이터(`synth: true`)
- 식당 평점은 카카오/구글 리뷰의 "개수 대비 가중평균" (기획서 요구사항)
- 식당명은 실존 상호(웹 검증 완료)지만 평점·리뷰수·좌표는 가상 값
- 개인정보: 카드 소지자 실명은 마스킹(이*환). 원본 docx/xlsx/추출 XML은
  .gitignore/.vercelignore로 저장소·배포에서 제외

## 로드맵 (기획서 기준)

- [x] 필터: 예산 / 목적(계정 자동 매핑) / 거리 / 음식종류
- [x] 방문횟수순 정렬(1순위), 평점순·가까운순
- [x] 목업 지도 (SVG 동심원)
- [x] 카카오맵 JS SDK 연동 — `NEXT_PUBLIC_KAKAO_MAP_KEY` 설정 시 실지도, 없으면 SVG 폴백
      (키 발급: developers.kakao.com, Web 플랫폼에 localhost:3000 + 배포 도메인 등록 필요)
- [x] 예약 UX — 인원/날짜/시간 입력 + 네이버·캐치테이블 딥링크 + 자동 예약 시뮬레이션
- [x] 엑셀 업로드 — 브라우저에서 법인카드 xlsx 파싱(fflate), 실명 마스킹, localStorage 영속화
- [x] Vercel 배포 — https://moim-blush.vercel.app
- [ ] 실제 리뷰 데이터 연동 (카카오/구글 API)
- [ ] 예약 자동화 실연동 (네이버예약/캐치테이블 — 캐치테이블 스나이퍼 참고)
- [ ] 회계팀 실데이터 정기 연동 (DB화 — school-meal처럼 Supabase 후보)
