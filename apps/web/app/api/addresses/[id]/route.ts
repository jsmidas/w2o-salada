import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAuth } from "../../../lib/auth-guard";
import { enrichLocation, locationToAddressData } from "../../../lib/geo";
import { normalizeDrop, type AddressInput } from "../../../lib/address-resolve";

// PATCH: 배송지 수정 — 주소가 바뀌면 좌표·판정을 다시 계산한다
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const userId = (session!.user as { id: string }).id;
    const { id } = await params;
    const body = (await request.json()) as Partial<AddressInput>;

    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    if (body.isDefault === true && !existing.isDefault) {
      await prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }

    const str = (v: unknown, fallback: string | null) => (v === undefined ? fallback : v === null ? null : String(v).trim() || null);

    const data: Record<string, unknown> = {
      name: body.name ?? existing.name,
      phone: body.phone ?? existing.phone,
      zipCode: body.zipCode ?? existing.zipCode,
      address1: body.address1 ?? existing.address1,
      address2: str(body.address2, existing.address2),
      isDefault: body.isDefault ?? existing.isDefault,
      deliveryMemo: str(body.deliveryMemo, existing.deliveryMemo),
      label: str(body.label, existing.label),
      entranceMethod: str(body.entranceMethod, existing.entranceMethod),
      entrancePassword: str(body.entrancePassword, existing.entrancePassword),
      floor: str(body.floor, existing.floor),
      dropLocation: body.dropLocation === undefined ? existing.dropLocation : normalizeDrop(body.dropLocation),
      dropNote: str(body.dropNote, existing.dropNote),
    };

    // 주소 자체가 바뀌었거나 좌표가 없으면 위치 정보 재계산
    const addressChanged = body.address1 !== undefined && body.address1 !== existing.address1;
    if (addressChanged || !existing.geocodedAt) {
      const loc = await enrichLocation(String(data.address1), addressChanged ? body : {
        sido: existing.sido, sigungu: existing.sigungu, bname: existing.bname, buildingName: existing.buildingName,
        isApartment: existing.isApartment, roadAddress: existing.roadAddress, jibunAddress: existing.jibunAddress, ...body,
      });
      Object.assign(data, locationToAddressData(loc));
    }

    const updated = await prisma.address.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/addresses/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// DELETE: 배송지 삭제
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const userId = (session!.user as { id: string }).id;
    const { id } = await params;

    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const [orderCount, subCount] = await Promise.all([
      prisma.order.count({ where: { addressId: id } }),
      prisma.subscription.count({ where: { addressId: id, status: { in: ["PENDING", "ACTIVE", "PAUSED"] } } }),
    ]);
    if (orderCount > 0) {
      return NextResponse.json({ error: "주문 이력이 있어 삭제할 수 없습니다." }, { status: 400 });
    }
    if (subCount > 0) {
      return NextResponse.json({ error: "진행 중인 구독의 배송지라 삭제할 수 없습니다. 구독 배송지를 먼저 바꿔주세요." }, { status: 400 });
    }

    await prisma.address.delete({ where: { id } });

    if (existing.isDefault) {
      const remaining = await prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
      if (remaining) {
        await prisma.address.update({ where: { id: remaining.id }, data: { isDefault: true } });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/addresses/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
