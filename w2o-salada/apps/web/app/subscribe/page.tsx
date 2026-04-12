import { prisma } from "@repo/db";
import SubscribeClient from "./SubscribeClient";

// 서버에서 데이터를 프리페치하여 클라이언트 컴포넌트에 전달
// → API 워터폴 제거, 초기 로딩 대폭 단축
export default async function SubscribePage() {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const startDate = new Date(curYear, curMonth - 1, 1);
  const endDate = new Date(curYear, curMonth + 1, 0, 23, 59, 59);

  const [calendarData, settingsData] = await Promise.all([
    prisma.deliveryCalendar.findMany({
      where: { date: { gte: startDate, lte: endDate }, isActive: true },
      include: {
        menuAssignments: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                description: true,
                originalPrice: true,
                price: true,
                kcal: true,
                tags: true,
                imageUrl: true,
                category: { select: { name: true, slug: true, isOption: true } },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { date: "asc" },
    }).catch(() => []),
    prisma.setting.findMany({
      where: {
        key: { in: ["subscribe.minItems", "subscribe.maxItems", "subscribe.trial.price"] },
      },
    }).catch(() => []),
  ]);

  const settingsMap: Record<string, string> = {};
  for (const s of settingsData) {
    settingsMap[s.key] = s.value;
  }

  const initialData = {
    calendar: JSON.parse(JSON.stringify(calendarData)),
    config: {
      minItems: parseInt(settingsMap["subscribe.minItems"] || "2"),
      maxItems: parseInt(settingsMap["subscribe.maxItems"] || "5"),
      trialPrice: parseInt(settingsMap["subscribe.trial.price"] || "6900"),
    },
  };

  return <SubscribeClient initialData={initialData} />;
}
