# 간편결제(삼성페이·애플페이·네이버페이·카카오페이·토스페이) 적용 계획

> 작성: 2026-09-27. 사무실에서 이어서 작업하기 위한 메모.
> 결론부터: **코드보다 토스 상점관리자 계약이 먼저다.** 계약이 끝나면 단건 결제는 코드 수정 없이 간편결제가 뜬다.

---

## 0. 월요일(2026-09-28) 할 일 — 토스 상담 (주말엔 상담원 없음)

상점관리자(토스 비즈니스 → PG → 주식회사 다함푸드) 우측 하단 **채팅 상담**으로 아래 순서대로.

1. **심사중 3건 상태 문의** — "상점아이디 `w2owfey7l6` (및 `w2oweruv3x`, `w2o9razj36`) 간편결제 심사가 4월 신청 후 아직 심사중인데, 어느 간편결제사에서 어떤 보완이 필요한지 알려달라"
   - 사이트 하단 사업자 표기(회사명·대표자·사업자번호·통신판매업신고)는 **9/27에 채워 넣었으니 재심사 요청** 가능
   - 보완 요청 메일이 신청 당시 담당자 이메일로 갔을 수 있음 → 그 메일함도 확인
2. **중복 신청 정리** — 3건 중 가장 넓은 `w2owfey7l6`(SSG·페이코·L.pay·카카오·삼성·토스·애플) 하나만 진행하고 나머지 둘은 취소 요청. 안 해도 해는 없지만 정산·키 관리가 헷갈린다
3. **네이버페이 신청** — "서비스 추가 신청" 버튼 → 네이버페이. 신청은 토스에서, 심사는 네이버페이가 하며 **약 15일**. 같은 화면에 **네이버페이 자동결제** 항목이 있으면 함께 체크, 없으면 상담에 "구독 갱신용 네이버페이 자동결제도 필요"라고 요청
4. 승인 알림이 오면 `w2owfey7l6`의 **라이브 클라이언트 키·시크릿 키**를 개발자센터에서 복사해 두기 → 아래 4-0 코드 작업

### 2026-09-27 확인한 현황

| 상점아이디(MID) | 상태 | 결제방식 | 간편결제 |
|---|---|---|---|
| `bill_w2oqm3rup` | 계약완료 (2026-04-16) | **빌링(자동결제)** | 없음 (빌링 MID엔 못 붙임) |
| `dahamfood` | 계약완료 | 일반 | 미확인 |
| `w2obaqytxo` | 계약완료 | 일반 | 미확인 |
| `w2o9razj36` | 심사중 | 일반 + 결제위젯 Basic | 페이코, 토스페이 |
| `w2oweruv3x` | 심사중 | 일반 | 카카오페이, 삼성페이, 토스페이, 애플페이 |
| `w2owfey7l6` | 심사중 | 일반 | SSG페이, 페이코, L.pay, 카카오페이, 삼성페이, 토스페이, 애플페이 |

- 심사중 3건 모두 카드사 심사는 승인 완료, 계약일만 비어 있음 → 토스/간편결제사 최종 처리 대기
- **네이버페이는 어디에도 없음** → 별도 신청 필요
- 9월 매출 0원. 운영 사이트가 어느 MID 키를 쓰는지 미확인 — Vercel 환경변수 `NEXT_PUBLIC_TOSS_CLIENT_KEY`를 개발자센터의 각 MID 라이브 키와 대조할 것. 로컬 `.env`는 테스트 키(`test_ck_`)라 판단 불가
- **심사가 4개월 멈춘 원인(추정)**: 9/27 DB 초기화 이후 사이트 하단에 회사명·대표자·사업자번호가 비어 있었음. 간편결제사는 사이트 표기와 신청서를 대조한다 → 9/27 저녁에 아래 값 재입력 완료 (운영 반영 확인)
  - 회사명 주식회사 다함푸드 / 대표 손정수 / 사업자등록번호 452-87-02160 / 통신판매업신고 2021-경북경산-0076 / 이메일 dahamfood@dahamfood.co.kr
  - 값은 `/admin/settings` 쇼핑몰 기본 설정에서 관리 (통신판매업 신고번호 칸은 커밋 `da1fd95`에서 추가)

---

## 1. 현재 코드 상태

