"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

// ── 타입 ──

type DaySummary = {
  date: string;
  orderCount: number;
  totalRevenue: number;
  mainRevenue: number;
  optionRevenue: number;
  totalItems: number;
  productKinds: number;
  singleCount: number;
  subscriptionCount: number;
};

type DailyResponse = {
  days: DaySummary[];
  totals: {
    orderCount: number;
    totalRevenue: number;
    mainRevenue: number;
    optionRevenue: number;
    totalItems: number;
  };
};

type ProductAgg = {
  productId: string;
  name: string;
  categoryName: string;
  categorySlug: string;
  isOption: boolean;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
};

type CategoryAgg = {
  slug: string;
  name: string;
  isOption: boolean;
  quantity: number;
  totalAmount: number;
};

type DateDetail = {
  date: string;
  totals: {
    orderCount: number;
    totalRevenue: number;
    mainRevenue: number;
    optionRevenue: number;
    totalItems: number;
    productKinds: number;
    singleCount: number;
    subscriptionCount: number;
  };
  statusCounts: Record<string, number>;
  categories: CategoryAgg[];
  products: ProductAgg[];
};

// ── 유틸 ──

function won(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const day = days[d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} (${day})`;
}

function toInputDate(d: Date) {
  return d.toISOString().split("T")[0] as string;
}

const statusLabels: Record<string, string> = {
  PAID: "결제완료",
  PREPARING: "준비중",
  SHIPPING: "배송중",
  DELIVERED: "배송완료",
};

const statusColors: Record<string, string> = {
  PAID: "bg-blue-100 text-blue-700",
  PREPARING: "bg-amber-100 text-amber-700",
  SHIPPING: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
};

// ── 컴포넌트 ──

export default function StatsClient() {
  // 기본 범위: 2주
  const today = new Date();
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(today.getDate() - 13);

  const [from, setFrom] = useState(toInputDate(twoWeeksAgo));
  const [to, setTo] = useState(toInputDate(today));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data, isLoading } = useSWR<DailyResponse>(
    `/api/admin/stats/daily?from=${from}&to=${to}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: detail, isLoading: detailLoading } = useSWR<DateDetail>(
    selectedDate ? `/api/admin/stats/daily?date=${selectedDate}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const days = data?.days ?? [];
  const totals = data?.totals;

  // 차트용 최대값
  const maxRevenue = Math.max(...days.map((d) => d.totalRevenue), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">일자별 매출 · 생산 현황</h2>
      </div>

      {/* 기간 필터 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">조회 기간</label>
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setSelectedDate(null); }}
              className="border rounded-lg px-3 py-1.5 text-sm"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setSelectedDate(null); }}
              className="border rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          {/* 빠른 선택 */}
          <div className="flex gap-1.5">
            {[
              { label: "1주", d: 6 },
              { label: "2주", d: 13 },
              { label: "1개월", d: 29 },
              { label: "3개월", d: 89 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  const end = new Date();
                  const start = new Date(end);
                  start.setDate(end.getDate() - preset.d);
                  setFrom(toInputDate(start));
                  setTo(toInputDate(end));
                  setSelectedDate(null);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border hover:bg-gray-50 transition text-gray-600"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 기간 합산 카드 */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            icon="payments"
            label="총 매출"
            value={won(totals.totalRevenue)}
            color="bg-green-500"
          />
          <SummaryCard
            icon="restaurant"
            label="본품 매출"
            value={won(totals.mainRevenue)}
            sub={`옵션: ${won(totals.optionRevenue)}`}
            color="bg-blue-500"
          />
          <SummaryCard
            icon="receipt_long"
            label="총 주문"
            value={`${totals.orderCount}건`}
            color="bg-purple-500"
          />
          <SummaryCard
            icon="inventory_2"
            label="총 제품 수량"
            value={`${totals.totalItems.toLocaleString()}개`}
            color="bg-amber-500"
          />
        </div>
      )}

      {isLoading ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border text-center text-gray-400">
          <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
          <p className="mt-2 text-sm">데이터를 불러오는 중...</p>
        </div>
      ) : days.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border text-center text-gray-400">
          <span className="material-symbols-outlined text-5xl">bar_chart</span>
          <p className="mt-2 text-sm">해당 기간에 배송 데이터가 없습니다.</p>
        </div>
      ) : (
        <>
          {/* 일별 매출 바 차트 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border mb-6">
            <h3 className="font-bold text-gray-700 mb-4">일별 매출 추이 (배송일 기준)</h3>
            <div className="overflow-x-auto">
              <div className="flex items-end gap-1 min-w-fit" style={{ height: 200 }}>
                {days.map((d) => {
                  const h = Math.max((d.totalRevenue / maxRevenue) * 180, 4);
                  const isSelected = selectedDate === d.date;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => setSelectedDate(isSelected ? null : d.date)}
                      className={`flex flex-col items-center justify-end group transition ${
                        isSelected ? "opacity-100" : "opacity-80 hover:opacity-100"
                      }`}
                      style={{ minWidth: days.length > 20 ? 32 : 48 }}
                      title={`${d.date}: ${won(d.totalRevenue)}`}
                    >
                      {/* 금액 레이블 */}
                      <span className="text-[10px] text-gray-400 mb-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition">
                        {(d.totalRevenue / 10000).toFixed(d.totalRevenue >= 100000 ? 0 : 1)}만
                      </span>
                      {/* 바 */}
                      <div
                        className={`w-full rounded-t transition-all ${
                          isSelected
                            ? "bg-[#1D9E75]"
                            : "bg-[#1D9E75]/40 group-hover:bg-[#1D9E75]/70"
                        }`}
                        style={{ height: h, minWidth: days.length > 20 ? 20 : 28 }}
                      />
                      {/* 날짜 */}
                      <span
                        className={`text-[10px] mt-1 whitespace-nowrap ${
                          isSelected ? "text-[#1D9E75] font-bold" : "text-gray-400"
                        }`}
                      >
                        {formatDate(d.date).split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 일별 매출 테이블 */}
          <div className="bg-white rounded-xl shadow-sm border mb-6 overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="font-bold text-gray-700">일자별 매출 상세</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">배송일</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">주문 건수</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">단건</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">구독</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">본품 매출</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">옵션 매출</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 bg-green-50">총 매출</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">생산 수량</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">품목 수</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500"></th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => {
                    const isSelected = selectedDate === d.date;
                    return (
                      <tr
                        key={d.date}
                        className={`border-b last:border-0 transition cursor-pointer ${
                          isSelected ? "bg-green-50" : "hover:bg-gray-50"
                        }`}
                        onClick={() => setSelectedDate(isSelected ? null : d.date)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">
                          {formatDate(d.date)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right font-medium">
                          {d.orderCount}건
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 text-right">{d.singleCount}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 text-right">{d.subscriptionCount}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {won(d.mainRevenue)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 text-right">
                          {won(d.optionRevenue)}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-green-700 text-right bg-green-50/50">
                          {won(d.totalRevenue)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {d.totalItems.toLocaleString()}개
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 text-right">{d.productKinds}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`material-symbols-outlined text-lg transition ${
                              isSelected ? "text-[#1D9E75] rotate-180" : "text-gray-300"
                            }`}
                          >
                            expand_more
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* 합계 행 */}
                {totals && (
                  <tfoot className="bg-gray-50 border-t-2">
                    <tr>
                      <td className="px-4 py-3 text-sm font-bold text-gray-700">합계</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-700 text-right">
                        {totals.orderCount}건
                      </td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-sm font-bold text-gray-700 text-right">
                        {won(totals.mainRevenue)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-700 text-right">
                        {won(totals.optionRevenue)}
                      </td>
                      <td className="px-4 py-3 text-sm font-black text-green-700 text-right bg-green-50/50">
                        {won(totals.totalRevenue)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-700 text-right">
                        {totals.totalItems.toLocaleString()}개
                      </td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {/* 특정 날짜 상세 패널 */}
      {selectedDate && (
        <DateDetailPanel
          date={selectedDate}
          detail={detail ?? null}
          loading={detailLoading}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

// ── 서브 컴포넌트 ──

function SummaryCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`${color} w-11 h-11 rounded-xl flex items-center justify-center`}>
          <span className="material-symbols-outlined text-white text-xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}

function DateDetailPanel({
  date,
  detail,
  loading,
  onClose,
}: {
  date: string;
  detail: DateDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="px-6 py-4 border-b flex items-center justify-between bg-[#1D9E75]/5">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#1D9E75]">calendar_today</span>
          <h3 className="font-bold text-gray-800">
            {formatDate(date)} 상세 현황
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-400">
          <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
          <p className="mt-2 text-sm">상세 데이터를 불러오는 중...</p>
        </div>
      ) : !detail ? (
        <div className="p-12 text-center text-gray-400 text-sm">데이터가 없습니다.</div>
      ) : (
        <div className="p-6">
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <MiniCard label="총 매출" value={won(detail.totals.totalRevenue)} accent />
            <MiniCard label="주문 건수" value={`${detail.totals.orderCount}건`} />
            <MiniCard
              label="단건 / 구독"
              value={`${detail.totals.singleCount} / ${detail.totals.subscriptionCount}`}
            />
            <MiniCard label="생산 수량" value={`${detail.totals.totalItems}개 (${detail.totals.productKinds}품목)`} />
          </div>

          {/* 주문 상태 */}
          {Object.keys(detail.statusCounts).length > 0 && (
            <div className="flex gap-2 mb-6 flex-wrap">
              {Object.entries(detail.statusCounts).map(([status, count]) => (
                <span
                  key={status}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    statusColors[status] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {statusLabels[status] ?? status} {count}건
                </span>
              ))}
            </div>
          )}

          {/* 카테고리별 소계 */}
          {detail.categories.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">category</span>
                카테고리별 소계
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {detail.categories.map((cat) => (
                  <div
                    key={cat.slug}
                    className={`rounded-lg p-3 border ${cat.isOption ? "bg-gray-50" : "bg-white"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                      {cat.isOption && (
                        <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                          옵션
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-bold text-gray-800">{cat.quantity}개</p>
                    <p className="text-xs text-gray-400">{won(cat.totalAmount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 상품별 생산 수량 */}
          {detail.products.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">inventory_2</span>
                상품별 생산 · 배송 수량
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">상품명</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">카테고리</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">단가</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 bg-amber-50">수량</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">소계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.products.map((p) => (
                      <tr key={p.productId} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-sm text-gray-800">
                          <div className="flex items-center gap-1.5">
                            {p.name}
                            {p.isOption && (
                              <span className="text-[10px] bg-gray-200 text-gray-500 px-1 py-0.5 rounded">
                                옵션
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-500">{p.categoryName}</td>
                        <td className="px-3 py-2.5 text-sm text-gray-500 text-right">
                          {won(p.unitPrice)}
                        </td>
                        <td className="px-3 py-2.5 text-sm font-bold text-amber-700 text-right bg-amber-50/50">
                          {p.quantity}개
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-700 text-right font-medium">
                          {won(p.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t">
                    <tr>
                      <td colSpan={3} className="px-3 py-2.5 text-sm font-bold text-gray-600">합계</td>
                      <td className="px-3 py-2.5 text-sm font-bold text-amber-700 text-right bg-amber-50/50">
                        {detail.totals.totalItems}개
                      </td>
                      <td className="px-3 py-2.5 text-sm font-bold text-gray-700 text-right">
                        {won(detail.totals.totalRevenue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-lg p-3 border ${accent ? "bg-green-50 border-green-200" : "bg-gray-50"}`}>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${accent ? "text-green-700" : "text-gray-800"}`}>{value}</p>
    </div>
  );
}
