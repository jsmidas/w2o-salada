# W2O SALADA 작업 인수인계

> 세션 간/PC 간 이어서 작업하기 위한 진행 상태 기록.
> 최신 상태가 상단에 오도록 유지.

---

## 📅 2026-09-27 (일) 운영 DB 초기화 사고 → 복구 체계

### ⚠️ 무슨 일이 있었나

- 01:19~01:24(PC 시각) 마이그레이션 SQL을 만들려고 `prisma migrate diff --from-migrations … --shadow-database-url <운영 DIRECT_URL>`을 실행. Prisma는 shadow DB로 받은 DB를 **먼저 완전히 비운다**. 운영 DB가 4월 초기 마이그레이션 상태(11개 테이블, 0행)로 리셋됐다.
- Supabase **Free 플랜이라 백업 없음**. Vercel 실서비스가 같은 DB를 써서 사이트가 빈 상태가 됐다. 실주문은 없었음(사용자 확인).
- 원인: 마이그레이션 이력(init + RLS 3개)이 db push로 운영된 실제 DB와 어긋나 있었고, 이를 shadow DB로 맞추려다 발생.

### 💾 건진 것 (Vercel 홈페이지 ISR 캐시)

`packages/db/prisma/recovery-20260927/salvaged_home.json`
- 상품 22종 — 이름·설명·정가·구독가·태그·이미지 URL·**원래 ID**
- 카테고리 5개(샐러드·간편식·오니기리·반찬·국·주스·음료), 원래 ID
- 배송 캘린더 9/1~10/30 배송일 20일 + 메뉴 배정 69건(9/29부터)

**잃은 것**: 회원 전부(관리자 포함), 주문 56·구독 43(테스트), 문의·리뷰·알림 이력, 관리자 설정(회사정보·FAQ 3건), 구독 설정, 사이드바, 권한, 상품 상세페이지 본문. 상품 이미지 파일은 Supabase Storage에 그대로 있다.

### 🔧 복구 실행 (사용자가 직접 — 자동모드가 운영 DB 쓰기를 막는다)

```bash
cd packages/db
npx tsx ../../tools/recover_20260927.ts           # ① 스키마 보정 ② RLS ③ 데이터 복원 ④ baseline
```
- 멱등이라 다시 실행해도 안전. 미리 보려면 `DRY_RUN=1 npx tsx ../../tools/recover_20260927.ts`
- 관리자 계정 `admin@w2osalada.co.kr`이 **임시 비밀번호**와 함께 출력된다 → 로그인 후 즉시 변경
- 비회원 주문용 `guest` 유저도 재생성된다 (없으면 단건 주문이 FK 오류)

### ✍️ 복구 후 관리자에서 재입력할 것

1. `/admin/settings` — 회사명·대표자·사업자번호·이메일, 알림톡 설정, FAQ 3건, 문의 알림 번호
2. `/admin/subscribe-settings` — 수량/가격/배송 조건
3. `/admin/pages` — 상품 상세페이지 (이미지는 Storage `images` 버킷에서 다시 선택)
4. `/admin/sidebar`, `/admin/permissions`
5. 상품 `singlePrice`(단건가) — 캐시에 없어 비어 있음. 단건가 정책이 있었다면 `/admin/pricing`에서 재설정
6. 배송 캘린더 9/1~9/24는 배정 없이 배송일만 복원됨(과거라 무관)

### 🛡️ 재발 방지 (이번 커밋에 포함)

- `packages/db/package.json`에서 `db:push`·`db:migrate` 제거. `db:diff`(읽기 전용)·`db:deploy`·`db:backup`·`db:status` 추가
- 마이그레이션 이력을 `20260927000000_baseline` 하나로 재정렬 (구 4개는 `migrations_archive/`)
- **GitHub Actions `DB backup`** — 매일 03:00 KST pg_dump(커스텀 포맷)+JSON을 아티팩트 90일 보관.
  → **저장소 Settings → Secrets → Actions에 `DIRECT_URL` 등록 필요** (packages/db/.env 값). 등록 후 Actions 탭에서 Run workflow로 첫 백업 확인