| 흐름 | 파일 | 호출 | 결제수단 |
|---|---|---|---|
| 단건 결제 (장바구니) | `apps/web/app/checkout/page.tsx` | `payment.requestPayment({ method: "CARD" })` | 카드 결제창 |
| 구독 "이번 주기만" · 맛보기 | `apps/web/app/subscribe/page.tsx` | `payment.requestPayment({ method: "CARD" })` | 카드 결제창 |
| 구독 자동 갱신 (첫 결제) | `apps/web/app/subscribe/page.tsx` | `payment.requestBillingAuth({ method: "CARD" })` | 카드 빌링키 |
| 구독 카드 변경 | `apps/web/app/subscribe/next/page.tsx` | `payment.requestBillingAuth({ method: "CARD" })` | 카드 빌링키 |
| 결제 승인 (서버) | `apps/web/app/api/payments/route.ts` | `POST /v1/payments/confirm` | — |
| 빌링키 발급 (서버) | `apps/web/app/api/subscribe/billing/route.ts` | `POST /v1/billing/authorizations/issue` | — |
| 자동결제 크론 | `apps/web/app/api/cron/renewal-charge/route.ts` | `POST /v1/billing/{billingKey}` | — |

- SDK: `@tosspayments/tosspayments-sdk` v2 (결제창 방식, 결제위젯 아님)
- 환경변수: `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`
- **지금 카드만 보이는 이유**: 토스 카드 결제창은 상점관리자에서 **계약된 간편결제만** 버튼으로 보여준다. 코드가 막고 있는 게 아니다.

---

## 2. 사장님이 할 일 — 토스 상점관리자

1. 상점관리자 → 결제수단 관리 → 간편결제 신청
   - 신청 가능: 토스페이 · 카카오페이 · 네이버페이 · 삼성페이 · 페이코 · SSG페이 · L.Pay · 애플페이
2. 난이도 순서
   - **삼성페이 · 애플페이**: 카드 결제의 한 형태. 비교적 빨리 열린다
   - **토스페이**: 별도 신청
   - **네이버페이 · 카카오페이**: 각 사 가맹 심사가 따로 있어 며칠~몇 주
3. 승인되면 기존 카드 결제창에 자동으로 나타난다 → **단건 결제는 코드 수정 없음**

### 기기·브라우저 제한 (고객 안내용)
- 삼성페이: 지원 갤럭시 기기, 브라우저 무관
- 애플페이: iPhone 앱·브라우저, Mac Safari에서만

---

## 3. 구독 자동결제의 제약 (중요)

- 토스 자동결제(빌링)는 **카드 · 계좌이체**만 기본 지원
- **삼성페이 · 애플페이 · 카카오페이는 자동결제 불가**
- **네이버페이 · 토스페이 자동결제**는 가능하지만 **별도 심사** 필요 → 간편결제 신청할 때 같이 신청해 둘 것
- 정리
  - 자동 갱신 구독(`autoRenew=true`): 당분간 **카드만**. 네이버페이·토스페이 자동결제 심사 통과 후 추가
  - "이번 주기만"(`autoRenew=false`) · 맛보기 · 단건: 일반결제라 **계약된 간편결제 전부 사용 가능**

---

## 4. 계약 후 코드 작업 (순서대로)

### 4-0. 키 분리 (승인 후 가장 먼저)
간편결제는 `w2owfey7l6`(일반결제 MID)에 붙고, 자동결제는 `bill_w2oqm3rup`에 그대로 남는다. MID마다 키가 다르므로 **용도별 키 두 벌**이 필요하다. 지금 코드는 `NEXT_PUBLIC_TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` 한 벌로 모두 호출한다.

| 용도 | 호출 | 파일 | 써야 할 키 |
|---|---|---|---|
| 단건·맛보기·이번 주기만 결제창 | `requestPayment` | `checkout/page.tsx`, `subscribe/page.tsx` | 일반결제 MID 클라이언트 키 |
| 결제 승인 | `POST /v1/payments/confirm` | `api/payments/route.ts` | 일반결제 MID 시크릿 키 |
| 카드 등록(빌링키 발급 창) | `requestBillingAuth` | `subscribe/page.tsx`, `subscribe/next/page.tsx` | `bill_` MID 클라이언트 키 |
| 빌링키 발급·자동결제 | `/v1/billing/authorizations/issue`, `/v1/billing/{key}` | `api/subscribe/billing/route.ts`, `api/cron/renewal-charge/route.ts` | `bill_` MID 시크릿 키 |
| 웹훅 검증·취소 | `api/webhooks/toss`, 취소 API | 결제가 어느 MID에서 났는지에 따라 | Payment에 MID 구분 저장 필요 |

- 제안: 환경변수 `NEXT_PUBLIC_TOSS_BILLING_CLIENT_KEY`, `TOSS_BILLING_SECRET_KEY` 추가. **비어 있으면 기존 키로 폴백**해서 승인 전에 배포해도 안전하게
- `Payment` 테이블에 어느 키(일반/빌링)로 결제됐는지 표시 컬럼 하나 추가 → 취소·환불 시 맞는 시크릿 키 선택
- 현재 운영 키가 어느 MID인지에 따라 "일반 키만 새로 넣기" 또는 "둘 다 넣기"가 갈린다 → 위 현황의 키 대조 먼저

