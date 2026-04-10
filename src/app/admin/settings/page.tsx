"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type StoredUser = { id: string; email: string; name?: string; role: "user" | "admin" };

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.role !== "admin") {
      router.replace("/");
      return;
    }
    loadUsers();
  }, [user, router]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, role')
        .order('email', { ascending: true });
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (userId: string, role: "user" | "admin") => {
    try {
      const { error } = await supabase.from('users').update({ role }).eq('id', userId);
      if (error) throw error;
      setUsers(users.map(u => u.id === userId ? { ...u, role } : u));
    } catch (error) {
      console.error('Error updating role:', error);
      alert('역할 변경에 실패했습니다.');
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}명의 사용자를 삭제하시겠습니까?`)) return;
    try {
      for (const userId of Array.from(selectedIds)) {
        await supabase.from('reports').delete().eq('user_id', userId);
        await supabase.from('survey_answers').delete().eq('user_id', userId);
        await supabase.from('user_progress').delete().eq('user_id', userId);
        await supabase.from('users').delete().eq('id', userId);
      }
      setUsers(users.filter(u => !selectedIds.has(u.id)));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error deleting users:', error);
      alert('사용자 삭제에 실패했습니다.');
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q);
  });

  const selectAll = () => setSelectedIds(new Set(filtered.map(u => u.id)));
  const deselectAll = () => setSelectedIds(new Set());
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">관리자 설정</h2>
        <div className="card p-6 text-center text-slate-600">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button className="btn btn-outline w-fit" onClick={() => router.push("/admin/dashboard")}>← 대시보드로</button>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">관리자 설정</h2>
        <div className="flex gap-2">
          <button className="btn btn-outline text-sm" onClick={selectAll}>전체 선택</button>
          <button className="btn btn-outline text-sm" onClick={deselectAll}>선택 해제</button>
          <button className="btn btn-outline text-sm text-red-600" onClick={bulkDelete} disabled={selectedIds.size === 0}>
            선택 삭제{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
        </div>
      </div>
      <input
        type="text"
        placeholder="이메일 또는 이름으로 검색..."
        className="input max-w-md"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="card p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="py-2 pr-4">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every(u => selectedIds.has(u.id))}
                  onChange={e => e.target.checked ? selectAll() : deselectAll()}
                />
              </th>
              <th className="py-2">이메일</th>
              <th className="py-2">이름</th>
              <th className="py-2">역할</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="py-2 pr-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(u.id)}
                    onChange={() => toggleSelect(u.id)}
                  />
                </td>
                <td className="py-2">{u.email}</td>
                <td className="py-2">{u.name ?? "-"}</td>
                <td className="py-2">
                  <select
                    className="border rounded-md px-2 py-1"
                    value={u.role}
                    onChange={(e) => updateRole(u.id, e.target.value as "user" | "admin")}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-500">
                  {search ? '검색 결과가 없습니다.' : '등록된 사용자가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
