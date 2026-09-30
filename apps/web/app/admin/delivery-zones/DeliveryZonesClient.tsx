"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

// ───────────────────────── 타입 (API 응답 그대로) ─────────────────────────

type ZoneMode = "LEGACY" | "ZONES";
type ZoneKind = "ZIP" | "BCODE";

type Zone = {
  id: string;
  kind: ZoneKind;
  code: string;
  name: string;
  sido: string | null;
  sigungu: string | null;
  isActive: boolean;
  memo: string | null;
  addressCount: number;
  subscriptionCount: number;
  createdAt: string;
};
type ZonesPayload = { mode: ZoneMode; total: number; active: number; zones: Zone[] };

type ImpactSub = { id: string; status: string; nextBillingDate: string | null; userName: string | null; phone: string | null; address: string };
type ImpactPayload = {
  zone: { id: string; name: string; kind: ZoneKind; code: string; isActive: boolean };
  activeSubscriptions: number;
  upcomingOrders: number;
  addresses: number;
  subscriptions: ImpactSub[];
};

type UpsertResult = { created: number; updated: number; skipped: number; skippedReasons: string[] };

type RuleAction = "ALLOW" | "BLOCK";
type Rule = {
  id: string;
  action: RuleAction;
  zipCode: string | null;
  buildingName: string | null;
  apartmentId: string | null;
  apartment: { id: string; name: string; sigungu: string | null; bname: string | null } | null;
  sigungu: string | null;
  reason: string | null;
  isActive: boolean;
  createdAt: string;
};
type RulesPayload = { rules: Rule[] };
type ApartmentsPayload = { apartments: { id: string; name: string; sigungu: string | null; bname: string | null }[] };

type SuspensionImpact = { singleOrders: number; subscriptionDeliveries: number; subscriptions: number; editable: boolean };
type Suspension = {
  id: string;
  date: string;
  zoneId: string | null;
  zone: { id: string; name: string; kind: ZoneKind; code: string; isActive: boolean } | null;
  reason: string;
  createdAt: string;
  impact: SuspensionImpact;
};
type SuspensionsPayload = { suspensions: Suspension[] };

type WaitArea = { sido: string | null; sigungu: string | null; bname: string | null; count: number; consent: number; lastAt: string | null };
type WaitRow = {
  id: string;
  name: string | null;
  phone: string;
  zipCode: string | null;
  sido: string | null;
  sigungu: string | null;
  bname: string | null;
  bcode: string | null;
  address1: string | null;
  buildingName: string | null;
  marketingConsent: boolean;
  source: string | null;
  notifiedAt: string | null;
  createdAt: string;
};
type WaitlistPayload = { total: number; byArea: WaitArea[]; rows: WaitRow[] };

type BlockedSub = {
  id: string;
  status: string;
  zoneBlockedAt: string | null;
  zoneBlockedReason: string | null;
  nextBillingDate: string | null;
  nextDeliveryDate: string | null;
  cycleWeeks: number;
  price: number;
  user: { id: string; name: string | null; phone: string | null; email: string | null };
  address: {
    id: string;
    address1: string;
    buildingName: string | null;
    zipCode: string | null;
    bcode: string | null;
    areaStatus: string | null;
    areaReason: string | null;
    zone: { name: string; isActive: boolean } | null;
  } | null;
};
type BlockedPayload = { subscriptions: BlockedSub[] };
type RecheckResult = { checked: number; cleared: number; stillBlocked: number; newlyBlocked: number };

// ───────────────────────── 공통 유틸 ─────────────────────────

const ZONES_URL = "/api/admin/delivery-zones";
const RULES_URL = "/api/admin/delivery-zones/rules";
const SUSP_URL = "/api/admin/delivery-zones/suspensions";
const WAIT_URL = "/api/admin/delivery-zones/waitlist";
const BLOCKED_URL = "/api/admin/delivery-zones/blocked-subscriptions";

const inputCls = "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]";
const btnPrimary = "px-4 py-2 bg-[#1D9E75] text-white text-sm rounded-lg hover:bg-[#178a64] disabled:opacity-50";
const btnOutline = "px-3 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50";
const btnDanger = "px-3 py-2 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50";
const thCls = "text-left px-4 py-3 font-medium";

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

// 실패는 던지지 않고 error 문자열로 돌려준다 — 화면에 그대로 보여주기 위해
async function callApi<T>(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? `실패 (${res.status})`, status: res.status };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "네트워크 오류", status: 0 };
  }
}

const fmtDate = (v: string | null | undefined) => (v ? v.slice(0, 10) : "-");
const fmtDateTime = (v: string | null | undefined) => {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const kindLabel = (k: ZoneKind) => (k === "ZIP" ? "우편번호" : "법정동");
const won = (n: number) => `${n.toLocaleString()}원`;

// CSV 한 줄 → 셀 배열. 큰따옴표 안의 쉼표와 ""(이스케이프)만 처리한다 — 엑셀 저장본이면 충분
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const CSV_COLUMNS = ["kind", "code", "name", "sido", "sigungu", "isActive", "memo"] as const;
type CsvColumn = (typeof CSV_COLUMNS)[number];
type ZoneRow = Record<CsvColumn, string>;

// 첫 줄에 kind/code 헤더가 있으면 이름으로 매핑(열 순서 무관), 없으면 정해진 순서로 읽는다
function parseZoneCsv(text: string): { rows: ZoneRow[]; hasHeader: boolean } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { rows: [], hasHeader: false };
  const first = parseCsvLine(lines[0] ?? "").map((h) => h.toLowerCase());
  const hasHeader = first.includes("kind") && first.includes("code");
  const index: Partial<Record<CsvColumn, number>> = {};
  if (hasHeader) {
    for (const col of CSV_COLUMNS) {
      const i = first.indexOf(col.toLowerCase());
      if (i >= 0) index[col] = i;
    }
  } else {
    CSV_COLUMNS.forEach((col, i) => { index[col] = i; });
  }
  const body = hasHeader ? lines.slice(1) : lines;
  const rows: ZoneRow[] = body.map((line) => {
    const cells = parseCsvLine(line);
    const pick = (col: CsvColumn) => { const i = index[col]; return i === undefined ? "" : (cells[i] ?? ""); };
    return { kind: pick("kind"), code: pick("code"), name: pick("name"), sido: pick("sido"), sigungu: pick("sigungu"), isActive: pick("isActive"), memo: pick("memo") };
  });
  return { rows: rows.filter((r) => r.kind || r.code || r.name), hasHeader };
}

