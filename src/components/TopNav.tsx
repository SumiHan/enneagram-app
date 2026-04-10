"use client";
import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";

export function TopNav() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };
  
  // Hide navigation buttons on login/signup pages
  const isAuthPage = pathname === '/login' || pathname === '/signup';
  
  if (isAuthPage) return null;

  return (
    <div className="flex items-center justify-between mb-4">
      <Link href="/" className="font-semibold">에니어그램 성향 기반 직무 찾기</Link>
      {user ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-600">{user.email}{user.role === "admin" ? " · admin" : ""}</span>
          <button className="btn btn-outline" onClick={onLogout}>로그아웃</button>
        </div>
      ) : (
        !isAuthPage && (
          <div className="flex items-center gap-2 text-sm">
            <Link href="/login" className="btn btn-outline">로그인</Link>
            <Link href="/signup" className="btn btn-primary">회원가입</Link>
          </div>
        )
      )}
    </div>
  );
}


