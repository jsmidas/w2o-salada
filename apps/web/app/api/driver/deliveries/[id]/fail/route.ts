import { NextRequest, NextResponse } from "next/server";
import { requireDriver } from "../../../../../lib/auth-guard";
import { canTouchDelivery } from "../../../../../lib/driver-access";
import { transitionDelivery } from "../../../../../lib/delivery-status";
import { uploadDeliveryPhoto } from "../../../../../lib/delivery-photo";

/**
 * 배송 불가 처리 — 사유(memo) 필수, 현장 사진은 선택.
 * 주문 상태는 바꾸지 않고 관리자가 후속 처리한다.
 * POST /api/driver/deliveries/:id/fail  multipart { memo, file? }  (JSON { memo } 도 허용)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session, isAdmin } = await requireDriver();
  if (error) return error;
  const me = session!.user as { id: string };

  try {
    const { id } = await params;
    const access = await canTouchDelivery(id, me.id, isAdmin);
    if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 403 });
    if (access.delivery!.status === "DELIVERED") {
      return NextResponse.json({ error: "이미 완료된 배송입니다." }, { status: 400 });
    }

    let memo = "";
    let file: File | null = null;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const m = formData.get("memo");
      memo = typeof m === "string" ? m.trim() : "";
      const f = formData.get("file");
      if (f instanceof File && f.size > 0) file = f;
    } else {
      const body = await request.json().catch(() => ({}));
      memo = typeof body.memo === "string" ? body.memo.trim() : "";
    }
    if (!memo) return NextResponse.json({ error: "배송 불가 사유를 입력해 주세요." }, { status: 400 });

    let photoUrl: string | undefined;
    if (file) {
      const uploaded = await uploadDeliveryPhoto(file, id, access.delivery!.scheduledDate);
      if (!uploaded.ok) return NextResponse.json({ error: uploaded.error }, { status: uploaded.status });
      photoUrl = uploaded.url;
    }

    const updated = await transitionDelivery(id, "FAILED", { memo: memo.slice(0, 500), photoUrl });
    return NextResponse.json({ success: true, photoUrl: photoUrl ?? null, completedAt: updated?.completedAt ?? null });
  } catch (err) {
    console.error("POST /api/driver/deliveries/[id]/fail error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
