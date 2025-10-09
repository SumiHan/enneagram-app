"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user?.role !== "admin") router.replace("/");
  }, [user, loading, router]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">관리자 대시보드</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5 flex flex-col gap-3">
          <div className="font-semibold">설문 문항 수정</div>
          <p className="text-sm text-slate-600">사전/본 설문 문항을 CSV로 관리합니다.</p>
          <div className="mt-auto">
            <button className="btn btn-primary" onClick={() => router.push("/admin/questions-simple")}>이동</button>
          </div>
        </div>
        <div className="card p-5 flex flex-col gap-3">
          <div className="font-semibold">사용자 관리</div>
          <p className="text-sm text-slate-600">역할 변경 및 사용자 삭제</p>
          <div className="mt-auto">
            <button className="btn btn-primary" onClick={() => router.push("/admin/users")}>이동</button>
          </div>
        </div>
        <div className="card p-5 flex flex-col gap-3">
          <div className="font-semibold">방문자 응답 관리</div>
          <p className="text-sm text-slate-600">사전/본/리포트 진행 현황 조회</p>
          <div className="mt-auto">
            <button className="btn btn-primary" onClick={() => router.push("/admin/responses")}>이동</button>
          </div>
        </div>
        <div className="card p-5 flex flex-col gap-3">
          <div className="font-semibold">AI 설정</div>
          <p className="text-sm text-slate-600">OpenAI API 키 및 리포트 프롬프트 설정</p>
          <div className="mt-auto">
            <button className="btn btn-primary" onClick={() => router.push("/admin/ai-settings")}>이동</button>
          </div>
        </div>
      </div>
    </div>
  );
}


