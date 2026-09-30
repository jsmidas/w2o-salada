# 배송 가능 지역 관리 (2026-09-30)

우편번호·법정동 코드 단위 권역 테이블로 배송 가능 여부를 판정하고, 권역 밖 고객은 결제 대신
"우리 동네 오픈 알림"을 신청한다. 브랜치 `feature/delivery-zone`.

## 1. 구성

| 구분 | 위치 |
|---|---|
| 스키마 | `DeliveryZone` / `DeliveryZoneRule` / `DeliveryZoneSuspension` / `DeliveryWaitlist`, `Address.bcode·zoneId·areaReason`, `Subscription.zoneBlockedAt·zoneBlockedReason` |
| 마이그레이션 | `packages/db/prisma/migrations/20260930100000_delivery_zones/` (`migration.sql` + `rollback.sql`) |
| 판정 | `apps/web/app/lib/delivery-zone.ts` (`judgeZone`, `checkOrderable`, `suspendedDates`), `lib/geo.ts` (`enrichLocation`, `rejudgeAddress`) |
| 서버 검증 | `/api/orders`, `/api/subscribe`, `/api/cron/renewal-charge`, `/api/cron/renewal-notify`, `/api/subscribe/next/confirm`, `/api/subscriptions/[id]`(배송지 변경), `lib/subscription-delivery.ts`(배송 건 생성) |
| 공개 API | `POST /api/delivery/check` (IP 분당 20회), `POST /api/delivery/waitlist` (IP 10분 5회 · 번호당 하루 3회) |
| 관리자 | `/admin/delivery-zones` (탭: 권역 목록 · 예외 규칙 · 날짜별 중지 · 대기 신청 · 결제 보류 구독자), `/api/admin/delivery-zones/*`, 설정 카드의 `deliveryZoneMode`·`adminAlertPhone` |
| 고객 화면 | `components/address/AreaCheckNotice`(주소 선택 즉시 판정 + 신청 폼), `AreaLookup`(메인·구독 페이지 확인창), `WaitlistForm` |
| 시드 | `packages/db/prisma/seeds/delivery-zones.csv` → `npm run db:seed:zones -w @repo/db` (`DRY_RUN=1` 로 미리보기) |

### 판정 순서

1. 예외 규칙 **BLOCK** (우편번호 / 단지명 / 사전 등록 단지) → 불가. 모드와 무관하게 결제를 막는다
2. 예외 규칙 **ALLOW** → 가능
3. 활성 권역 — `ZIP` 정확 일치 또는 `BCODE` 접두 매칭. 여러 개면 가장 긴 코드
4. 매칭 없음 → `deliveryZoneMode`
   - `LEGACY`(기본): 기존 규칙(시/도 전역 → 허용 동 → 센터 반경). 밖이면 결제는 받고 `deliveryHold` 보류
   - `ZONES`: 불가 → 결제 차단, 오픈 알림 신청으로 안내
5. 배송일이 있으면 그 날짜의 중지(전체 또는 해당 권역) 확인 → `DATE_SUSPENDED`

`Address.areaStatus`는 캐시일 뿐이다. 결제 경로는 항상 `rejudgeAddress`로 현재 규칙에 다시 맞춘다.

## 2. 적용 절차 (순서 중요)

1. **마이그레이션** — 추가 전용. `packages/db`에서:
   ```bash
   npm run db:deploy -w @repo/db
   ```
   새 컬럼은 전부 NULL 허용이라 기존 행에 영향이 없고 잠금도 짧다. 새 테이블 4개는 RLS 를 켠다.
2. **코드 배포** — 새 코드가 새 컬럼을 select 하므로 마이그레이션 뒤에 배포한다.
3. **권역 데이터 투입** — CSV 를 채운 뒤 `npm run db:seed:zones -w @repo/db` 또는 관리자 화면 CSV 업로드. 시드는 upsert 만 하고 어떤 행도 지우지 않는다.
4. **기존 배송지 보정** — 관리자 → 설정 → 배송 권역 → "기존 배송지 좌표 보정·재판정". `bcode` 가 없는 주소를 카카오 `b_code` 로 채우고 `zoneId` 를 맞춘다. 카카오맵이 꺼져 있으면 우편번호 매칭만 된다(VWorld 는 법정동 코드를 주지 않는다).
5. **검증** — 아직 LEGACY 모드. `/admin/delivery-zones` 권역 목록의 "배송지 수"가 기대대로 채워졌는지, 대표 주소 몇 개를 `/api/delivery/check` 로 찔러 `zoneName` 이 나오는지 본다.
6. **모드 전환** — 설정에서 `deliveryZoneMode = ZONES` 저장. 이때부터 권역 밖 결제가 막힌다.
7. **활성 구독 점검** — 결제 보류 구독자 탭 "활성 구독 전체 점검"으로 권역 밖 구독을 미리 표시하고, 필요하면 고객에게 연락한다.

