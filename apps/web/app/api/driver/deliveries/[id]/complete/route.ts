import { NextRequest, NextResponse } from "next/server";
import { requireDriver } from "../../../../../lib/auth-guard";
import { canTouchDelivery } from "../../../../../lib/driver-access";
import { transitionDelivery } from "../../../../../lib/delivery-status";
import { getSupabaseAdmin } from "../../../../../lib/supabase";

const MAX_BYTES = 4.5 * 1024 * 1024; // Vercel 요청 본문 한도 — 클라이언트가 먼저 압축한다

/**
 * 배송 완료 = 문 앞 사진 업로드. 사진 없이는 완료할 수 없다.
 * POST /api/driver/deliveries/:id/complete  multipart { file }
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
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "이미지 파일만 올릴 수 있습니다." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "사진 용량이 너무 큽니다 (4.5MB 이하)." }, { status: 413 });
    }

    const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const ext = rawExt || "jpg";
    const scheduled = access.delivery!.scheduledDate;
    const day = scheduled ? new Date(scheduled.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) : "undated";
    const path = "delivery-proof/" + day + "/" + id + "-" + Date.now() + "." + ext;

    const supabase = getSupabaseAdmin();
    const { data, error: uploadError } = await supabase.storage
      .from("images")
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (uploadError) {
      console.error("delivery photo upload error:", uploadError);
      return NextResponse.json({ error: "사진 업로드에 실패했습니다. 다시 시도해 주세요." }, { status: 500 });
    }
    const { data: urlData } = supabase.storage.from("images").getPublicUrl(data.path);

    const updated = await transitionDelivery(id, "DELIVERED", { photoUrl: urlData.publicUrl });
    return NextResponse.json({ success: true, photoUrl: urlData.publicUrl, completedAt: updated?.completedAt ?? null });
  } catch (err) {
    console.error("POST /api/driver/deliveries/[id]/complete error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
