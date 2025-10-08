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

  useEffect(() => {
    const prefill = search.get("email");
    if (prefill) setEmail(prefill);
  }, [search]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!email || !password || !name) throw new Error("모든 항목을 입력하세요");
      await signup(name, email, password);
      router.replace("/");
    } catch (e: any) {
      setError(e?.message ?? "회원가입 실패");
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">회원가입</h2>
      <form onSubmit={onSubmit} className="card p-6 flex flex-col gap-3">
        <input className="border rounded-md px-3 py-2" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="border rounded-md px-3 py-2" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="border rounded-md px-3 py-2" placeholder="비밀번호" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={loading}>가입하기</button>
      </form>
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


