"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";
import DeliveryMap from "./DeliveryMap";

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
  type: "SINGLE" | "SUBSCRIPTION" | "SUBSCRIPTION_DELIVERY";
  status: string;
  totalAmount: number;
  customer: { id: string; name: string; phone: string };
  addressId?: string | null;
  deliveryHold?: boolean;
  deliveryHoldReason?: string | null;
  address: {
    receiver: string;
    phone: string;
    zipCode: string;
    address1: string;
    address2: string;
    memo: string;
    label?: string;
    sigungu?: string;
    bname?: string;
    buildingName?: string;
    isApartment?: boolean;
    distanceKm?: number | null;
    areaStatus?: "UNKNOWN" | "IN_RANGE" | "OUT_OF_RANGE";
    lat?: number | null;
    lng?: number | null;
    entranceMethod?: string;
    entrancePassword?: string;
    floor?: string;
    dropLocation?: "DOOR" | "SECURITY_OFFICE" | "PARCEL_BOX" | "OTHER";
    dropNote?: string;
  } | null;
  items: ReportOrderItem[];
  delivery: {
    id: string;
    routeId?: string | null;
    routeLabel: string;
    autoFilled?: boolean; // 지난번 코스로 자동 채워짐
    sortOrder: number;
    status: string;
    photoUrl?: string | null;    // 기사 앱 배송 완료 사진
    memo?: string | null;        // 기사 메모 (특이사항·배송 못함 사유)
    completedAt?: string | null; // 처리 시각 (완료·못함)
  } | null;
};

type RouteMaster = {
  id: string;
  name: string;
  driverName: string | null;
  maxStops: number;
  ownership: "OWN" | "OUTSOURCED";
  departOrder: number;
  color: string | null;
};

const DROP_LABEL: Record<string, string> = {
  DOOR: "문 앞",
  SECURITY_OFFICE: "경비실",
  PARCEL_BOX: "택배함",
  OTHER: "기타",
};

type ReportRoute = {
  label: string | null;
  orderCount: number;
  stopCount?: number;
  totalAmount: number;
  orders: ReportOrder[];
};

type Report = {
  date: string;
  totals: ReportTotals & { stops?: number; heldCount?: number };
  categories: ReportCategory[];
  products: ReportProduct[];
  routes: ReportRoute[];
  orders: ReportOrder[];
  heldOrders?: ReportOrder[]; // 배송지 확인 대기 — 코스 편성·출력에서 제외
  routeMaster?: RouteMaster[];
  center?: { name: string; lat: number | null; lng: number | null; radiusKm: number } | null; // 물류센터 — 지도 중심·반경 원
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

/** 기사 처리 시각 — 서버·브라우저 어디서든 한국시간으로 */
function kstTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
}

