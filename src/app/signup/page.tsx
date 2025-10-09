"use client";
import React, { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSearchParams } from "next/navigation";

function SignupForm() {
  const { signup, loading } = useAuth() as any;
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const prefill = search.get("email");
    if (prefill) setEmail(prefill);
  }, [search]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!email || !password || !name) throw new Error("모든 항목을 입력하세요");
      await signup(name, email, password);
      
      // Show success message
      setShowSuccess(true);
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (e: any) {
      setError(e?.message ?? "회원가입 실패");
    }
  };

  return (
    <div className="max-w-md mx-auto">
      {/* Back to main button */}
      <button 
        className="mb-4 text-blue-500 hover:underline text-sm flex items-center gap-1"
        onClick={() => router.push("/")}
        type="button"
      >
        ← 메인으로 돌아가기
      </button>
      
      <h2 className="text-xl font-semibold mb-4">회원가입</h2>
      <form onSubmit={onSubmit} className="card p-6 flex flex-col gap-3">
        <input className="border rounded-md px-3 py-2" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="border rounded-md px-3 py-2" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="border rounded-md px-3 py-2" placeholder="비밀번호" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={loading}>가입하기</button>
        
        <div className="text-sm text-slate-600 text-center">
          이미 계정이 있으신가요? <button type="button" className="text-blue-500 underline" onClick={() => router.push('/login')}>로그인</button>
        </div>
      </form>
      
      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full text-center shadow-xl">
            <div className="mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">회원가입 완료!</h3>
              <p className="text-slate-600">
                회원가입이 완료되었습니다.<br />
                로그인 후 서비스를 이용해주세요.
              </p>
            </div>
            <div className="text-sm text-slate-500">
              잠시 후 로그인 페이지로 이동합니다...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto">로딩 중...</div>}>
      <SignupForm />
    </Suspense>
  );
}