- 로컬 수동 백업 `npm run db:backup -w @repo/db` → `backups/` (gitignore)
- CLAUDE.md에 "DB 안전 규칙" 추가. 스키마 변경은 diff 확인 → migrations 파일 → deploy 순서로만
- 권장: Supabase **Pro($25/월)** 전환 시 일일 백업 7일 + PITR 애드온 가능. 오픈 전 전환 권장

### 📌 미착수 (사고 전 하려던 일)

- 배송 코스 1단계 스키마 초안은 `git stash`(`delivery-area phase1 schema draft`)에 있음. 복구 확인 후 `git stash pop` → `db:diff`로 SQL 확인 → 마이그레이션 파일로 적용
- 카카오 로컬 API가 앱 `w2o`에서 **"카카오맵" 서비스 비활성** 상태(`disabled OPEN_MAP_AND_LOCAL service`). Kakao Developers → 앱 → 제품 설정 → 카카오맵 → 활성화 필요. 좌표 수집(반경 판정)의 전제 조건
- 이후 우선순위는 9/26 섹션의 "다음 할 일" 그대로

---

## 📅 2026-09-26 (토) 오픈 준비 작업

### ✅ 완료

**관리자 — 배송 캘린더 / 생산**
- 메뉴 선택 모달을 다중 선택으로 전환 (카테고리 칩 필터 + 검색 + 3열 그리드).
  기존 배정이 체크된 상태로 열려 체크/해제만으로 추가·제거가 된다
- **버그**: 배송일 토글·화목 일괄 지정이 서버 응답으로 상태를 통째로 교체해
  미저장 메뉴 배정을 날리고, 그대로 저장하면 기존 배정까지 삭제되던 문제 수정
- **버그**: 배송일 하나를 해제하면 `activeDates.length === 0` 조건 때문에
  그 달 전체가 비활성화되던 문제 수정 (`replaceMonth` 플래그 도입).
  10월 배송일 9일(메뉴 70건)이 이 버그로 꺼져 있던 것을 복구
- **신규** `/admin/production` 생산 집계 — 구독 선택분 + 단건 주문을 합산해
  상품별·카테고리별 수량 산출. 기존 `delivery/report`는 Order만 봐서 구독
  물량이 통째로 빠져 있었다. A4/A3 · 세로/가로 작업지시서 출력 지원
- 사이드바 메뉴 간격을 절반으로 축소 (메뉴 추가 여지 확보)

**카테고리 동적화**
- 오니기리 카테고리 신설 (sortOrder 3, 간편식 뒤). **상품은 아직 0개**
- 구독 화면의 수량 카드·선택 제한을 DB 카테고리 기반으로 전환.
  선택 제한이 "샐러드 vs 나머지" 2분류라 반찬·음료가 간편식 쿼터를
  소진하던 버그도 함께 해소
- 상품 관리 필터, 고객 헤더 드롭다운(`/menu?category=`)도 DB 기준으로
- → 이제 `/admin/categories`에서 카테고리를 추가하면 코드 수정 없이
  고객 메뉴·헤더·배송 캘린더·구독·상품 관리에 모두 반영된다

**주문 마감 — 전날 14:00으로 통일**
- `lib/cutoff.ts` 신설. 마감 로직이 아예 없어 밤 11시에도 다음날 배송분
  주문이 가능했다. 서버(UTC)·브라우저(KST) 어디서 계산해도 같도록 KST 고정
- 고객 문구 정정 — 마감(매일 밤 11시 → 배송 전날 14시), 배송 지역
  (서울·경기 → 대구 달서구·달성군 일부), 배송비(3만원 기준 → 무료),
  배송 사이클, **이용약관 3개 조항**, 관리자 설정 기본값, DB FAQ 3건

**배송비**
- 설정은 무료(deliveryFee=0)인데 코드가 "15,000원 미만 3,000원"을
  하드코딩해 **실제로 배송비가 청구되던 문제** 수정. 주문 API·장바구니·
  결제 화면이 모두 설정값을 읽도록 변경
