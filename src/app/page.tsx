"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProgress } from "@/lib/progress-context";
import { ProgressCard } from "@/components/ProgressCard";
import { apiGetProgress, apiGetReportStatus, apiGetPreResponse, apiGetMainResponse } from "@/lib/api";
import { getPreSurveyQuestionsCount } from "@/lib/survey-questions";
import { useAuth } from "@/lib/auth-context";
import { useSurveyStatus } from "@/hooks/useSurveyStatus";
import { eventBus, EVENTS } from "@/lib/event-bus";
import { useRealtimeSubscription } from "@/lib/realtime";

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userId, progress, reload } = useProgress();
  const [hydrated, setHydrated] = useState(false);
  const [reportStatus, setReportStatus] = useState<'not_started' | 'completed'>('not_started');
  const [loadingReport, setLoadingReport] = useState(true);
  const [preAnswerCount, setPreAnswerCount] = useState(0);
  const [mainAnswerCount, setMainAnswerCount] = useState(0);
  const [preTotalCount, setPreTotalCount] = useState(0);
  
  // Use DB-based survey status hooks (single source of truth)
  const preStatus = useSurveyStatus(userId, 'pre');
  const mainStatus = useSurveyStatus(userId, 'main');
  
  // Initialize real-time subscriptions
  const isRealtimeConnected = useRealtimeSubscription();

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return;
    
    if (!user) {
      router.replace("/login");
      return;
    }
    
    if (user.role === "admin") {
      router.replace("/admin/dashboard");
      return;
    }
    
    // ensure progress loaded
    if (!progress) reload();
    
    setHydrated(true);
  }, [progress, reload, user, authLoading, router]);

  // Load report status and answer counts from DB
  const loadData = async () => {
    if (!userId) {
      setLoadingReport(false);
      return;
    }

    setLoadingReport(true);
    try {
      console.log('[HomePage] Loading data for userId:', userId);
      
      // Load report status
      const status = await apiGetReportStatus(userId);
      console.log('[HomePage] Report status:', status);
      setReportStatus(status);
      
      // Load pre-survey question total & answer count
      const [preResponse, preTotal] = await Promise.all([
        apiGetPreResponse(userId),
        getPreSurveyQuestionsCount(),
      ]);
      const preCount = Object.keys(preResponse.answers || {}).length;
      setPreAnswerCount(preCount);
      if (preTotal > 0) setPreTotalCount(preTotal);
      
      // Load main-survey answer count
      const mainResponse = await apiGetMainResponse(userId);
      const mainCount = Object.keys(mainResponse.answers || {}).length;
      setMainAnswerCount(mainCount);
    } catch (error) {
      console.error('[HomePage] Error loading data:', error);
      setReportStatus('not_started');
      setPreAnswerCount(0);
      setMainAnswerCount(0);
    } finally {
      setLoadingReport(false);
    }
  };

  // Load data when userId is available and component is hydrated
  useEffect(() => {
    console.log('[HomePage] useEffect triggered - userId:', userId, 'hydrated:', hydrated);
    if (userId && hydrated) {
      console.log('[HomePage] Calling loadData()');
      loadData();
    }
  }, [userId, hydrated]);

  // Listen for report generation events
  useEffect(() => {
    const handleReportGenerated = (data: any) => {
      // Only update if it's for the current user
      if (data.userId === userId) {
        setReportStatus('completed');
      }
    };

    const handleDataUpdated = (data: any) => {
      // Refresh all data when any data is updated
      if (data.userId === userId) {
        loadData();
      }
    };

    // Subscribe to events
    eventBus.on(EVENTS.REPORT_GENERATED, handleReportGenerated);
    eventBus.on(EVENTS.DATA_UPDATED, handleDataUpdated);

    // Cleanup on unmount
    return () => {
      eventBus.off(EVENTS.REPORT_GENERATED, handleReportGenerated);
      eventBus.off(EVENTS.DATA_UPDATED, handleDataUpdated);
    };
  }, [userId]);

  // Calculate progress text
  const preTotal = preTotalCount || progress?.pre_survey.total_count || 0;
  const mainTotal = 90; // Total 90 questions
  
  const preProgressText = 
    preStatus.status === 'completed' ? `(${preTotal}/${preTotal})` :
    preStatus.status === 'in_progress' ? `(${preAnswerCount}/${preTotal})` :
    `(0/${preTotal})`;
  
  const mainProgressText = 
    mainStatus.status === 'completed' ? `(${mainTotal}/${mainTotal})` :
    mainStatus.status === 'in_progress' ? `(${mainAnswerCount}/${mainTotal})` :
    `(0/${mainTotal})`;

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
        {/* 에니어그램 설명 카드 */}
        <div className="card px-5 py-6 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-slate-800">에니어그램이란?</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              9가지 핵심 동기로 성격을 분류하는 심리 모델입니다.<br />
              테스트 전에 유형별 특징과 날개를 미리 살펴보세요.
            </p>
          </div>
          <div className="ml-6 shrink-0">
            <button className="btn btn-primary" onClick={() => router.push("/enneagram-intro")}>
              개념 살펴보기
            </button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
        <ProgressCard
          title="사전 설문"
          description="간단한 준비 설문입니다. 완료 후 본 설문이 활성화됩니다."
          status={
            preStatus.status === 'completed' ? 'COMPLETED' :
            preStatus.status === 'in_progress' ? 'IN_PROGRESS' :
            'NOT_STARTED'
          }
          progressText={preProgressText}
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
          progressText={mainProgressText}
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
            actionLabel={reportStatus === 'completed' ? "보기" : "생성하기"}
            onAction={() => {
              // If report not completed, pass auto-generate flag
              if (reportStatus !== 'completed') {
                router.push("/report?generate=true");
              } else {
                router.push("/report");
              }
            }}
            disabled={mainStatus.status !== 'completed'}
          />
        </div>
      </div>
    </div>
    </>
  );
}


