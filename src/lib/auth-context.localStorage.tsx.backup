"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Role = "user" | "admin";
type AppUser = { uid: string; email: string; name?: string; role: Role } | null;

type Ctx = {
  user: AppUser;
  loading: boolean;
  signup: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const LS_USER = "auth.email.user.v1";
const LS_USERS = "auth.users.v1"; // directory of users keyed by email, includes password

const AuthCtx = createContext<Ctx | null>(null);

function resolveRole(email: string): Role {
  const admins = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(/[,\s]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.toLowerCase()) ? "admin" : "user";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(LS_USER) : null;
      setUser(raw ? (JSON.parse(raw) as AppUser) : null);
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = async (name: string, email: string, password: string) => {
    const role = resolveRole(email);
    const newUser: AppUser = { uid: email, email, name, role };
    const dirRaw = typeof window !== "undefined" ? window.localStorage.getItem(LS_USERS) : null;
    const dir = dirRaw ? (JSON.parse(dirRaw) as Record<string, any>) : {};
    dir[email] = { ...newUser, password };
    window.localStorage.setItem(LS_USERS, JSON.stringify(dir));
    window.localStorage.setItem(LS_USER, JSON.stringify(newUser));
    setUser(newUser);
  };

  const login = async (email: string, password: string) => {
    const role = resolveRole(email);
    const dirRaw = typeof window !== "undefined" ? window.localStorage.getItem(LS_USERS) : null;
    const dir = dirRaw ? (JSON.parse(dirRaw) as Record<string, any>) : {};
    const existing = dir[email];
    if (!existing || existing.password !== password) {
      throw new Error("이메일 또는 비밀번호가 올바르지 않습니다");
    }
    window.localStorage.setItem(LS_USER, JSON.stringify(existing));
    setUser({ uid: existing.uid, email: existing.email, name: existing.name, role: existing.role });
  };

  const logout = async () => {
    window.localStorage.removeItem(LS_USER);
    setUser(null);
  };

  const value = useMemo<Ctx>(() => ({ user, loading, signup, login, logout }), [user, loading]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("Auth context missing");
  return ctx;
}


