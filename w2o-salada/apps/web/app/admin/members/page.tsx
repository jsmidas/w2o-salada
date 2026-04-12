"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

type Member = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  permissions: string | null;
  provider: string | null;
  createdAt: string;
};

export default function MembersPage() {
  const { data, isLoading: loading } = useSWR<Member[]>("/api/admin/members", fetcher, { revalidateOnFocus: false });
  const members = Array.isArray(data) ? data : [];
  const [search, setSearch] = useState("");

  const filtered = members.filter((m) =>
    m.name.includes(search) || m.email.includes(search)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">회원 관리</h2>
        <span className="text-sm text-gray-500">
          총 <span className="font-bold text-gray-800">{members.length}명</span>
        </span>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border mb-4">
        <input
          type="text"
          placeholder="이름 또는 이메일 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 border rounded-lg text-sm w-full max-w-xs focus:outline-none focus:border-[#1D9E75]"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">이름</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">이메일</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">전화번호</th>
              <th className="text-center px-5 py-3 text-sm font-medium text-gray-500">가입방법</th>
              <th className="text-center px-5 py-3 text-sm font-medium text-gray-500">등급</th>
              <th className="text-center px-5 py-3 text-sm font-medium text-gray-500">가입일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">로딩 중...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">회원이 없습니다.</td></tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-4 font-medium text-gray-800">{m.name}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{m.email}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{m.phone ?? "-"}</td>
                  <td className="px-5 py-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      m.provider === "kakao" ? "bg-yellow-100 text-yellow-700" :
                      m.provider === "naver" ? "bg-green-100 text-green-700" :
                      m.provider === "google" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {m.provider === "kakao" ? "카카오" :
                       m.provider === "naver" ? "네이버" :
                       m.provider === "google" ? "구글" : "이메일"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      m.role === "ADMIN" ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"
                    }`}>
                      {m.role === "ADMIN" ? "관리자" : "일반"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center text-sm text-gray-500">
                    {new Date(m.createdAt).toLocaleDateString("ko-KR")}
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
