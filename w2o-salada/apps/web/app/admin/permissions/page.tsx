"use client";

import { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { fetcher } from "../../lib/fetcher";
import { ALL_PERMISSIONS, PERMISSION_LABELS, type AdminPermission } from "../../lib/auth-guard";

type Member = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string | null;
  provider: string | null;
};

export default function PermissionsPage() {
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;

  const { data, isLoading: loading, mutate } = useSWR<Member[]>("/api/admin/members", fetcher, { revalidateOnFocus: false });
  const admins = (Array.isArray(data) ? data : []).filter((m) => m.role === "ADMIN");

  const [editMember, setEditMember] = useState<Member | null>(null);
  const [saving, setSaving] = useState(false);

  const parsePerms = (p: string | null): AdminPermission[] | null => {
    if (p === null) return null;
    try { return JSON.parse(p); } catch { return null; }
  };

  const handlePermissionSave = async (member: Member, perms: AdminPermission[] | null) => {
    setSaving(true);
    await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: member.id, permissions: perms }),
    });
    setSaving(false);
    setEditMember(null);
    mutate();
  };

  const handleRoleRemove = async (member: Member) => {
    if (!confirm(`${member.name}님의 관리자 권한을 해제하시겠습니까?`)) return;
    setSaving(true);
    await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: member.id, role: "CUSTOMER" }),
    });
    setSaving(false);
    mutate();
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">관리자 권한</h2>
        <p className="text-sm text-gray-500 mt-1">관리자별 접근 가능한 영역을 설정합니다</p>
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
              admins.map((m) => {
                const perms = parsePerms(m.permissions);
                const isSelf = m.id === currentUserId;

                return (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{m.name}</span>
                        {isSelf && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">나</span>}
                        {perms === null && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EF9F27]/10 text-[#EF9F27] font-semibold">슈퍼</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{m.email}</td>
                    <td className="px-5 py-4">
                      {perms === null ? (
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
                      {!isSelf ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditMember(m)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                            title="권한 편집"
                          >
                            <span className="material-symbols-outlined text-lg text-gray-400">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRoleRemove(m)}
                            disabled={saving}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition"
                            title="관리자 해제"
                          >
                            <span className="material-symbols-outlined text-lg text-red-400">person_remove</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 권한 편집 모달 */}
      {editMember && (
        <PermissionModal
          member={editMember}
          onClose={() => setEditMember(null)}
          onSave={handlePermissionSave}
          saving={saving}
        />
      )}
    </div>
  );
}

function PermissionModal({
  member,
  onClose,
  onSave,
  saving,
}: {
  member: Member;
  onClose: () => void;
  onSave: (member: Member, perms: AdminPermission[] | null) => void;
  saving: boolean;
}) {
  const currentPerms = member.permissions
    ? (() => { try { return JSON.parse(member.permissions) as AdminPermission[]; } catch { return null; } })()
    : null;

  const [isSuperAdmin, setIsSuperAdmin] = useState(currentPerms === null);
  const [selected, setSelected] = useState<AdminPermission[]>(currentPerms ?? [...ALL_PERMISSIONS]);

  const togglePerm = (perm: AdminPermission) => {
    setSelected((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSave = () => {
    onSave(member, isSuperAdmin ? null : selected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold text-gray-900">권한 설정</h3>
              <p className="text-sm text-gray-500 mt-0.5">{member.name} ({member.email})</p>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isSuperAdmin}
                onChange={(e) => setIsSuperAdmin(e.target.checked)}
                className="w-4 h-4"
              />
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
                    selected.includes(perm)
                      ? "bg-[#1D9E75]/5 border-[#1D9E75]/30"
                      : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(perm)}
                    onChange={() => togglePerm(perm)}
                    className="w-4 h-4 accent-[#1D9E75]"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">{PERMISSION_LABELS[perm]}</div>
                  </div>
                  {selected.includes(perm) && (
                    <span className="material-symbols-outlined text-[#1D9E75] text-lg">check_circle</span>
                  )}
                </label>
              ))}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || (!isSuperAdmin && selected.length === 0)}
              className="flex-1 py-2.5 bg-[#1D9E75] text-white rounded-xl text-sm font-bold hover:bg-[#178a64] transition disabled:opacity-50"
            >
              {saving ? "저장 중..." : "권한 저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
