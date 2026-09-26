"use client";

/** 비밀번호 입력칸 오른쪽의 보기/숨기기 아이콘 버튼 (부모는 relative, input은 pr-12) */
export default function PasswordToggle({
  shown,
  onToggle,
}: {
  shown: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "비밀번호 숨기기" : "비밀번호 보기"}
      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition"
    >
      <span className="material-symbols-outlined text-[20px]">
        {shown ? "visibility_off" : "visibility"}
      </span>
    </button>
  );
}
