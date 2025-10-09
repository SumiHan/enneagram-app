"use client";
import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useProgress } from "@/lib/progress-context";
import { apiGenerateReport, apiGetLatestReport } from "@/lib/api";
import { eventBus, EVENTS } from "@/lib/event-bus";

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId, progress, reload } = useProgress();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const autoGenerateTriggered = React.useRef(false);

  const onGenerate = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGenerateReport(userId);
      await reload();
      setReport(r);
      
      // Emit data updated event for real-time UI updates
      eventBus.emit(EVENTS.DATA_UPDATED, { userId });
      console.log(`Report generated for user ${userId}, emitted data updated event`);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, reload]);

  useEffect(() => {
    (async () => {
      if (progress?.report.status === "COMPLETED") {
        const r = await apiGetLatestReport(userId);
        setReport(r);
      }
    })();
  }, [progress, userId]);

  // Auto-generate report if ?generate=true is in URL
  useEffect(() => {
    const shouldAutoGenerate = searchParams.get('generate') === 'true';
    
    if (shouldAutoGenerate && 
        !autoGenerateTriggered.current && 
        !loading && 
        !report && 
        progress?.main_survey.status === "COMPLETED") {
      autoGenerateTriggered.current = true;
      onGenerate();
    }
  }, [searchParams, loading, report, progress, onGenerate]);

  const disabled = progress?.main_survey.status !== "COMPLETED";

  return (
    <div className="flex flex-col gap-6">
      <button className="btn btn-outline w-fit" onClick={() => router.back()}>← 홈</button>
      <h2 className="text-xl font-semibold">결과 리포트</h2>
      <div className="card p-6 flex flex-col gap-4">
        {report ? (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded border">
              <div className="text-sm text-blue-600 font-medium mb-1">에니어그램 유형</div>
              <div className="text-2xl font-bold text-blue-800">{report.type}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded border">
              <div className="font-semibold text-slate-800 mb-2">특징</div>
              <p className="text-slate-700 leading-relaxed">{report.characteristics}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded border">
              <div className="font-semibold text-slate-800 mb-2">추천 직업</div>
              <ul className="space-y-1">
                {report.job_recommendations?.map((job: string, idx: number) => (
                  <li key={idx} className="flex items-center text-slate-700">
                    <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold mr-2">
                      {idx + 1}
                    </span>
                    {job}
                  </li>
                ))}
              </ul>
            </div>
            {report.generated_at && (
              <div className="text-xs text-slate-500 text-right">
                생성일: {new Date(report.generated_at).toLocaleString('ko-KR')}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-slate-600">리포트를 생성하여 결과를 확인하세요.</p>
            <button className="btn btn-primary" onClick={onGenerate} disabled={disabled || loading}>{loading ? "생성 중..." : "리포트 생성"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-6">
        <div className="card p-6 text-center text-slate-600">
          로딩 중...
        </div>
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}


