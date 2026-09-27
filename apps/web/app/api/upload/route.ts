import { NextResponse } from "next/server";
import { requireAdmin } from "../../lib/auth-guard";
import { getSupabaseAdmin } from "../../lib/supabase";

const ALLOWED: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const FOLDERS = new Set(["products", "pages", "reviews", "misc", "deliveries"]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const { error } = await requireAdmin("products");
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folderRaw = String(formData.get("folder") ?? "products");
    const folder = FOLDERS.has(folderRaw) ? folderRaw : "misc"; // 경로 조작 방지 — 정해진 폴더만

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }
    // 이미지만, 10MB 이하. 확장자는 원본 파일명이 아니라 MIME 에서 정한다 (.html/.svg 업로드 방지)
    const ext = ALLOWED[file.type];
    if (!ext) return NextResponse.json({ error: "JPG·PNG·WebP·GIF 이미지만 올릴 수 있습니다." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "10MB 이하 파일만 올릴 수 있습니다." }, { status: 400 });

    // 파일명 생성 (중복 방지)
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Supabase Storage 업로드 (관리자 인증 후 service role로 RLS 우회)
    const supabase = getSupabaseAdmin();
    const arrayBuffer = await file.arrayBuffer();
    const { data, error: uploadError } = await supabase.storage
      .from("images")
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "업로드에 실패했습니다." }, { status: 500 });
    }

    // 공개 URL 생성
    const { data: urlData } = supabase.storage
      .from("images")
      .getPublicUrl(data.path);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("POST /api/upload error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
