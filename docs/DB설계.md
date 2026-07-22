# 모심 DB 설계안 — 법인카드 업로드 기반 데이터 파이프라인

> 2026-07-23 설계 논의 정리. 아직 확정 전이며 검토용 초안.

## 1. 설계 원칙

- **원천(source of truth)은 법인카드 사용내역 엑셀 하나.** 식당 마스터와 특성(features)은 업로드 후 파생·부가(enrichment)한다.
- 원천 데이터(card_tx)는 절대 수정하지 않는다. 매칭·특성은 별도 테이블에서 **출처(source)와 함께** 관리해, 잘못된 자동 매칭·추정을 언제든 수동 교정할 수 있게 한다.
- 식당 마스터는 별도 소스로 만들지 않는다 — 카드내역에 실제 등장한 가맹점에서만 생성되고, 업로드가 쌓일수록 자란다.

## 2. 업로드 양식 (법인카드 시스템 엑셀 다운로드)

캡처 화면 기준 컬럼 (실제 파일 컬럼 동일 여부 확인 대기 중):

| 컬럼 | 활용 |
|---|---|
| 사용일자 / 결재일시 | **결재일시의 시각**이 점심/저녁 구분의 핵심 신호 |
| 가맹점상호 | 식당 매칭 키 (사업자번호가 없어 상호 의존) |
| 업종 | 카드사 분류. 안전망 필터용 |
| 사용금액 | 가격대 추정, 김영란법 |
| 카드소유자 / 부서 | 개인별 이력·부서 집계 (개인정보 처리 필요) |
| 카드번호 | **인제스트 시 마스킹(뒤 4자리만 보존)** |
| 승인번호 | **중복 업로드 방지 유니크 키** |
| 진행상태 / 등록자 | 경비정산 관리용, 추천에는 미사용 |

전제: **실제 업로드 파일에는 식당 거래만 포함**된다 (2026-07-23 확인). 따라서 업종 필터는 필수 관문이 아니라, 비식당 행이 섞이면 경고 후 스킵하는 안전망.

양식에 **없는 것** → 파생으로 보완:
- 사업자번호 없음 → 매칭은 "상호 + 회사 좌표 반경 카카오 검색" + 검수 큐
- 계정과목/사용목적 없음 → 점심/저녁 회식/접대는 시간대·금액·식당 등급으로 추정
- 식당 위치·특성 정보 없음 → 전부 enrichment 단계 몫

## 3. 파이프라인

```
① Ingest   : 엑셀 → card_tx 원천 보존 (승인번호 dedup, 카드번호 마스킹)
② Guard    : 업종 검사 — 비식당 행은 경고 후 스킵 (안전망)
③ Match    : 상호 정규화 → restaurant 마스터 upsert
             신규 상호는 카카오 로컬 API(상호 + 서린빌딩 반경)로 place_id·좌표·주소 확정
             모호 건은 검수 큐 → merchant_map에 수동 확정 기록
④ Enrich   : features 단계적 부가 — 지오코딩(즉시) → 평점·예약 → 룸·주차 실데이터
⑤ Derive   : purpose 추정(시간대·금액), 방문통계 집계 → 앱이 읽는 형태(restaurants.json 등)
```

## 4. 최종 스키마안

```sql
-- 원천 (불변, 업로드 반복 누적)
card_tx (
  approval_no   PK,          -- 승인번호 (dedup 키)
  used_date, approved_at,    -- 사용일자, 결재일시(시각 포함)
  merchant_raw,              -- 가맹점상호 원문
  mcc_category,              -- 업종 (카드사 분류)
  amount, card_owner, dept,
  card_last4                 -- 마스킹 후 뒤 4자리
)

-- 가맹점 → 식당 매칭 (매칭 이력·방법 보존)
merchant_map (
  merchant_raw PK, restaurant_id FK,
  method,                    -- auto_kakao | manual
  confidence, matched_at
)

-- 식당 마스터 (카드내역에서 파생, enrichment로 성장)
restaurant (
  id PK, name, kakao_place_id, lat, lng, address, place_url,
  cuisine, price_tier,       -- price_tier는 거래 금액 분포에서 추정 가능
  rating_kakao, rating_naver, review_counts,
  reservation_platform, reservation_url
)

-- 특성 (출처·검증일이 핵심 — 추정 → 실측 교체 추적)
restaurant_features (
  restaurant_id FK, feature,  -- room | parking | quiet | group | english | halal ...
  value BOOLEAN,
  source,                     -- inferred | google_places | web_research | manual
  verified_at
)

-- (예약) 선택 이력 — 기능 트래커 문서의 Supabase 계획과 정렬
user_selections ( user_name, restaurant_id, mode, profile, created_at )
```

## 5. 앱 코드와의 연결 지점

- `src/lib/data.ts`의 `buildRestaurants`는 `r.features ?? 추정치` 구조 — restaurants.json에 features가 기입되면 코드 수정 없이 실데이터가 추정치를 자동 대체.
- 현재 `src/lib/xlsx.ts`(`parseCardXlsx`)는 **SAP 내보내기 형식(D열 증빙일/J열 금액) 가정**이라 위 양식을 읽지 못함 → 실파일 확보 후 헤더 기준으로 재작성 필요.
- 룸/주차는 현재 임시 추정치(룸: 3등급 또는 2등급+접대, 주차: 3등급) 적용 중.

## 6. 남은 결정·작업 (TODO)

- [ ] 실제 엑셀 파일 샘플 확보 → 컬럼 헤더 확정, `parseCardXlsx` 재작성
- [ ] 매칭 검수 큐 UI/절차 결정 (모호 매칭 수동 확정 방식)
- [ ] purpose 추정 규칙 확정 (시간대 경계, 접대 판정 기준)
- [ ] 주차 실데이터: Google Places API `parkingOptions` 수집 스크립트 (Google API 키 필요)
- [ ] 룸 실데이터: 접대 후보 식당 웹 조사 반영
- [ ] 저장소 형태 결정: JSON 파일 유지 vs Supabase 이전 (user_selections는 Supabase 예정)
- [ ] 개인정보 처리 방침: 카드소유자 실명·부서 노출 범위
