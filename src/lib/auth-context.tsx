"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";

type Role = "user" | "admin";
type AppUser = { uid: string; email: string; name?: string; role: Role } | null;

type Ctx = {
  user: AppUser;
  loading: boolean;
  signup: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

function resolveRole(email: string): Role {
  const admins = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(/[,\s]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase()) ? "admin" : "user";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (supabaseUser: SupabaseUser) => {
    try {
      // Get user profile from users table
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      if (error) throw error;

      if (data) {
        const appUser: AppUser = {
          uid: data.id,
          email: data.email,
          name: data.name,
          role: data.role as Role,
        };
        setUser(appUser);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    try {
      // 1. Create auth user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined, // Disable email confirmation redirect
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('회원가입에 실패했습니다.');

      // 2. Determine role
      const role = resolveRole(email);

      // 3. Create user profile in users table
      const { error: dbError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          name,
          password_hash: 'supabase_managed', // Supabase Auth manages passwords
          role,
        });

      if (dbError) throw dbError;

      // 4. Initialize user progress
      const { error: progressError } = await supabase
        .from('user_progress')
        .insert({
          user_id: authData.user.id,
          pre_survey_status: 'NOT_STARTED',
          pre_survey_answered_count: 0,
          pre_survey_total_count: 0,
          main_survey_status: 'NOT_STARTED',
          main_survey_sets: 0,
          main_survey_total_sets: 3,
          main_survey_current_page: 0,
          report_status: 'NOT_STARTED',
        });

      if (progressError) throw progressError;

      // 5. Set user state
      const appUser: AppUser = {
        uid: authData.user.id,
        email,
        name,
        role,
      };
      setUser(appUser);
    } catch (error: any) {
      console.error('Signup error:', error);
      throw new Error(error.message || '회원가입에 실패했습니다.');
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('로그인에 실패했습니다.');

      // User profile will be loaded by onAuthStateChange
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || '로그인에 실패했습니다.');
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
    } catch (error: any) {
      console.error('Logout error:', error);
      throw new Error(error.message || '로그아웃에 실패했습니다.');
    }
  };

  const value = { user, loading, signup, login, logout };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
