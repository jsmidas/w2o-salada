"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";
import { ALL_PERMISSIONS, PERMISSION_LABELS, type AdminPermission } from "../../lib/auth-guard";

type Member = {
  id: string;
  username: string | null;
  email: string;
  name: string;
  phone?: string | null;
  role: string;
  permissions: string | null;
  provider: string | null;
};

/** 계정 정보 수정에 쓰는 필드 (비밀번호는 입력했을 때만 전송) */
type AccountFields = { name: string; username: string; email: string; phone: string; newPassword: string };

type NewAccount = { username: string; name: string; email: string; phone: string; password: string; role: "ADMIN" | "DRIVER" };

async function callApi(method: "POST" | "PATCH", body: unknown): Promise<string | null> {
  const res = await fetch("/api/admin/members", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return null;
  const err = await res.json().catch(() => ({}));
  return (err as { error?: string }).error ?? "요청에 실패했습니다.";
}

export default function PermissionsClient({
  currentUserId,
  initialMembers,
}: {
  currentUserId: string;
  initialMembers: Member[];
}) {
  const { data, isLoading: loading, mutate } = useSWR<Member[]>("/api/admin/members", fetcher, {
    fallbackData: initialMembers,
    revalidateOnFocus: false,
  });
  const allMembers = Array.isArray(data) ? data : [];
  const admins = allMembers.filter((m) => m.role === "ADMIN");
  const drivers = allMembers.filter((m) => m.role === "DRIVER");
  const nonAdmins = allMembers.filter((m) => m.role !== "ADMIN");

  const [editMember, setEditMember] = useState<Member | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const parsePerms = (p: string | null): AdminPermission[] | null => {
    if (p === null) return null;
    try { return JSON.parse(p); } catch { return null; }
  };

  const run = async (method: "POST" | "PATCH", body: unknown, onOk: () => void) => {
    setSaving(true);
    const err = await callApi(method, body);
    setSaving(false);
    if (err) { alert(err); return; }
    onOk();
    mutate();
  };

  /** 권한 + 계정 정보 저장 (자기 자신은 계정 정보만) */
  const handleEditSave = (member: Member, perms: AdminPermission[] | null | undefined, account: Partial<AccountFields>) => {
    const body: Record<string, unknown> = { userId: member.id, ...account };
    if (perms !== undefined) body.permissions = perms;
    if (!body.newPassword) delete body.newPassword;
    run("PATCH", body, () => setEditMember(null));
  };

  const handleAddExisting = (memberId: string, perms: AdminPermission[] | null) =>
    run("PATCH", { userId: memberId, role: "ADMIN", permissions: perms }, () => setShowAddModal(false));

  const handleCreate = (account: NewAccount, perms: AdminPermission[] | null) =>
    run("POST", { ...account, permissions: perms }, () => setShowAddModal(false));

  const handleRoleRemove = (member: Member) => {
    if (!confirm(`${member.name}님의 관리자 권한을 해제하시겠습니까?\n(계정은 일반 회원으로 남습니다)`)) return;
    run("PATCH", { userId: member.id, role: "CUSTOMER" }, () => {});
  };

  const renderRow = (m: Member) => {
    const perms = parsePerms(m.permissions);
    const isSelf = m.id === currentUserId;
    return (
      <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
        <td className="px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-800">{m.name}</span>
            {isSelf && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">나</span>}
            {m.role === "ADMIN" && perms === null && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EF9F27]/10 text-[#EF9F27] font-semibold">슈퍼</span>
            )}
            {m.role === "DRIVER" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-semibold">기사</span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            아이디 {m.username ? <span className="text-gray-600 font-medium">{m.username}</span> : <span className="text-gray-300">없음</span>}
            {m.provider && m.provider !== "email" && <span className="ml-2 text-gray-400">({m.provider} 로그인)</span>}
          </div>
        </td>
        <td className="px-5 py-4 text-sm text-gray-600">{m.email}</td>
        <td className="px-5 py-4">
          {m.role !== "ADMIN" ? (
            <span className="text-xs text-gray-400">관리자 메뉴 없음</span>
          ) : perms === null ? (
            <span className="text-sm text-[#EF9F27] font-medium">전체 권한</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {perms.map((p) => (
                <span key={p} className="px-2 py-0.5 rounded-full bg-[#1D9E75]/10 text-[#1D9E75] text-[11px] font-medium">
                  {PERMISSION_LABELS[p as AdminPermission]?.replace(/ \(.*\)/, "") ?? p}
                </span>
              ))}
              {perms.length === 0 && <span className="text-xs text-red-400">권한 없음</span>}
            </div>
          )}
        </td>
        <td className="px-5 py-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => setEditMember(m)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition"
              title={isSelf ? "내 계정 정보 수정" : "권한·계정 정보 편집"}
            >
              <span className="material-symbols-outlined text-lg text-gray-400">edit</span>
            </button>
            {!isSelf && m.role === "ADMIN" && (
              <button
                type="button"
                onClick={() => handleRoleRemove(m)}
                disabled={saving}
                className="p-1.5 rounded-lg hover:bg-red-50 transition"
                title="관리자 해제"
              >
                <span className="material-symbols-outlined text-lg text-red-400">person_remove</span>
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">관리자 권한</h2>
          <p className="text-sm text-gray-500 mt-1">관리자 계정을 만들고, 계정별 접근 가능한 영역을 설정합니다</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1D9E75] text-white rounded-lg hover:bg-[#178a64] transition text-sm font-medium"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          관리자 추가
        </button>
      </div>

      {/* 권한 영역 안내 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border mb-6">
        <h3 className="text-sm font-bold text-gray-700 mb-3">권한 영역 안내</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {ALL_PERMISSIONS.map((perm) => (
            <div key={perm} className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-2 h-2 rounded-full bg-[#1D9E75]" />
              {PERMISSION_LABELS[perm]}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          슈퍼관리자는 모든 메뉴를 봅니다. 자기 자신의 권한은 바꿀 수 없고(잠금 방지), 다른 슈퍼관리자가 바꿔야 합니다.
        </p>
      </div>

      {/* 관리자 목록 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">관리자</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">이메일</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">권한</th>
              <th className="text-center px-5 py-3 text-sm font-medium text-gray-500 w-32">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-12 text-gray-400">로딩 중...</td></tr>
            ) : admins.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-12 text-gray-400">관리자가 없습니다.</td></tr>
            ) : (
              admins.map(renderRow)
            )}
          </tbody>
        </table>
      </div>

      {/* 배송 기사 계정 (기사 앱 대비) */}
      {drivers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
          <div className="px-5 py-3 border-b bg-gray-50 text-sm font-medium text-gray-500">배송 기사 계정</div>
          <table className="w-full">
            <tbody>{drivers.map(renderRow)}</tbody>
          </table>
        </div>
      )}

      {editMember && (
        <EditModal
          member={editMember}
          isSelf={editMember.id === currentUserId}
          onClose={() => setEditMember(null)}
          onSave={handleEditSave}
          saving={saving}
        />
      )}

      {showAddModal && (
        <AddAdminModal
          members={nonAdmins}
          onClose={() => setShowAddModal(false)}
          onAddExisting={handleAddExisting}
          onCreate={handleCreate}
          saving={saving}
        />
      )}
    </div>
  );
}

/* ───────────────────────── 공통: 권한 선택 ───────────────────────── */

function PermissionPicker({
  isSuperAdmin,
  setIsSuperAdmin,
  selected,
  setSelected,
}: {
  isSuperAdmin: boolean;
  setIsSuperAdmin: (v: boolean) => void;
  selected: AdminPermission[];
  setSelected: (v: AdminPermission[]) => void;
}) {
  const togglePerm = (perm: AdminPermission) =>
    setSelected(selected.includes(perm) ? selected.filter((p) => p !== perm) : [...selected, perm]);

  return (
    <>
      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={isSuperAdmin} onChange={(e) => setIsSuperAdmin(e.target.checked)} className="w-4 h-4" />
          <div>
            <div className="text-sm font-bold text-amber-900">슈퍼관리자 (전체 권한)</div>
            <div className="text-xs text-amber-700 mt-0.5">모든 메뉴와 기능에 접근할 수 있습니다</div>
          </div>
        </label>
      </div>
      {!isSuperAdmin && (
        <div className="space-y-2">
          {ALL_PERMISSIONS.map((perm) => (
            <label
              key={perm}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                selected.includes(perm) ? "bg-[#1D9E75]/5 border-[#1D9E75]/30" : "bg-gray-50 border-gray-200 hover:bg-gray-100"
              }`}
            >
              <input type="checkbox" checked={selected.includes(perm)} onChange={() => togglePerm(perm)} className="w-4 h-4 accent-[#1D9E75]" />
              <div className="flex-1 text-sm font-medium text-gray-800">{PERMISSION_LABELS[perm]}</div>
              {selected.includes(perm) && <span className="material-symbols-outlined text-[#1D9E75] text-lg">check_circle</span>}
            </label>
          ))}
        </div>
      )}
    </>
  );
}

const fieldCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]";

function PasswordField({
  value, onChange, placeholder, autoFocus,
}: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        autoFocus={autoFocus}
        className={`${fieldCls} pr-10`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        title={show ? "숨기기" : "보기"}
      >
        <span className="material-symbols-outlined text-lg">{show ? "visibility_off" : "visibility"}</span>
      </button>
    </div>
  );
}

/* ───────────────────────── 관리자 추가 (기존 회원 승격 / 새 계정 생성) ───────────────────────── */

function AddAdminModal({
  members,
  onClose,
  onAddExisting,
  onCreate,
  saving,
}: {
  members: Member[];
  onClose: () => void;
  onAddExisting: (memberId: string, perms: AdminPermission[] | null) => void;
  onCreate: (account: NewAccount, perms: AdminPermission[] | null) => void;
  saving: boolean;
}) {
  const [mode, setMode] = useState<"new" | "existing">(members.length === 0 ? "new" : "existing");
  const [step, setStep] = useState<"select" | "permissions">("select");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [account, setAccount] = useState<NewAccount>({ username: "", name: "", email: "", phone: "", password: "", role: "ADMIN" });
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [selected, setSelected] = useState<AdminPermission[]>([...ALL_PERMISSIONS]);

  const filtered = search.trim()
    ? members.filter((m) => m.name.includes(search) || m.email.includes(search) || (m.username ?? "").includes(search))
    : members;
  const selectedMember = members.find((m) => m.id === selectedId);

  const accountValid =
    /^[a-z0-9_.-]{3,30}$/i.test(account.username) &&
    account.name.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email) &&
    account.password.length >= 6;

  const canNext = mode === "existing" ? !!selectedId : accountValid;
  const setA = (k: keyof NewAccount, v: string) => setAccount((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = () => {
    const perms = isSuperAdmin ? null : selected;
    if (mode === "existing") { if (selectedId) onAddExisting(selectedId, perms); }
    else onCreate(account, account.role === "DRIVER" ? null : perms);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold text-gray-900">관리자 추가</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {step === "select"
                  ? mode === "new" ? "새 계정의 아이디와 비밀번호를 정하세요" : "관리자로 추가할 회원을 선택하세요"
                  : "부여할 권한을 선택하세요"}
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {step === "select" ? (
            <>
              {/* 방식 선택 */}
              <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4">
                {([["new", "새 계정 만들기"], ["existing", "기존 회원에서 선택"]] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMode(k)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                      mode === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mode === "new" ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">아이디 *</label>
                    <input type="text" value={account.username} onChange={(e) => setA("username", e.target.value.trim())} placeholder="영문·숫자 3~30자 (로그인에 사용)" className={fieldCls} autoFocus />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">비밀번호 *</label>
                    <PasswordField value={account.password} onChange={(v) => setA("password", v)} placeholder="6자 이상" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">이름 *</label>
                      <input type="text" value={account.name} onChange={(e) => setA("name", e.target.value)} className={fieldCls} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">전화번호</label>
                      <input type="tel" value={account.phone} onChange={(e) => setA("phone", e.target.value)} placeholder="010-0000-0000" className={fieldCls} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">이메일 *</label>
                    <input type="email" value={account.email} onChange={(e) => setA("email", e.target.value.trim())} placeholder="알림·연락용 (로그인에도 사용 가능)" className={fieldCls} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">역할</label>
                    <div className="flex gap-2">
                      {([["ADMIN", "관리자"], ["DRIVER", "배송 기사"]] as const).map(([k, label]) => (
                        <label key={k} className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${account.role === k ? "border-[#1D9E75] bg-[#1D9E75]/5 text-gray-900" : "border-gray-200 text-gray-500"}`}>
                          <input type="radio" name="role" checked={account.role === k} onChange={() => setA("role", k)} className="accent-[#1D9E75]" />
                          {label}
                        </label>
                      ))}
                    </div>
                    {account.role === "DRIVER" && (
                      <p className="text-xs text-gray-400 mt-1">기사 계정은 관리자 메뉴에 접근하지 못합니다 (기사 앱용).</p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative mb-4">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
                    <input
                      type="text"
                      placeholder="이름·아이디·이메일로 검색..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-[#1D9E75]"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <p className="text-center py-8 text-gray-400 text-sm">
                        {search ? "검색 결과가 없습니다" : "추가 가능한 회원이 없습니다. '새 계정 만들기'를 이용하세요."}
                      </p>
                    ) : (
                      filtered.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedId(m.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition ${
                            selectedId === m.id ? "bg-[#1D9E75]/10 border border-[#1D9E75]/30" : "hover:bg-gray-50 border border-transparent"
                          }`}
                        >
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 text-sm font-bold shrink-0">
                            {m.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{m.name}{m.username && <span className="text-gray-400 font-normal ml-1">({m.username})</span>}</p>
                            <p className="text-xs text-gray-400 truncate">{m.email}</p>
                          </div>
                          {selectedId === m.id && <span className="material-symbols-outlined text-[#1D9E75]">check_circle</span>}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}

              <div className="flex gap-3 mt-5">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                  취소
                </button>
                {mode === "new" && account.role === "DRIVER" ? (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canNext || saving}
                    className="flex-1 py-2.5 bg-[#1D9E75] text-white rounded-xl text-sm font-bold hover:bg-[#178a64] transition disabled:opacity-50"
                  >
                    {saving ? "생성 중..." : "기사 계정 생성"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep("permissions")}
                    disabled={!canNext}
                    className="flex-1 py-2.5 bg-[#1D9E75] text-white rounded-xl text-sm font-bold hover:bg-[#178a64] transition disabled:opacity-50"
                  >
                    다음: 권한 설정
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-4">
                <div className="w-8 h-8 bg-[#1D9E75]/20 rounded-full flex items-center justify-center text-[#1D9E75] text-sm font-bold">
                  {(mode === "existing" ? selectedMember?.name : account.name)?.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{mode === "existing" ? selectedMember?.name : `${account.name} (${account.username})`}</p>
                  <p className="text-xs text-gray-400">{mode === "existing" ? selectedMember?.email : account.email}</p>
                </div>
                <button type="button" onClick={() => setStep("select")} className="ml-auto text-xs text-[#1D9E75] hover:underline">
                  변경
                </button>
              </div>

              <PermissionPicker isSuperAdmin={isSuperAdmin} setIsSuperAdmin={setIsSuperAdmin} selected={selected} setSelected={setSelected} />

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setStep("select")} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                  이전
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving || (!isSuperAdmin && selected.length === 0)}
                  className="flex-1 py-2.5 bg-[#1D9E75] text-white rounded-xl text-sm font-bold hover:bg-[#178a64] transition disabled:opacity-50"
                >
                  {saving ? "처리 중..." : mode === "new" ? "계정 생성" : "관리자 추가"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── 편집: 권한 + 계정 정보 ───────────────────────── */

function EditModal({
  member,
  isSelf,
  onClose,
  onSave,
  saving,
}: {
  member: Member;
  isSelf: boolean;
  onClose: () => void;
  onSave: (member: Member, perms: AdminPermission[] | null | undefined, account: Partial<AccountFields>) => void;
  saving: boolean;
}) {
  const currentPerms = member.permissions
    ? (() => { try { return JSON.parse(member.permissions) as AdminPermission[]; } catch { return null; } })()
    : null;

  const [tab, setTab] = useState<"perms" | "account">(isSelf || member.role !== "ADMIN" ? "account" : "perms");
  const [isSuperAdmin, setIsSuperAdmin] = useState(currentPerms === null);
  const [selected, setSelected] = useState<AdminPermission[]>(currentPerms ?? [...ALL_PERMISSIONS]);
  const [account, setAccount] = useState<AccountFields>({
    name: member.name,
    username: member.username ?? "",
    email: member.email,
    phone: member.phone ?? "",
    newPassword: "",
  });
  const setA = (k: keyof AccountFields, v: string) => setAccount((prev) => ({ ...prev, [k]: v }));
  const isSocial = !!member.provider && member.provider !== "email";
  const canEditPerms = !isSelf && member.role === "ADMIN";

  const handleSave = () => {
    const changed: Partial<AccountFields> = {};
    if (account.name.trim() !== member.name) changed.name = account.name.trim();
    if (account.username.trim() !== (member.username ?? "")) changed.username = account.username.trim();
    if (!isSocial && account.email.trim().toLowerCase() !== member.email) changed.email = account.email.trim();
    if ((account.phone ?? "") !== (member.phone ?? "")) changed.phone = account.phone;
    if (account.newPassword) changed.newPassword = account.newPassword;
    if (changed.newPassword && changed.newPassword.length < 6) { alert("비밀번호는 6자 이상이어야 합니다."); return; }

    const perms = canEditPerms ? (isSuperAdmin ? null : selected) : undefined;
    const permsChanged = canEditPerms && JSON.stringify(perms) !== JSON.stringify(currentPerms);
    if (!permsChanged && Object.keys(changed).length === 0) { alert("변경된 내용이 없습니다."); return; }
    onSave(member, permsChanged ? perms : undefined, changed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{isSelf ? "내 계정" : "계정 편집"}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{member.name} · {member.username ?? member.email}</p>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {canEditPerms && (
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4">
              {([["perms", "권한"], ["account", "계정 정보"]] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {tab === "perms" && canEditPerms ? (
            <PermissionPicker isSuperAdmin={isSuperAdmin} setIsSuperAdmin={setIsSuperAdmin} selected={selected} setSelected={setSelected} />
          ) : (
            <div className="space-y-3">
              {isSelf && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  자기 자신의 권한은 여기서 바꿀 수 없습니다. 아이디·이메일·비밀번호만 수정됩니다.
                </p>
              )}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">아이디 (로그인용)</label>
                <input type="text" value={account.username} onChange={(e) => setA("username", e.target.value.trim())} placeholder="비우면 이메일로만 로그인" className={fieldCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">이메일</label>
                <input type="email" value={account.email} onChange={(e) => setA("email", e.target.value.trim())} readOnly={isSocial} className={`${fieldCls} ${isSocial ? "bg-gray-50 text-gray-400" : ""}`} />
                {isSocial && <p className="text-xs text-gray-400 mt-1">소셜 로그인 계정은 이메일을 바꿀 수 없습니다.</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">이름</label>
                  <input type="text" value={account.name} onChange={(e) => setA("name", e.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">전화번호</label>
                  <input type="tel" value={account.phone} onChange={(e) => setA("phone", e.target.value)} className={fieldCls} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">새 비밀번호 <span className="text-gray-400 font-normal">(바꿀 때만 입력)</span></label>
                <PasswordField value={account.newPassword} onChange={(v) => setA("newPassword", v)} placeholder="6자 이상" />
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || (canEditPerms && !isSuperAdmin && selected.length === 0)}
              className="flex-1 py-2.5 bg-[#1D9E75] text-white rounded-xl text-sm font-bold hover:bg-[#178a64] transition disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
