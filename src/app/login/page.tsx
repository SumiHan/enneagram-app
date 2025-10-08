"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestSignup, setSuggestSignup] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSuggestSignup(false);
      await login(email, password);
      
      // Wait a bit for auth state to update
      setTimeout(() => {
        // Will be redirected by useEffect in page.tsx based on user role
        router.replace('/');
      }, 500);
    } catch (e: any) {
      const msg = e?.message ?? "로그인 실패";
      setError(msg);
      if (msg.includes("올바르지 않습니다") || msg.includes("존재") || msg.includes("Invalid")) {
        setSuggestSignup(true);
      }
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">로그인</h2>
      <form onSubmit={onSubmit} className="card p-6 flex flex-col gap-3">
        <input className="border rounded-md px-3 py-2" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="border rounded-md px-3 py-2" placeholder="비밀번호" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={loading}>로그인</button>
        <div className="text-sm text-slate-600">
          처음 오셨나요? <button type="button" className="text-primary-600 underline" onClick={() => {
            if (email) {
              router.push(`/signup?email=${encodeURIComponent(email)}` as any);
            } else {
              router.push('/signup');
            }
          }}>회원가입</button>
        </div>
        {suggestSignup && (
          <div className="text-sm text-slate-600">
            해당 이메일로 가입된 계정을 찾을 수 없어요. <button type="button" className="text-primary-600 underline" onClick={() => {
              if (email) {
                router.push(`/signup?email=${encodeURIComponent(email)}` as any);
              } else {
                router.push('/signup');
              }
            }}>이메일로 회원가입</button>
          </div>
        )}
      </form>
    </div>
  );
}


