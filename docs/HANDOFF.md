# W2O SALADA 작업 인수인계

> 세션 간/PC 간 이어서 작업하기 위한 진행 상태 기록.
> 최신 상태가 상단에 오도록 유지.

---

## 📅 2026-09-28 (월) 코드 점검 후속 — NEXT_STEPS C 항목 처리

`docs/NEXT_STEPS_20260929.md` 의 "남은 코드 작업" 10건 중 9건 완료, 1건 부분 완료.

### ✅ 완료

**생산 집계와 배송 리포트 기준 통일 (C-2)**
- 생산 집계가 구독 물량을 `SubscriptionSelection` 에서 직접 세고 있어 배송
  리포트(배송 건 기준)와 수량이 어긋날 수 있었다. 둘 다
  `ensureSubscriptionDeliveries` + `DELIVERABLE_ORDER_TYPES` 로 통일
- 배송 보류(`deliveryHold`) 건은 상품 행 배지 + 하단 별도 표로 분리

**서버리스 타임아웃 대비 (C-3)** — 주소 일괄 보정은 커서 페이징(25건/요청),
아파트 CSV 등록은 25행씩 청크 전송. 둘 다 건마다 외부 지오코딩을 부르므로
한 요청에서 다 돌리면 중간에 끊겼다

**구독 생성 검증 (C-4·C-5)**
- 주기 창을 화면이 보낸 `windowStart` 기준으로 확정. 서버가 "첫 선택일"로
  다시 잡던 탓에 첫 회를 건너뛰면 기간·결제일이 7일 밀렸다
- 활성 배송일 검증 + `sanitizeSlots` 추가

**rate limit (C-6)** — DB(`AccessAttempt`) 기반. 워커가 없어 Redis 를 쓰는
곳이 전무하므로 이것 하나 때문에 서비스를 늘리지 않았다. 로그인 계정당
10분 10회·IP당 30회, 인증번호 발송 IP당 1시간 20회

**정리** — `middleware.ts` → `proxy.ts`(Next 16), 죽은 토스 키 입력란 제거,
미사용 의존성·데드 코드 제거(패키지 38개 감소), ESLint 68 → 23건

**백업 (C-1)**
- 복원 리허설 수행. 25개 테이블 행 수가 백업 매니페스트와 전부 일치
- Storage 이미지 백업 추가 — DB 가 참조하는 URL 로 받아 아티팩트에 함께 올린다
- `docs/BACKUP_RESTORE.md` 신설 (절차·검증·월 1회 리허설 권장)

### 🐞 작업 중 발견해 고친 버그

| 무엇 | 어떻게 찾았나 |
|---|---|
| `products/placeholder.jpg` 파일 없음 — 판매중 상품 7개가 깨져 보임 | Playwright 로 `/menu` 를 찍어 확인 |
| 개발용 데모 관리자 로그인이 P2002 로 실패 (username 중복) | 로그인 자동화 중 발견 |
| `_prisma_migrations` RLS 가 운영 DB 에서 꺼져 있음 | 백업 복원본과 운영본을 대조하다 발견 |
| `auth.ts` 의 `@ts-nocheck` — 로그인·세션 전체가 타입 검사 밖 | 제거해도 에러 0건이라 삭제 |

### 🖼 next/image 전환 (C-8 부분)

`remotePatterns` 등록 후 화면마다 Playwright 로 전후를 대조하며 전환했다.
`/menu` 22 · `/products/<id>` 1 · `/trial` 10 · `/admin/products` 22 ·
`/mypage/orders` 33 — 모두 깨짐 0.

남은 15건과 이어서 하는 방법은 `docs/NEXT_STEPS_20260929.md` 상단 참고.

### 🔧 새로 생긴 도구

- `tools/shot.mjs` — 경로를 데스크톱·모바일 두 벌로 찍고 **깨진 이미지 수와
  next/image 적용 수**를 보고한다. `SHOT_LOGIN=1` 로 로그인 화면도 촬영.
  MCP Playwright 가 끊겨 있어도 패키지를 직접 써서 동작한다
- `tools/backup_images.ts` — Storage 이미지 백업

---

## 📅 2026-09-27 (일) 오전 — 구독 요일별 구성 + 휴일 대체 배송일 + 간편결제 계획

