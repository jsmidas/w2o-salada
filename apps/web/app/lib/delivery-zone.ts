/**
 * 배송 권역 판정 (2026-09-30)
 *
 * 우편번호·법정동 코드 단위 권역 테이블(DeliveryZone)과 예외 규칙(DeliveryZoneRule),
 * 날짜별 중지(DeliveryZoneSuspension)로 "이 주소에 이 날짜에 배송할 수 있나"를 정한다.
 *
 * 판정 순서
 *   1. 예외 규칙 BLOCK  — 우편번호 / 단지명 / 사전 등록 단지 매칭 → OUT_OF_RANGE
 *   2. 예외 규칙 ALLOW  — → IN_RANGE (권역 밖이라도 배송)
 *   3. 활성 권역        — ZIP 정확 일치, BCODE 접두 매칭(5자리=구, 8자리=동, 10자리=리). 가장 긴 코드 우선 → IN_RANGE
 *   4. 매칭 없음        — Setting deliveryZoneMode 에 따라
 *        LEGACY(기본): 기존 규칙(시/도 전역 → 허용 동 → 센터 반경)으로 폴백. 밖이면 결제는 받고 보류(deliveryHold)
 *        ZONES       : OUT_OF_RANGE 확정. 주문·구독·자동결제를 막고 오픈 알림 신청으로 보낸다
 *   5. 배송일이 주어지면 그 날짜의 중지(전체 또는 해당 권역)를 본다
 *
 * 이 파일은 geo.ts 를 런타임 import 하지 않는다 (geo.ts 가 이 파일을 부른다 — 순환 방지).
 * 기존 규칙의 판정(AreaJudgement)은 호출부가 계산해서 넘긴다.
 */
import { prisma } from "@repo/db";
import type { AreaJudgement, AreaStatus } from "./geo";

export type ZoneMode = "LEGACY" | "ZONES";
export const ZONE_MODE_KEY = "deliveryZoneMode";
export const ADMIN_ALERT_PHONE_KEY = "adminAlertPhone";
/** ZONES 모드에서 권역에 없는 주소라도 센터 반경(deliveryRadiusKm) 이내면 허용 — "1" 이면 켜짐 (2026-09-30, 반경 15km 확장 요청) */
export const RADIUS_FALLBACK_KEY = "deliveryZoneRadiusFallback";

export const ZONE_MODE_LABEL: Record<ZoneMode, string> = {
  LEGACY: "기존 규칙 (시/도·동·반경, 권역 밖은 보류 접수)",
  ZONES: "권역 테이블만 (권역 밖은 결제 차단 + 오픈 알림 신청)",
};

export type ZoneConfig = { mode: ZoneMode; radiusFallback: boolean };

/** 판정 설정. 키가 없거나 값이 이상하면 LEGACY·반경 폴백 꺼짐 (배포 직후 동작이 바뀌지 않게) */
export async function getZoneConfig(): Promise<ZoneConfig> {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { in: [ZONE_MODE_KEY, RADIUS_FALLBACK_KEY] } } });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      mode: map.get(ZONE_MODE_KEY) === "ZONES" ? "ZONES" : "LEGACY",
      radiusFallback: ["1", "true", "on"].includes((map.get(RADIUS_FALLBACK_KEY) ?? "").trim().toLowerCase()),
    };
  } catch {
    return { mode: "LEGACY", radiusFallback: false };
  }
}

/** 현재 판정 모드 */
export async function getZoneMode(): Promise<ZoneMode> {
  return (await getZoneConfig()).mode;
}

export type ZoneInput = {
  zipCode?: string | null;
  bcode?: string | null;
  buildingName?: string | null;
  apartmentId?: string | null;
  sigungu?: string | null;
  sido?: string | null;
  bname?: string | null;
};

export type ZoneMatchedBy = "RULE_BLOCK" | "RULE_ALLOW" | "ZONE" | "RADIUS" | "LEGACY" | "NONE";

