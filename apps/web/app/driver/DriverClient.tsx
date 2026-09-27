"use client";

import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { signOut } from "next-auth/react";
import { fetcher } from "../lib/fetcher";
import { FileTooLargeError, prepareUpload } from "../lib/compress-image";

type Stop = {
  deliveryId: string;
  orderNo: string;
  isSubscription: boolean;
  status: "PENDING" | "IN_TRANSIT" | "DELIVERED" | "FAILED";
  photoUrl: string | null;
  memo: string | null;
  completedAt: string | null;
  sortOrder: number;
  receiver: string;
  phone: string;
  zipCode: string;
  address1: string;
  address2: string;
  buildingName: string;
  floor: string;
  entranceMethod: string;
  entrancePassword: string;
  dropLocation: string;
  dropNote: string;
  deliveryMemo: string;
  lat: number | null;
  lng: number | null;
  items: Array<{ name: string; quantity: number; isOption: boolean }>;
};

type Route = {
  id: string;
  name: string;
  color: string | null;
  vehicleNo: string | null;
  isMine: boolean;
  summary: { total: number; boxes: number; pending: number; inTransit: number; delivered: number; failed: number };
  products: Array<{ name: string; quantity: number; isOption: boolean }>;
  stops: Stop[];
};

type Today = { date: string; driverName: string; isAdmin: boolean; routes: Route[] };
type Filter = "all" | "remaining" | "done";

const DROP_LABEL: Record<string, string> = { DOOR: "문 앞", SECURITY_OFFICE: "경비실", PARCEL_BOX: "택배함", OTHER: "기타" };

function todayKst() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function shiftDate(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function dateLabel(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}
function timeLabel(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}
function accessLine(s: Stop) {
  const parts: string[] = [];
  if (s.floor) parts.push(s.floor);
  if (s.entranceMethod) parts.push(s.entranceMethod);
  if (s.entrancePassword) parts.push("비번 " + s.entrancePassword);
  if (s.dropLocation !== "DOOR") {
    const where = DROP_LABEL[s.dropLocation] ?? s.dropLocation;
    parts.push("→ " + where + (s.dropNote ? " (" + s.dropNote + ")" : ""));
  } else if (s.dropNote) {
    parts.push(s.dropNote);
  }
  return parts.join(" · ");
}
function mapLink(s: Stop) {
  if (s.lat != null && s.lng != null) {
    return "https://map.kakao.com/link/to/" + encodeURIComponent(s.receiver) + "," + s.lat + "," + s.lng;
  }
  return "https://map.kakao.com/link/search/" + encodeURIComponent(s.address1);
}

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "요청에 실패했습니다.");
  return json;
}

