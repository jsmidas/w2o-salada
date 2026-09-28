"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

type OrderItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product: { name: string; imageUrl: string | null };
};

type Order = {
  id: string;
  orderNo: string;
  status: string;
  totalAmount: number;
  deliveryFee: number;
  createdAt: string;
  paidAt: string | null;
  deliveredAt: string | null;
  items: OrderItem[];
};

const statusLabels: Record<string, string> = {
  PENDING: "결제 대기",
  PAID: "결제 완료",
  PREPARING: "준비 중",
  SHIPPING: "배송 중",
  DELIVERED: "배송 완료",
  CANCELLED: "주문 취소",
  REFUNDED: "환불 완료",
  FAILED: "결제 실패",
};

const statusColors: Record<string, string> = {
  PENDING: "text-gray-400",
  PAID: "text-blue-400",
  PREPARING: "text-amber-400",
  SHIPPING: "text-purple-400",
  DELIVERED: "text-brand-green",
  CANCELLED: "text-red-400",
  REFUNDED: "text-gray-400",
  FAILED: "text-red-400",
};

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?redirect=/mypage/orders");
      return;
    }
    if (status !== "authenticated") return;

    fetch("/api/orders")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router]);

  if (status === "loading" || !session) return null;

  return (
    <div className="min-h-screen bg-brand-dark">
      <header className="sticky top-0 z-50 bg-brand-deep/95 backdrop-blur border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/mypage"
            className="flex items-center gap-1 text-gray-400 hover:text-white transition"
          >
            <span className="material-symbols-outlined text-xl">chevron_left</span>
            <span className="text-sm">마이페이지</span>
          </Link>
          <h1 className="text-white font-bold">주문 내역</h1>
          <div className="w-20" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-gray-400 text-center py-12">로딩 중...</p>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-white/10 block mb-3">
              receipt_long
            </span>
            <p className="text-gray-500 mb-4">아직 주문 내역이 없습니다.</p>
            <Link
              href="/#weekly-menu"
              className="inline-block px-6 py-2.5 bg-brand-green text-white rounded-full font-semibold text-sm hover:bg-brand-mint transition"
            >
              메뉴 보러가기
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white/5 rounded-xl p-5 border border-white/10">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-gray-500 text-xs">{order.orderNo}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      statusColors[order.status] ?? "text-gray-400"
                    }`}
                  >
                    {statusLabels[order.status] ?? order.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {item.product.imageUrl ? (
                          <Image
                            src={item.product.imageUrl}
                            alt=""
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-white/10 text-lg">
                            lunch_dining
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm">{item.product.name}</p>
                        <p className="text-gray-500 text-xs">수량: {item.quantity}</p>
                      </div>
                      <p className="text-gray-300 text-sm">
                        {item.totalPrice.toLocaleString()}원
                      </p>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                  <span className="text-gray-500 text-sm">
                    총 {order.items.reduce((s, i) => s + i.quantity, 0)}개
                  </span>
                  <span className="text-brand-amber font-bold">
                    {order.totalAmount.toLocaleString()}원
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