const CSV_TEMPLATE = "kind,code,name,sido,sigungu,isActive,memo\nZIP,42690,달서구 이곡동,대구,달서구,1,\nBCODE,27290,달서구 전체,대구,달서구,1,구 전체\n";

function downloadCsvTemplate() {
  // BOM 을 붙여야 엑셀에서 한글이 깨지지 않는다
  const blob = new Blob(["\uFEFF" + CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "delivery-zones-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function Pill({ on, onLabel, offLabel, onClick, title }: { on: boolean; onLabel: string; offLabel: string; onClick?: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={title}
      className={`px-2 py-1 rounded-full text-xs font-medium ${on ? "bg-[#1D9E75]/10 text-[#1D9E75]" : "bg-gray-100 text-gray-500"}`}
    >
      {on ? onLabel : offLabel}
    </button>
  );
}

function Msg({ text, tone = "info" }: { text: string | null; tone?: "info" | "error" }) {
  if (!text) return null;
  return <p className={`text-xs mt-2 whitespace-pre-line ${tone === "error" ? "text-red-600" : "text-gray-600"}`}>{text}</p>;
}

function EmptyRow({ colSpan, loading, text }: { colSpan: number; loading: boolean; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-10 text-gray-400">{loading ? "로딩 중..." : text}</td>
    </tr>
  );
}

// ───────────────────────── 탭 1. 권역 목록 ─────────────────────────

function ZonesTab({ onGoBlocked }: { onGoBlocked: () => void }) {
  const { data, isLoading, mutate } = useSWR<ZonesPayload>(ZONES_URL, fetcher, { revalidateOnFocus: false });

  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [impactWarn, setImpactWarn] = useState<ImpactPayload | null>(null);
  const [form, setForm] = useState({ kind: "ZIP" as ZoneKind, code: "", name: "", sido: "대구", sigungu: "", memo: "" });
  const [showBulk, setShowBulk] = useState(false);
  const [bulk, setBulk] = useState("");
  const [memoEdit, setMemoEdit] = useState<{ id: string; value: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 검색은 클라이언트에서 — 권역 수가 수천 건을 넘지 않는다
  const filtered = useMemo(() => {
    const zones = data?.zones ?? [];
    const k = q.trim().toLowerCase();
    if (!k) return zones;
    return zones.filter((z) => [z.name, z.code, z.sigungu ?? "", z.sido ?? "", z.memo ?? ""].some((v) => v.toLowerCase().includes(k)));
  }, [data, q]);

  const summarize = (r: UpsertResult) => {
    let s = `등록 ${r.created} · 갱신 ${r.updated} · 건너뜀 ${r.skipped}`;
    if (r.skippedReasons.length > 0) s += `\n건너뛴 이유: ${r.skippedReasons.slice(0, 5).join(" / ")}${r.skippedReasons.length > 5 ? " …" : ""}`;
    return s;
  };

  const addOne = async () => {
    if (!form.code.trim() || !form.name.trim()) return;
    setBusy(true); setMsg(null); setErr(null);
    const r = await callApi<UpsertResult>(ZONES_URL, "POST", form);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setMsg(summarize(r.data));
    setForm({ ...form, code: "", name: "", memo: "" });
    mutate();
  };

  // 200행씩 끊어 보낸다 — 서버 상한(500)보다 넉넉히 작게, 진행률도 보여주기 위해
  const postRows = async (rows: ZoneRow[]) => {
    if (rows.length === 0) { setErr("읽을 행이 없습니다."); return; }
    const CHUNK = 200;
    setBusy(true); setMsg(null); setErr(null);
    const total: UpsertResult = { created: 0, updated: 0, skipped: 0, skippedReasons: [] };
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        setMsg(`등록 중 ${Math.min(i + CHUNK, rows.length)}/${rows.length}행`);
        const r = await callApi<UpsertResult>(ZONES_URL, "POST", { rows: rows.slice(i, i + CHUNK) });
        if (!r.ok) { setErr(`${i + 1}행부터 실패: ${r.error}`); return; }
        total.created += r.data.created;
        total.updated += r.data.updated;
        total.skipped += r.data.skipped;
        total.skippedReasons.push(...r.data.skippedReasons);
      }
      setMsg(summarize(total));
      mutate();
    } finally {
      setBusy(false);
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      postRows(parseZoneCsv(text).rows);
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.onerror = () => setErr("파일을 읽지 못했습니다.");
    reader.readAsText(file, "utf-8");
  };

  const toggle = async (z: Zone) => {
    setErr(null);
    if (z.isActive) {
      // 끄기 전에 영향 범위를 먼저 보여준다 — 권역 모드에서는 이 구독들의 자동결제가 멈추기 때문
      let impact: ImpactPayload | null = null;
      try {
        const res = await fetch(`${ZONES_URL}?impact=${encodeURIComponent(z.id)}`);
        if (res.ok) impact = (await res.json()) as ImpactPayload;
      } catch { /* 영향 조회 실패는 confirm 문구만 줄어들 뿐 */ }
      const line = impact
        ? `활성 구독 ${impact.activeSubscriptions}건 · 다가오는 주문 ${impact.upcomingOrders}건 · 배송지 ${impact.addresses}건`
        : "(영향 범위를 불러오지 못했습니다)";
      if (!confirm(`"${z.name}" 권역을 비활성화할까요?\n${line}\n(권역 모드에서는 이 구독들의 자동결제가 보류됩니다)`)) return;
      const r = await callApi(ZONES_URL, "PATCH", { id: z.id, isActive: false });
      if (!r.ok) { setErr(r.error); return; }
      setImpactWarn(impact && impact.activeSubscriptions > 0 ? impact : null);
    } else {
      const r = await callApi(ZONES_URL, "PATCH", { id: z.id, isActive: true });
      if (!r.ok) { setErr(r.error); return; }
    }
    mutate();
  };

  const saveMemo = async () => {
    if (!memoEdit) return;
    const r = await callApi(ZONES_URL, "PATCH", { id: memoEdit.id, memo: memoEdit.value });
    if (!r.ok) setErr(r.error);
    setMemoEdit(null);
    mutate();
  };

  const remove = async (z: Zone) => {
    if (!confirm(`"${z.name}" (${kindLabel(z.kind)} ${z.code}) 권역을 삭제할까요?\n배송지 ${z.addressCount}건의 권역 연결이 풀립니다.`)) return;
    const r = await callApi(ZONES_URL, "DELETE", { id: z.id });
    if (!r.ok) { setErr(r.error); return; }
    mutate();
  };

  return (
    <div>
      {/* 등록 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-700">권역 등록</h3>
          <button type="button" onClick={() => setShowBulk((v) => !v)} className="text-xs text-[#1D9E75] hover:underline">
            {showBulk ? "한 건씩 입력" : "CSV 업로드 · 붙여넣기"}
          </button>
        </div>
        {showBulk ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <input ref={fileRef} type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} className="text-sm" />
              <button type="button" onClick={downloadCsvTemplate} className="text-xs text-[#1D9E75] hover:underline">CSV 양식 다운로드</button>
            </div>
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={6}
              placeholder={"또는 여기에 붙여넣기 — 첫 줄 헤더: kind,code,name,sido,sigungu,isActive,memo\nZIP,42690,달서구 이곡동,대구,달서구,1,\nBCODE,27290,달서구 전체,대구,달서구,1,구 전체"}
              className={`${inputCls} w-full font-mono text-xs`}
            />
            <div className="text-xs text-gray-400 space-y-1">
              <p>헤더: <code className="font-mono">kind,code,name,sido,sigungu,isActive,memo</code> — 열 이름으로 맞추므로 순서는 상관없고, 헤더가 없으면 이 순서로 읽습니다.</p>
              <p>kind 는 <b>ZIP</b>(우편번호 5자리) 또는 <b>BCODE</b>(법정동 코드 5~10자리). isActive 는 1/0 (비우면 활성). 같은 kind·code 가 있으면 덮어씁니다.</p>
              <p className="font-mono">예) ZIP,42690,달서구 이곡동,대구,달서구,1,</p>
              <p className="font-mono">예) BCODE,27290,달서구 전체,대구,달서구,1,구 전체</p>
            </div>
            <button type="button" onClick={() => postRows(parseZoneCsv(bulk).rows).then(() => setBulk(""))} disabled={busy || !bulk.trim()} className={btnPrimary}>
              {busy ? "등록 중..." : "붙여넣은 내용 등록"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ZoneKind })} className={inputCls}>
              <option value="ZIP">우편번호</option>
              <option value="BCODE">법정동</option>
            </select>
            <input type="text" placeholder={form.kind === "ZIP" ? "우편번호 5자리 *" : "법정동 코드 *"} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputCls} />
            <input type="text" placeholder="이름 * (예: 달서구 이곡동)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${inputCls} md:col-span-2`} />
            <input type="text" placeholder="시/도" value={form.sido} onChange={(e) => setForm({ ...form, sido: e.target.value })} className={inputCls} />
            <input type="text" placeholder="시군구" value={form.sigungu} onChange={(e) => setForm({ ...form, sigungu: e.target.value })} className={inputCls} />
            <div className="flex gap-2">
              <input type="text" placeholder="메모" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className={`${inputCls} flex-1 min-w-0`} />
              <button type="button" onClick={addOne} disabled={busy || !form.code.trim() || !form.name.trim()} className={`${btnPrimary} shrink-0`}>등록</button>
            </div>
          </div>
        )}
        <Msg text={msg} />
        <Msg text={err} tone="error" />
      </div>

      {/* 방금 끈 권역에 걸린 구독 — 결제 보류 목록으로 갈 수 있게 */}
      {impactWarn && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-bold text-amber-900">
              &quot;{impactWarn.zone.name}&quot; 비활성화 — 활성 구독 {impactWarn.activeSubscriptions}건이 이 권역에 있습니다
            </h3>
            <div className="flex gap-3 shrink-0 text-xs">
              <button type="button" onClick={onGoBlocked} className="text-amber-900 underline">결제 보류 구독자 보기</button>
              <button type="button" onClick={() => setImpactWarn(null)} className="text-amber-700">닫기</button>
            </div>
          </div>
          <ul className="mt-2 text-xs text-amber-900 space-y-1">
            {impactWarn.subscriptions.map((s) => (
              <li key={s.id}>
                {s.userName ?? "(이름 없음)"} · {s.phone ?? "-"} · {s.address} · 다음 결제일 {fmtDate(s.nextBillingDate)} · {s.status}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 목록 */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <input type="search" placeholder="이름·코드·시군구 검색" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} w-64`} />
        <div className="text-sm text-gray-500">
          전체 <b className="text-gray-800">{data?.total ?? 0}</b> · 활성 <b className="text-[#1D9E75]">{data?.active ?? 0}</b>
          {q && <span className="ml-2 text-gray-400">(검색 {filtered.length})</span>}
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-xs text-gray-500">
              <th className={thCls}>종류</th>
              <th className={thCls}>코드</th>
              <th className={thCls}>이름</th>
              <th className={thCls}>시군구</th>
              <th className="text-right px-4 py-3 font-medium">배송지</th>
              <th className="text-right px-4 py-3 font-medium">활성 구독</th>
              <th className="text-center px-4 py-3 font-medium">상태</th>
              <th className={thCls}>메모</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading || filtered.length === 0 ? (
              <EmptyRow colSpan={9} loading={isLoading} text={q ? "검색 결과가 없습니다." : "등록된 권역이 없습니다. CSV 로 한 번에 넣을 수 있습니다."} />
            ) : (
              filtered.map((z) => (
                <tr key={z.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-600">{kindLabel(z.kind)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{z.code}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{z.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{[z.sido, z.sigungu].filter(Boolean).join(" ") || "-"}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{z.addressCount}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{z.subscriptionCount}</td>
                  <td className="px-4 py-3 text-center">
                    <Pill on={z.isActive} onLabel="활성" offLabel="비활성" onClick={() => toggle(z)} title="클릭해서 전환" />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {memoEdit?.id === z.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={memoEdit.value}
                        onChange={(e) => setMemoEdit({ id: z.id, value: e.target.value })}
                        onBlur={saveMemo}
                        onKeyDown={(e) => { if (e.key === "Enter") saveMemo(); if (e.key === "Escape") setMemoEdit(null); }}
                        className={`${inputCls} w-full py-1`}
                      />
                    ) : (
                      <button type="button" onClick={() => setMemoEdit({ id: z.id, value: z.memo ?? "" })} className="text-left hover:text-gray-800 w-full" title="클릭해서 수정">
                        {z.memo || <span className="text-gray-300">메모 추가</span>}
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-3 text-center">
                    <button type="button" onClick={() => remove(z)} className="text-gray-300 hover:text-red-400" title="삭제">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ───────────────────────── 탭 2. 예외 규칙 ─────────────────────────

function RulesTab() {
  const { data, isLoading, mutate } = useSWR<RulesPayload>(RULES_URL, fetcher, { revalidateOnFocus: false });
  const { data: aptData } = useSWR<ApartmentsPayload>("/api/admin/apartments", fetcher, { revalidateOnFocus: false });
  const rules = data?.rules ?? [];
  const apartments = aptData?.apartments ?? [];

  const [form, setForm] = useState({ action: "BLOCK" as RuleAction, target: "zipCode" as "zipCode" | "buildingName" | "apartmentId", zipCode: "", buildingName: "", sigungu: "", apartmentId: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const targetValue = form.target === "zipCode" ? form.zipCode : form.target === "buildingName" ? form.buildingName : form.apartmentId;
  const canSubmit = targetValue.trim().length > 0 && (form.target !== "zipCode" || /^\d{5}$/.test(form.zipCode.trim()));

  const add = async () => {
    if (!canSubmit) return;
    setBusy(true); setErr(null);
    const body: Record<string, string> = { action: form.action };
    if (form.target === "zipCode") body.zipCode = form.zipCode.trim();
    if (form.target === "buildingName") { body.buildingName = form.buildingName.trim(); if (form.sigungu.trim()) body.sigungu = form.sigungu.trim(); }
    if (form.target === "apartmentId") body.apartmentId = form.apartmentId;
    if (form.reason.trim()) body.reason = form.reason.trim();
    const r = await callApi(RULES_URL, "POST", body);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setForm({ ...form, zipCode: "", buildingName: "", sigungu: "", apartmentId: "", reason: "" });
    mutate();
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    const r = await callApi(RULES_URL, "PATCH", { id, ...body });
    if (!r.ok) setErr(r.error);
    mutate();
  };

  const remove = async (rule: Rule) => {
    if (!confirm(`이 ${rule.action === "ALLOW" ? "허용" : "차단"} 규칙을 삭제할까요?`)) return;
    const r = await callApi(RULES_URL, "DELETE", { id: rule.id });
    if (!r.ok) setErr(r.error);
    mutate();
  };

  const targetText = (r: Rule) => {
    if (r.apartment) return `단지 ${r.apartment.name}${r.apartment.sigungu || r.apartment.bname ? ` (${[r.apartment.sigungu, r.apartment.bname].filter(Boolean).join(" ")})` : ""}`;
    if (r.zipCode) return `우편번호 ${r.zipCode}`;
    if (r.buildingName) return `건물명 "${r.buildingName}"${r.sigungu ? ` (${r.sigungu})` : ""}`;
    return "-";
  };

  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">
        예외 규칙은 권역보다 우선합니다. <b>차단</b> 규칙은 모드와 무관하게 결제를 막고, <b>허용</b> 규칙은 권역 밖이라도 배송을 받습니다 (예: 경계에 걸친 단지).
      </p>

      <div className="bg-white rounded-xl p-5 shadow-sm border mb-6">
        <h3 className="text-sm font-bold text-gray-700 mb-3">규칙 추가</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value as RuleAction })} className={inputCls}>
            <option value="BLOCK">차단</option>
            <option value="ALLOW">허용</option>
          </select>
          <select value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value as typeof form.target })} className={inputCls}>
            <option value="zipCode">우편번호</option>
            <option value="buildingName">건물명(단지명)</option>
            <option value="apartmentId">사전등록 단지</option>
          </select>
          {form.target === "zipCode" && (
            <input type="text" placeholder="우편번호 5자리" value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} className={`${inputCls} md:col-span-2`} />
          )}
          {form.target === "buildingName" && (
            <>
              <input type="text" placeholder="건물명 (다음 주소 원문 그대로)" value={form.buildingName} onChange={(e) => setForm({ ...form, buildingName: e.target.value })} className={inputCls} />
              <input type="text" placeholder="시군구 (같은 이름 구분용, 선택)" value={form.sigungu} onChange={(e) => setForm({ ...form, sigungu: e.target.value })} className={inputCls} />
            </>
          )}
          {form.target === "apartmentId" && (
            <select value={form.apartmentId} onChange={(e) => setForm({ ...form, apartmentId: e.target.value })} className={`${inputCls} md:col-span-2`}>
              <option value="">단지 선택</option>
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.sigungu || a.bname ? ` (${[a.sigungu, a.bname].filter(Boolean).join(" ")})` : ""}</option>
              ))}
            </select>
          )}
          <div className="flex gap-2 md:col-span-2">
            <input type="text" placeholder="사유 (선택)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={`${inputCls} flex-1 min-w-0`} />
            <button type="button" onClick={add} disabled={busy || !canSubmit} className={`${btnPrimary} shrink-0`}>추가</button>
          </div>
        </div>
        {form.target === "zipCode" && form.zipCode && !/^\d{5}$/.test(form.zipCode.trim()) && <p className="text-xs text-red-500 mt-1">우편번호는 숫자 5자리입니다.</p>}
        <Msg text={err} tone="error" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-xs text-gray-500">
              <th className={thCls}>동작</th>
              <th className={thCls}>대상</th>
              <th className={thCls}>사유</th>
              <th className={thCls}>등록일</th>
              <th className="text-center px-4 py-3 font-medium">상태</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading || rules.length === 0 ? (
              <EmptyRow colSpan={6} loading={isLoading} text="예외 규칙이 없습니다." />
            ) : (
              rules.map((r) => (
                <tr key={r.id} className={`border-b last:border-0 hover:bg-gray-50 ${r.isActive ? "" : "opacity-60"}`}>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.action === "ALLOW" ? "bg-[#1D9E75]/10 text-[#1D9E75]" : "bg-red-50 text-red-600"}`}>
                      {r.action === "ALLOW" ? "허용" : "차단"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{targetText(r)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{r.reason || "-"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <Pill on={r.isActive} onLabel="적용 중" offLabel="꺼짐" onClick={() => patch(r.id, { isActive: !r.isActive })} />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <button type="button" onClick={() => remove(r)} className="text-gray-300 hover:text-red-400" title="삭제">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ───────────────────────── 탭 3. 날짜별 중지 ─────────────────────────

function SuspensionsTab() {
  const { data, isLoading, mutate } = useSWR<SuspensionsPayload>(SUSP_URL, fetcher, { revalidateOnFocus: false });
  const { data: zonesData } = useSWR<ZonesPayload>(ZONES_URL, fetcher, { revalidateOnFocus: false });
  const list = data?.suspensions ?? [];
  const activeZones = (zonesData?.zones ?? []).filter((z) => z.isActive);

  const [form, setForm] = useState({ date: "", zoneId: "", reason: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    if (!form.date || !form.reason.trim()) return;
    setBusy("add"); setMsg(null); setErr(null);
    const r = await callApi<{ held: number; impact: SuspensionImpact }>(SUSP_URL, "POST", { date: form.date, zoneId: form.zoneId || null, reason: form.reason.trim() });
    setBusy(null);
    if (!r.ok) { setErr(r.error); return; }
    const { held, impact } = r.data;
    setMsg(`등록됨 — 이미 잡힌 배송 건 ${held}건을 보류로 표시했습니다. 단건 주문 ${impact.singleOrders}건 · 구독 배송 ${impact.subscriptionDeliveries}건(구독 ${impact.subscriptions}건)`);
    setForm({ date: "", zoneId: "", reason: "" });
    mutate();
  };

  const credit = async (s: Suspension) => {
    if (!confirm(`${s.date} ${s.zone?.name ?? "전체 권역"} 중지에 걸린 결제된 구독 배송분을 크레딧으로 적립할까요?\n(건너뛰기와 같은 정산 — 다음 결제에서 차감됩니다)`)) return;
    setBusy(s.id); setMsg(null); setErr(null);
    const r = await callApi<{ credited: number; creditedAmount: number; notCreditable: number }>(SUSP_URL, "POST", { action: "credit", id: s.id });
    setBusy(null);
    if (!r.ok) { setErr(r.error); return; }
    setMsg(`구독 ${r.data.credited}건 ${won(r.data.creditedAmount)} 적립 · 크레딧 불가 ${r.data.notCreditable}건(이번 주기만 구독 — 환불 신청으로 처리)`);
    mutate();
  };

  const release = async (s: Suspension) => {
    if (!confirm(`${s.date} ${s.zone?.name ?? "전체 권역"} 중지를 해제할까요?\n보류로 표시된 배송 건이 다시 정상 흐름으로 돌아갑니다.`)) return;
    setBusy(s.id); setMsg(null); setErr(null);
    const r = await callApi<{ released: number }>(SUSP_URL, "DELETE", { id: s.id });
    setBusy(null);
    if (!r.ok) { setErr(r.error); return; }
    setMsg(`해제됨 — 보류 ${r.data.released}건을 풀었습니다.`);
    mutate();
  };

  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">
        새 주문은 그 날짜에 막히고, 이미 결제된 단건 주문은 주문 관리의 &quot;배송지 확인&quot; 큐에 보류로 올라갑니다. 단건은 기존 취소·환불 도구로 처리하세요.
        구독 배송분은 아래 &quot;구독분 크레딧 적립&quot;으로 한 번에 정산합니다.
      </p>

      <div className="bg-white rounded-xl p-5 shadow-sm border mb-6">
        <h3 className="text-sm font-bold text-gray-700 mb-3">중지 등록</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
          <select value={form.zoneId} onChange={(e) => setForm({ ...form, zoneId: e.target.value })} className={inputCls}>
            <option value="">전체 권역</option>
            {activeZones.map((z) => (
              <option key={z.id} value={z.id}>{z.name} ({kindLabel(z.kind)} {z.code})</option>
            ))}
          </select>
          <div className="flex gap-2 md:col-span-3">
            <input type="text" placeholder="사유 * (예: 폭설로 차량 진입 불가)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={`${inputCls} flex-1 min-w-0`} />
            <button type="button" onClick={add} disabled={busy !== null || !form.date || !form.reason.trim()} className={`${btnPrimary} shrink-0`}>
              {busy === "add" ? "등록 중..." : "등록"}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1">사유는 고객 안내 문구에 들어갑니다.</p>
        <Msg text={msg} />
        <Msg text={err} tone="error" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-xs text-gray-500">
              <th className={thCls}>날짜</th>
              <th className={thCls}>권역</th>
              <th className={thCls}>사유</th>
              <th className={thCls}>영향</th>
              <th className="text-right px-4 py-3 font-medium">처리</th>
            </tr>
          </thead>
          <tbody>
            {isLoading || list.length === 0 ? (
              <EmptyRow colSpan={5} loading={isLoading} text="오늘 이후 예정된 중지가 없습니다." />
            ) : (
              list.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.date}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {s.zone ? (
                      <>
                        {s.zone.name}
                        <span className="text-[11px] text-gray-400 ml-1">{kindLabel(s.zone.kind)} {s.zone.code}{s.zone.isActive ? "" : " · 비활성"}</span>
                      </>
                    ) : (
                      <span className="text-amber-700 font-medium">전체 권역</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{s.reason}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    단건 {s.impact.singleOrders} · 구독 {s.impact.subscriptionDeliveries}
                    {s.impact.subscriptions > 0 && <span className="text-gray-400"> (구독 {s.impact.subscriptions}건)</span>}
                    {!s.impact.editable && <div className="text-[11px] text-gray-400">마감 지남 — 정산 대상 아님</div>}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button type="button" onClick={() => credit(s)} disabled={busy !== null || s.impact.subscriptionDeliveries === 0} className={`${btnOutline} mr-2`} title="결제된 구독 배송분을 크레딧으로 돌립니다">
                      구독분 크레딧 적립
                    </button>
                    <button type="button" onClick={() => release(s)} disabled={busy !== null} className={btnDanger}>해제</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ───────────────────────── 탭 4. 대기 신청 ─────────────────────────

function WaitlistTab() {
  const [filter, setFilter] = useState({ sigungu: "", bname: "" });
  const [q, setQ] = useState("");
  const params = new URLSearchParams();
  if (filter.sigungu) params.set("sigungu", filter.sigungu);
  if (filter.bname) params.set("bname", filter.bname);
  if (q.trim()) params.set("q", q.trim());
  const qs = params.toString();
  const { data, isLoading, mutate } = useSWR<WaitlistPayload>(`${WAIT_URL}${qs ? `?${qs}` : ""}`, fetcher, { revalidateOnFocus: false });
  const rows = data?.rows ?? [];
  const byArea = data?.byArea ?? [];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState("365");

  // 필터가 바뀌면 선택은 의미가 없어진다
  useEffect(() => { setSelected(new Set()); }, [qs]);

  const csvParams = new URLSearchParams();
  if (filter.sigungu) csvParams.set("sigungu", filter.sigungu);
  if (filter.bname) csvParams.set("bname", filter.bname);
  if (q.trim()) csvParams.set("q", q.trim());
  csvParams.set("format", "csv");
  const csvHref = `${WAIT_URL}?${csvParams.toString()}`;

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleOne = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const markNotified = async () => {
    if (selected.size === 0) return;
    setBusy(true); setMsg(null); setErr(null);
    const r = await callApi<{ updated: number }>(WAIT_URL, "PATCH", { ids: Array.from(selected), notified: true });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setMsg(`${r.data.updated}건을 안내 완료로 표시했습니다.`);
    setSelected(new Set());
    mutate();
  };

  const removeOne = async (row: WaitRow) => {
    if (!confirm(`${row.name ?? "(이름 없음)"} · ${row.phone} 신청을 삭제할까요?`)) return;
    const r = await callApi(WAIT_URL, "DELETE", { id: row.id });
    if (!r.ok) { setErr(r.error); return; }
    mutate();
  };

  // 개인정보 보관 기간 정리 — 되돌릴 수 없으니 두 번 묻는다
  const removeOld = async () => {
    const days = Number(retentionDays);
    if (!Number.isFinite(days) || days < 30) { setErr("보관 기간은 30일 이상이어야 합니다."); return; }
    if (!confirm(`${days}일 이전에 들어온 대기 신청을 모두 삭제할까요?\n되돌릴 수 없습니다. (개인정보 보관 기간 정리)`)) return;
    setBusy(true); setMsg(null); setErr(null);
    const r = await callApi<{ deleted: number }>(WAIT_URL, "DELETE", { olderThanDays: days });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setMsg(`${r.data.deleted}건 삭제했습니다.`);
    mutate();
  };

  const hasFilter = Boolean(filter.sigungu || filter.bname);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="text-sm text-gray-500">
          총 <b className="text-gray-800">{data?.total ?? 0}</b>건
          {hasFilter && (
            <span className="ml-2">
              — 필터: {[filter.sigungu, filter.bname].filter(Boolean).join(" ")}
              <button type="button" onClick={() => setFilter({ sigungu: "", bname: "" })} className="ml-2 text-xs text-[#1D9E75] hover:underline">필터 해제</button>
            </span>
          )}
        </div>
        <input type="search" placeholder="이름·연락처·주소 검색" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} w-64`} />
      </div>

      {/* 지역별 집계 — 어느 동네부터 열어야 하는지 보는 표 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-6">
        <div className="px-4 py-2 border-b bg-gray-50 text-xs font-bold text-gray-600">지역별 집계 — 행을 누르면 그 지역만 봅니다</div>
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr className="text-xs text-gray-500">
              <th className={thCls}>시군구</th>
              <th className={thCls}>법정동</th>
              <th className="text-right px-4 py-3 font-medium">신청</th>
              <th className="text-right px-4 py-3 font-medium">마케팅 동의</th>
              <th className={thCls}>최근 신청일</th>
            </tr>
          </thead>
          <tbody>
            {isLoading || byArea.length === 0 ? (
              <EmptyRow colSpan={5} loading={isLoading} text="대기 신청이 없습니다." />
            ) : (
              byArea.map((a) => {
                const active = filter.sigungu === (a.sigungu ?? "") && filter.bname === (a.bname ?? "");
                return (
                  <tr
                    key={`${a.sido}|${a.sigungu}|${a.bname}`}
                    onClick={() => setFilter({ sigungu: a.sigungu ?? "", bname: a.bname ?? "" })}
                    className={`border-b last:border-0 cursor-pointer ${active ? "bg-[#1D9E75]/5" : "hover:bg-gray-50"}`}
                  >
                    <td className="px-4 py-2 text-gray-800">{[a.sido, a.sigungu].filter(Boolean).join(" ") || "-"}</td>
                    <td className="px-4 py-2 text-gray-800">{a.bname ?? "-"}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-800">{a.count}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{a.consent}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{fmtDate(a.lastAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 상세 목록 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button type="button" onClick={markNotified} disabled={busy || selected.size === 0} className={btnPrimary}>
          선택 안내 완료 표시{selected.size > 0 ? ` (${selected.size})` : ""}
        </button>
        <a href={csvHref} download className={btnOutline}>CSV 다운로드</a>
        <div className="ml-auto flex items-center gap-2">
          <input type="number" min={30} value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} className={`${inputCls} w-24`} />
          <button type="button" onClick={removeOld} disabled={busy} className={btnDanger}>일 이전 신청 삭제</button>
        </div>
      </div>
      <Msg text={msg} />
      <Msg text={err} tone="error" />
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden mt-2">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-xs text-gray-500">
              <th className="px-3 py-3 w-8"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
              <th className={thCls}>신청일</th>
              <th className={thCls}>이름</th>
              <th className={thCls}>연락처</th>
              <th className={thCls}>우편번호</th>
              <th className={thCls}>주소</th>
              <th className="text-center px-4 py-3 font-medium">동의</th>
              <th className={thCls}>경로</th>
              <th className={thCls}>안내발송일</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading || rows.length === 0 ? (
              <EmptyRow colSpan={10} loading={isLoading} text="조건에 맞는 신청이 없습니다." />
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-3"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-800">{r.name ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-700">{r.phone}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.zipCode ?? "-"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {r.address1 ?? [r.sido, r.sigungu, r.bname].filter(Boolean).join(" ")}
                    {r.buildingName && <span className="text-gray-400"> ({r.buildingName})</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-xs">{r.marketingConsent ? <span className="text-[#1D9E75] font-medium">Y</span> : <span className="text-gray-400">N</span>}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.source ?? "-"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.notifiedAt ? fmtDate(r.notifiedAt) : <span className="text-gray-300">미발송</span>}</td>
                  <td className="px-2 py-3 text-center">
                    <button type="button" onClick={() => removeOne(r)} className="text-gray-300 hover:text-red-400" title="삭제">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ───────────────────────── 탭 5. 결제 보류 구독자 ─────────────────────────

function BlockedTab() {
  const { data, isLoading, mutate } = useSWR<BlockedPayload>(BLOCKED_URL, fetcher, { revalidateOnFocus: false });
  const list = data?.subscriptions ?? [];
  const [busy, setBusy] = useState<"recheck" | "scan" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (action: "recheck" | "scan") => {
    if (action === "scan" && !confirm("활성 구독 전체를 지금 규칙으로 다시 훑습니다. 권역 밖인 구독은 결제 보류로 표시됩니다. 계속할까요?")) return;
    setBusy(action); setMsg(null); setErr(null);
    const r = await callApi<RecheckResult>(BLOCKED_URL, "POST", { action });
    setBusy(null);
    if (!r.ok) { setErr(r.error); return; }
    const d = r.data;
    setMsg(`${action === "recheck" ? "다시 판정" : "전체 점검"} 완료 — 점검 ${d.checked}건 · 해제 ${d.cleared}건 · 계속 보류 ${d.stillBlocked}건 · 새로 보류 ${d.newlyBlocked}건`);
    mutate();
  };

  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
        <p className="text-sm text-amber-900">
          권역이 비활성화되거나 차단 규칙에 걸려 자동결제를 건너뛴 구독입니다. 권역을 다시 켜면 다음 아침 크론에서 자동 청구됩니다.
          고객에게는 별도 안내가 나가지 않으니 필요하면 연락하세요.
        </p>
      </div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button type="button" onClick={() => run("recheck")} disabled={busy !== null} className={btnPrimary} title="보류 표시된 구독만 지금 규칙으로 다시 판정합니다">
          {busy === "recheck" ? "판정 중..." : "다시 판정"}
        </button>
        <button type="button" onClick={() => run("scan")} disabled={busy !== null} className={btnOutline} title="활성 구독 전체를 훑어 권역 밖인 것을 찾습니다 — 권역을 끈 직후 확인용">
          {busy === "scan" ? "점검 중..." : "활성 구독 전체 점검"}
        </button>
        <span className="text-sm text-gray-500 ml-auto">보류 <b className="text-amber-700">{list.length}</b>건</span>
      </div>
      <Msg text={msg} />
      <Msg text={err} tone="error" />
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden mt-2">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-xs text-gray-500">
              <th className={thCls}>고객</th>
              <th className={thCls}>배송지</th>
              <th className={thCls}>권역</th>
              <th className={thCls}>보류 사유</th>
              <th className={thCls}>보류 시각</th>
              <th className={thCls}>다음 결제일</th>
              <th className={thCls}>구독</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading || list.length === 0 ? (
              <EmptyRow colSpan={8} loading={isLoading} text="결제가 보류된 구독이 없습니다." />
            ) : (
              list.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{s.user.name ?? "(이름 없음)"}</div>
                    <div className="text-xs text-gray-500">{s.user.phone ?? s.user.email ?? "-"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {s.address ? (
                      <>
                        {s.address.address1}{s.address.buildingName && <span className="text-gray-400"> ({s.address.buildingName})</span>}
                        <div className="font-mono text-gray-400">{s.address.zipCode ?? "-"}</div>
                      </>
                    ) : (
                      <span className="text-red-400">배송지 없음</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {s.address?.zone ? (
                      <>
                        <span className="text-gray-800">{s.address.zone.name}</span>{" "}
                        <Pill on={s.address.zone.isActive} onLabel="활성" offLabel="비활성" />
                      </>
                    ) : (
                      <span className="text-gray-500">{s.address?.areaReason ?? s.address?.areaStatus ?? "권역 없음"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{s.zoneBlockedReason ?? "-"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDateTime(s.zoneBlockedAt)}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{fmtDate(s.nextBillingDate)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {s.status}
                    <div className="text-gray-400">{s.cycleWeeks}주 · {won(s.price)}</div>
                  </td>
                  <td className="px-2 py-3 text-center">
                    {/* 구독 상세 페이지는 아직 없다 — 목록을 고객 이름으로 검색한 상태로 연다 */}
                    <Link href={`/admin/subscriptions?search=${encodeURIComponent(s.user.name ?? "")}`} className="text-xs text-[#1D9E75] hover:underline whitespace-nowrap">구독 보기</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ───────────────────────── 페이지 ─────────────────────────

type TabKey = "zones" | "rules" | "suspensions" | "waitlist" | "blocked";
const TABS: { key: TabKey; label: string }[] = [
  { key: "zones", label: "권역 목록" },
  { key: "rules", label: "예외 규칙" },
  { key: "suspensions", label: "날짜별 중지" },
  { key: "waitlist", label: "대기 신청" },
  { key: "blocked", label: "결제 보류 구독자" },
];

export default function DeliveryZonesClient() {
  const [tab, setTab] = useState<TabKey>("zones");
  // 모드 배지와 보류 건수는 어느 탭에 있든 보여야 하므로 페이지에서 한 번 불러둔다 (탭과 캐시 키를 공유)
  const { data: zonesData } = useSWR<ZonesPayload>(ZONES_URL, fetcher, { revalidateOnFocus: false });
  const { data: blockedData } = useSWR<BlockedPayload>(BLOCKED_URL, fetcher, { revalidateOnFocus: false });
  const mode = zonesData?.mode;
  const blockedCount = blockedData?.subscriptions.length ?? 0;

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">배송 권역</h2>
          <p className="text-sm text-gray-500 mt-1">
            우편번호·법정동 단위로 배송 가능 지역을 관리합니다. 권역 밖 고객은 오픈 알림을 신청해 두고, 권역이 열리면 여기서 안내합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {mode === "ZONES" ? (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#1D9E75]/10 text-[#1D9E75]">권역 모드 (권역 밖 결제 차단)</span>
          ) : mode === "LEGACY" ? (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">기존 규칙 모드 (권역 밖도 보류 접수)</span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-400">모드 확인 중...</span>
          )}
          <Link href="/admin/settings" className="text-xs text-[#1D9E75] hover:underline">모드 변경</Link>
        </div>
      </div>

      <div className="flex gap-1 border-b mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition ${tab === t.key ? "border-[#1D9E75] text-[#1D9E75] font-medium" : "border-transparent text-gray-500 hover:text-gray-800"}`}
          >
            {t.label}
            {t.key === "blocked" && blockedCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">{blockedCount}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "zones" && <ZonesTab onGoBlocked={() => setTab("blocked")} />}
      {tab === "rules" && <RulesTab />}
      {tab === "suspensions" && <SuspensionsTab />}
      {tab === "waitlist" && <WaitlistTab />}
      {tab === "blocked" && <BlockedTab />}
    </div>
  );
}
