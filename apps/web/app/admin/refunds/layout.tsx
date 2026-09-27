import { requirePagePermission } from "../../lib/auth-guard";

// 환불 신청 검토는 '구독 관리' 권한 (돈이 나가는 화면)
export default async function SectionLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission("subscriptions");
  return children;
}
