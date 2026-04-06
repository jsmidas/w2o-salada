# W2O SALADA 구독 시스템 설계

> 2026-04-06 작성. 월별 캘린더 기반 배송일 관리 + 자유 수량 조합 + 위임형 구독 + 자동 재결제

---

## 핵심 개념

### 배송일 관리
- 관리자가 **월별 달력에서 배송일을 직접 지정** (기존 화/목 고정 제거)
- 공휴일 제외, 대체 배송일 설정 가능
- 각 배송일마다 **제공 가능한 메뉴 목록** 등록 (샐러드 N종 + 간편식 N종)

### 고객 수량 자유 선택
- 고객이 **배송당 수량을 선택** (2개, 3개, 4개...)
- 선택한 수량 안에서 **샐러드/간편식 자유 조합**
- 금액 = 선택한 상품 가격 합산 × 배송 횟수

### 구독 유형
| 유형 | 설명 |
|---|---|
| **직접 골라먹기 (MANUAL)** | 달력에서 날짜별 메뉴 직접 선택 |
| **잘 챙겨서 보내줘 (AUTO)** | 수량만 선택, 회사가 우선순위대로 배정 |
| **맛보기 (TRIAL)** | 1회 체험, 일반결제 |

### 자동 재결제
- 토스 빌링키로 월말 자동결제
- 종료 7일 전 사전 알림 → 해지/변경 기회 → 자동결제 → 다음 달 시작

---

## DB 모델

### 새로 추가

```prisma
// 관리자 지정 배송일
model DeliveryCalendar {
  id        String   @id @default(cuid())
  date      DateTime @unique  // 2026-05-06
  isActive  Boolean  @default(true)
  memo      String?  // "어린이날 배송 제외" 등
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  menuAssignments MenuAssignment[]
  @@map("delivery_calendar")
}

// 날짜별 제공 메뉴 (관리자 배정)
model MenuAssignment {
  id                 String           @id @default(cuid())
  deliveryCalendarId String
  deliveryCalendar   DeliveryCalendar @relation(...)
  productId          String
  product            Product          @relation(...)
  sortOrder          Int @default(0)  // 우선순위 (AUTO 모드 배정 순서)
  createdAt          DateTime @default(now())
  @@unique([deliveryCalendarId, productId])
  @@map("menu_assignments")
}

// 월별 구독 사이클
model SubscriptionPeriod {
  id             String       @id @default(cuid())
  subscriptionId String
  subscription   Subscription @relation(...)
  year           Int
  month          Int
  status         PeriodStatus @default(PENDING)
  totalAmount    Int
  orderId        String?
  paidAt         DateTime?
  createdAt      DateTime @default(now())
  selections     SubscriptionSelection[]
  @@unique([subscriptionId, year, month])
  @@map("subscription_periods")
}

// 고객 날짜별 메뉴 선택
model SubscriptionSelection {
  id                   String             @id @default(cuid())
  subscriptionPeriodId String
  subscriptionPeriod   SubscriptionPeriod @relation(...)
  deliveryDate         DateTime
  productId            String
  product              Product            @relation(...)
  quantity             Int @default(1)
  @@map("subscription_selections")
}
```

### Subscription 수정
```
- selectionMode: MANUAL | AUTO  (신규)
- itemsPerDelivery: Int          (신규 - 배송당 수량)
- renewalNotifiedAt: DateTime?   (신규 - 갱신 알림 발송일)
- planType: 제거 (또는 optional)
- frequency: 제거 (MONTHLY 고정)
```

### Deprecate 대상
- `MenuSchedule` → `DeliveryCalendar` + `MenuAssignment`
- `SubscriptionItem` → `SubscriptionSelection`
- `Setting`의 `subscribe.deliveryDays`, `subscribe.weeksPerMonth`

---

## 고객 플로우

```
Step 1: 구독 유형 선택
  - 직접 골라먹기 / 잘 챙겨서 보내줘 / 맛보기

Step 2: 배송당 수량 선택
  - 2개 / 3개 / 4개... (관리자 설정: 최소~최대)

Step 3-A (MANUAL): 달력에서 날짜별 메뉴 선택
  - 배송일만 활성, 등록된 메뉴 중 수량만큼 자유 조합
Step 3-B (AUTO): 스킵
  - 배송 달력 미리보기만 표시, 바로 결제

Step 4: 주문 요약 + 결제
  - MANUAL: 선택 메뉴 합산
  - AUTO: MenuAssignment 우선순위 상위 N개 × 단가 합산
  - 맛보기: 일반결제 / 구독: 빌링키 발급 + 첫 결제
```

---

## 자동 재결제 플로우

```
배송 종료 7일 전 → [Cron] 갱신 사전 알림 발송
  "1주일 후 자동 갱신됩니다. 변경/해지 가능"

배송 마지막 날 → [Cron] 빌링키 자동결제
  성공 → 다음 달 SubscriptionPeriod 생성
       → AUTO: 메뉴 자동 배정
       → MANUAL: "메뉴를 선택해주세요" 알림
  실패 → 1일 간격 3회 재시도 → 3회 실패 시 일시정지
```

---

## API 목록

### 관리자
- `GET/POST /api/admin/delivery-calendar` — 배송일 조회/저장
- `GET/POST /api/admin/menu-assignment` — 식단 배정
- `GET /api/admin/subscriptions/renewals` — 갱신 예정 목록

### 고객
- `GET /api/delivery-calendar` — 배송일+메뉴 조회 (공개)
- `POST /api/subscribe` — 구독 생성 (selectionMode + itemsPerDelivery)
- `PUT /api/subscriptions/[id]/selections` — 메뉴 변경
- `PUT /api/subscriptions/[id]/mode` — MANUAL↔AUTO 전환

### Cron
- `POST /api/cron/renewal-notify` — 갱신 7일 전 알림 (매일 09:00)
- `POST /api/cron/renewal-charge` — 자동결제 (매일 06:00)

---

## 구현 단계

| Phase | 내용 | 기간 |
|---|---|---|
| 1 | DB 마이그레이션 + 관리자 캘린더 + 식단 배정 | 1주 |
| 2 | 고객 구독 플로우 리뉴얼 (캘린더 UI + AUTO + 수량 선택) | 1주 |
| 3 | 자동 재결제 + 알림 (Cron + 빌링키) | 1주 |
| 4 | 마이페이지 확장 + 관리자 구독관리 + 정리/테스트 | 1주 |
