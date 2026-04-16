import DeliveryClient from "./DeliveryClient";

export const dynamic = "force-dynamic";

function todayKst(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export default function DeliveryPage() {
  return <DeliveryClient initialDate={todayKst()} initialReport={null} />;
}
