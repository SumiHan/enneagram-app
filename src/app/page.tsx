"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProgress } from "@/lib/progress-context";
import { ProgressCard } from "@/components/ProgressCard";
import { apiGetProgress } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userId, progress, reload } = useProgress();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
      return;
    }
    if (!authLoading && user?.role === "admin") {
      router.replace("/admin/dashboard");
      return;
    }
    // ensure progress loaded
    if (!progress) reload();
    setHydrated(true);
  }, [progress, reload, user, authLoading, router]);

  const prePct = progress ? Math.round((progress.pre_survey.answered_count / progress.pre_survey.total_count) * 100) : 0;
  const mainPct = progress ? Math.round((progress.main_survey.sets / progress.main_survey.total_sets) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">에니어그램 성향 분석</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <ProgressCard
          title="사전 설문"
          description="간단한 준비 설문입니다. 완료 후 본 설문이 활성화됩니다."
          status={progress?.pre_survey.status ?? "NOT_STARTED"}
          progressPct={prePct}
          actionLabel={progress?.pre_survey.status === "IN_PROGRESS" ? "이어하기" : progress?.pre_survey.status === "COMPLETED" ? "다시 보기" : "시작하기"}
          onAction={() => router.push("/surveys/pre")}
        />
        <ProgressCard
          title="본 설문"
          description="에니어그램 성향을 분석하는 본 설문입니다."
          status={progress?.main_survey.status ?? "NOT_STARTED"}
          progressPct={mainPct}
          actionLabel={progress?.main_survey.status === "IN_PROGRESS" ? "이어하기" : progress?.main_survey.status === "COMPLETED" ? "다시 보기" : "시작하기"}
          onAction={() => router.push("/surveys/main")}
          disabled={progress?.pre_survey.status !== "COMPLETED"}
        />
        <div className="md:col-span-2">
          <ProgressCard
            title="결과 리포트"
            description="유형, 특징, 직업 추천 3개를 확인합니다."
            status={progress?.report.status ?? "NOT_STARTED"}
            progressPct={progress?.report.status === "COMPLETED" ? 100 : 0}
            actionLabel={progress?.report.status === "COMPLETED" ? "보기" : "생성하기"}
            onAction={() => router.push("/report")}
            disabled={progress?.main_survey.status !== "COMPLETED"}
          />
        </div>
      </div>
    </div>
  );
}


