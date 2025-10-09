"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProgress } from "@/lib/progress-context";
import { ProgressCard } from "@/components/ProgressCard";
import { apiGetProgress, apiGetReportStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useSurveyStatus } from "@/hooks/useSurveyStatus";
import { DebugPanel } from "@/components/DebugPanel";

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userId, progress, reload } = useProgress();
  const [hydrated, setHydrated] = useState(false);
  const [reportStatus, setReportStatus] = useState<'not_started' | 'completed'>('not_started');
  const [loadingReport, setLoadingReport] = useState(true);
  
  // Use DB-based survey status hooks (single source of truth)
  const preStatus = useSurveyStatus(userId, 'pre');
  const mainStatus = useSurveyStatus(userId, 'main');

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) {
      console.log('Auth loading...');
      return;
    }
    
    console.log('Auth loaded, user:', user);
    
    if (!user) {
      console.log('No user, redirecting to login');
      router.replace("/login");
      return;
    }
    
    if (user.role === "admin") {
      console.log('Admin user, redirecting to dashboard');
      router.replace("/admin/dashboard");
      return;
    }
    
    console.log('Regular user, loading progress');
    // ensure progress loaded
    if (!progress) reload();
    
    setHydrated(true);
  }, [progress, reload, user, authLoading, router]);

  // Load report status from DB
  useEffect(() => {
    if (!userId) {
      setLoadingReport(false);
      return;
    }

    const loadReportStatus = async () => {
      setLoadingReport(true);
      try {
        const status = await apiGetReportStatus(userId);
        console.log('[HomePage] Report status from DB:', status);
        setReportStatus(status);
      } catch (error) {
        console.error('[HomePage] Error loading report status:', error);
        setReportStatus('not_started');
      } finally {
        setLoadingReport(false);
      }
    };

    loadReportStatus();
  }, [userId]);

  const prePct = progress ? Math.round((progress.pre_survey.answered_count / progress.pre_survey.total_count) * 100) : 0;
  const mainPct = progress ? Math.round((progress.main_survey.sets / progress.main_survey.total_sets) * 100) : 0;

  // Show loading state
  if (authLoading || preStatus.loading || mainStatus.loading || loadingReport) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-slate-600">
          {authLoading ? '로그인 확인 중...' : '설문 상태를 불러오는 중...'}
        </div>
      </div>
    );
  }

  // Don't render if not hydrated
  if (!hydrated) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-bold">에니어그램 성향 분석</h1>
        <div className="grid gap-4 md:grid-cols-2">
        <ProgressCard
          title="사전 설문"
          description="간단한 준비 설문입니다. 완료 후 본 설문이 활성화됩니다."
          status={
            preStatus.status === 'completed' ? 'COMPLETED' :
            preStatus.status === 'in_progress' ? 'IN_PROGRESS' :
            'NOT_STARTED'
          }
          progressPct={prePct}
          actionLabel={
            preStatus.status === 'in_progress' ? "이어하기" :
            preStatus.status === 'completed' ? "수정하기" :
            "시작하기"
          }
          onAction={() => router.push("/surveys/pre")}
        />
        <ProgressCard
          title="본 설문"
          description="에니어그램 성향을 분석하는 본 설문입니다."
          status={
            mainStatus.status === 'completed' ? 'COMPLETED' :
            mainStatus.status === 'in_progress' ? 'IN_PROGRESS' :
            'NOT_STARTED'
          }
          progressPct={mainPct}
          actionLabel={
            mainStatus.status === 'in_progress' ? "이어하기" :
            mainStatus.status === 'completed' ? "수정하기" :
            "시작하기"
          }
          onAction={() => router.push("/surveys/main")}
          disabled={preStatus.status !== 'completed'}
        />
        <div className="md:col-span-2">
          <ProgressCard
            title="결과 리포트"
            description="유형, 특징, 직업 추천 3개를 확인합니다."
            status={reportStatus === 'completed' ? 'COMPLETED' : 'NOT_STARTED'}
            progressPct={reportStatus === 'completed' ? 100 : 0}
            actionLabel={reportStatus === 'completed' ? "보기" : "생성하기"}
            onAction={() => router.push("/report")}
            disabled={mainStatus.status !== 'completed'}
          />
        </div>
      </div>
    </div>
      
      {/* Debug Panel - shows DB state on mobile */}
      <DebugPanel surveyType="pre" status={preStatus.status} loading={preStatus.loading} />
    </>
  );
}