- 정책 확정: **본품 11,000원 이상 주문 · 배송비 없음**.
  최소 주문 11,000원에서도 공헌이익 4,008원(36.4%)이라 전액 부담 가능
- 도입이 필요해지면 `/admin/settings`에서 두 값만 올리면 적용된다

**상품 정리**
- 미판매였던 간편식 3종·집반찬 B세트·음료 2종·소고기 무국 활성화 (총 22종)
- **중복 상품 통합** — 시드의 "착즙 당근주스 300ml"와 수동 등록된
  "착즙 당근주스"가 갈려 같은 음료가 두 품목으로 배정돼 있었다
  (당근주스는 같은 날 양쪽 배정이 9일). 짧은 이름으로 합치고 배정·구독선택
  이관. 300ml 쪽은 과거 주문 이력 때문에 삭제하지 않고 미판매로 유지
- 시드도 같은 기준으로 수정 — **용량·인분은 상품명이 아니라 설명에**

**문서 / 손익 모델**
- `docs/DELIVERY_ROUTE_DESIGN.md` 신규 — 배송 코스 설계 (아래 참고)
- 손익 시뮬레이터 배송비를 `max(보장액, 집수 × 단가)` 구조로 교체.
  고정비 시나리오 비교 시트 추가. 냉장설비는 모회사 워크인 공유로 0원
- CLAUDE.md 배송 사이클을 실제 운영(D-2 발주 → 전날 14시 마감 → 전날
  오후 조리 → 새벽 배송)으로 갱신

### 📌 확정된 운영 조건 (현장 확인 완료)

| 항목 | 값 |
|---|---|
| 주문 마감 | 배송 전날 14:00 (구독 메뉴 변경도 동일) |
| 재료 발주 | D-2 예측 발주, 오차는 회사 부담 |
| 생산 | 전날 오후 조리·포장 → 냉장 보관 → 새벽 배송 |
| 보관 | 모회사 10평 워크인 (약 500~1,000집분, 제약 아님) |
| 배송 지역 | 대구 달서구 + 성서 센터 반경 5km 달성군 |
| 배송 단위 | **한 집 = 1건** / 차량당 100집 목표, 물리 한계 200집 |
| 용차 | 최소비용 보장 — `max(보장액, 집수 × 1,000원)`, 보장액 10만(7만 검토) |
| 자차 | 주간 차량을 충전해 야간 재사용 — 차량 고정비 없음 |
| 배송비 | 무료 (본품 11,000원 이상 주문) |

손익분기: 고정비 1,850만 원 → 267집 / 920만 원 → 133집 / 550만 원 → 82집

### 🔜 다음 할 일

**오픈 전 필수**
1. **배송 코스 1단계** — 주소에 `sido/sigungu/bname/buildingName/isApartment`
   저장(다음 우편번호 API가 이미 주는 값), 카카오 로컬로 좌표 수집,
   센터 반경 판정, 경계 밖 주문 HOLD 처리, 아파트 단지 사전 등록.
   **주소는 한 번 입력되면 소급 보정이 어려우므로 오픈 전에 해야 한다**
2. **서버 측 마감 검증** — 현재는 화면에서 배송일을 거르는 수준.
   `/api/orders`, `/api/subscribe/next`에서 마감된 날짜를 막아야 한다
3. **오니기리 상품 등록** — 카테고리만 있고 상품 0개
4. `집반찬 plus 3찬+국 (준비중)`이 판매중 상태 — 이름/노출 정리 필요

**오픈 전 권장**
5. 마감 임박 알림톡 (당일 오전 "오후 2시까지 메뉴 변경 가능") — 워커 작업.
   구독자가 마감을 체감하지 않게 하는 장치
6. 생산 집계 **D-2 스냅샷 저장** — 예측 대비 실제를 비교해 단건 예측
   정확도를 데이터로 개선

