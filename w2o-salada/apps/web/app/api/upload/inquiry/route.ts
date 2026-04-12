import { NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// POST: 고객 문의용 이미지 업로드 (로그인 불필요)
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "이미지 파일만 업로드 가능합니다." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "파일 크기는 5MB 이하여야 합니다." }, { status: 400 });
    }

    const ext = file.name.split(".").pop();
    const fileName = `inquiries/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const supabase = getSupabase();
    const arrayBuffer = await file.arrayBuffer();
    const { data, error: uploadError } = await supabase.storage
      .from("images")
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Inquiry upload error:", uploadError);
      return NextResponse.json({ error: "업로드에 실패했습니다.", detail: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("images").getPublicUrl(data.path);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("POST /api/upload/inquiry error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "서버 오류", detail: msg }, { status: 500 });
  }
}
