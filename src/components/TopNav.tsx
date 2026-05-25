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
    router.replace("/");
  };
  
  // Hide navigation buttons on login/signup pages
  const isAuthPage = pathname === '/login' || pathname === '/signup';
  
  if (isAuthPage) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between py-4">
        {/* 좌측: 타이틀 + 이메일 (모바일에서 세로 스택) */}
        <div className="flex flex-col gap-0.5">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
            에니어그램 성향 기반 직무 찾기
          </Link>
          {user && (
            <span className="text-xs text-slate-400 md:hidden">
              {user.email}{user.role === "admin" ? " · admin" : ""}
            </span>
          )}
        </div>
        {/* 우측: 버튼들 */}
        {user ? (
          <div className="flex items-center gap-3 text-sm shrink-0">
            <span className="hidden md:inline text-slate-600">{user.email}{user.role === "admin" ? " · admin" : ""}</span>
            <button className="btn btn-outline" onClick={onLogout}>로그아웃</button>
          </div>
        ) : (
          !isAuthPage && (
            <div className="flex items-center gap-2 text-sm shrink-0">
              <Link href="/login" className="btn btn-outline">로그인</Link>
              <Link href="/signup" className="btn btn-primary">회원가입</Link>
            </div>
          )
        )}
      </div>
      <hr className="border-slate-200" />
    </div>
  );
}


