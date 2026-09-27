import { requirePagePermission } from "../../lib/auth-guard";

// 이 섹션의 모든 페이지는 'orders' 권한이 있어야 열린다 (API 와 같은 기준)
export default async function SectionLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission("orders");
  return children;
}
