/**
 * 배송 확인 페이지 — 알림톡 '배송 확인' 버튼이 여는 곳.
 *
 * 로그인 없이 열린다. 주소로 쓰는 토큰은 배송 건마다 발급된 난수라
 * 링크를 받은 사람만 볼 수 있지만, 그래도 배송지 전체 주소처럼
 * 링크가 새면 곤란한 정보는 가려서 보여준다.
 */
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";

export const dynamic = "force-dynamic";

// 링크가 카카오톡·메신저로 돌아다니므로 검색엔진에는 올리지 않는다
export const metadata: Metadata = {
  title: "배송 확인",
  robots: { index: false, follow: false },
};

/** "대구광역시 달서구 성서공단로 332-10 3층 301호" → "대구광역시 달서구 성서공단로 ***" */
function maskAddress(address: string | null, detail: string | null): string {
  const full = [address, detail].filter(Boolean).join(" ").trim();
  if (!full) return "등록된 배송지";
  const parts = full.split(/\s+/);
  if (parts.length <= 3) return full;
  return `${parts.slice(0, 3).join(" ")} ***`;
}

function formatKst(d: Date | null): string {
  if (!d) return "-";
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const mm = kst.getUTCMonth() + 1;
  const dd = kst.getUTCDate();
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mi = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${mm}월 ${dd}일 ${hh}:${mi}`;
}

export default async function DeliveryConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const delivery = await prisma.delivery.findUnique({
    where: { publicToken: token },
    select: {
      status: true,
      photoUrl: true,
      memo: true,
      completedAt: true,
      scheduledDate: true,
      order: {
        select: {
          orderNo: true,
          user: { select: { name: true } },
          address: { select: { address1: true, address2: true } },
          items: {
            select: { quantity: true, product: { select: { name: true } } },
            orderBy: { id: "asc" },
          },
        },
      },
    },
  });

  if (!delivery) notFound();

  const { order } = delivery;
  const done = delivery.status === "DELIVERED";

  return (
    <main className="min-h-screen bg-brand-light px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-lg font-bold text-brand-dark">
          W2O SALADA
        </Link>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="bg-brand-primary px-5 py-6 text-white">
            <p className="text-sm opacity-90">{order.user.name}님</p>
            <h1 className="mt-1 text-xl font-bold">
              {done ? "문 앞으로 배송해 드렸습니다" : "배송을 준비하고 있습니다"}
            </h1>
            <p className="mt-2 text-sm opacity-90">
              {done ? `배송 완료 · ${formatKst(delivery.completedAt)}` : "도착하면 사진과 함께 알려드릴게요"}
            </p>
          </div>

          {delivery.photoUrl ? (
            <div className="relative aspect-[4/3] w-full bg-gray-100">
              <Image
                src={delivery.photoUrl}
                alt="문 앞에 놓인 배송 상품 사진"
                fill
                sizes="(max-width: 448px) 100vw, 448px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center bg-gray-100 text-sm text-gray-500">
              {done ? "배송 사진이 등록되지 않았습니다" : "배송 후 사진이 올라옵니다"}
            </div>
          )}

          <dl className="divide-y divide-gray-100 px-5 text-sm">
            <div className="flex justify-between gap-4 py-3">
              <dt className="shrink-0 text-gray-500">주문번호</dt>
              <dd className="text-right font-medium text-brand-dark">{order.orderNo}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="shrink-0 text-gray-500">배송지</dt>
              <dd className="text-right text-brand-dark">
                {maskAddress(order.address?.address1 ?? null, order.address?.address2 ?? null)}
              </dd>
            </div>
            <div className="py-3">
              <dt className="mb-2 text-gray-500">배송 상품</dt>
              <dd className="space-y-1">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between gap-4 text-brand-dark">
                    <span>{item.product.name}</span>
                    <span className="shrink-0 text-gray-500">{item.quantity}개</span>
                  </div>
                ))}
              </dd>
            </div>
            {delivery.memo && (
              <div className="py-3">
                <dt className="mb-1 text-gray-500">배송 메모</dt>
                <dd className="text-brand-dark">{delivery.memo}</dd>
              </div>
            )}
          </dl>

          <div className="border-t border-gray-100 px-5 py-4">
            <Link
              href="/menu"
              className="block rounded-xl bg-brand-primary py-3 text-center text-sm font-semibold text-white"
            >
              다음 배송 메뉴 보기
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-gray-500">
          상품에 문제가 있으면 고객센터로 알려주세요.
          <br />
          053-721-7794 (08:00 ~ 22:00)
        </p>
      </div>
    </main>
  );
}
