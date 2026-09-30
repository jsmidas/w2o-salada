import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAuth } from "../../lib/auth-guard";
import { enrichLocation, locationToAddressData } from "../../lib/geo";
import { addressInputToData, validateAddressInput, type AddressInput } from "../../lib/address-resolve";

// GET: 내 배송지 목록
export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const userId = (session!.user as { id: string }).id;
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(addresses);
  } catch (err) {
    console.error("GET /api/addresses error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// POST: 배송지 등록 — 다음 API 필드 보존 + 좌표·반경 판정까지 저장
export async function POST(request: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const userId = (session!.user as { id: string }).id;
    const body = (await request.json()) as AddressInput;

    const invalid = validateAddressInput(body);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const base = addressInputToData(body);
    const loc = await enrichLocation(base.address1, body);

    // isDefault=true면 기존 기본배송지 해제, 배송지 0개면 자동으로 기본
    const count = await prisma.address.count({ where: { userId } });
    const finalIsDefault = count === 0 ? true : Boolean(body.isDefault);
    if (finalIsDefault) {
      await prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }

    const address = await prisma.address.create({
      data: { userId, ...base, ...locationToAddressData(loc), isDefault: finalIsDefault },
    });

    return NextResponse.json({ ...address, areaReason: loc.areaReason, canOrder: loc.canOrder, zoneName: loc.zone.zoneName }, { status: 201 });
  } catch (err) {
    console.error("POST /api/addresses error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