**확인 대기 중인 항목**
- 새벽 배송 기사: 주간 기사 연장근무인가 별도 채용인가 (자차 코스 원가)
- 자차 1대 월 고정비 → 자차·용차 분기점 계산
- 달서구도 반경 5km로 자를 것인가, 구 전체를 열 것인가
- 고정비 시나리오 A/B/C 중 어느 규모로 시작할 것인가
- 기사 물리 한계를 아파트 비중에 따라 달리 볼 것인가

---

## 📅 2026-04-06 (일) 2차 작업

### ✅ 완료

**홈페이지 구조 개편 (구독 중심)**
- 히어로/About/CTA/Footer 문구 및 링크 전면 수정
- 구독 플랜 3종: 맛보기/정기구독/혼합신청
- 가격 할인 표시 강화 (취소선 + 21% 배지)
- 메뉴 소개 페이지 `/menu` 신규
- 상세 페이지: 장바구니 → 구독 안내 용도로 전환

**구독 시스템 전면 재설계 (Phase 1~4)**
- DB: DeliveryCalendar, MenuAssignment, SubscriptionPeriod, SubscriptionSelection 추가
- Subscription 확장: selectionMode(MANUAL/AUTO), itemsPerDelivery
- 관리자 배송 캘린더 `/admin/delivery-calendar` — 월별 달력 배송일 지정 + 식단 배정
- 관리자 구독 설정 `/admin/subscribe-settings` — 수량/가격/배송 조건
- 관리자 구독 관리 `/admin/subscriptions` — 목록/필터/갱신예정
- 고객 구독 신청 `/subscribe` — 3단계 (유형→수량→캘린더 메뉴선택)
  - 직접 골라먹기 (MANUAL): 캘린더에서 날짜별 메뉴 자유 조합
  - 잘 챙겨서 보내줘 (AUTO): 메뉴 선택 스킵, 회사 배정
  - 맛보기: 1회 체험
- 토스페이먼츠 결제: 맛보기(일반결제) + 구독(빌링키 자동결제)
- 자동 재결제 Cron: renewal-notify(7일전 알림), renewal-charge(자동결제)
- Vercel Cron 설정 (매일 06:00/09:00)
- 마이페이지 구독 관리 UI 리뉴얼
- 홈페이지 식단표 캘린더 데이터 연동

**기타**
- DB 비밀번호 복구 (로컬 + Vercel)
- 관리자 페이지 RightDock 숨김
- 설계 문서: docs/SUBSCRIPTION_DESIGN.md

### 🎯 다음 작업 우선순위

#### 즉시 (관리자 운영 준비)
1. **Vercel 환경변수 추가** — `CRON_SECRET` 값을 생성하여 Vercel 프로젝트에 등록
2. **상품 사진 업로드** — 촬영 완료 후 `/admin/products`에서 이미지 등록
3. **간편식 상품 등록** — `/admin/products`에서 간편식 카테고리로 상품 추가 (샌드위치, 핫도그 등)
4. **배송 캘린더 설정** — `/admin/delivery-calendar`에서 다음 달 배송일 지정 + 날짜별 메뉴 배정
5. **구독 설정 확인** — `/admin/subscribe-settings`에서 수량/가격/배송 조건 확인

#### 심사 대기 중
6. **카카오 비즈니스 심사 완료** → 솔라피 가입 + 템플릿 등록 + 환경변수 추가 → 알림톡 실연동
7. **토스 사업자 심사 완료** → `.env` + Vercel에 라이브 키로 교체 → 실결제 전환

#### 기능 개선 (추후)
8. **주문 시 소스 선택 기능** — 구독 신청 플로우에 소스 옵션 추가
9. **about-service 페이지 업데이트** — 사업 모델 확정 후 서비스 소개서 현행화
10. **배송 관리 고도화** — 기사용 코스표, 배송 상태 실시간 추적
11. **모바일 하단 고정 네비게이션** — PWA 외 추가로 하단바 검토
12. **E2E 테스트** — 구독 생성 → 결제 → 갱신 알림 → 자동결제 전체 플로우 검증

### ⚠️ Vercel 환경변수 추가 필요
- `CRON_SECRET` — cron API 보호용 시크릿 키 (임의 문자열 생성하여 등록)

