/**
 * 크론 묶음 실행기
 *
 * Vercel Hobby 는 프로젝트당 크론 2개가 상한이다. 작업마다 크론을 하나씩 걸면
 * 상한을 넘는 것들이 조용히 등록되지 않아, 구독 자동결제 같은 핵심 작업이
 * 안 도는 채로 운영될 수 있다. 시각이 비슷한 작업을 묶어 크론 하나로 돌린다.
 *
 * 한 작업이 실패해도 나머지는 계속 돌린다 — 도착 알림이 터졌다고 자동결제까지
 * 멈추면 안 된다. 결과는 작업별로 나눠 돌려주므로 어느 것이 실패했는지 보인다.
 */
import * as Sentry from "@sentry/nextjs";

export type CronJob = [name: string, handler: (request: Request) => Promise<Response>];

export type CronGroupResult = {
  ok: boolean;
  ran: number;
  failed: number;
  jobs: Record<string, { status: number; body?: unknown; error?: string }>;
};

export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  // 시크릿이 비어 있으면 열리는 게 아니라 닫힌다 (fail-closed)
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function runCronGroup(request: Request, jobs: CronJob[]): Promise<CronGroupResult> {
  const out: CronGroupResult = { ok: true, ran: 0, failed: 0, jobs: {} };

  for (const [name, handler] of jobs) {
    try {
      const res = await handler(request);
      const body = await res.json().catch(() => undefined);
      out.jobs[name] = { status: res.status, body };
      out.ran++;
      if (!res.ok) {
        out.failed++;
        out.ok = false;
        Sentry.captureMessage(`크론 작업 실패: ${name}`, {
          level: "error",
          tags: { area: "cron", job: name },
          extra: { status: res.status, body },
        });
      }
    } catch (err) {
      out.jobs[name] = { status: 500, error: err instanceof Error ? err.message : "unknown" };
      out.failed++;
      out.ok = false;
      Sentry.captureException(err, { level: "error", tags: { area: "cron", job: name } });
    }
  }

  return out;
}