## 3. 롤백

```
1. 이전 코드를 배포한다 (새 코드는 새 컬럼을 select 한다 — 컬럼을 먼저 지우면 주문·배송지 API 가 죽는다)
2. psql "$DIRECT_URL" -f packages/db/prisma/migrations/20260930100000_delivery_zones/rollback.sql
3. cd packages/db && npx prisma migrate resolve --rolled-back 20260930100000_delivery_zones
```

- 권역·예외·중지·대기 신청 데이터가 함께 사라진다. 대기 신청은 지우기 전에 관리자 화면에서 CSV 로 내려받는다.
- 코드만 되돌리고 스키마를 남겨도 동작한다 (컬럼은 NULL 허용, 테이블은 참조하지 않으면 무해). 급하면 이 방법이 더 안전하다.
- 모드만 되돌리려면 설정에서 `LEGACY` 로 바꾸면 된다 — 결제 차단이 즉시 풀리고 기존 보류 접수로 돌아간다. 차단 규칙은 계속 적용된다.

## 4. 시드 CSV 형식

관리자 CSV 업로드와 같은 형식. 헤더 필수, 열 순서 무관.

```
kind,code,name,sido,sigungu,isActive,memo
ZIP,42690,달서구 이곡동,대구,달서구,1,
BCODE,27290,달서구 전체,대구,달서구,1,구 전체
BCODE,2726010100,수성구 범어동,대구,수성구,0,등록만 하고 비활성
```

| 열 | 값 |
|---|---|
| `kind` | `ZIP`(우편번호) 또는 `BCODE`(법정동 코드). 한글 `우편번호`/`법정동` 도 인식 |
| `code` | ZIP 은 5자리. BCODE 는 5~10자리 접두 — 5=시군구 전체, 8=읍면동, 10=리 |
| `name` | 관리자·고객 안내에 쓰는 이름 |
| `sido`, `sigungu` | 검색·집계용 (선택) |
| `isActive` | `1/0`, `true/false`, `Y/N`. 비우면 1 |
| `memo` | 선택 |

법정동 코드는 행정안전부 법정동 코드표(10자리) 기준. 다음 우편번호 API 의 `bcode` 와 카카오 로컬 API 의 `b_code` 가 같은 체계다.

## 5. 테스트 시나리오

사전 준비: 마이그레이션 적용, 권역 CSV 투입(예: 달서구 `BCODE 27290` 활성, 수성구 범어동 `2726010100` 비활성), 재판정 배치, 모드 `ZONES`. 테스트 계정은 `tools/seed_test_scenario.cts` 의 test01~test10 을 써도 된다.

### A. 가능 지역
1. 메인 하단 "배송 가능 지역 확인"에 달서구 주소 입력 → 초록 "배송 가능 지역입니다. (달서구 전체)".
2. 체크아웃에서 같은 주소로 새 배송지 입력 → 같은 문구, 결제 버튼 활성 → 결제 성공.
3. DB: `Address.zoneId` 가 그 권역, `areaReason` 이 "권역: 달서구 전체 (법정동 27290)", `Order.deliveryHold=false`.
4. 구독 신청도 같은 주소로 결제 성공, `Subscription.addressId` 연결.

### B. 불가 지역
1. 경산시 주소 입력 → 앰버 "아직 배송하지 않는 지역입니다…" + 오픈 알림 신청 폼이 펼쳐지고 결제 버튼이 "배송 불가 지역"으로 비활성.
2. 폼에서 이름·번호·필수 동의 후 신청 → 접수 문구. 같은 번호·우편번호로 다시 신청하면 갱신(중복 행 없음).
3. 화면을 우회해 `POST /api/orders` 를 직접 호출 → 400 `code: "OUT_OF_AREA"`. `POST /api/subscribe` 도 동일.
4. 관리자 대기 신청 탭: 경산시 행에 집계, CSV 다운로드에 포함. 마케팅 동의 여부가 맞게 기록.
5. IP 에서 10분 안에 6번째 신청 → 429.

### C. 예외 규칙
1. 달서구 안 특정 단지를 BLOCK (단지명 또는 우편번호) → 그 주소는 불가("현재 배송이 어려운 주소입니다"), 옆 동 주소는 가능.
2. 모드를 LEGACY 로 돌려도 BLOCK 은 여전히 결제를 막는다.
3. 경산 우편번호를 ALLOW → 그 우편번호만 가능. 규칙 비활성화 → 다시 불가.