### ✅ 완료 (모두 푸시·마이그레이션 적용 완료)
- **요일별 구독 구성** — "화요일은 샐러드 2, 목요일은 샐러드 1 + 오니기리 1". `Subscription.weekdaySlots`, 우선순위 날짜 예외 > 요일 > 기본. `lib/auto-assign.ts`의 `slotsForDate()`가 단일 진입점 (커밋 `08f0567`)
- **휴일 대체 배송일** — 화·목이 아닌 날을 배송일로 켜면 관리자 캘린더에서 "화요일 대신 / 목요일 대신" 지정 (`DeliveryCalendar.substituteWeekday`). 요일별 구성은 이 요일로 해석 (커밋 `3fe3d54`)
- 구독 캘린더 열 너비를 배송 있는 요일 기준으로 유도, 고객용 캘린더 API CDN 캐시 5분→1분 (커밋 `b48ef00`)

### 📌 다음 작업 — 간편결제 (월요일 9/28 토스 상담부터)
- 계획 문서: [`docs/PAYMENT_EASYPAY_PLAN.md`](PAYMENT_EASYPAY_PLAN.md) **0번 섹션이 월요일 할 일.**
- 확인된 사실: 간편결제는 4월에 이미 신청돼 MID 3건이 심사중(`w2owfey7l6`가 가장 넓음). 네이버페이만 미신청. 심사가 멈춘 원인은 DB 초기화 후 사이트 하단 사업자 표기가 비어 있던 것으로 추정 → 9/27 저녁 회사명·대표(손정수)·사업자번호·통신판매업신고·이메일 재입력 완료
- 승인 후 코드: 일반결제 MID와 빌링 MID 키 분리 (문서 4-0)

### 🗺️ 배송 코스 지도 (9/27 저녁 착수 → 9/28 마무리)
- 구현: `apps/web/app/admin/delivery/DeliveryMap.tsx` — 배송 관리 "2. 코스 편성" 위에 지도. 집(배송지) 단위 핀, 코스 색(`DeliveryRoute.color` 없으면 팔레트), 핀 숫자=코스 안 순번, ×N=같은 집 주문 수, 미배정 회색. 핀 클릭 → 오른쪽 패널에서 출입 정보 보고 코스 변경(저장은 기존 "코스 배정 저장" 버튼). 센터 핀 + 배송 반경 점선 원. 좌표 없는 집은 패널 아래 목록
- 리포트 API(`/api/admin/delivery/report`)에 `address.lat/lng`, `center` 추가
- 키: 카카오 **daham_voc 앱**(ID 1321764, 카카오맵 무료 쿼터 보유)의 JavaScript 키 `c49d3caee184645323027f84b59a9f8f`. 로컬 `.env` 두 곳에 `NEXT_PUBLIC_KAKAO_JS_KEY`로 넣음. **새 앱 만들지 말 것** — 무료 쿼터는 첫 활성화 앱에만
- **9/28 남은 일**
  1. 카카오 콘솔 daham_voc → 플랫폼 키 → JavaScript 키 카드의 "JS SDK 도메인"에 `https://www.w2o.co.kr`, `https://w2o.co.kr`, `http://localhost:3000`(+ 로컬 확인용 포트) 등록 — 이게 없으면 지도가 빈 화면
  2. Vercel 환경변수 `NEXT_PUBLIC_KAKAO_JS_KEY` 추가 후 재배포 (없으면 관리자 화면에 "지도 키 미설정" 안내만 보임)
  3. 관리자 로그인 후 배송 관리 → 9/29(주문 17건)로 실제 확인. tsc 통과했지만 **브라우저 확인은 아직 못 함**(도메인 미등록 + 관리자 비밀번호 없음)
  4. 확인 후 다음 단계: 코스별 핀 숨기기, 지도에서 순번 드래그, 아파트 단지 묶음 표시
- **9/28 새벽 추가 — 배송 현황판**: `DeliveryMap.tsx`에 Delivery.status 기반 현황 합침. 완료 핀 흐림+✓, 못함 ✕, 문제 집은 빨간(주의는 주황) 테두리 깜빡임. 문제 판정 = 못함 / 06:00 지남 / 건너뜀(뒤 순번 완료, 이 집 미완료) / 순번 선형 배분 예상 시각+20분 초과. 출발 03:00·기한 06:00은 파일 상수(설정 이관 전). 보기 필터(전체·남은 집·문제), 코스별 진행 막대, 문제 목록 클릭→핀 이동. 배송 당일엔 SWR 1분 자동 새로고침. 카카오 JS SDK 도메인 등록·Vercel 키 완료, 운영에서 지도 뜨는 것 확인함. 현황 표시는 DELIVERED/FAILED 데이터가 아직 없어 브라우저 미확인

