"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

type Apartment = {
  id: string;
  name: string;
  aliases: string[];
  address: string | null;
  sigungu: string | null;
  bname: string | null;
  households: number | null;
  dongCount: number | null;
  distanceKm: number | null;
  lat: number | null;
  isServiced: boolean;
  memo: string | null;
  addressCount: number;
};

const inputCls = "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]";

type Unregistered = { buildingName: string; sigungu: string | null; bname: string | null; addressCount: number };
type Payload = { apartments: Apartment[]; unregistered: Unregistered[] };

export default function ApartmentsClient() {
  const { data, isLoading, mutate } = useSWR<Payload>("/api/admin/apartments", fetcher, { revalidateOnFocus: false });
  const list = data?.apartments ?? [];
  const unregistered = data?.unregistered ?? [];

  const [form, setForm] = useState({ name: "", address: "", households: "", aliases: "" });
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);

  const post = async (payload: unknown) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/apartments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await res.json();
      if (!res.ok) { setMsg(d.error ?? "실패"); return; }
      setMsg(`등록 ${d.created} · 갱신 ${d.updated}${d.skipped ? ` · 건너뜀 ${d.skipped}` : ""}`);
      mutate();
    } finally {
      setBusy(false);
    }
  };

  const addOne = () => {
    if (!form.name.trim()) return;
    post({ name: form.name, address: form.address, households: form.households, aliases: form.aliases }).then(() =>
      setForm({ name: "", address: "", households: "", aliases: "" }),
    );
  };

  // 한 줄에 "단지명, 주소, 세대수, 별칭1|별칭2" — 공공데이터 엑셀에서 열을 골라 붙여넣는다
  const addBulk = () => {
    const rows = bulk
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [name, address, households, aliases] = l.split(/\t|,/).map((s) => s?.trim() ?? "");
        return { name, address, households, aliases };
      })
      .filter((r) => r.name);
    if (rows.length === 0) return;
    postBulk(rows).then(() => setBulk(""));
  };

  // 단지마다 지오코딩을 부르므로 한 번에 다 보내면 타임아웃이 난다 — 25행씩 끊어 보낸다
  const postBulk = async (rows: { name?: string; address?: string; households?: string; aliases?: string }[]) => {
    const CHUNK = 25;
    setBusy(true);
    setMsg(null);
    try {
      let created = 0, updated = 0, skipped = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        setMsg(`등록 중... ${Math.min(i + CHUNK, rows.length)}/${rows.length}행`);
        const res = await fetch("/api/admin/apartments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: rows.slice(i, i + CHUNK) }),
        });
        const d = await res.json();
        if (!res.ok) { setMsg(d.error ?? "실패"); return; }
        created += d.created ?? 0;
        updated += d.updated ?? 0;
        skipped += d.skipped ?? 0;
      }
      setMsg(`등록 ${created} · 갱신 ${updated}${skipped ? ` · 건너뜀 ${skipped}` : ""}`);
      mutate();
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    await fetch("/api/admin/apartments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
    mutate();
  };

  const remove = async (a: Apartment) => {
    if (!confirm(`${a.name} 단지를 삭제할까요? (연결된 배송지 ${a.addressCount}건은 단지 연결만 풀립니다)`)) return;
    await fetch("/api/admin/apartments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id }) });
    mutate();
  };

  const total = list.length;
  const serviced = list.filter((a) => a.isServiced).length;
  const households = list.reduce((s, a) => s + (a.households ?? 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">아파트 단지</h2>
          <p className="text-sm text-gray-500 mt-1">
            대상 지역 단지를 미리 등록해 두면 고객 주소의 단지명이 자동으로 묶이고, 단지별 주문 수(침투율)와 센터 거리로 영업 우선순위를 볼 수 있습니다.
          </p>
        </div>
        <div className="text-right text-sm text-gray-500">
          단지 <b className="text-gray-800">{total}</b> · 배송 중 <b className="text-[#1D9E75]">{serviced}</b> · 세대 합계 <b className="text-gray-800">{households.toLocaleString()}</b>
        </div>
      </div>

      {/* 등록 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-700">단지 등록</h3>
          <button type="button" onClick={() => setShowBulk((v) => !v)} className="text-xs text-[#1D9E75] hover:underline">
            {showBulk ? "한 건씩 입력" : "여러 건 붙여넣기 (공공데이터)"}
          </button>
        </div>
        {showBulk ? (
          <div>
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={6}
              placeholder={"한 줄에 하나 — 단지명, 주소, 세대수, 별칭1|별칭2\n예) 성서주공1단지, 대구 달서구 이곡동 1234, 980, 성서주공 1단지|성서 주공1"}
              className={`${inputCls} w-full font-mono text-xs`}
            />
            <p className="text-xs text-gray-400 mt-1">공공데이터포털 &quot;공동주택 단지 정보&quot; 엑셀에서 단지명·주소·세대수 열을 복사해 붙여넣으면 됩니다. 주소로 좌표와 센터 거리를 자동 계산합니다.</p>
            <button type="button" onClick={addBulk} disabled={busy || !bulk.trim()} className="mt-2 px-4 py-2 bg-[#1D9E75] text-white text-sm rounded-lg hover:bg-[#178a64] disabled:opacity-50">
              {busy ? "등록 중..." : "일괄 등록"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <input type="text" placeholder="단지명 *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            <input type="text" placeholder="주소 (좌표 계산용)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={`${inputCls} md:col-span-2`} />
            <input type="number" placeholder="세대수" value={form.households} onChange={(e) => setForm({ ...form, households: e.target.value })} className={inputCls} />
            <div className="flex gap-2">
              <input type="text" placeholder="별칭 (| 구분)" value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} className={`${inputCls} flex-1 min-w-0`} />
              <button type="button" onClick={addOne} disabled={busy || !form.name.trim()} className="px-4 py-2 bg-[#1D9E75] text-white text-sm rounded-lg hover:bg-[#178a64] disabled:opacity-50 shrink-0">
                등록
              </button>
            </div>
          </div>
        )}
        {msg && <p className="text-xs text-gray-600 mt-2">{msg}</p>}
      </div>

      {/* 미등록 단지 — 고객 주소에서 나왔지만 사전 등록이 없어 묶이지 않는 단지 */}
      {unregistered.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-bold text-amber-900 mb-2">미등록 단지 {unregistered.length}곳 — 고객 주소에는 있는데 등록이 없습니다</h3>
          <div className="flex flex-wrap gap-2">
            {unregistered.map((u) => (
              <button
                key={`${u.buildingName}|${u.bname}`}
                type="button"
                onClick={() => { setShowBulk(false); setForm({ name: u.buildingName, address: [u.sigungu, u.bname].filter(Boolean).join(" "), households: "", aliases: "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-amber-900 hover:bg-amber-100"
                title="클릭하면 등록 폼에 채워집니다 — 주소를 정확히 입력하면 좌표·거리가 계산됩니다"
              >
                {u.buildingName} <span className="text-amber-600">({u.bname ?? u.sigungu ?? "?"} · 배송지 {u.addressCount})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 목록 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-xs text-gray-500">
              <th className="text-left px-4 py-3 font-medium">단지</th>
              <th className="text-left px-4 py-3 font-medium">위치</th>
              <th className="text-right px-4 py-3 font-medium">센터 거리</th>
              <th className="text-right px-4 py-3 font-medium">세대수</th>
              <th className="text-right px-4 py-3 font-medium">배송지</th>
              <th className="text-center px-4 py-3 font-medium">배송 개시</th>
              <th className="text-center px-4 py-3 font-medium w-16"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">로딩 중...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">등록된 단지가 없습니다.</td></tr>
            ) : (
              list.map((a) => {
                const rate = a.households && a.households > 0 ? Math.round((a.addressCount / a.households) * 1000) / 10 : null;
                return (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{a.name}</div>
                      {a.aliases.length > 0 && <div className="text-[11px] text-gray-400">별칭: {a.aliases.join(", ")}</div>}
                      {a.memo && <div className="text-[11px] text-gray-500">{a.memo}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {a.sigungu} {a.bname}
                      <div className="text-gray-400 truncate max-w-xs">{a.address}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {a.distanceKm !== null ? `${a.distanceKm}km` : a.lat === null ? <span className="text-red-400 text-xs">좌표 없음</span> : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{a.households?.toLocaleString() ?? "-"}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {a.addressCount}
                      {rate !== null && <span className="text-[11px] text-gray-400 ml-1">({rate}%)</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => patch(a.id, { isServiced: !a.isServiced })}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${a.isServiced ? "bg-[#1D9E75]/10 text-[#1D9E75]" : "bg-gray-100 text-gray-500"}`}
                      >
                        {a.isServiced ? "배송 중" : "대기"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button type="button" onClick={() => remove(a)} className="text-gray-300 hover:text-red-400" title="삭제">
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