### 📌 오늘 추가된 주요 관리자 페이지
| 페이지 | 경로 | 용도 |
|---|---|---|
| 배송 캘린더 | `/admin/delivery-calendar` | 월별 배송일 지정 + 날짜별 식단 배정 |
| 구독 설정 | `/admin/subscribe-settings` | 선택 수량/가격/배송 조건 설정 |
| 구독 관리 | `/admin/subscriptions` | 구독 목록/필터/갱신 예정 관리 |
| 식단 배정 (레거시) | `/admin/menu-schedule` | 기존 주차×요일 방식 (deprecated) |

---

## 📅 2026-04-06 (일) 작업 마감

### ✅ 오늘 완료

**커밋**
- `5cbdb30` — 마이페이지 구현 + 알림톡 발송 시스템 + 타입 오류 정리
- `663b0a4` — 구독 상세 관리 페이지 + 일시정지/재개/해지 API
- main 브랜치 푸시 완료, Vercel 자동 배포 진행

**마이페이지 완전 구현**
| 페이지 | 경로 | 기능 |
|--------|------|------|
| 허브 | `/mypage` | 회원정보 + 4개 메뉴 카드 + 로그아웃 |
| 주문내역 | `/mypage/orders` | 주문 목록 + 상태 배지 |
| 구독관리 | `/mypage/subscription` | 구독 목록 (빈 상태 안내 포함) |
| 구독상세 | `/mypage/subscription/[id]` | 일시정지/재개/해지, 타임라인 |
| 배송지 | `/mypage/addresses` | CRUD + 다음 주소검색 + 기본배송지 |
| 프로필 | `/mypage/profile` | 이름/전화 수정, 비밀번호 변경 |

**알림톡 발송 시스템** (Mock 모드)
- `app/lib/notification.ts` — 솔라피 발송 모듈 (HMAC-SHA256 직접 구현)
- 환경변수 없으면 Mock 모드 (콘솔 출력 + DB 기록만)
- 5개 템플릿: `ORDER_PAID` / `DELIVERY_START` / `DELIVERY_DONE` / `SUB_PAID` / `PAYMENT_FAIL`
- 결제 완료 + 배송 상태 전환 시 자동 발송 연동
- `/admin/notifications` 관리자 센터 (이력·필터·테스트 발송)

**새 API**
- 고객: `addresses` CRUD, `user/profile` GET/PATCH, `subscriptions` GET, `subscriptions/[id]` GET/PATCH, `subscriptions/[id]/{pause,resume,cancel}` POST
- 관리자: `admin/notifications` GET/POST

**버그·타입 정리**
- `api/orders` GET 버그 수정 (requireAuth/prisma import 누락)
- `api/payments` Payment.orderId 버그 수정 (orderNo → Order.id)
- 기존 타입 오류 4건 수정 (admin/pages, admin/products, admin/sidebar, AboutSection)
- `lib/supabase.ts` lazy 초기화 (빌드 시점 env 없어도 안전)
- `auth.ts` NextAuth v5 beta 타입 이슈 회피 (`: any` 명시)

**기타**
- 로컬 Turbopack `@theme` 캐시 이슈 해결 경험 (`.next` 삭제 + 재시작)

---

### 🎯 다음 작업 우선순위

#### 1순위: 카카오 비즈니스 인증 대기 + 알림톡 실연동
**현재 상태**
- 2026-04-06 심사 시작, 영업일 3~5일 (4/9 ~ 4/13 예상 완료)
- 심사 완료 시 카카오 비즈니스 파트너 관리자센터 알림

**심사 완료 후 할 일**
1. 카카오 비즈니스 파트너 → **발신프로필 등록** (PFID 발급)
2. **솔라피(solapi.com) 가입** → API Key/Secret 발급
3. 솔라피 콘솔에서 **템플릿 5개 등록** → 심사 제출 (2~3일)
4. `.env`에 환경변수 추가:
   ```env
   SOLAPI_API_KEY=
   SOLAPI_API_SECRET=
   SOLAPI_PFID=
   SOLAPI_SENDER_PHONE=053-721-7794
   SOLAPI_TEMPLATE_ORDER_PAID=
   SOLAPI_TEMPLATE_DELIVERY_START=
   SOLAPI_TEMPLATE_DELIVERY_DONE=
   SOLAPI_TEMPLATE_SUB_PAID=
   SOLAPI_TEMPLATE_PAYMENT_FAIL=
   ```