export type ZoneJudgement = {
  status: AreaStatus;
  /** 지금 이 주소로 결제를 받을 수 있나. LEGACY 모드는 밖이라도 보류 접수하므로 true, ZONES 모드는 IN_RANGE 만 true */
  canOrder: boolean;
  reason: string; // 사람이 읽는 근거 — Address.areaReason 에 저장
  zoneId: string | null;
  zoneName: string | null;
  ruleId: string | null;
  distanceKm: number | null;
  mode: ZoneMode;
  matchedBy: ZoneMatchedBy;
  /** 결론을 내려면 좌표가 필요하다 (ZONES 모드 반경 폴백에서 아직 좌표가 없을 때). enrichLocation 이 이때만 지오코딩한다 */
  needsCoords?: boolean;
  legacy: AreaJudgement;
};

/** 단지명 비교용 정규화 — 공백 제거·소문자 (geo.ts matchApartment 와 같은 규칙) */
export function normName(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, "").toLowerCase();
}

/** 우편번호 정규화 — 숫자 5자리만 인정 (구 6자리 우편번호는 버린다) */
export function normZip(s: string | null | undefined): string | null {
  const d = (s ?? "").replace(/\D/g, "");
  return d.length === 5 ? d : null;
}

/** 법정동 코드 정규화 — 숫자만, 5~10자리 */
export function normBcode(s: string | null | undefined): string | null {
  const d = (s ?? "").replace(/\D/g, "");
  return d.length >= 5 && d.length <= 10 ? d : null;
}

/**
 * 권역·예외 규칙으로 판정한다. legacy 는 기존 규칙(시/도·동·반경)의 결과 — 매칭이 없을 때 폴백으로 쓴다.
 * 예외 없이 항상 값을 돌려준다 (DB 장애 시 legacy 그대로).
 */
export async function judgeZone(input: ZoneInput, legacy: AreaJudgement, modeOverride?: ZoneMode): Promise<ZoneJudgement> {
  const cfg = await getZoneConfig();
  const mode = modeOverride ?? cfg.mode;
  const radiusFallback = cfg.radiusFallback;
  const zip = normZip(input.zipCode);
  const bcode = normBcode(input.bcode);
  const bn = input.buildingName ? normName(input.buildingName) : "";
  const base = { distanceKm: legacy.distanceKm, mode, legacy };

  try {
    // 1·2) 예외 규칙 — 표가 작아서 활성 규칙을 전부 읽고 코드에서 맞춘다
    const rules = await prisma.deliveryZoneRule.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    const hit = (r: (typeof rules)[number]) => {
      if (r.zipCode && zip && r.zipCode === zip) return true;
      if (r.apartmentId && input.apartmentId && r.apartmentId === input.apartmentId) return true;
      if (r.buildingName && bn && normName(r.buildingName) === bn) {
        if (!r.sigungu || !input.sigungu || r.sigungu === input.sigungu) return true;
      }
      return false;
    };
    const block = rules.find((r) => r.action === "BLOCK" && hit(r));
    if (block) {
      return {
        ...base,
        status: "OUT_OF_RANGE",
        canOrder: false, // 차단 규칙은 모드와 무관하게 막는다 (사람이 명시적으로 막은 곳)
        reason: `차단 규칙${block.reason ? `: ${block.reason}` : ""}`,
        zoneId: null, zoneName: null, ruleId: block.id, matchedBy: "RULE_BLOCK",
      };
    }
    const allow = rules.find((r) => r.action === "ALLOW" && hit(r));
    if (allow) {
      return {
        ...base,
        status: "IN_RANGE", canOrder: true,
        reason: `허용 규칙${allow.reason ? `: ${allow.reason}` : ""}`,
        zoneId: null, zoneName: null, ruleId: allow.id, matchedBy: "RULE_ALLOW",
      };
    }

    // 3) 권역
    const zone = await matchZone(zip, bcode);
    if (zone) {
      return {
        ...base,
        status: "IN_RANGE", canOrder: true,
        reason: `권역: ${zone.name} (${zone.kind === "ZIP" ? "우편번호" : "법정동"} ${zone.code})`,
        zoneId: zone.id, zoneName: zone.name, ruleId: null, matchedBy: "ZONE",
      };
    }

    // 4) 매칭 없음
    if (mode === "ZONES") {
      // 4-a) 반경 폴백 — 권역에 없어도 센터 반경 이내면 허용 (시/도·허용 동 화이트리스트는 쓰지 않는다, 거리만)
      if (radiusFallback) {
        if (legacy.distanceKm !== null && legacy.distanceKm <= legacy.radiusKm) {
          return {
            ...base,
            status: "IN_RANGE", canOrder: true,
            reason: `센터 반경 ${legacy.radiusKm}km 이내 (${legacy.distanceKm}km)`,
            zoneId: null, zoneName: null, ruleId: null, matchedBy: "RADIUS",
          };
        }
        if (legacy.distanceKm === null) {
          // 좌표가 없어 거리를 모른다 — 호출부(enrichLocation)가 지오코딩한 뒤 다시 판정한다. 끝내 못 얻으면 UNKNOWN 보류
          return {
            ...base,
            status: "UNKNOWN", canOrder: true,
            reason: "권역 밖 — 센터 거리 확인 필요",
            zoneId: null, zoneName: null, ruleId: null, matchedBy: "NONE", needsCoords: true,
          };
        }
      }
      const inactive = await matchZone(zip, bcode, false);
      const far = radiusFallback && legacy.distanceKm !== null ? ` · 센터에서 ${legacy.distanceKm}km` : "";
      return {
        ...base,
        status: "OUT_OF_RANGE", canOrder: false,
        reason: (inactive ? `권역 비활성: ${inactive.name}` : "등록된 배송 권역 없음") + far,
        zoneId: inactive?.id ?? null, zoneName: inactive?.name ?? null, ruleId: null, matchedBy: "NONE",
      };
    }
  } catch (err) {
    console.error("[delivery-zone] 판정 실패, 기존 규칙으로 폴백:", err);
  }

  return {
    ...base,
    status: legacy.status,
    canOrder: true, // LEGACY: 밖이어도 보류로 접수
    reason: legacy.reason,
    zoneId: null, zoneName: null, ruleId: null, matchedBy: "LEGACY",
  };
}

