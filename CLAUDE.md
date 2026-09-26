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
| 알림톡 | NHN Cloud (카카오 알림톡) |
| SMS | NHN Cloud SMS |
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
2. **자동결제**: 매일 AM 9:00 워커가 당일 결제 대상 → billingKey로 결제
3. **실패 처리**: 4시간 간격 3회 재시도 → 실패 알림 → 3회 실패 시 구독 일시정지
4. **카드 변경**: 새 빌링키 발급 → 기존 빌링키 폐기

---

## 배송 사이클

```
D-2       재료 발주 (예측 수량 — 구독 확정분 + 단건 예측분)
          └ 오차는 회사가 감당. D-3과 단가 차이가 작아 앞당기지 않는다

D-1  AM 9:00   정기구독 자동결제
     ...       일반주문 수시 접수
     PM 2:00   주문 마감 (컷오프) · 구독 메뉴 변경 마감
     PM 2:30   배송 리스트 확정 (PAID → PREPARING)
     오후       조리 · 포장 → 냉장 보관 (PREPARING → SHIPPING)

D    AM 3:00   배송 출발 → '배송 출발' 알림톡
     AM 6:00   도착 (SHIPPING → DELIVERED) → '배송 완료' 알림톡
```

---

## 알림 시점

| 시점 | 채널 | 내용 |
|------|------|------|
| 결제 완료 | 알림톡 | "주문이 완료되었습니다. 내일 새벽 도착 예정" |
| 배송 출발 | 알림톡 | "새벽배송이 출발했습니다" |
| 배송 완료 | 알림톡 | "문 앞에 도착했습니다" |
| 구독 결제 | 알림톡 | "정기구독 결제가 완료되었습니다" |
| 결제 실패 | 알림톡+SMS | "결제에 실패했습니다. 카드를 확인해주세요" |
| 구독 갱신 D-3 | 알림톡 | "3일 후 구독이 갱신됩니다" |

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

- 로컬 `.env` 3개(루트·apps/web·packages/db)는 **모두 운영 Supabase DB**를 가리킨다. 개발용 DB가 따로 없다.
- **절대 실행 금지**: `prisma migrate dev`, `prisma migrate reset`, `prisma db push --force-reset`, 그리고 `--shadow-database-url`에 운영 URL을 넣는 모든 명령. Prisma는 shadow DB로 지정된 DB를 **먼저 비운다**.
- 스키마 변경 절차: `npm run db:diff -w @repo/db`(읽기 전용)로 SQL 확인 → `packages/db/prisma/migrations/<timestamp>_<name>/migration.sql` 작성 → 사용자 확인 → `npm run db:deploy -w @repo/db`.
- 마이그레이션 이력은 `20260927000000_baseline` 하나로 시작한다(이전 4개는 `migrations_archive/`).
- 백업: GitHub Actions `DB backup`이 매일 03:00 KST pg_dump + JSON을 아티팩트(90일)로 남긴다. 수동은 `npm run db:backup -w @repo/db`. Supabase Free 플랜에는 백업이 없으므로 Pro 전환 전까지 이것이 유일한 백업이다.
- DB에 쓰는 명령을 돌리기 전에 그 명령이 대상 DB를 비우거나 덮어쓰는지 문서로 먼저 확인한다.

## 배송 권역 · 배송지 규칙 (2026-09-27)

- 배송 가능 판정은 **물류센터 반경**(Setting `deliveryRadiusKm`, 기본 10km — "10km 안이면 어디든" 현장 판단) 기준. 행정구역 화이트리스트(`deliveryAllowedDongs`)는 예외 열기용 보조 수단
- 좌표는 카카오 로컬 API(`apps/web/app/lib/geo.ts`). 실패하면 `UNKNOWN` → 주문은 받되 `Order.deliveryHold`로 보류, 관리자 "배송지 확인" 큐에서 전화 후 처리. **결제를 막지 않는다**
- 주문 생성 4곳(단건·구독 신청·갱신 확정·자동결제)은 반드시 `addressId`를 채운다 (`lib/address-resolve.ts`)
- 출입 방법·비밀번호·층수·갖다둘 곳·별칭은 **회원이 아니라 배송지(Address)** 에 둔다. 한 회원이 부모님 댁 등 여러 곳에 보낼 수 있다
- `buildingName`은 다음 API 원문 그대로 저장(단지 묶음 키). 주소 문자열에 합치지 않는다