5. Vercel 프로젝트 설정에도 동일 환경변수 추가
6. 배포 → 자동으로 LIVE 모드 전환

**심사 대기 중 할 수 있는 작업**: 2~4순위 작업

#### 2순위: 토스 빌링키 구독 결제 플로우
- `/subscribe` 구독 시작 페이지 (플랜 비교 + 주기 선택 + 메뉴 구성 UI)
- `POST /api/subscriptions` — 빌링키 발급 + 첫 결제
- `PATCH /api/subscriptions/[id]/card` — 카드 변경
- 매일 AM 9시 자동결제 cron (단순 cron 우선, BullMQ+Redis는 나중)
- 결제 실패 시 재시도 로직 (4시간 간격 3회, 3회 실패 시 일시정지)

#### 3순위: 배송 관리 고도화
- 기사용 코스표 (배송 순서 최적화)
- 배송 상태 실시간 추적 UI

#### 4순위: 모바일 앱 + 확장 (나중)
- 고객/기사용 React Native 앱
- FCM 푸시 알림
- 쿠폰/프로모션, 리뷰 시스템

---

### 📌 서비스 운영 정보

| 항목 | 값 |
|------|-----|
| 프로덕션 URL | https://www.w2o.co.kr |
| 카카오톡 채널 | `w2o_salada` (pf.kakao.com/_xfLLuX) |
| 고객센터 | 053-721-7794 |
| GitHub | jsmidas/w2o-salada |
| 배포 | Vercel (main 푸시 시 자동) |
| DB | Supabase Pro (Seoul, MICRO) |

---

### ⚠️ 알려진 이슈/주의사항

- **Turbopack `@theme` 캐시 이슈**: `globals.css`에 새 CSS 변수 추가 후 dev 빌드에서 누락될 수 있음 → `.next` 삭제 + dev 서버 재시작
- **패키지 매니저**: `pnpm` 없음, **`npm` 사용**
- **`auth.ts` 타입**: NextAuth v5 beta 때문에 export에 `: any` 명시 (뺄 수 없음)
- **Vercel CDN 캐시**: 중요 변경 후 `X-Vercel-Cache: HIT` 오래 남음. 빈 커밋으로 재배포 트리거 필요할 수 있음
- **하드 리프레시**: `Ctrl+Shift+R` 필수 (F5는 HTML 캐시 씀)
- **IDE diagnostics**: hint/error에 false positive 많음, 실제 동작과 별개로 무시 가능한 경우 다수

---

### 📦 현재 커밋 기준 파일 구조

```
w2o-salada/apps/web/app/
├── mypage/
│   ├── page.tsx                    # 허브
│   ├── orders/page.tsx
│   ├── subscription/page.tsx
│   ├── subscription/[id]/page.tsx  # 상세
│   ├── addresses/page.tsx
│   └── profile/page.tsx
├── api/
│   ├── addresses/{route,[id]/route}.ts
│   ├── user/profile/route.ts
│   ├── subscriptions/{route,[id]/route,[id]/pause/route,[id]/resume/route,[id]/cancel/route}.ts
│   ├── orders/route.ts             # 버그 수정됨
│   ├── payments/route.ts           # 알림톡 훅 추가
│   └── admin/
│       ├── notifications/route.ts
│       └── delivery/[id]/route.ts  # 알림톡 훅 추가
├── admin/
│   └── notifications/page.tsx
└── lib/
    ├── notification.ts             # 솔라피 발송 모듈
    ├── auth-guard.ts
    └── supabase.ts                 # lazy init 리팩터
```

---

> 다음 작업 시작 시 이 문서 상단에 새 세션 기록을 추가할 것.
