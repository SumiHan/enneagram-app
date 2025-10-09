"use client";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { UserProgress } from "./types";
import { apiGetProgress } from "./api";
import { useAuth } from "./../lib/auth-context";

type Ctx = {
  userId: string;
  progress: UserProgress | null;
  reload: () => Promise<void>;
};

const ProgressCtx = createContext<Ctx | null>(null);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const { user } = useAuth();
  const userIdRef = useRef<string>("");

  const reload = async () => {
    if (!userIdRef.current) {
      console.log('[ProgressProvider] No userId, skipping reload');
      return;
    }
    const p = await apiGetProgress(userIdRef.current);
    setProgress(p);
  };

  useEffect(() => {
    const newUserId = user?.uid ?? "";
    console.log('[ProgressProvider] User changed, new userId:', newUserId);
    userIdRef.current = newUserId;
    
    if (newUserId) {
      reload();
    }
  }, [user]);

  const value = useMemo<Ctx>(() => ({ userId: userIdRef.current, progress, reload }), [progress]);
  return <ProgressCtx.Provider value={value}>{children}</ProgressCtx.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressCtx);
  if (!ctx) throw new Error("Progress context missing");
  return ctx;
}


