# 백업 · 복원 절차

> 2026-09-28 실제 복원 리허설을 거쳐 작성. 사고가 났을 때 이 문서만 보고 따라 할 수 있게 쓴다.

## 지금 백업되는 것 / 안 되는 것

| 대상 | 상태 | 비고 |
|---|---|---|
| Postgres (public 스키마) | ✅ 매일 03:00 KST | GitHub Actions `db-backup.yml`, 아티팩트 90일 보관 |
| 테이블별 JSON + 행 수 매니페스트 | ✅ 같은 워크플로 | 복원 검증용 |
| **Supabase Storage `images` 버킷** | ❌ **백업 없음** | 상품 사진이 날아가면 복구 불가 (DB엔 URL만 있다) |

Supabase Free 플랜에는 자체 백업이 없어 이 워크플로가 유일한 안전장치다.

## 복원 절차

### 준비물

- PostgreSQL 17 클라이언트 (`pg_restore`) — **서버와 같은 메이저 버전**이어야 한다
- 복원 대상 빈 데이터베이스
- GitHub CLI (`gh`) 또는 Actions 웹에서 아티팩트 내려받기

### 1. 백업 내려받기

```bash
gh run list --workflow=db-backup.yml --limit 5      # 성공한 실행 찾기
gh run download <RUN_ID> --dir ./restore            # 아티팩트 저장
```

받으면 이런 구조다.

```
restore/db-backup-<RUN_ID>/
  w2o-YYYYMMDD-HHMM.dump         ← pg_restore 용 (커스텀 포맷)
  w2o-YYYYMMDD-HHMM.schema.sql   ← 스키마만 (읽기용)
  json/manifest.json             ← 테이블별 행 수 (검증용)
  json/*.json                    ← 테이블별 데이터
```

### 2. 빈 DB 만들고 복원

```bash
psql -U postgres -h localhost -c "CREATE DATABASE w2o_restore_test;"

pg_restore -U postgres -h localhost -d w2o_restore_test \
  --clean --if-exists --no-owner --no-privileges \
  restore/db-backup-<RUN_ID>/w2o-YYYYMMDD-HHMM.dump
```

**운영 DB에 직접 복원하지 않는다.** 먼저 별도 DB에 올려 검증한 뒤, 정말 되돌려야 할 때만
운영 `DIRECT_URL` 을 대상으로 같은 명령을 쓴다.

### 3. 검증 (이 단계를 건너뛰지 않는다)

**행 수 대조** — `json/manifest.json` 의 숫자와 복원본을 맞춰본다.

```bash
psql -U postgres -h localhost -d w2o_restore_test -At \
  -c "SELECT count(*) FROM orders"   # manifest 의 orders 값과 같아야 한다
```

**마이그레이션 이력**

```bash
DATABASE_URL="postgresql://postgres@localhost:5432/w2o_restore_test" \
DIRECT_URL="$DATABASE_URL" \
npx prisma migrate status --schema packages/db/prisma/schema.prisma
```

백업 시점 이후에 추가된 마이그레이션은 "not yet applied" 로 나오는 게 정상이다.

**제약·RLS**

```sql
-- 검증되지 않은 제약이 있으면 안 된다 (0 이어야 정상)
SELECT count(*) FROM pg_constraint c
JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
WHERE n.nspname='public' AND NOT c.convalidated;

-- RLS 가 꺼진 테이블이 있으면 안 된다
SELECT tablename FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity;
```

## 2026-09-28 리허설 결과

백업 `w2o-20260928-0529.dump` (90KB) 를 로컬 PostgreSQL 17 에 복원했다.

| 항목 | 결과 |
|---|---|
| 복원 소요 | **1초** (에러 없음) |
| 행 수 대조 | **25개 테이블 전부 일치** |
| 마이그레이션 이력 | 13개 정상 인식 (백업 이후 추가분 1개만 미적용 — 정상) |
| 제약 조건 | 외래키 30 · 기본키 25 · 고유 인덱스 38, 검증 실패 0 |
| RLS | 25개 중 24개 — **1개 누락 발견** |

### 리허설에서 찾은 문제

`_prisma_migrations` 의 RLS 가 꺼져 있었다. baseline 마이그레이션에 활성화 구문이
있는데도 운영 DB 에서 풀려 있었고, 9/27 복구 과정에서 테이블이 재생성되며 설정이
사라진 것으로 보인다. public 스키마는 PostgREST 로 노출되므로 anon 키만으로
마이그레이션 이력(=스키마 구조)이 읽히는 상태였다.

→ `20260928170000_rls_prisma_migrations` 로 다시 켰다. 현재 26개 테이블 전부 활성.

**복원 리허설의 목적이 이것이다.** 백업이 열리는지만 보는 게 아니라, 복원본과
운영본을 비교해 운영 쪽 설정이 어긋난 것을 찾아낸다. 정기적으로 돌려야 한다.

## 남은 과제 — 이미지 버킷 백업

Supabase Storage 의 `images` 버킷이 백업되지 않는다. 상품 사진이 사라지면
DB 를 복원해도 URL 만 남고 파일은 돌아오지 않는다.

방법은 둘이다.

- `supabase storage cp -r` (Supabase CLI) — 공식 도구, 서비스 롤 키 필요
- `rclone` S3 프로토콜 연결 — Supabase Storage 는 S3 호환 엔드포인트를 제공한다

`db-backup.yml` 에 단계를 덧붙여 같은 아티팩트에 올리는 게 가장 간단하다.
용량이 커지면 별도 워크플로로 분리하고 주 1회로 낮춘다.

## 권장 주기

- **백업**: 매일 자동 (이미 적용)
- **복원 리허설**: 월 1회. 스키마가 크게 바뀐 직후에는 그때 한 번 더
- 리허설 때마다 이 문서의 "리허설 결과" 표를 갱신한다