/** 우편번호 정확 일치 또는 법정동 코드 접두 매칭. 여러 개면 가장 구체적인(긴) 코드 */
async function matchZone(zip: string | null, bcode: string | null, active = true) {
  if (!zip && !bcode) return null;
  const or: { kind: "ZIP" | "BCODE"; code: string | { in: string[] } }[] = [];
  if (zip) or.push({ kind: "ZIP", code: zip });
  if (bcode) {
    // 접두 후보: 5·8·10자리 등 모든 접두를 한 번에 IN 으로 (LIKE 보다 인덱스를 탄다)
    const prefixes: string[] = [];
    for (let len = 5; len <= bcode.length; len++) prefixes.push(bcode.slice(0, len));
    or.push({ kind: "BCODE", code: { in: prefixes } });
  }
  const rows = await prisma.deliveryZone.findMany({
    where: { isActive: active, OR: or },
    select: { id: true, name: true, kind: true, code: true },
  });
  if (rows.length === 0) return null;
  rows.sort((a, b) => (a.kind === b.kind ? b.code.length - a.code.length : a.kind === "ZIP" ? -1 : 1));
  return rows[0]!;
}

// ───────────────────────── 날짜별 중지 ─────────────────────────

export type Suspension = { reason: string; scope: "ALL" | "ZONE"; zoneId: string | null };

