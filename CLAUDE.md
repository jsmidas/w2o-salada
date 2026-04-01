# W2O SALADA - 샐러드 새벽배송 풀스택 서비스

## 프로젝트 개요
- **브랜드명**: W2O SALADA
- **슬로건**: "일어나면 이미 준비된 하루" / "Wake 2 go Out"
- **서비스**: 샐러드 새벽배송 + 정기구독
- **모회사**: 다함푸드 (https://dahamfood.co.kr/)
- **방향**: 자체 개발 + 토스페이먼츠 PG 연동 (카페24 스킨 X)

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
Category        → 카테고리 (샐러드/그레인볼/프로틴)
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
AM 9:00   정기구독 자동결제
...       일반주문 수시 접수
PM 11:00  당일 주문 마감 (컷오프)
PM 11:30  배송 리스트 확정 (PAID → PREPARING)
AM 12:00  조리/포장 시작
AM 2:00   포장 완료 (PREPARING → SHIPPING)
AM 3:00   배송 출발 → '배송 출발' 알림톡
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

### 유지
- `salada-video/` — Remotion 히어로 영상 프로젝트 (차량 SVG, 로고 애니메이션)
- `videos/hero.mp4` — 렌더링된 히어로 영상
- `CLAUDE.md` — 프로젝트 설계 문서

### Next.js 이전 대상
- `index.html` → `apps/web/app/(marketing)/page.tsx`
- `css/style.css` → Tailwind 설정으로 디자인 토큰 이전
- `js/main.js` → React 컴포넌트로 전환
- `js/animations.js` → Framer Motion으로 전환