### ⚠️ 운영 캘린더 샘플 데이터
- 10/12(월)=화요일 대체, 10/30(금)=목요일 대체, 10/13(화)·10/29(목)=꺼짐 — 휴일 시나리오 테스트용으로 넣은 값. 실제 배송 전에 정리할 것

---

## 📅 2026-09-27 (일) 배송 코스 1단계 + 계정 관리

### ✅ 완료 (커밋 대기 → 마이그레이션 적용 후 푸시)

**배송 코스 1단계 — 주소 위치 정보 + 센터 반경 판정**
- `Address`에 다음 우편번호 API 필드 보존: `sido/sigungu/bname/buildingName/isApartment/roadAddress/jibunAddress`.
  주소 문자열에 건물명을 합치던 방식을 버리고 `buildingName`을 원문 그대로 별도 저장(단지 묶음 키)
- 좌표 `lat/lng` + `distanceKm` + `areaStatus(IN_RANGE/OUT_OF_RANGE/UNKNOWN)` + `geocodedAt`. 카카오 로컬 API로 수집(`lib/geo.ts`)
- **배송지별 출입·수령 정보**: `label`(집/부모님 댁), `entranceMethod`, `entrancePassword`, `floor`, `dropLocation`(문 앞/경비실/택배함/기타), `dropNote`.
  한 회원이 여러 곳(부모님 댁 등)에 보낼 수 있고 출입 방법이 각각 다르다는 현장 판단 반영
- **주문에 배송지 연결** — 이전엔 주문 56건 중 주소 연결 0건이었다. 단건 주문·구독 신청·구독 갱신 확정·자동결제 크론 4곳 모두 `addressId`를 채운다. `Subscription.addressId`로 구독 배송지 고정
- **경계 밖 주문 보류(HOLD)** — 결제는 막지 않고 `Order.deliveryHold/deliveryHoldReason`으로 표시. 관리자 주문 관리에 "배송지 확인" 필터 + 확인 완료(통화 메모) 버튼
- 고객 화면: 주소 선택 직후 배송 가능 안내(`/api/delivery/check`), 출입 정보 입력 폼(체크아웃·배송지 관리·구독 신청 공용 컴포넌트 `components/address/`)
- 구독 신청 화면에 **배송지 선택기** 추가 — 이전엔 구독 신청에 주소 입력이 아예 없었다
- 관리자 설정 "배송 권역" 섹션: 센터 이름·주소·좌표 찾기·반경(km)·허용 동 화이트리스트 + 기존 배송지 좌표 보정/재판정 버튼
- 관리자 배송 관리·기사 출력본에 동/단지/거리/출입 정보 표시
- `/admin/apartments` 아파트 단지 사전 등록(단건·CSV 붙여넣기, 주소로 좌표·센터 거리 자동, 배송 개시 토글, 단지별 배송지 수/침투율)

**계정 관리**
- 권한 페이지: 새 관리자/기사 계정 직접 생성, 아이디·이메일·이름·비밀번호 수정. 프로필 이메일 변경, 비밀번호 보기 토글, 관리자 사이드바→내 정보 링크

### 🔧 적용 절차 (순서 중요)

1. **마이그레이션 적용** (사용자 직접 — 자동모드가 운영 DB 쓰기를 막는다)
   ```bash
   cd packages/db && npm run db:deploy
   ```
   `20260927100000_delivery_area_phase1` — 추가 전용(enum 2, addresses 컬럼 20, orders 4, subscriptions 1, apartments 테이블). 파괴 구문 없음
2. **그다음 코드 푸시** — 새 코드는 새 컬럼을 select 하므로 마이그레이션 전에 배포되면 주문·배송지 API가 실패한다
3. **카카오맵 활성화** — Kakao Developers → 앱 `w2o` → 제품 설정 → 카카오맵 → ON. 켜기 전까지는 모든 주소가 `UNKNOWN`(보류)으로 들어온다.
   켠 뒤 `/admin/settings` 배송 권역에서 "좌표 찾기" → 저장 → "기존 배송지 좌표 보정·재판정"
