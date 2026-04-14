"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "../../../lib/fetcher";

type ReportOrder = {
  id: string;
  orderNo: string;
  type: string;
  totalAmount: number;
  customer: { name: string; phone: string };
  address: {
    receiver: string;
    phone: string;
    zipCode: string;
    address1: string;
    address2: string;
    memo: string;
  } | null;
  items: Array<{ productId: string; name: string; quantity: number; isOption: boolean }>;
  delivery: { id: string; routeLabel: string; sortOrder: number } | null;
};

type ReportRoute = {
  label: string | null;
  orderCount: number;
  totalAmount: number;
  orders: ReportOrder[];
};

type Report = {
  date: string;
  routes: ReportRoute[];
  products: Array<{ productId: string; name: string; categoryName: string; quantity: number; isOption: boolean }>;
};

function fmt(n: number) {
  return n.toLocaleString();
}

export default function DeliveryPrintPage() {
  const params = useSearchParams();
  const date = params.get("date") ?? "";
  const course = params.get("course");

  const apiUrl = date ? `/api/admin/delivery/report?date=${date}` : null;
  const { data, isLoading } = useSWR<Report>(apiUrl, fetcher);

  const filteredRoutes = useMemo(() => {
    if (!data) return [];
    if (course) return data.routes.filter((r) => r.label === course);
    return data.routes;
  }, [data, course]);

  useEffect(() => {
    if (!isLoading && data) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [isLoading, data]);

  if (isLoading || !data) {
    return (
      <div className="p-10 text-center text-gray-400">
        리포트를 불러오는 중입니다...
      </div>
    );
  }

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div className="print-root">
      {/* 인쇄 전용 스타일 */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm 10mm;
          }
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-root {
            color: #000;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
        }
        @media screen {
          .print-root {
            max-width: 210mm;
            margin: 24px auto;
            padding: 20mm 15mm;
            background: white;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
          }
        }
        .print-root {
          font-family: "Pretendard", -apple-system, sans-serif;
          font-size: 11pt;
          line-height: 1.4;
          color: #111;
        }
        .print-root h1 {
          font-size: 18pt;
          font-weight: 800;
          margin-bottom: 4px;
        }
        .print-root h2 {
          font-size: 14pt;
          font-weight: 700;
          margin: 16px 0 8px;
          padding-bottom: 4px;
          border-bottom: 2px solid #1d9e75;
        }
        .print-root table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10pt;
        }
        .print-root th,
        .print-root td {
          border: 1px solid #d4d4d4;
          padding: 6px 8px;
          vertical-align: top;
          text-align: left;
        }
        .print-root th {
          background: #f5f5f5;
          font-weight: 700;
        }
        .print-root .chk {
          width: 14px;
          height: 14px;
          border: 1.5px solid #333;
          display: inline-block;
        }
        .print-root .meta {
          font-size: 10pt;
          color: #555;
        }
      `}</style>

      <div className="no-print" style={{ marginBottom: 16, textAlign: "right" }}>
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            padding: "8px 16px",
            background: "#1d9e75",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          인쇄
        </button>
      </div>

      {filteredRoutes.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
          {course ? `코스 "${course}"` : "해당 날짜"}에 배송 대상이 없습니다.
        </div>
      ) : (
        filteredRoutes.map((route, idx) => (
          <div key={route.label ?? "unassigned"} className={idx < filteredRoutes.length - 1 ? "page-break" : ""}>
            {/* 헤더 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
              <div>
                <h1>W2O SALADA 배송 전표</h1>
                <div className="meta">{dateLabel}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "13pt", fontWeight: 700 }}>
                  코스 {route.label ?? "(미배정)"}
                </div>
                <div className="meta">
                  총 {route.orderCount}박스 · {fmt(route.totalAmount)}원
                </div>
              </div>
            </div>

            {/* 포장 체크리스트 (코스 전체 상품 합계) */}
            <h2>코스 포장 체크리스트</h2>
            <RouteProductSummary orders={route.orders} />

            {/* 배송 순번별 명세 */}
            <h2>배송 순번</h2>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "6%", textAlign: "center" }}>#</th>
                  <th style={{ width: "4%", textAlign: "center" }}>✓</th>
                  <th style={{ width: "18%" }}>수령인</th>
                  <th style={{ width: "36%" }}>주소</th>
                  <th style={{ width: "28%" }}>구성</th>
                  <th style={{ width: "8%", textAlign: "right" }}>합계</th>
                </tr>
              </thead>
              <tbody>
                {route.orders.map((o, i) => (
                  <tr key={o.id}>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>
                      {o.delivery?.sortOrder || i + 1}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className="chk" />
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>
                        {o.address?.receiver ?? o.customer.name}
                        {o.type === "SUBSCRIPTION" && (
                          <span style={{ fontSize: "8pt", color: "#1d9e75", marginLeft: 4 }}>
                            [구독]
                          </span>
                        )}
                      </div>
                      <div className="meta">{o.address?.phone ?? o.customer.phone}</div>
                    </td>
                    <td style={{ fontSize: "9.5pt" }}>
                      {o.address ? (
                        <>
                          [{o.address.zipCode}] {o.address.address1} {o.address.address2}
                          {o.address.memo && (
                            <div style={{ color: "#c07500", fontSize: "9pt", marginTop: 2 }}>
                              * {o.address.memo}
                            </div>
                          )}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td style={{ fontSize: "9.5pt" }}>
                      {o.items.map((it) => (
                        <div key={it.productId}>
                          · {it.name} ×<strong>{it.quantity}</strong>
                        </div>
                      ))}
                    </td>
                    <td style={{ textAlign: "right", fontSize: "9pt" }}>{fmt(o.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 푸터 */}
            <div
              style={{
                marginTop: 16,
                fontSize: "9pt",
                color: "#666",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <div>
                출발 시각: ________ &nbsp;&nbsp; 완료 시각: ________ &nbsp;&nbsp; 기사 서명: ________
              </div>
              <div>
                박스 {route.orderCount}개 적재 확인: <span className="chk" />
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function RouteProductSummary({ orders }: { orders: ReportOrder[] }) {
  const map = new Map<string, { name: string; quantity: number; isOption: boolean }>();
  for (const o of orders) {
    for (const it of o.items) {
      const cur = map.get(it.productId);
      if (cur) cur.quantity += it.quantity;
      else map.set(it.productId, { name: it.name, quantity: it.quantity, isOption: it.isOption });
    }
  }
  const list = Array.from(map.values()).sort((a, b) => {
    if (a.isOption !== b.isOption) return a.isOption ? 1 : -1;
    return b.quantity - a.quantity;
  });
  if (list.length === 0) return null;
  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: "6%", textAlign: "center" }}>✓</th>
          <th>상품명</th>
          <th style={{ width: "15%", textAlign: "right" }}>필요 수량</th>
        </tr>
      </thead>
      <tbody>
        {list.map((p) => (
          <tr key={p.name}>
            <td style={{ textAlign: "center" }}>
              <span className="chk" />
            </td>
            <td>
              {p.name}
              {p.isOption && (
                <span style={{ fontSize: "8pt", color: "#c07500", marginLeft: 4 }}>[옵션]</span>
              )}
            </td>
            <td style={{ textAlign: "right", fontWeight: 700 }}>{p.quantity}개</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
