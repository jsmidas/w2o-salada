import { redirect } from "next/navigation";
import { auth } from "../../auth";
import Sidebar from "./components/Sidebar";
import AdminHeader from "./components/AdminHeader";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user as
    | { id?: string; name?: string | null; email?: string | null; role?: string; permissions?: string | null }
    | undefined;

  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="flex print:block">
      <Sidebar
        name={user.name ?? null}
        email={user.email ?? null}
        permissions={user.permissions ?? null}
      />
      <div className="flex-1 flex flex-col min-h-screen bg-gray-100 print:bg-white print:min-h-0">
        <AdminHeader name={user.name ?? null} />
        <main className="flex-1 p-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
