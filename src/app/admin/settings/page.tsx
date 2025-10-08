"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

type StoredUser = { uid: string; email: string; name?: string; role: "user" | "admin"; password?: string };

const LS_USERS = "auth.users.v1";

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<Record<string, StoredUser>>({});

  useEffect(() => {
    if (user?.role !== "admin") {
      router.replace("/");
      return;
    }
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(LS_USERS) : null;
    setUsers(raw ? JSON.parse(raw) : {});
  }, [user, router]);

  const list = useMemo(() => Object.values(users).sort((a, b) => a.email.localeCompare(b.email)), [users]);

  const updateRole = (email: string, role: "user" | "admin") => {
    const updated = { ...users, [email]: { ...users[email], role } };
    setUsers(updated);
    window.localStorage.setItem(LS_USERS, JSON.stringify(updated));
  };

  const removeUser = (email: string) => {
    const updated = { ...users };
    delete updated[email];
    setUsers(updated);
    window.localStorage.setItem(LS_USERS, JSON.stringify(updated));
  };

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
            {list.map((u) => (
              <tr key={u.email} className="border-t">
                <td className="py-2">{u.email}</td>
                <td className="py-2">{u.name ?? "-"}</td>
                <td className="py-2">
                  <select
                    className="border rounded-md px-2 py-1"
                    value={u.role}
                    onChange={(e) => updateRole(u.email, e.target.value as any)}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="py-2 text-right">
                  <button className="btn btn-outline" onClick={() => removeUser(u.email)}>삭제</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
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