4. Vercel 환경변수 `KAKAO_REST_API_KEY`는 선택 — 없으면 `KAKAO_CLIENT_ID`를 그대로 쓴다
5. **VWorld 대체 지오코더** — 카카오맵은 비즈 앱 전환·비즈월렛 카드 등록(business.kakao.com)까지 끝나야 활성화된다(2026-09-27 현재 비즈니스 정보 심사 중).
   그동안은 국토부 VWorld 키로 판정한다: Vercel 환경변수 `VWORLD_API_KEY` (개발키, 만료 2027-03-27, 연장 3회). 로컬 apps/web/.env에는 넣어둠.
   테스트 결과 센터(성서공단로 332-10)가 **월성동**(35.8356, 128.5185)으로 잡혀 상인동이 2.7km — 설계 문서의 "상인·월배 8~10km" 가정과 다름. 센터 주소는 맞음(사용자 확인). **반경은 10km로 확정**("10km 안이면 어디든") — 코드 기본값도 10km

### 📌 결정 사항
- 배송 가능 판정은 **행정구역 무관, 센터 반경 단일 규칙(기본 10km)** + 허용 동 예외 목록. 상인·월배·다사읍 죽곡까지 모두 반경 안이라 "달서구 전체" 논점은 해소됐다
- 좌표를 못 얻은 주소도 주문을 막지 않고 보류 큐로 보낸다

### 🧪 배송 코스 시나리오 테스트 (2026-09-27 준비)
`tools/seed_test_scenario.cts` — 지역별 테스트 계정 10개(test01~test10 / test1234), 배송지 11곳(아파트 4·단독·원룸·부모님 댁·권역 밖 경산·좌표 불명),
다가오는 배송일 2개에 단건 주문 15건 + 구독 3건(한 건은 부모님 댁 배송지) + 비회원 주문 1건 + 아파트 단지 4곳.
`cd packages/db && npx tsx ../../tools/seed_test_scenario.cts` (멱등, `--clean`으로 삭제, `DRY_RUN=1`로 판정만).
확인할 화면: /admin/delivery(두 배송일), /admin/orders 배송지 확인 필터, /admin/production, /admin/apartments, 기사 출력본.
**미리 알고 있는 문제**: 배송 관리는 `Order.deliveryDate`로만 모으므로 구독 고객은 월 주문의 첫 배송일에만 나타나고 두 번째 배송일 코스 편성에서 빠진다.

### 🔧 시나리오에서 찾은 문제와 수정 (2026-09-27 밤, 마이그레이션 `20260927140000_subscription_delivery_orders` 필요)
1. **구독 고객이 두 번째 배송일 코스 편성에서 누락** / 2. **첫 배송일에 한 달치 품목이 실림** / 3. **생산 집계 이중 계산** — 원인은 하나.
   배송 관리가 `Order.deliveryDate`만 보는데 구독은 월 결제 주문 1건뿐이었다.
   → `OrderType.SUBSCRIPTION_DELIVERY`(금액 0, 배송일별) 신설. `lib/subscription-delivery.ts`의 `ensureSubscriptionDeliveries(date)`가
   리포트를 열 때마다 그날 선택분으로 배송 건을 만들고(마감 전엔 최신 선택분으로 갱신, 마감 후 고정), 배송 관리는 SINGLE + SUBSCRIPTION_DELIVERY만,
   생산 집계는 선택분 + SINGLE만 센다. 통계·고객 주문 목록·관리자 주문 목록은 SUBSCRIPTION_DELIVERY를 숨긴다
4. **같은 집이 2스톱** — 배송지(addressId) 기준 스톱 수 집계, 코스 배정 시 같은 집 주문은 같이 이동, "같은 집 N건" 표시
5. **권역 밖 주문이 코스에 섞임** — `heldOrders`로 분리해 코스·피킹·출력에서 제외, 배송 관리 상단에 대기 목록
6. **미결제 주문이 전화 큐에** — 보류 큐는 PAID/PREPARING/SHIPPING만
7. **같은 고객에게 두 번 전화** — 확인 완료 시 같은 배송지의 다른 보류 주문도 함께 처리
8. **미등록 단지** — 단지 관리에 "고객 주소에 있는데 미등록인 단지" 목록, 클릭하면 등록 폼에 채움

