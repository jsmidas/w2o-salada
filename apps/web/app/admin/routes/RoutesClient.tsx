"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

type Driver = { id: string; name: string; username: string | null; phone: string | null };
type Route = {
  id: string;
  name: string;
  driverUserId: string | null;
  driver: Driver | null;
  vehicleNo: string | null;
  ownership: "OWN" | "OUTSOURCED";
  maxStops: number;
  departOrder: number;
  color: string | null;
  memo: string | null;
  isActive: boolean;
  _count: { deliveries: number; lastAddresses: number };
};
type Payload = { routes: Route[]; drivers: Driver[] };

const inputCls = "px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]";

export default function RoutesClient() {
  const { data, isLoading, mutate } = useSWR<Payload>("/api/admin/routes", fetcher, { revalidateOnFocus: false });
  const routes = data?.routes ?? [];
  const drivers = data?.drivers ?? [];
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const call = async (method: "POST" | "PATCH" | "DELETE", body: unknown) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/routes", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(d.error ?? "실패"); return false; }
      if (d.message) setMsg(d.message);
      mutate();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const patch = (id: string, body: Record<string, unknown>) => call("PATCH", { id, ...body });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">배송 코스 · 기사</h2>
          <p className="text-sm text-gray-500 mt-1">
            코스는 차량 1대의 하루입니다. 기사 계정을 연결하면 기사는 자기 코스만 보게 됩니다. 이름은 언제든 바꿔도 배정은 유지됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="text" placeholder="새 코스 이름 (예: 성서북부)" value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls} />
          <button
            type="button"
            disabled={busy || !newName.trim()}
            onClick={() => call("POST", { name: newName.trim(), departOrder: routes.length + 1 }).then((ok) => ok && setNewName(""))}
            className="px-4 py-2 bg-[#1D9E75] text-white text-sm font-medium rounded-lg hover:bg-[#178a64] disabled:opacity-50"
          >
            코스 추가
          </button>
        </div>
      </div>

      {msg && <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">{msg}</div>}

      {drivers.length === 0 && (
        <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg">
          기사 계정이 없습니다. <a href="/admin/permissions" className="underline">관리자 권한 → 관리자 추가 → 새 계정 만들기</a>에서 역할을 "배송 기사"로 만들면 여기서 코스에 연결할 수 있습니다.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-xs text-gray-500">
              <th className="text-left px-4 py-3 font-medium w-12">순번</th>
              <th className="text-left px-4 py-3 font-medium">코스 이름</th>
              <th className="text-left px-4 py-3 font-medium">기사</th>
              <th className="text-left px-4 py-3 font-medium">차량</th>
              <th className="text-left px-4 py-3 font-medium">구분</th>
              <th className="text-right px-4 py-3 font-medium">목표 집 수</th>
              <th className="text-right px-4 py-3 font-medium">기억된 배송지</th>
              <th className="text-center px-4 py-3 font-medium">상태</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400">로딩 중...</td></tr>
            ) : routes.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400">코스가 없습니다. 위에서 추가하세요.</td></tr>
            ) : (
              routes.map((r) => (
                <tr key={r.id} className={`border-b last:border-0 ${r.isActive ? "" : "opacity-50"}`}>
                  <td className="px-4 py-2">
                    <input type="number" defaultValue={r.departOrder} onBlur={(e) => Number(e.target.value) !== r.departOrder && patch(r.id, { departOrder: Number(e.target.value) })} className={`${inputCls} w-14 text-center`} aria-label="출고 순번" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="text" defaultValue={r.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== r.name && patch(r.id, { name: e.target.value.trim() })} className={`${inputCls} w-40 font-medium`} aria-label="코스 이름" />
                  </td>
                  <td className="px-4 py-2">
                    <select value={r.driverUserId ?? ""} onChange={(e) => patch(r.id, { driverUserId: e.target.value || null })} className={inputCls} aria-label="기사">
                      <option value="">기사 없음</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}{d.username ? ` (${d.username})` : ""}</option>
                      ))}
                    </select>
                    {r.driver?.phone && <div className="text-[11px] text-gray-400 mt-0.5">{r.driver.phone}</div>}
                  </td>
                  <td className="px-4 py-2">
                    <input type="text" defaultValue={r.vehicleNo ?? ""} placeholder="차량번호" onBlur={(e) => (e.target.value.trim() || null) !== r.vehicleNo && patch(r.id, { vehicleNo: e.target.value.trim() })} className={`${inputCls} w-28`} aria-label="차량번호" />
                  </td>
                  <td className="px-4 py-2">
                    <select value={r.ownership} onChange={(e) => patch(r.id, { ownership: e.target.value })} className={inputCls} aria-label="자차/용차">
                      <option value="OWN">자차</option>
                      <option value="OUTSOURCED">용차</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input type="number" defaultValue={r.maxStops} onBlur={(e) => Number(e.target.value) !== r.maxStops && patch(r.id, { maxStops: Number(e.target.value) })} className={`${inputCls} w-20 text-right`} aria-label="목표 집 수" />
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600" title="이 코스로 배정된 적 있는 배송지 수 — 다음 배송일에 자동으로 같은 코스에 들어갑니다">
                    {r._count.lastAddresses}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button type="button" onClick={() => patch(r.id, { isActive: !r.isActive })} className={`px-2 py-1 rounded-full text-xs font-medium ${r.isActive ? "bg-[#1D9E75]/10 text-[#1D9E75]" : "bg-gray-100 text-gray-500"}`}>
                      {r.isActive ? "운행" : "중지"}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button type="button" onClick={() => confirm(`${r.name} 코스를 삭제할까요?`) && call("DELETE", { id: r.id })} className="text-gray-300 hover:text-red-400" title="삭제">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-400 space-y-1">
        <p>· 자동 배정 순서: 자차 코스를 먼저 채우고 넘치는 물량만 용차로 (2단계에서 구현). 지금은 배송 관리에서 코스를 고르면 됩니다.</p>
        <p>· 기사 계정 만들기·비밀번호 재설정은 <a href="/admin/permissions" className="underline">관리자 권한</a>에서 합니다.</p>
      </div>
    </div>
  );
}