### 4-1. 확인만 (코드 수정 없음)
- 운영에서 단건 결제창을 열어 간편결제 버튼이 뜨는지 확인
- 토스 테스트 키에서는 계약 상태와 무관하게 보일 수 있으니 **운영 키로** 확인

### 4-2. "삼성페이로 바로 결제" 버튼 (선택)
카드 결제창을 한 번 거치지 않고 특정 간편결제로 바로 여는 방식.
```ts
await payment.requestPayment({
  method: "CARD",
  amount: { value, currency: "KRW" },
  orderId, orderName, customerName, successUrl, failUrl,
  card: {
    flowMode: "DIRECT",
    easyPay: "SAMSUNGPAY", // TOSSPAY | NAVERPAY | KAKAOPAY | SAMSUNGPAY | APPLEPAY | PAYCO | SSG | LPAY
  },
});
```
- 대상: `checkout/page.tsx`, `subscribe/page.tsx`의 일반결제 분기
- 결제수단 선택 UI(카드 / 삼성페이 / 애플페이 / 네이버페이 …)를 두고 선택값을 `easyPay`로 넘긴다
- 애플페이 버튼은 iOS Safari·Mac Safari에서만 노출
- `easyPay` 값과 `flowMode` 옵션명은 [SDK 레퍼런스](https://docs.tosspayments.com/sdk/v2/js)에서 최종 확인할 것

### 4-3. 네이버페이·토스페이 자동결제 (심사 통과 후)
- `requestBillingAuth`의 `method` 옵션과 빌링키 발급 API의 간편결제 파라미터를 [자동결제 결제창 연동](https://docs.tosspayments.com/guides/v2/billing/integration)에서 확인
- 구독 카드 등록 화면(`subscribe/page.tsx`, `subscribe/next/page.tsx`)에 "카드 / 네이버페이 / 토스페이" 선택 추가
- `Subscription.cardCompany/cardNumber` 표시 로직이 간편결제일 때 어떻게 나오는지 확인 (빌링키 응답 필드가 다를 수 있음)
- 갱신 크론 `renewal-charge`는 빌링키로 결제하므로 그대로 동작할 가능성이 높지만, 실패 코드가 카드와 다를 수 있으니 재시도 분기 점검

### 4-4. 결제위젯 전환 (선택, 규모 큼)
- 결제수단 노출·순서를 관리자 화면에서 켜고 끄고 싶으면 결제창 → 결제위젯으로 전환
- 지금 구조(결제창 + 서버 confirm)로도 간편결제는 충분히 되므로 당장은 불필요

---

## 5. 체크리스트

- [x] 사이트 하단 사업자 표기(회사명·대표·사업자번호·통신판매업신고·이메일) — 2026-09-27 완료
- [x] 삼성페이 · 애플페이 · 토스페이 · 카카오페이 신청 — 4월에 `w2owfey7l6`로 이미 신청됨, 심사중
- [ ] (월요일) 토스 채팅 상담: 심사중 3건 상태·보완 사항 문의, 재심사 요청
- [ ] (월요일) 중복 MID 2건 취소 요청 (선택)
- [ ] (월요일) 네이버페이 신청 + 네이버페이 자동결제 요청
- [ ] Vercel `NEXT_PUBLIC_TOSS_CLIENT_KEY`가 어느 MID 키인지 대조
- [ ] 승인 알림 수신 → `w2owfey7l6` 라이브 키 확보 → **4-0 키 분리** 코드 작업
- [ ] 운영 키로 단건 결제창에 간편결제 버튼 뜨는지 확인
- [ ] (선택) 결제수단 선택 UI + `flowMode: "DIRECT"` 바로 결제
- [ ] (네이버페이 자동결제 심사 후) 구독 카드 등록에 네이버페이 추가
- [ ] 고객 안내 문구: 애플페이는 아이폰·맥 Safari에서만

---

## 참고
- [결제수단 정책](https://docs.tosspayments.com/guides/v2/get-started/payment-methods)
- [자동결제(빌링) 이해하기](https://docs.tosspayments.com/guides/v2/billing)
- [카드/간편결제 통합결제창 연동하기](https://docs.tosspayments.com/guides/v2/payment-window/integration)
- [간편결제 용어](https://docs.tosspayments.com/resources/glossary/easypay)
- [SDK v2 레퍼런스](https://docs.tosspayments.com/sdk/v2/js)
