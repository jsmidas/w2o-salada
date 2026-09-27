import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "../../auth";

export const metadata: Metadata = {
  title: "배송 기사",
  robots: { index: false, follow: false },
};

/**
 * 배송 기사 전용 영역 — DRIVER 만 들어온다 (ADMIN 은 점검용으로 허용).
 * 고객용 헤더·독·푸터 없이 기사 화면만 보여 준다.
 */
export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;

  if (!user) redirect("/login");
  if (user.role !== "DRIVER" && user.role !== "ADMIN") redirect("/");

  return <div className="min-h-screen bg-[#f3f7f4] text-[#0A1A0F]">{children}</div>;
}