// YYYY-MM-DD 문자열을 days만큼 이동 (UTC 기준으로 계산해 타임존 영향 없음)
function shiftDate(ymd: string, days: number): string {
  const t = new Date(`${ymd}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

export default function DeliveryClient({
  initialDate,
  initialReport,
}: {
  initialDate: string;
  initialReport: Report | null;
}) {
  const [date, setDate] = useState<string>(initialDate);
  const [drafts, setDrafts] = useState<Record<string, { routeId: string | null; routeLabel: string; sortOrder: number }>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true); // 코스 편성 지도 — 핀으로 보고 핀에서 코스를 바꾼다

  const apiUrl = `/api/admin/delivery/report?date=${date}`;
  const isInitial = date === initialDate;
  // 배송 당일(한국 날짜)에는 1분마다 다시 불러와 기사 앱의 완료·못함 처리가 지도 현황판에 따라오게 한다
  const todayKst = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const { data, isLoading, mutate } = useSWR<Report>(apiUrl, fetcher, {
    fallbackData: isInitial && initialReport ? initialReport : undefined,
    revalidateOnFocus: false,
    refreshInterval: date === todayKst && showMap ? 60_000 : 0,
  });

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
          routeId: draft.routeId,
          routeLabel: draft.routeLabel,
          sortOrder: draft.sortOrder,
        },
      };
    });
  }, [data, drafts]);

  // 같은 집(배송지)에 주문이 몇 건인지 — 단건 + 구독이 같은 날 같은 주소면 1스톱
  const stopKey = (o: ReportOrder) => o.addressId ?? `order:${o.id}`;
  const houseCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of mergedOrders) m.set(stopKey(o), (m.get(stopKey(o)) ?? 0) + 1);
    return m;
  }, [mergedOrders]);

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
        stopCount: new Set(orders.map(stopKey)).size,
        totalAmount: orders.reduce((s, o) => s + o.totalAmount, 0),
        orders: orders.sort((a, b) => {
          const d = (a.delivery?.sortOrder ?? 0) - (b.delivery?.sortOrder ?? 0);
          return d !== 0 ? d : stopKey(a).localeCompare(stopKey(b));
        }),
      }))
      .sort((a, b) => {
        if (!a.label) return 1;
        if (!b.label) return -1;
        return a.label.localeCompare(b.label);
      });
  }, [mergedOrders]);

  const updateDraft = (deliveryId: string, patch: Partial<{ routeId: string | null; routeLabel: string; sortOrder: number }>) => {
    setDrafts((prev) => {
      const next = { ...prev };
      const apply = (id: string) => {
        const cur = data?.orders.find((o) => o.delivery?.id === id)?.delivery;
        const base = next[id] ?? {
          routeId: cur?.routeId ?? null,
          routeLabel: cur?.routeLabel ?? "",
          sortOrder: cur?.sortOrder ?? 0,
        };
        next[id] = { ...base, ...patch };
      };
      apply(deliveryId);
      // 같은 집의 다른 주문(단건+구독)도 같은 코스·순번으로 — 한 집은 한 번에 배송한다
      const me = data?.orders.find((o) => o.delivery?.id === deliveryId);
      if (me?.addressId) {
        for (const o of data?.orders ?? []) {
          if (o.addressId === me.addressId && o.delivery && o.delivery.id !== deliveryId) apply(o.delivery.id);
        }
      }
      return next;
    });
  };

  const routeMaster = data?.routeMaster ?? [];

  const assignToRoute = (deliveryId: string, routeId: string | null) => {
    const route = routeMaster.find((r) => r.id === routeId) ?? null;
    const label = route?.name ?? "";
    const current = mergedRoutes.find((r) => (r.label ?? "") === label);
    const nextSort = routeId ? (current?.orders.length ?? 0) + 1 : 0;
    updateDraft(deliveryId, { routeId, routeLabel: label, sortOrder: nextSort });
  };

  const hasChanges = Object.keys(drafts).length > 0;

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const assignments = Object.entries(drafts).map(([deliveryId, d]) => ({
        deliveryId,
        routeId: d.routeId,
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
  // 날짜 변경 — SWR 키가 date라 바꾸는 즉시 해당 날짜가 조회된다. 편집 중 draft는 버린다
  const changeDate = (next: string) => {
    setDate(next);
    setDrafts({});
  };

  const handlePrintCourse = (label: string | null) => {
    const q = new URLSearchParams({ date });
    if (label) q.set("course", label);
    window.open(`/admin/delivery/print?${q}`, "_blank");
  };

  const totals = data?.totals;

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
          <div className="inline-flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => changeDate(shiftDate(date, -1))}
              aria-label="이전 날짜"
              title="이전 날짜"
              className="px-2 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-800 inline-flex items-center"
            >
              <span className="material-symbols-outlined text-lg">chevron_left</span>
            </button>
            <input
              type="date"
              aria-label="배송 날짜 선택"
              title="배송 날짜"
              value={date}
              onChange={(e) => {
                if (e.target.value) changeDate(e.target.value);
              }}
              className="px-2 py-2 text-sm border-x border-gray-200 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => changeDate(shiftDate(date, 1))}
              aria-label="다음 날짜"
              title="다음 날짜"
              className="px-2 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-800 inline-flex items-center"
            >
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
          </div>
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
      ) : !data || (data.orders.length === 0 && (data.heldOrders?.length ?? 0) === 0) ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border text-center">
          <span className="material-symbols-outlined text-5xl text-gray-200 block mb-3">inbox</span>
          <p className="text-gray-400">해당 날짜에 배송 대상 주문이 없습니다.</p>
        </div>
      ) : (
        <>
          {/* 상단 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <SummaryCard
              label="배송 집 (스톱)"
              value={`${totals?.stops ?? totals?.totalBoxes ?? 0}집 · ${totals?.totalBoxes ?? 0}건`}
              icon="home_pin"
            />
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

          {/* 배송지 확인 대기 — 코스 편성·피킹·출력에서 제외 */}
          {(data.heldOrders?.length ?? 0) > 0 && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-amber-900 text-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">phone_in_talk</span>
                  배송지 확인 대기 {data.heldOrders!.length}건 — 코스에 넣지 않았습니다
                </h3>
                <a href="/admin/orders" className="text-xs text-amber-800 underline">주문 관리에서 처리</a>
              </div>
              <ul className="text-xs text-amber-900 space-y-1">
                {data.heldOrders!.map((o) => (
                  <li key={o.id}>
                    <b>{o.address?.receiver ?? o.customer.name}</b> · {o.address?.phone ?? o.customer.phone} · {o.address?.address1} {o.address?.address2}
                    <span className="text-amber-700"> — {o.deliveryHoldReason}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-amber-700 mt-2">고객과 통화해 "확인 완료"를 누르면 다음 새로고침부터 코스 편성에 들어옵니다. 취소면 주문 상태를 취소로 바꾸세요.</p>
            </div>
          )}

          {/* 2. 코스 편성 */}
          <Section title="2. 코스 편성" subtitle="각 주문에 코스명과 순번을 배정하세요 (같은 집의 단건·구독은 함께 움직입니다)">
            {/* 지도 — 코스별 색 핀, 핀에서 코스 변경 (저장은 아래 "코스 배정 저장") */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setShowMap((v) => !v)}
                className="text-xs font-medium text-[#1D9E75] hover:underline"
              >
                {showMap ? "지도 접기" : "지도 펼치기"}
              </button>
              {showMap && <span className="text-[11px] text-gray-400">핀을 누르면 집 정보와 코스 변경 · 숫자는 코스 안 순번</span>}
            </div>
            {showMap && (
              <div className="mb-4">
                <DeliveryMap orders={mergedOrders} routeMaster={routeMaster} center={data?.center} date={date} onAssign={assignToRoute} onRefresh={() => mutate()} />
              </div>
            )}
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
                          <td className="px-3 py-2 text-xs text-gray-500">
                            {o.orderNo.slice(-8)}
                            {d.status === "DELIVERED" && d.photoUrl && (
                              <a href={d.photoUrl} target="_blank" rel="noreferrer" className="ml-1 text-[#1D9E75]" title={"배송 완료 사진 보기 " + kstTime(d.completedAt)}>
                                📷 {kstTime(d.completedAt)}
                              </a>
                            )}
                            {d.status === "DELIVERED" && !d.photoUrl && (
                              <span className="ml-1 text-[#1D9E75]" title="배송 완료 (사진 없음)">완료 {kstTime(d.completedAt)}</span>
                            )}
                            {d.status === "IN_TRANSIT" && <span className="ml-1 text-blue-600">배송중</span>}
                            {d.status === "FAILED" && (
                              <span className="ml-1 text-red-600">못함 {kstTime(d.completedAt)}</span>
                            )}
                            {d.status === "FAILED" && d.photoUrl && (
                              <a href={d.photoUrl} target="_blank" rel="noreferrer" className="ml-1 text-red-600" title="현장 사진 보기">📷</a>
                            )}
                            {d.memo && (
                              <div className="mt-0.5 max-w-[160px] whitespace-pre-wrap text-[11px] text-amber-700" title={d.memo}>
                                📝 {d.memo}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-gray-800">{o.customer.name}</span>
                              {(o.type === "SUBSCRIPTION" || o.type === "SUBSCRIPTION_DELIVERY") && (
                                <span className="text-[10px] text-[#1D9E75] bg-[#1D9E75]/10 px-1 rounded">
                                  구독
                                </span>
                              )}
                              {(houseCount.get(stopKey(o)) ?? 1) > 1 && (
                                <span className="text-[10px] text-blue-700 bg-blue-50 px-1 rounded" title="같은 배송지 주문이 여러 건 — 1스톱으로 함께 배송">
                                  같은 집 {houseCount.get(stopKey(o))}건
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">{o.customer.phone}</div>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {o.address ? (
                              <>
                                {o.address.receiver !== o.customer.name && (
                                  <span className="text-gray-400">{o.address.label ? `[${o.address.label}] ` : ""}수령 {o.address.receiver} · </span>
                                )}
                                {o.address.address1} {o.address.address2}
                                <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[10px]">
                                  {o.address.bname && <span className="text-gray-500">{o.address.bname}</span>}
                                  {o.address.buildingName && (
                                    <span className="text-gray-500">· {o.address.buildingName}{o.address.isApartment ? " (아파트)" : ""}</span>
                                  )}
                                  {o.address.distanceKm != null && <span className="text-gray-400">· {o.address.distanceKm}km</span>}
                                  {o.deliveryHold && (
                                    <span className="px-1 rounded bg-red-50 text-red-600 font-semibold" title={o.deliveryHoldReason ?? ""}>배송지 확인</span>
                                  )}
                                </div>
                                {(o.address.entranceMethod || o.address.entrancePassword || o.address.floor || (o.address.dropLocation && o.address.dropLocation !== "DOOR")) && (
                                  <div className="text-[10px] text-blue-700 mt-0.5">
                                    {o.address.floor && `${o.address.floor} · `}
                                    {o.address.entranceMethod}
                                    {o.address.entrancePassword && ` #${o.address.entrancePassword}`}
                                    {o.address.dropLocation && o.address.dropLocation !== "DOOR" && ` · ${DROP_LABEL[o.address.dropLocation]}`}
                                    {o.address.dropNote && ` (${o.address.dropNote})`}
                                  </div>
                                )}
                                {o.address.memo && (
                                  <div className="text-[10px] text-amber-600 mt-0.5">
                                    메모: {o.address.memo}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-red-500">배송지 없음</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-gray-600">
                            {fmt(o.totalAmount)}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={d.routeId ?? ""}
                              onChange={(e) => assignToRoute(d.id, e.target.value || null)}
                              aria-label="코스 선택"
                              className={`w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1D9E75] ${
                                d.routeId ? "border-gray-200" : "border-amber-300 bg-amber-50"
                              }`}
                            >
                              <option value="">미배정</option>
                              {routeMaster.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}{r.driverName ? ` · ${r.driverName}` : ""}
                                </option>
                              ))}
                              {/* 마스터에 없는 옛 라벨(비활성 코스 등)은 그대로 보여준다 */}
                              {d.routeId && !routeMaster.some((r) => r.id === d.routeId) && (
                                <option value={d.routeId}>{routeLabel || "(비활성 코스)"}</option>
                              )}
                            </select>
                            {d.autoFilled && !drafts[d.id] && (
                              <div className="text-[10px] text-gray-400 mt-0.5" title="이 배송지의 지난번 코스를 자동으로 채웠습니다">지난 코스 자동</div>
                            )}
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
            <div className="mt-2 text-xs text-gray-400 flex flex-wrap items-center gap-x-3 gap-y-1">
              {routeMaster.length === 0 ? (
                <span className="text-amber-600">등록된 코스가 없습니다. 배송 코스 메뉴에서 코스와 기사를 먼저 만드세요.</span>
              ) : (
                routeMaster.map((r) => {
                  const cnt = mergedRoutes.find((mr) => mr.label === r.name);
                  const stops = cnt?.stopCount ?? 0;
                  return (
                    <span key={r.id} className={stops > r.maxStops ? "text-red-600 font-semibold" : ""}>
                      {r.name}{r.driverName ? `(${r.driverName})` : ""} {stops}/{r.maxStops}집
                    </span>
                  );
                })
              )}
              <a href="/admin/routes" className="text-[#1D9E75] underline">코스·기사 관리</a>
              <span>· 한 번 배정한 배송지는 다음 배송일에 같은 코스로 자동 채워집니다</span>
            </div>
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
                        {route.stopCount ?? route.orderCount}집 · {route.orderCount}건 · {fmt(route.totalAmount)}원
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
