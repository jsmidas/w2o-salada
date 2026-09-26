"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

type ProductRow = {
  productId: string;
  name: string;
  categoryName: string;
  categorySlug: string;
  categoryColor: string | null;
  isOption: boolean;
  subscriptionQty: number;
  orderQty: number;
  confirmedQty: number;
  pendingQty: number;
  qty: number;
};

type CategoryRow = {
  slug: string;
  name: string;
  color: string | null;
  isOption: boolean;
  qty: number;
  confirmedQty: number;
  pendingQty: number;
  productCount: number;
};

type Report = {
  date: string;
  summary: {
    totalQty: number;
    confirmedQty: number;
    pendingQty: number;
    productCount: number;
    subscriptionQty: number;
    orderQty: number;
    subscriberCount: number;
    orderCount: number;
  };
  categories: CategoryRow[];
  products: ProductRow[];
};

type CalendarEntry = { date: string; isActive: boolean };

const FALLBACK_COLOR = "#6b7280";

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatKorean(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${weekday})`;
}

export default function ProductionClient({ initialDate }: { initialDate: string }) {
  const [date, setDate] = useState(initialDate);
  // 결제 전(PENDING) 물량까지 합쳐 볼지. 기본은 확정 물량만 — 주방은 확정분으로 움직인다.
  const [includePending, setIncludePending] = useState(false);

  const { data, isLoading } = useSWR<Report>(
    `/api/admin/production?date=${date}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  // 같은 달 배송일을 빠른 이동 칩으로 제공
  const [calendar, setCalendar] = useState<CalendarEntry[]>([]);
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  useEffect(() => {
    fetch(`/api/admin/delivery-calendar?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => setCalendar(Array.isArray(d) ? d : []))
      .catch(() => setCalendar([]));
  }, [year, month]);

  const deliveryDays = useMemo(
    () =>
      calendar
        .filter((c) => c.isActive)
        .map((c) => new Date(c.date).toISOString().slice(0, 10))
        .sort(),
    [calendar],
  );

  // 표시 기준 수량 — 확정만 볼지, 대기까지 합쳐 볼지
  const pick = useCallback(
    (row: { qty: number; confirmedQty: number }) => (includePending ? row.qty : row.confirmedQty),
    [includePending],
  );

  const products = useMemo(() => {
    if (!data) return [];
    return data.products.filter((p) => pick(p) > 0);
  }, [data, pick]);

  const categories = useMemo(() => {
    if (!data) return [];
    return data.categories.filter((c) => pick(c) > 0);
  }, [data, pick]);

  const shownTotal = products.reduce((s, p) => s + pick(p), 0);
  const mainTotal = products.filter((p) => !p.isOption).reduce((s, p) => s + pick(p), 0);
  const optionTotal = shownTotal - mainTotal;

  return (
    <div className="max-w-[1100px]">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-4 print:mb-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">생산 집계</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            배송일 기준으로 만들어야 할 상품과 수량 — 구독 선택분과 단건 주문을 합산합니다
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition text-sm font-medium print:hidden"
        >
          <span className="material-symbols-outlined text-lg">print</span>
          작업지시서 출력
        </button>
      </div>

      {/* 날짜 선택 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border mb-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setDate(shiftDate(date, -1))}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition"
            aria-label="전날"
          >
            <span className="material-symbols-outlined text-lg">chevron_left</span>
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]"
          />
          <button
            onClick={() => setDate(shiftDate(date, 1))}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition"
            aria-label="다음날"
          >
            <span className="material-symbols-outlined text-lg">chevron_right</span>
          </button>

          <label className="ml-auto flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={includePending}
              onChange={(e) => setIncludePending(e.target.checked)}
              className="w-4 h-4 accent-[#1D9E75]"
            />
            미결제 물량 포함
            {data && data.summary.pendingQty > 0 && (
              <span className="text-xs text-[#EF9F27] font-semibold">
                (+{data.summary.pendingQty}개)
              </span>
            )}
          </label>
        </div>

        {/* 이 달 배송일 빠른 이동 */}
        {deliveryDays.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-400 self-center mr-1">{month}월 배송일</span>
            {deliveryDays.map((d) => (
              <button
                key={d}
                onClick={() => setDate(d)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  d === date
                    ? "bg-[#1D9E75] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {Number(d.slice(8, 10))}일
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 출력용 제목 */}
      <div className="hidden print:block mb-3">
        <h1 className="text-xl font-bold">
          {formatKorean(date)} 생산 작업지시서
        </h1>
        <p className="text-xs text-gray-500">
          {includePending ? "미결제 물량 포함" : "확정 물량"} · 총 {shownTotal}개
        </p>
      </div>

      {isLoading && !data ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400 text-sm">
          불러오는 중...
        </div>
      ) : shownTotal === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-gray-200 mb-2 block">
            production_quantity_limits
          </span>
          <p className="text-gray-500 font-medium">{formatKorean(date)}에 생산할 물량이 없습니다</p>
          {data && data.summary.pendingQty > 0 && !includePending && (
            <p className="text-xs text-[#EF9F27] mt-2">
              결제 대기 중인 물량이 {data.summary.pendingQty}개 있습니다 — 위의 &quot;미결제 물량 포함&quot;을 켜면 보입니다
            </p>
          )}
          {deliveryDays.length > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              이 달 배송일: {deliveryDays.map((d) => `${Number(d.slice(8, 10))}일`).join(", ")}
            </p>
          )}
        </div>
      ) : (
        <>
          {/* 요약 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: "총 생산 수량", value: `${shownTotal}개`, sub: `${products.length}종`, accent: true },
              { label: "본품", value: `${mainTotal}개`, sub: "샐러드·간편식·반찬 등" },
              { label: "옵션", value: `${optionTotal}개`, sub: "음료 등 최소액 제외" },
              {
                label: "구독 / 단건",
                value: data ? `${data.summary.subscriptionQty} / ${data.summary.orderQty}` : "-",
                sub: data ? `구독자 ${data.summary.subscriberCount}명 · 주문 ${data.summary.orderCount}건` : "",
              },
            ].map((c) => (
              <div
                key={c.label}
                className={`bg-white rounded-xl border p-4 ${c.accent ? "border-[#1D9E75]/30 bg-[#1D9E75]/5" : ""}`}
              >
                <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                <p className={`text-2xl font-black ${c.accent ? "text-[#1D9E75]" : "text-gray-800"}`}>
                  {c.value}
                </p>
                {c.sub && <p className="text-[11px] text-gray-400 mt-0.5">{c.sub}</p>}
              </div>
            ))}
          </div>

          {/* 카테고리별 소계 */}
          <div className="bg-white rounded-xl border overflow-hidden mb-4">
            <div className="px-4 py-2.5 bg-gray-50 border-b">
              <h3 className="text-sm font-bold text-gray-700">카테고리별 소계</h3>
            </div>
            <div className="flex flex-wrap gap-2 p-4">
              {categories.map((c) => (
                <div
                  key={c.slug}
                  className="px-3 py-2 rounded-lg border min-w-[120px]"
                  style={{
                    backgroundColor: `${c.color || FALLBACK_COLOR}12`,
                    borderColor: `${c.color || FALLBACK_COLOR}30`,
                  }}
                >
                  <p className="text-[11px] font-bold" style={{ color: c.color || FALLBACK_COLOR }}>
                    {c.name}
                    {c.isOption && <span className="text-gray-400 font-medium"> (옵션)</span>}
                  </p>
                  <p className="text-xl font-black text-gray-800">
                    {pick(c)}
                    <span className="text-xs font-medium text-gray-400 ml-0.5">개</span>
                  </p>
                  <p className="text-[10px] text-gray-400">{c.productCount}종</p>
                </div>
              ))}
            </div>
          </div>

          {/* 상품별 생산 수량 */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700">
                상품별 생산 수량 ({products.length}종)
              </h3>
              <span className="text-xs text-gray-400">
                {includePending ? "미결제 포함" : "확정 물량만"}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50 border-b text-xs text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">카테고리</th>
                  <th className="text-left px-4 py-2 font-semibold">상품명</th>
                  <th className="text-right px-4 py-2 font-semibold">구독</th>
                  <th className="text-right px-4 py-2 font-semibold">단건</th>
                  <th className="text-right px-4 py-2 font-semibold w-24">생산 수량</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => {
                  const prev = products[i - 1];
                  const newGroup = !prev || prev.categorySlug !== p.categorySlug;
                  return (
                    <tr
                      key={p.productId}
                      className={`border-b last:border-0 ${newGroup ? "border-t-2 border-t-gray-100" : ""}`}
                    >
                      <td className="px-4 py-2.5">
                        {newGroup && (
                          <span
                            className="text-xs font-bold"
                            style={{ color: p.categoryColor || FALLBACK_COLOR }}
                          >
                            {p.categoryName}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {p.name}
                        {p.pendingQty > 0 && !includePending && (
                          <span className="ml-2 text-[10px] text-[#EF9F27]">
                            대기 {p.pendingQty}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500">
                        {p.subscriptionQty || "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500">
                        {p.orderQty || "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-lg font-black text-gray-900">{pick(p)}</span>
                        <span className="text-xs text-gray-400 ml-0.5">개</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold text-gray-600">
                    합계
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xl font-black text-[#1D9E75]">{shownTotal}</span>
                    <span className="text-xs text-gray-400 ml-0.5">개</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