### D. 권역 비활성화된 기존 구독자
1. 달서구 주소로 활성 구독(빌링키 있음)을 만들고 `nextBillingDate` 를 어제로 당긴다 (테스트용 SQL).
2. 권역 목록에서 달서구 권역 끄기 → 확인 창에 "활성 구독 1건" → 끈 뒤 앰버 카드에 그 구독이 보인다.
3. `GET /api/cron/renewal-charge` (Authorization: Bearer CRON_SECRET) 수동 실행 → 응답 results 에 `status: "zone-blocked"`, 토스 청구 없음, `Subscription.zoneBlockedAt` 기록, `nextBillingDate` 가 내일로 밀림.
4. 결제 보류 구독자 탭에 고객·배송지·사유가 보인다. `adminAlertPhone` 이 있으면 SMS 1건(두 번째 실행에서는 다시 보내지 않는다).
5. 권역 다시 켜기 → "다시 판정" → 목록에서 사라짐 → `nextBillingDate` 를 다시 어제로 당기고 크론 재실행 → 정상 청구, `zoneBlockedAt=null`.
6. 갱신 예고 크론(`renewal-notify`)도 권역 밖이면 고지 문자를 보내지 않고 보류 표시만 한다.
7. 마이페이지에서 구독 배송지를 권역 밖 주소로 바꾸려 하면 400 "이 배송지로는 변경할 수 없습니다".

### E. 날짜별 중지
1. 다음 화요일에 달서구 권역 중지 등록(사유 "폭설") → 응답에 보류 처리된 배송 건 수.
2. 체크아웃에서 달서구 주소 + 그 화요일 상품 → 빨간 "…배송은 이 지역에 중지되었습니다", 결제 시 400 `DATE_SUSPENDED`. 목요일 상품만 담으면 결제 성공. 수성구(다른 권역) 주소는 화요일도 가능.
3. 구독 신청에서 그 화요일이 선택돼 있으면 서버가 `suspendedDates` 를 돌려주고 화면이 그 날짜를 건너뛰기로 표시한다.
4. 이미 결제된 구독의 그 날짜 배송 건: 배송 관리 리포트를 열면 보류(사유 "권역 배송 중지 — 폭설")로 코스에서 빠진다. "구독분 크레딧 적립" → `creditBalance` 증가, 선택분·배송 건 삭제. "이번 주기만" 구독은 크레딧 불가 건수로 표시.
5. 이미 결제된 단건 주문은 주문 관리 "배송지 확인" 큐에 같은 사유로 올라온다 → 기존 취소·환불 또는 배송일 변경으로 처리.
6. 중지 해제 → 그 사유로 보류된 건만 풀린다 (다른 사유 보류는 그대로).
7. 전체 중지(권역 없음) 등록 → 모든 권역에 적용. 같은 날짜에 전체 중지를 두 번 넣으면 409.

### F. LEGACY 모드 회귀
1. 모드를 `LEGACY` 로 → 경산 주소가 "배송 권역(대구 전역) 밖입니다. 주문은 접수되며…" 로 돌아가고 결제가 진행되며 `deliveryHold=true`.
2. 달서구 주소는 여전히 `zoneId` 가 채워진다 (권역 매칭이 먼저).

### G. 기존 주소 호환
1. `bcode` 가 NULL 인 기존 배송지가 우편번호 권역(`ZIP`)으로 매칭되는지.
2. 재판정 배치 후 `bcode` 가 채워지고 `BCODE` 권역으로도 매칭되는지. 카카오맵이 꺼져 있으면 `geocodeFailed` 가 늘고 우편번호 매칭만 남는다.
3. 좌표·우편번호가 모두 없는 주소(테스트 시나리오의 "좌표 불명")는 여전히 `UNKNOWN` 보류.

## 6. 운영 메모

- 대기 신청은 개인정보(이름·연락처·동 단위 주소)다. 폼 문구대로 1년 보관 후 삭제 — 대기 신청 탭 "N일 이전 신청 삭제"(기본 365일)를 분기마다 돌린다. 오픈 안내를 보낸 건은 "안내 완료"로 표시해 두 번 보내지 않는다.
- 권역을 끄면 고객에게 자동 안내가 나가지 않는다. 결제 보류 구독자 목록을 보고 직접 연락한다.
- 새 배송 요일·휴일 대체일은 기존 배송 캘린더가 담당한다. 날짜별 중지는 "그날은 배송일이지만 이 지역만 못 간다"에 쓴다. 하루 전체를 쉬면 캘린더에서 끈다.
- Postgres 유니크는 NULL 을 구분하지 않으므로 "전체 중지" 중복은 API 가 막는다 (`findFirst` 검사).
