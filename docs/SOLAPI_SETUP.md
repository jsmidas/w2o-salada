# 솔라피(알림톡) 설정

발송 코드는 [notification.ts](../apps/web/app/lib/notification.ts) 한 곳에 모여 있다.
`SOLAPI_API_KEY` / `SOLAPI_API_SECRET` 둘 중 하나라도 비면 **Mock 모드**로 떨어져
콘솔에만 찍히고 실제로 나가지 않는다.

템플릿 ID가 없으면 알림톡 대신 **SMS/LMS로 폴백**한다. 나가긴 나가지만 건당 비용이
비싸고 브랜딩이 없으므로, 승인된 템플릿은 반드시 환경변수에 넣는다.

---

## 1. 채널 / 발신번호

| 항목 | 값 |
|---|---|
| PFID (카카오 채널) | `KA01PF260412080935928c1R5q3GXkku` |
| 발신번호 | 053-721-7794 (다함푸드) — 2026-09-28 변경 신청, 승인까지 1~3일 |

발신번호 승인이 떨어지면 Vercel의 `SOLAPI_SENDER_PHONE`을 바꾸고 재배포한다.
승인 전까지는 대체발송(SMS)이 개인 번호로 나간다.

---

## 2. 템플릿 ↔ 코드 변수 대조

**템플릿에 없는 변수를 코드가 더 보내는 것은 무해하다**(무시된다).
반대로 템플릿이 쓰는 변수를 코드가 안 보내면 **빈칸으로 나가거나 발송이 거절된다.**

| 코드 상수 | 템플릿 이름 | 템플릿 변수 | 코드가 보내는 값 | Template ID |
|---|---|---|---|---|
| `ORDER_PAID` | 주문 완료 알림 | 고객명·주문번호·배송일 | 같음 | `KA01TP260412170004772NetvjwlNAWI` |
| `DELIVERY_DONE` | 배송 도착 알림 (사진) | 고객명·링크 | 같음 | `KA01TP260928105217870jG6Wc4kmprh` |
| `SUB_PAID` | 구독 결제 완료 | 금액 | 같음 | `KA01TP260928084700920S9bqr4RElaF` |
| `SUB_RENEWED` | 구독 갱신 완료 | 고객명·금액 | +기간·배송횟수 | `KA01TP260928084145660d61jNQcPzsY` |
| `SUB_RENEWAL_NOTICE` | 구독 갱신 예고 | 고객명·금액·결제일·배송횟수·기간·차감 | 같음 | 검수 후 확인 |
| `SUB_RENEWAL_FAILED` | 구독 갱신 실패 | 고객명 | 같음 | 검수 후 확인 |
| `SUB_SELECT_MENU` | 메뉴 선택 요청 | 고객명·월 | 같음 | 검수 후 확인 |
| `PAYMENT_FAIL` | 결제 실패 알림 | 고객명 | 같음 | `KA01TP260412175953755DVv1oA37ff1` |

`PAYMENT_FAIL`(결제 실패)은 **구독 자동 갱신이 7일 내 3회 실패해
구독이 일시정지된 회차에만** 나간다. 1·2회차 실패는 `SUB_RENEWAL_FAILED`(구독 갱신 실패)가
맡는다. 단건 결제 실패는 고객이 결제창 앞에 있어 화면에 바로 뜨므로 보내지 않는다.

> 문구가 "결제에 실패했습니다. 카드 정보를 확인해주세요"라 **구독이 멈췄다는
> 사실이 빠져 있다.** 정지 안내 전용 템플릿을 따로 만들면 더 정확하다.

`DELIVERY_START`(배송 출발)는 **쓰지 않는다.** 새벽 3시에 울리는 알림은 고객에게
득이 없다고 판단해 발송 자체를 없앴다. 지난 발송 기록이 남아 있어 관리자 화면의
라벨만 남겨 두었다.

### `#{링크}` 는 무엇인가

배송 도착 템플릿의 버튼은 `https://www.w2o.co.kr/delivery/#{링크}` 를 연다.
`링크`에는 배송 건마다 발급되는 난수 토큰(`Delivery.publicToken`)이 들어간다.
주문번호(`W2O-YYYYMMDD-0001`)를 그대로 주소에 쓰면 숫자만 바꿔 남의 배송 사진을
들여다볼 수 있어서 따로 둔다.

---

## 3. Vercel 환경변수

```
SOLAPI_API_KEY
SOLAPI_API_SECRET
SOLAPI_PFID                       = KA01PF260412080935928c1R5q3GXkku
SOLAPI_SENDER_PHONE               = 0537217794   (승인 후)

SOLAPI_TEMPLATE_ORDER_PAID        = KA01TP260412170004772NetvjwlNAWI
SOLAPI_TEMPLATE_DELIVERY_DONE     = KA01TP260928105217870jG6Wc4kmprh
SOLAPI_TEMPLATE_SUB_PAID          = KA01TP260928084700920S9bqr4RElaF
SOLAPI_TEMPLATE_SUB_RENEWED       = KA01TP260928084145660d61jNQcPzsY
SOLAPI_TEMPLATE_SUB_RENEWAL_NOTICE=
SOLAPI_TEMPLATE_SUB_RENEWAL_FAILED=
SOLAPI_TEMPLATE_SUB_SELECT_MENU   =
SOLAPI_TEMPLATE_PAYMENT_FAIL      = KA01TP260412175953755DVv1oA37ff1
```

넣은 뒤 **재배포해야** 반영된다. 빈 항목은 비워 둬도 되고, 그 템플릿만 SMS로 나간다.

---

## 4. 발송 시각

| 알림 | 시각 (KST) | 크론 |
|---|---|---|
| 주문 완료 / 구독 결제 | 결제 즉시 | — |
| 배송 도착(사진) | **07:30** | `/api/cron/morning` |
| 구독 갱신 결제·완료 | 07:30 | `/api/cron/morning` |
| 구독 갱신 예고 | 09:00 | `/api/cron/notices` |
| 메뉴 선택 요청 | 09:00 | `/api/cron/notices` |

Vercel Hobby 는 프로젝트당 크론이 **2개**까지라, 작업마다 크론을 걸면 상한을 넘는
것이 조용히 등록되지 않는다. 그래서 시각이 비슷한 작업을 `morning`·`notices`
두 묶음으로 돌린다. 개별 엔드포인트(`/api/cron/renewal-charge` 등)는 그대로
살아 있어 하나만 손으로 돌릴 수도 있다.

도착 알림은 배송 직후가 아니라 아침에 모아서 보낸다. 07:30 이 지난 뒤에 완료 처리된
건(지연·재배송)은 크론을 기다리면 하루가 밀리므로 그 자리에서 바로 나간다.
중복은 `Delivery.arrivedNotifiedAt` 으로 막고, 발송에 실패하면 표시를 되돌려
다음 크론이 다시 집는다.

---

## 5. 발송 실패 확인

관리자 → 알림 발송 내역(`/admin/notifications`)에서 SENT / FAILED 를 본다.

솔라피는 **접수 실패도 HTTP 200 으로 답한다.** 응답 본문의 `statusCode` 가 `2***`
가 아니면 나가지 않은 것이라, 그 판정을 코드에 넣어 두었다
(예전에는 실패도 전부 SENT 로 기록됐다).