export default function DriverClient({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const [date, setDate] = useState(todayKst());
  const [filter, setFilter] = useState<Filter>("remaining");
  const { data, error, isLoading, mutate } = useSWR<Today>("/api/driver/today?date=" + date, fetcher, {
    refreshInterval: 60_000,
  });

  const totals = useMemo(() => {
    const t = { total: 0, delivered: 0, failed: 0 };
    for (const r of data?.routes ?? []) {
      t.total += r.summary.total;
      t.delivered += r.summary.delivered;
      t.failed += r.summary.failed;
    }
    return t;
  }, [data]);

  const isToday = date === todayKst();
  const progressWidth = totals.total ? (totals.delivered / totals.total) * 100 + "%" : "0%";

  return (
    <div className="mx-auto max-w-2xl pb-24">
      {/* 상단 바 */}
      <header className="sticky top-0 z-20 bg-[#0A1A0F] text-white px-4 pt-3 pb-3 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] tracking-[0.25em] text-[#5DCAA5]">W2O SALADA</div>
            <div className="text-lg font-bold leading-tight">
              배송 기사 · {name}
              {isAdmin && <span className="ml-2 text-[11px] font-normal text-amber-300">관리자 점검</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/80 active:bg-white/10"
          >
            로그아웃
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-white/10 px-2 py-1.5">
          <button type="button" aria-label="이전 날" onClick={() => setDate((d) => shiftDate(d, -1))} className="h-9 w-9 rounded-lg text-xl active:bg-white/10">
            ‹
          </button>
          <button type="button" onClick={() => setDate(todayKst())} className="text-sm font-semibold">
            {dateLabel(date)}
            {isToday && <span className="ml-1 text-[11px] font-normal text-[#5DCAA5]">오늘</span>}
          </button>
          <button type="button" aria-label="다음 날" onClick={() => setDate((d) => shiftDate(d, 1))} className="h-9 w-9 rounded-lg text-xl active:bg-white/10">
            ›
          </button>
        </div>
      </header>

      {/* 진행 요약 */}
      {data && data.routes.length > 0 && (
        <div className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-end justify-between">
            <div className="text-sm text-gray-500">배송 진행</div>
            <div className="text-2xl font-black text-[#1D9E75]">
              {totals.delivered}
              <span className="text-base font-semibold text-gray-400"> / {totals.total}곳</span>
            </div>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-gradient-to-r from-[#1D9E75] to-[#5DCAA5] transition-all" style={{ width: progressWidth }} />
          </div>
          {totals.failed > 0 && <div className="mt-2 text-xs text-red-600">배송 못한 곳 {totals.failed}건 — 사무실에 연락해 주세요</div>}
          <div className="mt-3 flex gap-1 rounded-xl bg-gray-100 p-1 text-sm">
            {(
              [
                ["remaining", "남은 곳"],
                ["done", "완료"],
                ["all", "전체"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={"flex-1 rounded-lg py-2 font-semibold " + (filter === k ? "bg-white text-[#0A1A0F] shadow-sm" : "text-gray-500")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 본문 */}
      <div className="px-4">
        {isLoading && <div className="py-16 text-center text-gray-400">불러오는 중…</div>}
        {error && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            목록을 불러오지 못했습니다.{" "}
            <button type="button" className="underline" onClick={() => mutate()}>
              다시 시도
            </button>
          </div>
        )}
        {data && data.routes.length === 0 && (
          <div className="mt-10 rounded-2xl bg-white p-8 text-center shadow-sm">
            <div className="text-4xl">🚚</div>
            <div className="mt-3 font-bold">배정된 코스가 없습니다</div>
            <div className="mt-1 text-sm text-gray-500">사무실에서 코스에 기사 계정을 연결하면 여기에 배송 목록이 나타납니다.</div>
          </div>
        )}
        {data?.routes.map((route) => (
          <RouteSection key={route.id} route={route} date={date} filter={filter} onChanged={() => mutate()} />
        ))}
      </div>
    </div>
  );
}

function RouteSection({ route, date, filter, onChanged }: { route: Route; date: string; filter: Filter; onChanged: () => void }) {
  const [showLoad, setShowLoad] = useState(false);
  const [starting, setStarting] = useState(false);
  const s = route.summary;
  const canStart = s.pending > 0 && s.inTransit === 0 && s.delivered === 0 && s.failed === 0;

  const stops = route.stops.filter((st) => {
    if (filter === "remaining") return st.status !== "DELIVERED";
    if (filter === "done") return st.status === "DELIVERED";
    return true;
  });

  const start = async () => {
    if (!confirm(route.name + " 배송을 출발합니다.\n고객 " + s.pending + "명에게 '배송 출발' 알림이 나갑니다.")) return;
    setStarting(true);
    try {
      await postJson("/api/driver/routes/" + route.id + "/start", { date });
      onChanged();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <section className="mt-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: route.color ?? "#1D9E75" }} />
          <div className="text-lg font-bold">{route.name}</div>
          {route.vehicleNo && <span className="text-xs text-gray-400">{route.vehicleNo}</span>}
          <div className="ml-auto text-sm text-gray-500">
            {s.total}곳 · {s.boxes}개
          </div>
        </div>

        {s.total === 0 ? (
          <div className="mt-3 text-sm text-gray-400">이 날짜에 배송이 없습니다.</div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setShowLoad((v) => !v)}
              className="mt-3 flex w-full items-center justify-between rounded-xl bg-[#f3f7f4] px-3 py-2.5 text-sm font-semibold"
            >
              <span>📦 상차 체크리스트</span>
              <span className="text-gray-400">{showLoad ? "접기" : "펼치기"}</span>
            </button>
            {showLoad && (
              <ul className="mt-2 divide-y rounded-xl border">
                {route.products.map((p) => (
                  <li key={p.name} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>
                      {p.name}
                      {p.isOption && <span className="ml-1 text-[10px] text-amber-600">옵션</span>}
                    </span>
                    <b>{p.quantity}개</b>
                  </li>
                ))}
              </ul>
            )}
            {canStart && (
              <button
                type="button"
                onClick={start}
                disabled={starting}
                className="mt-3 w-full rounded-xl bg-[#1D9E75] py-3.5 text-base font-bold text-white shadow-md shadow-[#1D9E75]/30 active:bg-[#167A5B] disabled:opacity-60"
              >
                {starting ? "출발 처리 중…" : "🚚 배송 출발"}
              </button>
            )}
          </>
        )}
      </div>

      {stops.length === 0 && s.total > 0 && (
        <div className="py-8 text-center text-sm text-gray-400">
          {filter === "remaining" ? "남은 배송이 없습니다. 수고하셨습니다! 🎉" : "해당하는 배송이 없습니다."}
        </div>
      )}
      <div className="mt-3 space-y-3">
        {stops.map((st) => (
          <StopCard key={st.deliveryId} stop={st} onChanged={onChanged} />
        ))}
      </div>
    </section>
  );
}

const STATUS_BADGE: Record<Stop["status"], { label: string; cls: string }> = {
  PENDING: { label: "대기", cls: "bg-gray-100 text-gray-600" },
  IN_TRANSIT: { label: "배송중", cls: "bg-blue-50 text-blue-700" },
  DELIVERED: { label: "완료", cls: "bg-[#1D9E75]/10 text-[#1D9E75]" },
  FAILED: { label: "배송 못함", cls: "bg-red-50 text-red-700" },
};

function StopCard({ stop, onChanged }: { stop: Stop; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"photo" | "fail" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const done = stop.status === "DELIVERED";
  const access = accessLine(stop);
  const badge = STATUS_BADGE[stop.status];

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy("photo");
    setMsg(null);
    try {
      const prepared = await prepareUpload(file);
      const fd = new FormData();
      fd.append("file", prepared);
      const res = await fetch("/api/driver/deliveries/" + stop.deliveryId + "/complete", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "업로드에 실패했습니다.");
      onChanged();
    } catch (e) {
      setMsg(e instanceof FileTooLargeError ? "사진 용량이 너무 큽니다. 다시 찍어 주세요." : (e as Error).message);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onFail = async () => {
    const memo = prompt("배송하지 못한 이유를 적어 주세요.\n(예: 공동현관 출입 불가, 주소 불명, 고객 요청)", stop.memo ?? "");
    if (memo === null) return;
    if (!memo.trim()) {
      alert("사유를 입력해야 합니다.");
      return;
    }
    setBusy("fail");
    setMsg(null);
    try {
      await postJson("/api/driver/deliveries/" + stop.deliveryId + "/fail", { memo });
      onChanged();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const cardCls =
    "rounded-2xl bg-white p-4 shadow-sm" + (done ? " opacity-80" : "") + (stop.status === "FAILED" ? " ring-2 ring-red-200" : "");
  const numCls =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black " + (done ? "bg-[#1D9E75] text-white" : "bg-[#0A1A0F] text-white");
  const photoBtnCls =
    "flex-[2] rounded-xl py-3.5 text-base font-bold shadow-md disabled:opacity-60 " +
    (done ? "border border-[#1D9E75] bg-white text-[#1D9E75] shadow-none" : "bg-[#EF9F27] text-white shadow-[#EF9F27]/30 active:bg-[#D48A1E]");

  return (
    <article className={cardCls}>
      <div className="flex items-start gap-3">
        <div className={numCls}>{stop.sortOrder}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-base font-bold">{stop.receiver}</span>
            {stop.isSubscription && <span className="rounded bg-[#1D9E75]/10 px-1.5 text-[10px] font-semibold text-[#1D9E75]">구독</span>}
            <span className={"rounded px-1.5 py-0.5 text-[11px] font-semibold " + badge.cls}>{badge.label}</span>
            {done && stop.completedAt && <span className="text-[11px] text-gray-400">{timeLabel(stop.completedAt)}</span>}
          </div>
          <div className="mt-1 text-sm leading-snug text-gray-800">
            {stop.address1}
            {stop.buildingName && !stop.address1.includes(stop.buildingName) ? " (" + stop.buildingName + ")" : ""}
            {stop.address2 && <span className="font-semibold"> {stop.address2}</span>}
          </div>
          {access && <div className="mt-1 text-sm font-semibold text-blue-700">🔑 {access}</div>}
          {stop.deliveryMemo && <div className="mt-1 text-sm text-amber-700">* {stop.deliveryMemo}</div>}
          {stop.status === "FAILED" && stop.memo && <div className="mt-1 text-sm text-red-700">사유: {stop.memo}</div>}
        </div>
      </div>

      {/* 구성 */}
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {stop.items.map((it, i) => (
          <li key={i} className={"rounded-lg px-2 py-1 text-xs " + (it.isOption ? "bg-amber-50 text-amber-800" : "bg-[#f3f7f4] text-gray-800")}>
            {it.name} <b>×{it.quantity}</b>
          </li>
        ))}
      </ul>

      {/* 연락·지도 */}
      <div className="mt-3 flex gap-2 text-sm">
        {stop.phone && (
          <a href={"tel:" + stop.phone.replace(/-/g, "")} className="flex-1 rounded-xl border py-2.5 text-center font-semibold text-gray-700 active:bg-gray-50">
            📞 전화
          </a>
        )}
        <a href={mapLink(stop)} target="_blank" rel="noreferrer" className="flex-1 rounded-xl border py-2.5 text-center font-semibold text-gray-700 active:bg-gray-50">
          🗺 지도
        </a>
      </div>

      {/* 완료 사진 */}
      {done && stop.photoUrl && (
        <a href={stop.photoUrl} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-xl border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={stop.photoUrl} alt="배송 완료 사진" className="h-40 w-full object-cover" />
        </a>
      )}

      {/* 액션 */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy !== null} onClick={() => fileRef.current?.click()} className={photoBtnCls}>
          {busy === "photo" ? "올리는 중…" : done ? "📷 사진 다시 찍기" : "📷 사진 찍고 완료"}
        </button>
        {!done && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={onFail}
            className="flex-1 rounded-xl border border-red-200 py-3.5 text-sm font-semibold text-red-700 active:bg-red-50 disabled:opacity-60"
          >
            {busy === "fail" ? "…" : "배송 못함"}
          </button>
        )}
      </div>
      {!done && <div className="mt-2 text-center text-[11px] text-gray-400">문 앞에 둔 상태를 사진으로 남겨야 완료됩니다</div>}
      {msg && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</div>}
    </article>
  );
}
