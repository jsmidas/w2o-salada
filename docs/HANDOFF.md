# W2O SALADA 작업 인수인계

> 세션 간/PC 간 이어서 작업하기 위한 진행 상태 기록.
> 최신 상태가 상단에 오도록 유지.

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
