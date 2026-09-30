# W2O SALADA - 가정식 새벽배송 풀스택 서비스

## 프로젝트 개요
- **브랜드명**: W2O SALADA
- **브랜드 의미**: W2O = **Weekly 2 Order** (매주 두 번, 우리 집 식탁으로) / 보조 카피 "Wake 2 go Out — 일어나면 이미 준비된 하루"
- **서비스**: 샐러드·간편식·반찬·음료를 매주 두 번(화·목) 새벽 배송 + 정기구독
- **모회사**: 다함푸드 (https://dahamfood.co.kr/)
- **방향**: 자체 개발 + 토스페이먼츠 PG 연동 (카페24 스킨 X)

---

## 사업 모델 / 주문 규칙 (2026-04-11 확정)

### 카테고리 구조 (5개)
| 카테고리 | slug | 유형 | 최소액 계산 |
|---|---|---|---|
| 🥗 샐러드 | `salad` | 본품 | 포함 |
| 🍱 간편식 | `simple` | 본품 | 포함 |
| 🍙 오니기리 | `onigiri` | 본품 | 포함 |
| 🍲 반찬·국 | `banchan` | 본품 | 포함 |
| 🥤 주스·음료 | `drink` | **옵션** (`isOption=true`) | 제외 |

- 그레인볼·프로틴은 **샐러드의 세부 분류**로 통합 (별도 카테고리 X, 추후 확장 가능)
- 미래 확장 가능: 아침·베이커리·디저트 등

**카테고리는 DB(`categories` 테이블)에서 관리한다.** `/admin/categories`에서 추가하면
아래가 코드 수정 없이 따라온다 — 고객 메뉴 필터, 배송 캘린더 메뉴 배정, 구독 화면의
카테고리별 수량 카드·선택 제한. 최소 주문액 포함 여부는 slug가 아니라 `isOption`으로
판정하므로, 옵션 성격(음료·유산균 등)이면 `isOption=true`로 만들 것.

### 주문 방식 — OR 조합 + 최소 주문액
- **고객은 매 배송일 "오늘의 풀"에서 원하는 상품을 자유롭게 조합** (AND 아님, OR)
- **1회 배송 최소 주문액 = 11,000원** (`settings.minOrderAmount`에 저장, 관리자 변경 가능)
- **최소액 계산 = 본품(샐러드·간편식·반찬) 합계만** — 옵션 카테고리(음료·유산균 등)는 마진이 작아 최소액 계산에서 제외
- 예: 샐러드 5,900 + 음료 3,500 = 9,400원 → 본품 5,900원이라 **주문 불가**
- 예: 반찬세트 11,000원 → 주문 가능 (음료는 얼마든지 추가 OK)

### 반찬 세트
- **반찬은 "3종 고정 구성된 1개 상품"으로 취급** (예: "집반찬 A세트 — 나물+김치+조림 11,000원")
- 고객이 3종 중 하나를 고르는 게 아님. 세트 전체가 단일 상품
- 매 배송일 관리자가 "A세트 / B세트" 중 어떤 세트를 풀에 넣을지 선택
- 세트 가격은 구성에 따라 달라질 수 있음 → 여러 반찬 세트 상품을 자유롭게 등록
- 미래: 반찬 선택권(3종 중 일부 교체) 확장 가능

### 가격 표기 — "상시 할인가" 모델
- 모든 상품에 `originalPrice`(정가)와 `price`(판매가)를 함께 저장
- UI는 항상 "정가 ~~X~~ **Y** (−21%)" 형태로 표시
- **구독 여부와 무관하게 판매가로 결제** — 1회 체험도 할인가 적용
- 고객 체감: "정가보다 싸게 산다" → **구독 없이도 할인 혜택** + 구독 시 추가 혜택(배송 고정·자동 결제·재고 우선권)
- **구독 자체에 별도 할인을 걸지 않음** — 구독 혜택은 편의성/자동화로 포지셔닝 (마진 보호)

### 배송 주기
- 주 2회 **화·목** 새벽 배송 (Weekly 2 Order)
- AM 6시 전 문 앞 도착
- 주문 마감: 배송 전날 PM 2:00 (구독 메뉴 변경도 동일 시각 마감)

---

## 디자인 방향
- **톤**: 신선하고 역동적, 젊은 층 타겟
- **색상**: 그린(#1D9E75, #5DCAA5) + 앰버(#EF9F27) + 다크(#0A1A0F)
- **폰트**: Pretendard (한글) + 영문 산세리프
- **벤치마킹**: 컬리, 샐러디, 프레시코드
- **히어로 영상**: Remotion으로 제작 (salada-video/ 프로젝트)

---

## 기술 스택

### 프론트엔드 (고객 + 관리자)
| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 언어 | TypeScript |
| 스타일링 | Tailwind CSS |
| 상태 관리 | Zustand (장바구니/인증) |
| API 통신 | TanStack Query |
| 폼 검증 | React Hook Form + Zod |
| 어드민 UI | shadcn/ui |
| 차트 | Recharts (통계) |

### 백엔드
| 구분 | 기술 |
|------|------|
| 런타임 | Node.js |
| API | Next.js API Routes |
| ORM | Prisma |
| 인증 | NextAuth.js (Auth.js v5) |
| 작업 큐 | BullMQ (Redis) |

### 데이터베이스 & 인프라
| 구분 | 기술 |
|------|------|
| 메인 DB | PostgreSQL (Supabase) |
| 캐시/큐 | Redis (Upstash 또는 Railway) |
| 파일 저장 | Cloudflare R2 또는 AWS S3 |
| 호스팅 | Vercel (프론트) + Railway (워커) |
| CI/CD | GitHub Actions |
| 모니터링 | Sentry + Vercel Analytics |

### 외부 연동
| 구분 | 서비스 |
|------|--------|
| PG (결제) | 토스페이먼츠 (일반결제 + 빌링키 정기결제) |
| 알림톡 | 솔라피 Solapi (카카오 알림톡) |
| SMS | 솔라피 Solapi (알림톡 실패 시 자동 폴백) |
| 주소 검색 | 다음 우편번호 API |

---

## 프로젝트 구조 (모노레포 - Turborepo)

```
w2o-salada/
├── apps/
│   ├── web/                    # 고객용 Next.js
│   │   ├── app/
│   │   │   ├── (marketing)/    # 랜딩 페이지 (기존 HTML 이전)
│   │   │   ├── (shop)/         # 상품 목록/상세/장바구니
│   │   │   ├── (auth)/         # 로그인/회원가입
│   │   │   ├── (checkout)/     # 결제
│   │   │   ├── (mypage)/       # 마이페이지
│   │   │   ├── (subscription)/ # 구독 관리
│   │   │   └── api/            # API Routes
│   │   │       ├── auth/
│   │   │       ├── products/
│   │   │       ├── orders/
│   │   │       ├── subscriptions/
│   │   │       ├── payments/
│   │   │       ├── delivery/
│   │   │       └── webhooks/   # 토스 웹훅
│   │   └── ...
│   │
│   ├── admin/                  # 관리자 Next.js
│   │   ├── app/
│   │   │   ├── dashboard/      # 매출/통계
│   │   │   ├── products/       # 상품 관리
│   │   │   ├── orders/         # 주문 관리
│   │   │   ├── subscriptions/  # 구독 관리
│   │   │   ├── delivery/       # 배송 관리
│   │   │   ├── members/        # 회원 관리
│   │   │   └── settings/       # 설정
│   │   └── ...
│   │
│   └── worker/                 # 백그라운드 워커 (Express + BullMQ)
│       ├── jobs/
│       │   ├── billing.ts      # 정기결제 자동 실행
│       │   ├── notification.ts # 알림톡/SMS 발송
│       │   └── delivery.ts     # 배송 상태 자동 전환
│       └── ...
│
├── packages/
│   ├── db/                     # Prisma 스키마 + 클라이언트
│   ├── shared/                 # 공유 타입, 유틸, 상수
│   └── ui/                     # 공유 UI 컴포넌트
│
├── salada-video/               # Remotion 히어로 영상 (기존)
├── turbo.json
└── package.json
```

---

## 핵심 DB 테이블

```
User            → 회원 (CUSTOMER | ADMIN | DRIVER)
Address         → 배송지
Product         → 상품 (메뉴)
Category        → 카테고리 (샐러드 단일, 태그로 필터링: 곡물베이스·고단백 등)
Order           → 주문 (단건 | 구독)
OrderItem       → 주문 상품
Payment         → 결제 내역
Subscription    → 정기구독 (플랜/빌링키/다음결제일)
SubscriptionItem→ 구독 메뉴 구성
Delivery        → 배송 (상태/기사/코스순서)
Notification    → 알림 발송 내역
```

### 주문 상태 머신
```
PENDING → PAID → PREPARING → SHIPPING → DELIVERED
                                         
PENDING → FAILED (결제실패)
PAID → CANCELLED → REFUNDED (취소/환불, PREPARING 이전만)
```

---

## 정기결제 플로우

1. **구독 시작**: 플랜 선택 → 카드 등록 → 토스 빌링키 발급 → 첫 결제
2. **자동결제**: 매일 **AM 7:30** 크론이 당일 결제 대상 → billingKey로 결제
3. **실패 처리**: 하루 간격 재시도(크론이 `nextBillingDate`를 +1일로 미룬다) → 매회 '구독 갱신 실패' 알림톡
   → **7일 내 3회** 실패 시 구독 일시정지 + '결제 실패' 알림톡 (앵커 주문·주기·선택분 정리)
4. **카드 변경**: 새 빌링키 발급 → 기존 빌링키 폐기

---

## 배송 사이클

```
D-2       재료 발주 (예측 수량 — 구독 확정분 + 단건 예측분)
          └ 오차는 회사가 감당. D-3과 단가 차이가 작아 앞당기지 않는다

D-1  AM 7:30   정기구독 자동결제
     ...       일반주문 수시 접수
     PM 2:00   주문 마감 (컷오프) · 구독 메뉴 변경 마감
     PM 2:30   배송 리스트 확정 (PAID → PREPARING)
     오후       조리 · 포장 → 냉장 보관 (PREPARING → SHIPPING)

D    AM 3:00   배송 출발 (알림 없음 — 자는 고객을 깨우지 않는다)
     AM 6:00   도착 (SHIPPING → DELIVERED)
     AM 7:30   '배송 도착' 알림톡 — 배송 사진 페이지(/delivery/<토큰>) 버튼 포함
```

---

## 알림 시점

솔라피(Solapi) 알림톡, 템플릿 ID가 없으면 SMS/LMS 폴백. 설정·템플릿 대조표는
[docs/SOLAPI_SETUP.md](docs/SOLAPI_SETUP.md).

| 시점 | 발송 (KST) | 내용 |
|------|------|------|
| 주문 결제 완료 | 즉시 | "주문이 완료되었습니다 · #{배송일} 새벽 도착 예정" |
| 구독 결제 완료 | 즉시 | "정기구독 결제가 완료되었습니다" (배송일이 여러 번이라 주문 완료와 문구를 나눈다) |
| **배송 도착** | **07:30** | "간밤에 문 앞으로 배송해 드렸습니다" + 배송 사진 버튼 |
| 구독 갱신 예고 | D-7 09:00 | 다음 결제 예정 금액 고지 (변동 금액 정기결제라 필수) |
| 구독 갱신 완료 | 결제 직후 | "구독이 자동 갱신되었습니다" |
| 구독 갱신 실패 | 실패 직후 | "카드 정보를 확인해주세요" |
| 결제 실패(구독 정지) | 3회째 실패 | 7일 내 3회 실패로 구독이 멈춘 회차에만 |
| 메뉴 선택 요청 | 09:00 | "이달 메뉴를 선택해주세요" |

**배송 출발 알림은 두지 않는다.** 새벽 3시에 울리는 알림은 고객에게 득이 없다고
판단해 발송 자체를 없앴다(2026-09-28). 도착 알림도 06:00 도착 즉시가 아니라
아침 07:30 에 모아서 보낸다. 07:30 이 지난 뒤 완료 처리된 건(지연·재배송)은
그 자리에서 바로 나가고, 중복은 `Delivery.arrivedNotifiedAt` 으로 막는다.

---

## API 설계 (핵심)

### 인증
```
POST /api/auth/signup, login, login/kakao, login/naver
POST /api/auth/refresh, logout, forgot-password, reset-password
```

### 상품/장바구니
```
GET  /api/products, /api/products/:id, /api/categories
GET  /api/cart
POST /api/cart/items, PATCH /:id, DELETE /:id
```

### 주문/결제
```
POST /api/orders                    # 주문 생성
GET  /api/orders, /api/orders/:id
POST /api/payments/ready, confirm, /:id/cancel
POST /api/webhooks/toss             # 토스 웹훅
```

### 구독
```
POST  /api/subscriptions            # 구독 시작 (빌링키 발급)
GET   /api/subscriptions, /:id
PATCH /api/subscriptions/:id        # 메뉴/주기 변경
POST  /api/subscriptions/:id/pause, resume, cancel
PATCH /api/subscriptions/:id/card   # 카드 변경
```

### 배송/주소
```
GET  /api/delivery/:orderId, /api/delivery/schedule
CRUD /api/addresses
```

### 관리자
```
CRUD /api/admin/products
GET  /api/admin/orders, PATCH /:id/status, POST /:id/refund
GET  /api/admin/subscriptions, members, delivery/today
GET  /api/admin/stats/revenue, orders, subscriptions
POST /api/admin/delivery/route      # 배송 코스표 (추후)
```

---

## 보안

- **인증**: JWT (웹: httpOnly 쿠키, 모바일: Bearer Token)
- **빌링키**: AES-256-GCM 암호화 저장, 서버 사이드에서만 복호화
- **API**: Rate limiting, CORS 화이트리스트, 토스 웹훅 시그니처 검증
- **Admin**: role 기반 미들웨어 보호
- **장바구니**: 비로그인 localStorage, 로그인 DB (모바일 앱 대비)

---

## 개발 로드맵

### Phase 1: MVP (6~8주)
- 모노레포 셋업 (Turborepo + Next.js + Prisma)
- 기존 HTML → Next.js 마케팅 페이지 이전
- 회원가입/로그인 (NextAuth.js + 카카오/네이버)
- 상품 목록/상세, 장바구니
- 토스페이먼츠 일반결제 연동
- 마이페이지, 관리자 기본 (상품CRUD, 주문관리)

### Phase 2: 구독 + 알림 (4~6주)
- 구독 플랜 UI + 토스 빌링키 발급
- BullMQ 워커 + 정기 자동결제
- 카카오 알림톡 연동

### Phase 3: 배송 + 어드민 고도화 (4주)
- 배송 상태 자동 전환 + 배송 추적 UI
- 매출/통계 대시보드
- 회원 관리

### Phase 4: 모바일 앱 + 확장 (추후)
- 고객 모바일 앱 (React Native / Expo)
- 기사용 앱 (배송 코스표, 확인서)
- 푸시 알림 (FCM)
- 쿠폰/프로모션, 리뷰 시스템

---

## 비용 (월간)

### 초기 (무료 티어)
거의 0원 (Vercel/Supabase/Railway 무료 티어)

### 성장기
- 인프라: 약 $70~80/월 (Vercel Pro + Supabase Pro + Railway + Redis)
- PG 수수료: 결제액의 3.3%
- 알림톡: 건당 8~15원
- 도메인: 연 2만원

---

## 기존 자산 (현재 프로젝트)

> 2026-06-04 디렉터리 평탄화 완료 — 이전엔 저장소 루트 아래 `w2o-salada/`로 한 단계 더 중첩돼
> 있었으나, 모노레포를 루트로 끌어올려 위 "프로젝트 구조"와 실제 트리가 일치한다.
> Vercel **Root Directory 설정은 비워야**(저장소 루트) 정상 빌드된다.

### 유지
- `salada-video/` — Remotion 히어로 영상 프로젝트 (차량 SVG, 로고 애니메이션)
- `apps/web/public/videos/hero.mp4` — 렌더링된 히어로 영상 ([HeroSection.tsx](apps/web/app/components/HeroSection.tsx)에서 `/videos/hero.mp4`로 참조)
- `CLAUDE.md` — 프로젝트 설계 문서

### Next.js 이전 완료 → `_legacy/`에 아카이브
옛 정적 랜딩은 Next.js 앱으로 이전을 마쳤고, 원본은 `_legacy/`로 옮겨 보존만 한다(빌드 비포함).
- `_legacy/index.html` → `apps/web/app/(marketing)/page.tsx`
- `_legacy/css/style.css` → Tailwind 디자인 토큰
- `_legacy/js/main.js`, `_legacy/js/animations.js` → React 컴포넌트 + Framer Motion

---

## ⚠️ DB 안전 규칙 (2026-09-27 운영 DB 초기화 사고 이후)

- 로컬 `.env` 2개(루트·apps/web)는 **모두 운영 Supabase DB**를 가리킨다. 개발용 DB가 따로 없다. `packages/db/.env`는 없으므로(2026-09-30 확인) `db:diff`·`db:deploy`·`db:status` 같은 워크스페이스 스크립트는 `DIRECT_URL` 을 못 찾는다 — 루트에서 `npx prisma migrate <명령> --schema packages/db/prisma/schema.prisma` 로 돌리면 루트 `.env` 가 로드된다.
- **절대 실행 금지**: `prisma migrate dev`, `prisma migrate reset`, `prisma db push --force-reset`, 그리고 `--shadow-database-url`에 운영 URL을 넣는 모든 명령. Prisma는 shadow DB로 지정된 DB를 **먼저 비운다**.
- 스키마 변경 절차: `npm run db:diff -w @repo/db`(읽기 전용)로 SQL 확인 → `packages/db/prisma/migrations/<timestamp>_<name>/migration.sql` 작성 → 사용자 확인 → `npm run db:deploy -w @repo/db`.
- 마이그레이션 이력은 `20260927000000_baseline` 하나로 시작한다(이전 4개는 `migrations_archive/`).
- 백업: GitHub Actions `DB backup`이 매일 03:00 KST pg_dump + JSON을 아티팩트(90일)로 남긴다. 수동은 `npm run db:backup -w @repo/db`. Supabase Free 플랜에는 백업이 없으므로 Pro 전환 전까지 이것이 유일한 백업이다.
- DB에 쓰는 명령을 돌리기 전에 그 명령이 대상 DB를 비우거나 덮어쓰는지 문서로 먼저 확인한다.

## 배송 권역 · 배송지 규칙 (2026-09-27)

- 배송 가능 판정 순서: **전역 배송 시/도**(Setting `deliveryAllowedSido`, 기본 `대구` — 2026-09-27 "우선 대구 전역") → 허용 동(`deliveryAllowedDongs`) → **물류센터 반경**(`deliveryRadiusKm`, 기본 10km). 전역 시/도는 다음 API의 `sido`로 판정하므로 좌표가 없어도 `IN_RANGE`. 관리자가 시/도를 비우면 반경 판정만 남는다
- 저장된 배송지의 `areaStatus`는 저장 당시 규칙 기준이다. 주문 시 `resolveAddress`가 현재 규칙으로 다시 검산하고, 일괄 반영은 `/admin/settings` 배송 권역의 "재판정" 버튼(`/api/admin/delivery-area` rejudge)
- 좌표는 카카오 로컬 API(`apps/web/app/lib/geo.ts`). 실패하면 `UNKNOWN` → 주문은 받되 `Order.deliveryHold`로 보류, 관리자 "배송지 확인" 큐에서 전화 후 처리. **LEGACY 모드에서는 결제를 막지 않는다** (아래 권역 테이블 참고)
- 주문 생성 4곳(단건·구독 신청·갱신 확정·자동결제)은 반드시 `addressId`를 채운다 (`lib/address-resolve.ts`)

### 배송 권역 테이블 (2026-09-30, `feature/delivery-zone`)

- 우편번호(`ZIP`, 정확 일치)·법정동 코드(`BCODE`, 접두 매칭: 5자리=구, 8자리=동, 10자리=리) 단위 `DeliveryZone` + 예외 규칙 `DeliveryZoneRule`(우편번호·단지명·사전 등록 단지, ALLOW/BLOCK) + 날짜별 중지 `DeliveryZoneSuspension` + 오픈 알림 대기 `DeliveryWaitlist`. 관리는 `/admin/delivery-zones`(권한 `orders`), 판정은 `lib/delivery-zone.ts`
- 판정 순서: **차단 규칙 → 허용 규칙 → 활성 권역 → 매칭 없음이면 모드에 따라** (Setting `deliveryZoneMode`) — `LEGACY`(기본): 위 시/도·동·반경 규칙으로 폴백, 권역 밖은 보류 접수 / `ZONES`: 권역 밖 = **결제 차단** + "우리 동네 오픈 알림 신청"(`POST /api/delivery/waitlist`). 차단 규칙은 모드와 무관하게 막는다
- **반경 폴백** (Setting `deliveryZoneRadiusFallback`="1", 2026-09-30 켬): ZONES 모드에서 권역에 없는 주소라도 센터 반경(`deliveryRadiusKm`, **15km**로 확장) 이내면 허용. 이때만 좌표를 조회한다(VWorld 우선). 시/도·허용 동 화이트리스트는 ZONES 모드에서 쓰지 않는다
- 배포 직후 동작이 바뀌지 않게 기본은 LEGACY. 초기 권역 CSV(`packages/db/prisma/seeds/delivery-zones.csv`, `npm run db:seed:zones -w @repo/db`)를 넣고 "기존 배송지 좌표 보정·재판정"으로 `Address.bcode/zoneId`를 채운 뒤 설정에서 ZONES 로 전환한다
- 서버 검증 6곳이 모두 `rejudgeAddress`(현재 규칙 재판정) → `checkOrderable`(차단·중지일)을 거친다: 단건 주문·구독 신청·자동결제 크론·갱신 예고 크론·다음 주기 확정·구독 배송지 변경. 화면은 `AreaCheckNotice`의 `canOrder=false` 또는 서버 400 `code: OUT_OF_AREA`를 받으면 결제 버튼 대신 `WaitlistForm`을 보여준다
- 권역이 꺼져 자동결제를 건너뛴 구독은 `Subscription.zoneBlockedAt`에 표시되고 "결제 보류 구독자" 탭에 모인다. 크론 선점이 `nextBillingDate`를 하루씩 미루므로 권역을 다시 켜면 다음날 아침 자동 청구된다. 고객에게는 알림이 나가지 않고, Setting `adminAlertPhone`이 있으면 관리자 SMS 1건
- 날짜별 중지는 새 주문을 그 날짜에 막고(`DATE_SUSPENDED`), 이미 결제된 단건은 보류 큐로, 구독분은 관리자 버튼으로 크레딧 적립(건너뛰기와 같은 정산). 자동결제 직전이면 중지일을 주기에서 빼고 청구한다
- `Address.bcode`는 다음 API `bcode`(신규) 또는 카카오 `b_code`(보정 배치)로 채운다. 기존 주소는 우편번호로만 매칭되다가 배치 후 법정동으로도 매칭된다
- **지오코딩 비용 최소화 (2026-09-30, 카카오맵 유료 전환)**: `enrichLocation`은 좌표 없이 먼저 판정하고(규칙·권역·시/도·허용 동), 센터 반경까지 가야 할 때만 좌표를 조회한다. 좌표 조회는 무료 VWorld → 카카오 순, 법정동 코드가 목적인 보정 배치만 카카오를 먼저 부른다(`geocodeAddress(q, "bcode")`). 권역 모드에서 신규 주소는 사실상 카카오 호출이 없다
- 절차·롤백·테스트 시나리오: [docs/DELIVERY_ZONE.md](docs/DELIVERY_ZONE.md) · 관리자 사용 설명서: [docs/DELIVERY_ZONE_GUIDE.md](docs/DELIVERY_ZONE_GUIDE.md) (초기 CSV는 대구 9개 구·군, 군위군만 비활성)
- 출입 방법·비밀번호·층수·갖다둘 곳·별칭은 **회원이 아니라 배송지(Address)** 에 둔다. 한 회원이 부모님 댁 등 여러 곳에 보낼 수 있다
- `buildingName`은 다음 API 원문 그대로 저장(단지 묶음 키). 주소 문자열에 합치지 않는다

## 구독 청구 주기 규칙 (2026-09-28)

- 청구는 달력 월이 아니라 **롤링 주기**: 첫 배송일부터 N주(2/4/6/8, `Subscription.cycleWeeks`). `SubscriptionPeriod.startDate/endDate`가 주기
- 결제일 = 주기 종료 **이틀 전** 07:30 (`renewal-charge`). 금액 = 그 주기의 실제 배송일 × 선택 상품가 − `creditBalance`. 7일 전 `renewal-notify`가 예정 금액을 고지한다 (변동 금액 정기결제라 고지 필수)
- `autoRenew=false`는 "이번 주기만": 일반결제 1회, 빌링키 없음, 갱신 크론 대상 아님
- 결제된 주기의 배송을 마감 전에 건너뛰면 환불 대신 크레딧 적립 → 다음 결제에서 차감
- 배송 관리·피킹은 `SUBSCRIPTION_DELIVERY` 배송 건(배송일별)을 보고, 월/주기 결제 주문(`SUBSCRIPTION`)은 돈의 기록일 뿐이다


## 구독 요일별 구성 (2026-09-28)

- 구독 슬롯 우선순위: **날짜별 예외(SubscriptionSelection) > 요일별(`Subscription.weekdaySlots`) > 기본(`Subscription.slots`)**. 요일별은 `{ "2": { "salad": 2 }, "4": { "salad": 1, "onigiri": 1 } }` 형태(key=0 일~6 토)
- 배송일에 적용할 슬롯은 항상 `lib/auto-assign.ts`의 `slotsForDate()`로 구한다. 갱신 결제·고지 크론, 다음 배송 미리보기가 모두 이 함수를 거친다
- 구독 화면의 요일 목록은 배송 캘린더에서 유도하므로 토요일 등 새 배송 요일이 생겨도 코드 수정 없이 요일 행이 추가된다
- 휴일 대체 배송일: 화·목이 아닌 날을 배송일로 켜면 관리자 캘린더에서 "화요일 대신 / 목요일 대신"을 지정한다(`DeliveryCalendar.substituteWeekday`). 요일별 구성은 실제 요일이 아니라 이 요일로 해석되고, 구독 화면 요일 행도 이 기준으로 모인다. 미지정이면 실제 요일 → 기본 구성

## 구독 정산·환불 규칙 (2026-09-28)

- **남은 배송분** = 결제된 주기의 선택분 중 아직 주문 마감(전날 14:00) 전인 날짜. 마감 지난 배송분은 조리에 들어간 것이라 정산 대상이 아니다 (`lib/subscription-settle.ts`)
- **일시정지** 는 고객이 방식을 고른다 (`Subscription.pauseMode`): `CREDIT` = 남은 배송분 금액을 `creditBalance` 로 적립해 다음 결제에서 차감 / `EXTEND` = 선택분을 두고, 재개 시 정지 중 놓친 횟수만큼 배송일을 주기 뒤로 옮기고 `SubscriptionPeriod.endDate`·`nextBillingDate` 를 그만큼 민다
- **취소 수수료는 10%** (`Setting.refundFeePercent`, 2026-09-29 30%에서 인하). 구독은 방문판매법상 '계속거래'라 해지로 인한 실손해를 현저히 초과하는 위약금을 물릴 수 없고(통상 잔여 대금의 10% 이내), 과하게 잡으면 약관규제법 제8조로 조항이 무효가 되어 한 푼도 못 받는다. 조리·재료 손실의 실제 방어선은 수수료가 아니라 **"마감 지난 배송분은 환불 대상 아님"** 쪽이다
- **해지** 는 자동 환불이 없다. 남은 배송분 + 크레딧을 `RefundRequest`(kind SUBSCRIPTION_CANCEL, 사유 필수) 로 접수하고 담당자가 `/admin/refunds` 에서 수수료(`feeAmount`)를 정해 승인하면 그 주기 결제 주문에 대해 토스 **부분 취소** (`partialRefundOrder`, Payment REFUNDED 행으로 기록). 거절 사유는 고객 화면에 보인다
- 관리자가 크레딧을 현금으로 돌려줄 때도 `RefundRequest`(CREDIT_PAYOUT) 를 만들어 같은 검토 흐름을 탄다. 거절하면 크레딧 복구
- 해지 사유(`RefundReason`)는 이탈 원인 통계에 쓴다 — 환불 신청 화면 상단 분포. 약관 5·6조가 이 규칙을 그대로 담고 있으니 규칙을 바꾸면 약관도 같이 바꾼다
