"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type StoredUser = { id: string; email: string; name?: string; role: "user" | "admin" };

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [loading, setLoading] = useState(true);

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
      const { error } = await supabase
        .from('users')
        .update({ role })
        .eq('id', userId);
      
      if (error) throw error;
      
      // Update local state
      setUsers(users.map(u => u.id === userId ? { ...u, role } : u));
    } catch (error) {
      console.error('Error updating role:', error);
      alert('역할 변경에 실패했습니다.');
    }
  };

  const removeUser = async (userId: string, email: string) => {
    if (!confirm(`${email} 사용자를 삭제하시겠습니까?`)) return;
    
    try {
      // Delete related data first
      await supabase.from('reports').delete().eq('user_id', userId);
      await supabase.from('survey_answers').delete().eq('user_id', userId);
      await supabase.from('user_progress').delete().eq('user_id', userId);
      
      // Delete user
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;
      
      // Update local state
      setUsers(users.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Error removing user:', error);
      alert('사용자 삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">관리자 설정</h2>
        <div className="card p-6 text-center text-slate-600">
          로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">관리자 설정</h2>
      <div className="card p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="py-2">이메일</th>
              <th className="py-2">이름</th>
              <th className="py-2">역할</th>
              <th className="py-2 text-right">액션</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="py-2">{u.email}</td>
                <td className="py-2">{u.name ?? "-"}</td>
                <td className="py-2">
                  <select
                    className="border rounded-md px-2 py-1"
                    value={u.role}
                    onChange={(e) => updateRole(u.id, e.target.value as any)}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="py-2 text-right">
                  <button className="btn btn-outline" onClick={() => removeUser(u.id, u.email)}>삭제</button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-500">등록된 사용자가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div>
        <button className="btn btn-outline" onClick={() => router.push("/admin/dashboard")}>← 대시보드로</button>
      </div>
    </div>
  );
}


