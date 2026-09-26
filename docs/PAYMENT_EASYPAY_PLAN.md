# 간편결제(삼성페이·애플페이·네이버페이·카카오페이·토스페이) 적용 계획

> 작성: 2026-09-27. 사무실에서 이어서 작업하기 위한 메모.
> 결론부터: **코드보다 토스 상점관리자 계약이 먼저다.** 계약이 끝나면 단건 결제는 코드 수정 없이 간편결제가 뜬다.

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

- [ ] 상점관리자에서 삼성페이 · 애플페이 · 토스페이 · 카카오페이 · 네이버페이 신청
- [ ] 네이버페이 · 토스페이 **자동결제** 심사 신청
- [ ] 승인 알림 수신 → 운영 키로 단건 결제창에 버튼 뜨는지 확인
- [ ] (선택) 결제수단 선택 UI + `flowMode: "DIRECT"` 바로 결제
- [ ] (심사 후) 구독 카드 등록에 네이버페이 · 토스페이 추가
- [ ] 고객 안내 문구: 애플페이는 아이폰·맥 Safari에서만

---

## 참고
- [결제수단 정책](https://docs.tosspayments.com/guides/v2/get-started/payment-methods)
- [자동결제(빌링) 이해하기](https://docs.tosspayments.com/guides/v2/billing)
- [카드/간편결제 통합결제창 연동하기](https://docs.tosspayments.com/guides/v2/payment-window/integration)
- [간편결제 용어](https://docs.tosspayments.com/resources/glossary/easypay)
- [SDK v2 레퍼런스](https://docs.tosspayments.com/sdk/v2/js)