/** 배송일(YYYY-MM-DD) 목록 중 중지된 날짜. 전체 중지(zoneId null)와 이 권역의 중지를 함께 본다 */
export async function suspendedDates(zoneId: string | null, dates: string[]): Promise<Map<string, Suspension>> {
  const out = new Map<string, Suspension>();
  const uniq = [...new Set(dates)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (uniq.length === 0) return out;
  try {
    const rows = await prisma.deliveryZoneSuspension.findMany({
      where: {
        date: { in: uniq.map((d) => new Date(`${d}T00:00:00.000Z`)) },
        OR: [{ zoneId: null }, ...(zoneId ? [{ zoneId }] : [])],
      },
      select: { date: true, zoneId: true, reason: true },
    });
    for (const r of rows) {
      const key = r.date.toISOString().slice(0, 10);
      // 전체 중지가 권역 중지보다 우선 표시
      if (!out.has(key) || r.zoneId === null) out.set(key, { reason: r.reason, scope: r.zoneId === null ? "ALL" : "ZONE", zoneId: r.zoneId });
    }
  } catch (err) {
    console.error("[delivery-zone] 중지일 조회 실패:", err);
  }
  return out;
}

/** 특정 날짜에 중지된 권역 집합 — 배송 건 생성처럼 한 날짜에 여러 주소를 돌 때 한 번만 읽는다 */
export async function suspensionsOn(date: Date): Promise<{ all: Suspension | null; byZone: Map<string, Suspension> }> {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const byZone = new Map<string, Suspension>();
  let all: Suspension | null = null;
  try {
    const rows = await prisma.deliveryZoneSuspension.findMany({ where: { date: start }, select: { zoneId: true, reason: true } });
    for (const r of rows) {
      if (r.zoneId === null) all = { reason: r.reason, scope: "ALL", zoneId: null };
      else byZone.set(r.zoneId, { reason: r.reason, scope: "ZONE", zoneId: r.zoneId });
    }
  } catch (err) {
    console.error("[delivery-zone] 중지 조회 실패:", err);
  }
  return { all, byZone };
}

// ───────────────────────── 주문 시점 판정 ─────────────────────────

export type BlockCode = "OUT_OF_AREA" | "DATE_SUSPENDED" | "NO_ADDRESS";
export type Blocked = { code: BlockCode; message: string; dates?: string[]; reason?: string };

/**
 * 결제 직전 최종 판정. 권역 밖(ZONES 모드)이나 차단 규칙이면 OUT_OF_AREA, 배송일 중 중지된 날이 있으면 DATE_SUSPENDED.
 * LEGACY 모드에서 권역 밖은 막지 않는다 (호출부가 기존처럼 deliveryHold 로 보류).
 */
export async function checkOrderable(
  j: { areaStatus: AreaStatus; zoneId: string | null; canOrder?: boolean; areaReason?: string | null; mode?: ZoneMode },
  dates: string[],
): Promise<{ blocked: Blocked | null; suspended: Map<string, Suspension> }> {
  const mode = j.mode ?? (await getZoneMode());
  // canOrder=false 는 판정 함수가 이미 "막아야 한다"고 정한 것(차단 규칙, ZONES 모드 권역 밖).
  // 저장된 areaStatus 만 들고 오는 호출부를 위해 ZONES 모드 OUT_OF_RANGE 도 여기서 한 번 더 막는다
  const blockedByRule = (j.areaReason ?? "").startsWith("차단 규칙");
  if (j.canOrder === false || (mode === "ZONES" && j.areaStatus === "OUT_OF_RANGE")) {
    return {
      blocked: {
        code: "OUT_OF_AREA",
        message: blockedByRule
          ? "현재 배송이 어려운 주소입니다. 다른 배송지를 선택해주세요."
          : "아직 배송하지 않는 지역입니다. 오픈 알림을 신청하시면 배송이 시작될 때 알려드립니다.",
        reason: j.areaReason ?? undefined,
      },
      suspended: new Map(),
    };
  }
  const suspended = await suspendedDates(j.zoneId, dates);
  if (suspended.size > 0) {
    const list = [...suspended.keys()].sort();
    const label = list.map((d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`).join(", ");
    const why = [...new Set([...suspended.values()].map((s) => s.reason))].join(" · ");
    return {
      blocked: {
        code: "DATE_SUSPENDED",
        message: `${label} 배송은 해당 지역 사정(${why})으로 중지되었습니다. 다른 배송일을 선택해주세요.`,
        dates: list,
        reason: why,
      },
      suspended,
    };
  }
  return { blocked: null, suspended };
}

/** 고객 안내 문구 */
export function zoneMessage(z: ZoneJudgement): string {
  switch (z.matchedBy) {
    case "RULE_BLOCK":
      return "현재 배송이 어려운 주소입니다. 다른 배송지를 선택해주세요.";
    case "RULE_ALLOW":
    case "ZONE":
      return `배송 가능 지역입니다.${z.zoneName ? ` (${z.zoneName})` : ""}`;
    case "RADIUS":
      return `배송 가능 지역입니다. (${z.reason})`;
    case "NONE":
      if (z.status === "UNKNOWN") return "주소 위치를 자동으로 확인하지 못했습니다. 주문은 접수되며, 담당자가 확인 후 연락드립니다.";
      return "아직 배송하지 않는 지역입니다. 오픈 알림을 신청하시면 배송이 시작될 때 알려드립니다.";
    default:
      break;
  }
  // LEGACY 폴백 — 기존 문구
  switch (z.status) {
    case "IN_RANGE":
      return z.legacy.byWhitelist ? `배송 가능 지역입니다. (${z.legacy.reason})` : `배송 가능 지역입니다. (센터에서 ${z.distanceKm}km)`;
    case "OUT_OF_RANGE":
      return `배송 권역(${z.legacy.areaLabel}) 밖입니다. 주문은 접수되며, 담당자가 주간에 전화로 배송 가능 여부를 안내드립니다.`;
    default:
      return "주소 위치를 자동으로 확인하지 못했습니다. 주문은 접수되며, 담당자가 확인 후 연락드립니다.";
  }
}

// ───────────────────────── 관리자 알림 ─────────────────────────

/**
 * 권역 때문에 자동결제를 건너뛴 구독을 표시하고 관리자에게 알린다.
 * 화면 목록(/admin/delivery-zones 결제 보류 구독자)이 기본이고, Setting adminAlertPhone 이 있으면 SMS 한 통.
 * 이미 표시된 구독(zoneBlockedAt 있음)은 다시 알리지 않는다.
 */
export async function markSubscriptionZoneBlocked(sub: { id: string; zoneBlockedAt: Date | null; userId: string }, reason: string, ctx: { userName?: string | null; phase: string }) {
  const now = new Date();
  await prisma.subscription.update({ where: { id: sub.id }, data: { zoneBlockedAt: sub.zoneBlockedAt ?? now, zoneBlockedReason: reason } });
  if (sub.zoneBlockedAt) return; // 이미 알렸다

  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureMessage("구독 자동결제 보류: 배송 권역 밖", {
      level: "warning",
      tags: { area: "subscription", phase: ctx.phase },
      extra: { subId: sub.id, userId: sub.userId, reason },
    });
  } catch { /* Sentry 없음 */ }

  try {
    const setting = await prisma.setting.findUnique({ where: { key: ADMIN_ALERT_PHONE_KEY } });
    const phone = setting?.value?.replace(/\D/g, "");
    if (phone && phone.length >= 10) {
      const { sendSmsDirect } = await import("./notification");
      const cnt = await prisma.subscription.count({ where: { zoneBlockedAt: { not: null }, status: { in: ["ACTIVE", "PAUSED"] } } });
      await sendSmsDirect(
        phone,
        `[W2O] 구독 결제 보류 — 배송 권역 밖\n${ctx.userName ?? "고객"}님 (${reason})\n보류 구독 총 ${cnt}건 → 관리자 > 배송 권역 > 결제 보류 구독자`,
      );
    }
  } catch (err) {
    console.error("[delivery-zone] 관리자 알림 실패:", err);
  }
}

/** 청구가 다시 성공하면 표시를 지운다 */
export async function clearSubscriptionZoneBlock(subscriptionId: string) {
  await prisma.subscription.updateMany({ where: { id: subscriptionId, zoneBlockedAt: { not: null } }, data: { zoneBlockedAt: null, zoneBlockedReason: null } });
}
