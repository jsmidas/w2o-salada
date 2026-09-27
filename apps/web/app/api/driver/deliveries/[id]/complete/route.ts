import { NextRequest, NextResponse } from "next/server";
import { requireDriver } from "../../../../../lib/auth-guard";
import { canTouchDelivery } from "../../../../../lib/driver-access";
import { transitionDelivery } from "../../../../../lib/delivery-status";
import { uploadDeliveryPhoto } from "../../../../../lib/delivery-photo";

/**
 * 배송 완료 = 문 앞 사진 업로드. 사진 없이는 완료할 수 없다.
 * 특이사항이 있으면 memo 를 함께 남긴다 (선택).
 * POST /api/driver/deliveries/:id/complete  multipart { file, memo? }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session, isAdmin } = await requireDriver();
  if (error) return error;
  const me = session!.user as { id: string };

  try {
    const { id } = await params;
    const access = await canTouchDelivery(id, me.id, isAdmin);
    if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "배송 완료 사진이 필요합니다." }, { status: 400 });
    }
    const memoRaw = formData.get("memo");
    const memo = typeof memoRaw === "string" && memoRaw.trim() ? memoRaw.trim().slice(0, 500) : null;

    const uploaded = await uploadDeliveryPhoto(file, id, access.delivery!.scheduledDate);
    if (!uploaded.ok) return NextResponse.json({ error: uploaded.error }, { status: uploaded.status });

    const updated = await transitionDelivery(id, "DELIVERED", { photoUrl: uploaded.url, memo });
    return NextResponse.json({ success: true, photoUrl: uploaded.url, memo, completedAt: updated?.completedAt ?? null });
  } catch (err) {
    console.error("POST /api/driver/deliveries/[id]/complete error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
