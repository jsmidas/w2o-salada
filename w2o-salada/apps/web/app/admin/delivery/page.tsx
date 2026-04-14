"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

type ReportTotals = {
  orderCount: number;
  totalBoxes: number;
  totalRevenue: number;
  mainRevenue: number;
  optionRevenue: number;
  productKinds: number;
  assignedCount: number;
  unassignedCount: number;
};

type ReportProduct = {
  productId: string;
  name: string;
  categoryName: string;
  categorySlug: string;
  isOption: boolean;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
};

type ReportCategory = {
  slug: string;
  name: string;
  isOption: boolean;
  quantity: number;
  totalAmount: number;
};

type ReportOrderItem = {
  productId: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  isOption: boolean;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type ReportOrder = {
  id: string;
  orderNo: string;
  type: "SINGLE" | "SUBSCRIPTION";
  status: string;
  totalAmount: number;
  customer: { id: string; name: string; phone: string };
  address: {
    receiver: string;
    phone: string;
    zipCode: string;
    address1: string;
    address2: string;
    memo: string;
  } | null;
  items: ReportOrderItem[];
  delivery: {
    id: string;
    routeLabel: string;
    sortOrder: number;
    status: string;
  } | null;
};

type ReportRoute = {
  label: string | null;
  orderCount: number;
  totalAmount: number;
  orders: ReportOrder[];
};

type Report = {
  date: string;
  totals: ReportTotals;
  categories: ReportCategory[];
  products: ReportProduct[];
  routes: ReportRoute[];
  orders: ReportOrder[];
};

const statusLabels: Record<string, string> = {
  PAID: "결제완료",
  PREPARING: "준비중",
  SHIPPING: "배송중",
  DELIVERED: "배송완료",
};

function fmt(n: number) {
  return n.toLocaleString();
}

function todayKst(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export default function DeliveryReportPage() {
  const [date, setDate] = useState<string>(todayKst);
  const [drafts, setDrafts] = useState<Record<string, { routeLabel: string; sortOrder: number }>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const apiUrl = `/api/admin/delivery/report?date=${date}`;
  const { data, isLoading, mutate } = useSWR<Report>(apiUrl, fetcher, { revalidateOnFocus: false });

  // 편집 중 draft 병합
  const mergedOrders = useMemo(() => {
    if (!data) return [] as ReportOrder[];
    return data.orders.map((o) => {
      const draft = o.delivery ? drafts[o.delivery.id] : undefined;
      if (!draft || !o.delivery) return o;
      return {
        ...o,
        delivery: {
          ...o.delivery,
          routeLabel: draft.routeLabel,
          sortOrder: draft.sortOrder,
        },
      };
    });
  }, [data, drafts]);

  // 편집 반영 후 코스별 재그룹
  const mergedRoutes = useMemo(() => {
    const map = new Map<string, ReportOrder[]>();
    for (const o of mergedOrders) {
      const label = o.delivery?.routeLabel?.trim() || "";
      const list = map.get(label) ?? [];
      list.push(o);
      map.set(label, list);
    }
    return Array.from(map.entries())
      .map(([label, orders]) => ({
        label: label || null,
        orderCount: orders.length,
        totalAmount: orders.reduce((s, o) => s + o.totalAmount, 0),
        orders: orders.sort(
          (a, b) => (a.delivery?.sortOrder ?? 0) - (b.delivery?.sortOrder ?? 0)
        ),
      }))
      .sort((a, b) => {
        if (!a.label) return 1;
        if (!b.label) return -1;
        return a.label.localeCompare(b.label);
      });
  }, [mergedOrders]);

  const updateDraft = (deliveryId: string, patch: Partial<{ routeLabel: string; sortOrder: number }>) => {
    setDrafts((prev) => {
      const base = prev[deliveryId] ?? {
        routeLabel:
          data?.orders.find((o) => o.delivery?.id === deliveryId)?.delivery?.routeLabel ?? "",
        sortOrder:
          data?.orders.find((o) => o.delivery?.id === deliveryId)?.delivery?.sortOrder ?? 0,
      };
      return { ...prev, [deliveryId]: { ...base, ...patch } };
    });
  };

  const assignToRoute = (deliveryId: string, label: string) => {
    const current = data?.routes.find((r) => (r.label ?? "") === label);
    const nextSort = (current?.orders.length ?? 0) + 1;
    updateDraft(deliveryId, { routeLabel: label, sortOrder: nextSort });
  };

  const hasChanges = Object.keys(drafts).length > 0;

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const assignments = Object.entries(drafts).map(([deliveryId, d]) => ({
        deliveryId,
        routeLabel: d.routeLabel.trim() || null,
        sortOrder: d.sortOrder,
      }));
      const res = await fetch("/api/admin/delivery/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDrafts({});
      await mutate();
      setToast("코스 배정이 저장되었습니다");
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      console.error(err);
      setToast("저장 실패 — 콘솔을 확인하세요");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handlePrintAll = () => {
    window.open(`/admin/delivery/print?date=${date}`, "_blank");
  };
  const handlePrintCourse = (label: string | null) => {
    const q = new URLSearchParams({ date });
    if (label) q.set("course", label);
    window.open(`/admin/delivery/print?${q}`, "_blank");
  };

  const totals = data?.totals;
  const existingCourseLabels = useMemo(() => {
    const set = new Set<string>();
    for (const r of mergedRoutes) if (r.label) set.add(r.label);
    return Array.from(set).sort();
  }, [mergedRoutes]);

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">배송 운영 리포트</h2>
          <p className="text-sm text-gray-400 mt-1">
            선택한 배송일 기준 생산·피킹·코스 편성·기사 출력본
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="배송 날짜 선택"
            title="배송 날짜"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setDrafts({});
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <button
            type="button"
            onClick={() => mutate()}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50 inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            새로고침
          </button>
          <button
            type="button"
            onClick={handlePrintAll}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50 inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-base">print</span>
            전체 인쇄
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="px-4 py-2 bg-[#1D9E75] text-white text-sm font-bold rounded-lg hover:bg-[#178a64] transition disabled:opacity-40"
          >
            {saving ? "저장 중..." : hasChanges ? `코스 저장 (${Object.keys(drafts).length})` : "저장할 변경 없음"}
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-4 px-4 py-2 bg-[#1D9E75]/10 text-[#1D9E75] text-sm rounded-lg border border-[#1D9E75]/20">
          {toast}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20">
          <div className="inline-block w-6 h-6 border-2 border-[#1D9E75] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data || data.orders.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border text-center">
          <span className="material-symbols-outlined text-5xl text-gray-200 block mb-3">inbox</span>
          <p className="text-gray-400">해당 날짜에 배송 대상 주문이 없습니다.</p>
        </div>
      ) : (
        <>
          {/* 상단 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <SummaryCard label="배송 박스" value={`${totals?.totalBoxes ?? 0}개`} icon="package_2" />
            <SummaryCard
              label="총 매출"
              value={`${fmt(totals?.totalRevenue ?? 0)}원`}
              icon="payments"
            />
            <SummaryCard
              label="본품 매출"
              value={`${fmt(totals?.mainRevenue ?? 0)}원`}
              icon="restaurant"
              accent="green"
            />
            <SummaryCard
              label="옵션 매출"
              value={`${fmt(totals?.optionRevenue ?? 0)}원`}
              icon="local_drink"
              accent="amber"
            />
            <SummaryCard
              label="코스 배정"
              value={`${totals?.assignedCount ?? 0} / ${(totals?.assignedCount ?? 0) + (totals?.unassignedCount ?? 0)}`}
              icon="route"
            />
          </div>

          {/* 1. 생산 집계 */}
          <Section title="1. 생산 집계 (주방용)" subtitle="카테고리별 소계 + 상품별 필요 수량">
            <div className="grid md:grid-cols-[1fr_2fr] gap-4">
              {/* 카테고리 소계 */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b text-xs font-bold text-gray-500">
                  카테고리별 소계
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {data.categories.map((c) => (
                      <tr key={c.slug} className="border-b last:border-0">
                        <td className="px-4 py-2">
                          <span className="text-gray-800">{c.name}</span>
                          {c.isOption && (
                            <span className="ml-2 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                              옵션
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-700">
                          {c.quantity}개
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500 text-xs">
                          {fmt(c.totalAmount)}원
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 상품별 목록 */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b text-xs font-bold text-gray-500">
                  상품별 필요 수량 ({data.products.length}종)
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b">
                      <th className="text-left px-4 py-2 font-medium">카테고리</th>
                      <th className="text-left px-4 py-2 font-medium">상품명</th>
                      <th className="text-right px-4 py-2 font-medium">수량</th>
                      <th className="text-right px-4 py-2 font-medium">매출</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((p) => (
                      <tr key={p.productId} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2 text-xs text-gray-500">
                          {p.categoryName}
                          {p.isOption && <span className="ml-1 text-amber-600">·옵션</span>}
                        </td>
                        <td className="px-4 py-2 text-gray-800">{p.name}</td>
                        <td className="px-4 py-2 text-right font-bold text-gray-900">
                          {p.quantity}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500 text-xs">
                          {fmt(p.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* 2. 코스 편성 */}
          <Section title="2. 코스 편성" subtitle="각 주문에 코스명과 순번을 배정하세요 (저장 전까지 편집 중)">
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead className="bg-gray-50 border-b">
                    <tr className="text-xs text-gray-500">
                      <th className="text-left px-3 py-2 font-medium w-24">주문번호</th>
                      <th className="text-left px-3 py-2 font-medium">고객</th>
                      <th className="text-left px-3 py-2 font-medium">주소</th>
                      <th className="text-right px-3 py-2 font-medium">금액</th>
                      <th className="text-left px-3 py-2 font-medium w-28">코스</th>
                      <th className="text-center px-3 py-2 font-medium w-16">순번</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergedOrders.map((o) => {
                      const d = o.delivery;
                      if (!d) return null;
                      const routeLabel = d.routeLabel || "";
                      return (
                        <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs text-gray-500">{o.orderNo.slice(-8)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-800">{o.customer.name}</span>
                              {o.type === "SUBSCRIPTION" && (
                                <span className="text-[10px] text-[#1D9E75] bg-[#1D9E75]/10 px-1 rounded">
                                  구독
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">{o.customer.phone}</div>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {o.address ? (
                              <>
                                {o.address.address1} {o.address.address2}
                                {o.address.memo && (
                                  <div className="text-[10px] text-amber-600 mt-0.5">
                                    메모: {o.address.memo}
                                  </div>
                                )}
                              </>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-gray-600">
                            {fmt(o.totalAmount)}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={routeLabel}
                              onChange={(e) => updateDraft(d.id, { routeLabel: e.target.value })}
                              placeholder="미배정"
                              list="course-labels"
                              className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1D9E75]"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              aria-label="배송 순번"
                              title="배송 순번"
                              placeholder="0"
                              value={d.sortOrder}
                              onChange={(e) =>
                                updateDraft(d.id, { sortOrder: parseInt(e.target.value, 10) || 0 })
                              }
                              className="w-14 px-1 py-1 border border-gray-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-[#1D9E75]"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <datalist id="course-labels">
              {existingCourseLabels.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
            {existingCourseLabels.length > 0 && (
              <div className="mt-2 text-xs text-gray-400">
                기존 코스: {existingCourseLabels.map((l) => `"${l}"`).join(", ")} — 코스명 칸을 클릭하면 자동완성
              </div>
            )}
          </Section>

          {/* 3. 코스별 피킹 리스트 */}
          <Section
            title="3. 코스별 피킹 리스트 (포장용)"
            subtitle="박스 한 상자 = 한 고객 — 순번대로 포장·상차"
          >
            <div className="space-y-4">
              {mergedRoutes.map((route) => (
                <div key={route.label ?? "unassigned"} className="bg-white rounded-xl border overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-gray-800">
                        {route.label ? `코스 ${route.label}` : "미배정"}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        {route.orderCount}박스 · {fmt(route.totalAmount)}원
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePrintCourse(route.label)}
                      className="text-xs px-3 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50 inline-flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">print</span>
                      {route.label ? "코스 인쇄" : "미배정 확인"}
                    </button>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b">
                        <th className="text-center px-3 py-2 font-medium w-12">#</th>
                        <th className="text-left px-3 py-2 font-medium">수령인</th>
                        <th className="text-left px-3 py-2 font-medium">주소</th>
                        <th className="text-left px-3 py-2 font-medium">박스 구성</th>
                        <th className="text-right px-3 py-2 font-medium">합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {route.orders.map((o, idx) => (
                        <tr key={o.id} className="border-b last:border-0 align-top">
                          <td className="px-3 py-2 text-center text-gray-500 font-bold">
                            {o.delivery?.sortOrder || idx + 1}
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-gray-800">
                              {o.address?.receiver ?? o.customer.name}
                            </div>
                            <div className="text-xs text-gray-400">
                              {o.address?.phone ?? o.customer.phone}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {o.address ? (
                              <>
                                [{o.address.zipCode}] {o.address.address1} {o.address.address2}
                                {o.address.memo && (
                                  <div className="text-[10px] text-amber-600 mt-0.5">
                                    메모: {o.address.memo}
                                  </div>
                                )}
                              </>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <ul className="text-xs text-gray-700 space-y-0.5">
                              {o.items.map((it) => (
                                <li key={it.productId}>
                                  <span className="text-gray-400">·</span> {it.name}{" "}
                                  <span className="text-[#1D9E75] font-bold">×{it.quantity}</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-gray-600">
                            {fmt(o.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: string;
  accent?: "green" | "amber";
}) {
  const color =
    accent === "green"
      ? "text-[#1D9E75]"
      : accent === "amber"
        ? "text-[#EF9F27]"
        : "text-gray-700";
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className={`material-symbols-outlined text-base ${color}`}>{icon}</span>
        {label}
      </div>
      <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
