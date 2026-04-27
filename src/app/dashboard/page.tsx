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

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userId, progress, reload } = useProgress();
  const [hydrated, setHydrated] = useState(false);
  const [reportStatus, setReportStatus] = useState<'not_started' | 'completed'>('not_started');
  const [loadingReport, setLoadingReport] = useState(true);
  const [preAnswerCount, setPreAnswerCount] = useState(0);
  const [mainAnswerCount, setMainAnswerCount] = useState(0);
  const [preTotalCount, setPreTotalCount] = useState(0);

  const preStatus = useSurveyStatus(userId, 'pre');
  const mainStatus = useSurveyStatus(userId, 'main');

  const isRealtimeConnected = useRealtimeSubscription();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/");
      return;
    }

    if (user.role === "admin") {
      router.replace("/admin/dashboard");
      return;
    }

    if (!progress) reload();

    setHydrated(true);
  }, [progress, reload, user, authLoading, router]);

  const loadData = async () => {
    if (!userId) {
      setLoadingReport(false);
      return;
    }

    setLoadingReport(true);
    try {
      const status = await apiGetReportStatus(userId);
      setReportStatus(status);

      const [preResponse, preTotal] = await Promise.all([
        apiGetPreResponse(userId),
        getPreSurveyQuestionsCount(),
      ]);
      const preCount = Object.keys(preResponse.answers || {}).length;
      setPreAnswerCount(preCount);
      if (preTotal > 0) setPreTotalCount(preTotal);

      const mainResponse = await apiGetMainResponse(userId);
      const mainCount = Object.keys(mainResponse.answers || {}).length;
      setMainAnswerCount(mainCount);
    } catch (error) {
      setReportStatus('not_started');
      setPreAnswerCount(0);
      setMainAnswerCount(0);
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    if (userId && hydrated) {
      loadData();
    }
  }, [userId, hydrated]);

  useEffect(() => {
    const handleReportGenerated = (data: any) => {
      if (data.userId === userId) {
        setReportStatus('completed');
      }
    };

    const handleDataUpdated = (data: any) => {
      if (data.userId === userId) {
        loadData();
      }
    };

    eventBus.on(EVENTS.REPORT_GENERATED, handleReportGenerated);
    eventBus.on(EVENTS.DATA_UPDATED, handleDataUpdated);

    return () => {
      eventBus.off(EVENTS.REPORT_GENERATED, handleReportGenerated);
      eventBus.off(EVENTS.DATA_UPDATED, handleDataUpdated);
    };
  }, [userId]);

  const preTotal = preTotalCount || progress?.pre_survey.total_count || 0;
  const mainTotal = 90;

  const preProgressText =
    preStatus.status === 'completed' ? `(${preTotal}/${preTotal})` :
    preStatus.status === 'in_progress' ? `(${preAnswerCount}/${preTotal})` :
    `(0/${preTotal})`;

  const mainProgressText =
    mainStatus.status === 'completed' ? `(${mainTotal}/${mainTotal})` :
    mainStatus.status === 'in_progress' ? `(${mainAnswerCount}/${mainTotal})` :
    `(0/${mainTotal})`;

  if (authLoading || preStatus.loading || mainStatus.loading || loadingReport) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-slate-600">
          {authLoading ? '로그인 확인 중...' : '설문 상태를 불러오는 중...'}
        </div>
      </div>
    );
  }

  if (!hydrated) {
    return null;
  }

  return (
    <div className="flex flex-col gap-5">
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
  );
}
