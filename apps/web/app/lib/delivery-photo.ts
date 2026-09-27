import { getSupabaseAdmin } from "./supabase";

const MAX_BYTES = 4.5 * 1024 * 1024; // Vercel 요청 본문 한도 — 클라이언트가 먼저 압축한다

/**
 * 기사 현장 사진을 Supabase Storage(images/delivery-proof/<배송일 KST>/)에 올리고 공개 URL 을 돌려준다.
 * 배송 완료·배송 못함 API 가 같이 쓴다.
 */
export async function uploadDeliveryPhoto(
  file: File,
  deliveryId: string,
  scheduledDate: Date | null,
): Promise<{ ok: true; url: string } | { ok: false; error: string; status: number }> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "이미지 파일만 올릴 수 있습니다.", status: 400 };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "사진 용량이 너무 큽니다 (4.5MB 이하).", status: 413 };
  }

  const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ext = rawExt || "jpg";
  const day = scheduledDate ? new Date(scheduledDate.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) : "undated";
  const path = "delivery-proof/" + day + "/" + deliveryId + "-" + Date.now() + "." + ext;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from("images")
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error || !data) {
    console.error("delivery photo upload error:", error);
    return { ok: false, error: "사진 업로드에 실패했습니다. 다시 시도해 주세요.", status: 500 };
  }
  const { data: urlData } = supabase.storage.from("images").getPublicUrl(data.path);
  return { ok: true, url: urlData.publicUrl };
}
