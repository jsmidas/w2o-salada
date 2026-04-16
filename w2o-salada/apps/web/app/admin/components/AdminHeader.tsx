export default function AdminHeader({ name }: { name: string | null }) {
  const initial = name?.charAt(0) ?? "A";
  const displayName = name ?? "관리자";

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6 print:hidden">
      <div>
        <h1 className="text-lg font-bold text-gray-800">관리자</h1>
      </div>
      <div className="flex items-center gap-4">
        <button type="button" className="text-gray-400 hover:text-gray-600">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1D9E75] rounded-full flex items-center justify-center text-white text-sm font-bold">
            {initial}
          </div>
          <span className="text-sm text-gray-600">{displayName}</span>
        </div>
      </div>
    </header>
  );
}