### 🚚 코스 마스터 + 기사 계정 (2026-09-28 새벽, 마이그레이션 `20260927160000_delivery_routes` 필요)
- `DeliveryRoute`(이름·기사 계정·차량·자차/용차·목표 집 수·출고 순번·운행 여부) 신설, `Delivery.routeId` 정식 참조(`driverId`는 표시용 라벨로 동기화),
  `Address.lastRouteId`로 **고정 코스 원칙**: 한 번 배정한 배송지는 다음 배송일 리포트를 열 때 같은 코스로 자동 채움("지난 코스 자동" 표시)
- `/admin/routes` 코스·기사 관리(이름 인라인 수정, 기사 선택은 DRIVER 계정만, 삭제는 이력 있으면 비활성화), 배송 관리의 코스 입력이 자유 글자 → 코스 드롭다운, 코스별 집 수/목표 표시
- 기사 3명 + 코스 A/B/C 시드: `cd packages/db && npx tsx ../../tools/seed_routes.cts` (driver01~03 / driver1234). 이름은 운영 시 관리자 화면에서 변경
- 다음: 기사 페이지 `/driver`(DRIVER 로그인 → 오늘 내 코스만, 출입 정보·품목·전화·지도·완료 체크), 피킹 페이지 분리, 배송 관리에서 금액 제거

### 🔁 구독 캘린더 개편 + 롤링 청구 주기 (2026-09-28, 마이그레이션 `20260928020000_rolling_billing_cycle` 필요)
- **캘린더**: 월 탭 폐지 → 첫 주문 가능일부터 N주를 한 화면에 이어서(칸 높이 절반, 월 바뀌는 칸에 "10월"). 체크된 날짜/칩을 누르면 **그 날만 수량 변경·건너뛰기**
  (AUTO 는 날짜별 슬롯 `dateSlots`, MANUAL 은 메뉴 선택). 상단에 "날짜별 변경 N건"
- **기간**: "8회 ±" → **2/4/6/8주 칩**. 최소 2회. 회당 최대는 설정(기본 10)
- **자동 갱신 토글**: 켜면 빌링키(카드 등록) + N주마다 자동 결제, 끄면 이번 주기만 일반결제(빌링키 없음). 결제 승인 API가 구독을 활성화
- **롤링 청구**: `Subscription.cycleWeeks/autoRenew/creditBalance`, `SubscriptionPeriod.startDate/endDate/weeks`(연·월 유니크 제거).
  주기 = [첫 배송일, +N주). 결제일 = 주기 종료 이틀 전 06:00. 금액 = 그 주기 배송일 × 선택 상품가 − 크레딧
- **변동 금액 고지**: renewal-notify 가 다음 주기 예정 금액(배송 횟수·차감 포함)을 계산해 7일 전 발송. 약관 문구에 변동 가능 명시
- **크레딧**: 결제된 주기의 배송을 건너뛰면 그 금액을 `creditBalance`에 적립, 다음 자동 결제에서 차감(환불 대신). "이번 주기만"은 적립 없음(안내만)
- 알림톡 템플릿 변수 추가: SUB_RENEWAL_NOTICE(결제일·배송횟수·기간·차감), SUB_RENEWED(기간·배송횟수) — 솔라피 템플릿 등록 시 반영 필요
- `lib/subscription-cycle.ts`: cycleWindow · billingDateFor · previewCycle(DB 쓰기 없음) · nextCycleWindow · getOrCreatePeriodForDate

### 🔜 남은 것
- **서버 측 주문 마감 검증**(②) — 단건 주문에 아직 `deliveryDate`가 없다. 장바구니의 배송일을 주문에 싣고 `isOrderable`로 막아야 한다
- 배송 출발·완료 알림톡을 **주문자와 수령인 중 누구에게** 보낼지 — 부모님 댁 배송이면 둘 다일 수 있다
- 회원 상세 페이지 신설 후 알레르기·마케팅 수신 동의·탈퇴 분리보관(3~5번)
- 공동현관 비밀번호 열람 기록, 배송 완료 N일 후 출력본 마스킹
- 2단계(구역·코스 마스터, 자동 배정)는 물량 50집 시점

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
