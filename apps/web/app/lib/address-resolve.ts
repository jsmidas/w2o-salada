/**
 * 주문·구독 생성 시 배송지를 확정한다.
 *
 * 입력은 둘 중 하나:
 *   - addressId: 저장된 배송지 (본인 소유여야 함)
 *   - address:   입력 폼 값 (다음 API 필드 + 출입 정보 포함)
 * 폼 값은 같은 사용자의 동일 주소(우편번호+주소1+주소2)가 있으면 재사용하고 없으면 새로 만든다.
 * 비회원(guest)도 Address 를 만든다 — 배송에는 반드시 주소가 있어야 한다.
 */
import { prisma } from "@repo/db";
import type { DropLocation } from "@prisma/client";
import { areaLabel, enrichLocation, getDeliveryCenter, holdFromStatus, judgeArea, locationToAddressData, type DaumFields } from "./geo";

export type AddressInput = DaumFields & {
  name: string;
  phone: string;
  zipCode: string;
  address1: string;
  address2?: string | null;
  deliveryMemo?: string | null;
  label?: string | null;
  entranceMethod?: string | null;
  entrancePassword?: string | null;
  floor?: string | null;
  dropLocation?: DropLocation | string | null;
  dropNote?: string | null;
  isDefault?: boolean;
};

export type ResolvedAddress = {
  addressId: string;
  areaStatus: "UNKNOWN" | "IN_RANGE" | "OUT_OF_RANGE";
  distanceKm: number | null;
  deliveryHold: boolean;
  deliveryHoldReason: string | null;
};

const DROP_LOCATIONS = ["DOOR", "SECURITY_OFFICE", "PARCEL_BOX", "OTHER"] as const;

export function normalizeDrop(v: unknown): DropLocation {
  return (DROP_LOCATIONS as readonly string[]).includes(String(v)) ? (v as DropLocation) : "DOOR";
}

const clean = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
};

export function validateAddressInput(a: Partial<AddressInput> | undefined): string | null {
  if (!a) return "배송지가 필요합니다.";
  if (!clean(a.name)) return "수령인을 입력해주세요.";
  if (!clean(a.phone)) return "전화번호를 입력해주세요.";
  if (!clean(a.address1)) return "주소를 입력해주세요.";
  if (!clean(a.zipCode)) return "주소 검색으로 우편번호를 선택해주세요.";
  return null;
}

/** 폼 값 → Address 컬럼 (위치 정보 제외) */
export function addressInputToData(a: AddressInput) {
  return {
    name: String(a.name).trim(),
    phone: String(a.phone).trim(),
    zipCode: String(a.zipCode).trim(),
    address1: String(a.address1).trim(),
    address2: clean(a.address2),
    deliveryMemo: clean(a.deliveryMemo),
    label: clean(a.label),
    entranceMethod: clean(a.entranceMethod),
    entrancePassword: clean(a.entrancePassword),
    floor: clean(a.floor),
    dropLocation: normalizeDrop(a.dropLocation),
    dropNote: clean(a.dropNote),
  };
}

export async function resolveAddress(params: {
  userId: string;
  addressId?: string | null;
  address?: AddressInput | null;
}): Promise<{ error: string } | ResolvedAddress> {
  const { userId, addressId, address } = params;

  // 1) 저장된 배송지
  if (addressId) {
    const saved = await prisma.address.findUnique({ where: { id: addressId } });
    if (!saved || saved.userId !== userId) return { error: "배송지를 찾을 수 없습니다." };

    // 저장된 판정은 그때의 권역 규칙 기준이다. 전역 시/도·반경 설정이 바뀌어도 과거 배송지가
    // 따라오도록 주문 시점에 현재 규칙으로 다시 검산한다 (좌표가 있으면 지오코딩 없이 계산만).
    const center = await getDeliveryCenter();
    let { areaStatus, distanceKm } = saved;
    if (!saved.geocodedAt) {
      const loc = await enrichLocation(saved.address1, {
        sido: saved.sido, sigungu: saved.sigungu, bname: saved.bname, buildingName: saved.buildingName,
        isApartment: saved.isApartment, roadAddress: saved.roadAddress, jibunAddress: saved.jibunAddress,
      });
      if (loc.geocodedAt || loc.areaStatus !== saved.areaStatus) {
        await prisma.address.update({
          where: { id: saved.id },
          data: loc.geocodedAt ? locationToAddressData(loc) : { areaStatus: loc.areaStatus, distanceKm: loc.distanceKm },
        });
        areaStatus = loc.areaStatus;
        distanceKm = loc.distanceKm;
      }
    } else {
      const point = saved.lat !== null && saved.lng !== null ? { lat: saved.lat, lng: saved.lng } : null;
      const j = judgeArea(point, saved.bname, center, saved.sido);
      if (j.status !== saved.areaStatus || j.distanceKm !== saved.distanceKm) {
        await prisma.address.update({ where: { id: saved.id }, data: { areaStatus: j.status, distanceKm: j.distanceKm } });
        areaStatus = j.status;
        distanceKm = j.distanceKm;
      }
    }
    return { addressId: saved.id, areaStatus, distanceKm, ...holdFromStatus(areaStatus, distanceKm, areaLabel(center)) };
  }

  // 2) 폼 입력
  const invalid = validateAddressInput(address ?? undefined);
  if (invalid || !address) return { error: invalid ?? "배송지가 필요합니다." };

  const base = addressInputToData(address);
  const existing = await prisma.address.findFirst({
    where: { userId, zipCode: base.zipCode, address1: base.address1, address2: base.address2 },
    orderBy: { createdAt: "desc" },
  });

  const loc = await enrichLocation(base.address1, address);
  const locData = locationToAddressData(loc);

  let saved;
  if (existing) {
    // 같은 주소 재사용 — 출입 정보·메모·수령인은 최신 입력으로 갱신.
    // 이번 지오코딩이 실패했는데 기존 좌표가 있으면 좌표는 지키고 판정만 현재 규칙으로 다시 한다.
    let locPatch: Record<string, unknown> = locData;
    if (!loc.geocodedAt && existing.geocodedAt) {
      const center = await getDeliveryCenter();
      const point = existing.lat !== null && existing.lng !== null ? { lat: existing.lat, lng: existing.lng } : null;
      const j = judgeArea(point, loc.bname ?? existing.bname, center, loc.sido ?? existing.sido);
      locPatch = { areaStatus: j.status, distanceKm: j.distanceKm };
    }
    saved = await prisma.address.update({
      where: { id: existing.id },
      data: { ...base, ...locPatch },
    });
  } else {
    const count = await prisma.address.count({ where: { userId } });
    const wantDefault = userId !== "guest" && (count === 0 || address.isDefault === true);
    if (wantDefault) {
      await prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }
    saved = await prisma.address.create({
      data: { userId, ...base, ...locData, isDefault: wantDefault },
    });
  }

  return {
    addressId: saved.id,
    areaStatus: saved.areaStatus,
    distanceKm: saved.distanceKm,
    ...holdFromStatus(saved.areaStatus, saved.distanceKm, loc.judgement.areaLabel),
  };
}

/** 구독 갱신 주문 등 — 구독 배송지 없으면 사용자의 기본 배송지 */
export async function pickAddressForUser(userId: string, preferredAddressId?: string | null) {
  if (preferredAddressId) {
    const a = await prisma.address.findUnique({ where: { id: preferredAddressId } });
    if (a && a.userId === userId) return a;
  }
  return prisma.address.findFirst({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}
