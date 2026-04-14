import Sidebar from "./components/Sidebar";
import AdminHeader from "./components/AdminHeader";

// 인증은 middleware.ts에서 처리 (쿠키 확인)
// ADMIN role 검증은 각 API의 requireAdmin()에서 처리
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex print:block">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen bg-gray-100 print:bg-white print:min-h-0">
        <AdminHeader />
        <main className="flex-1 p-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
