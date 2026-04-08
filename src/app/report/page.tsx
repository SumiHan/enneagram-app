"use client";
import React, { useEffect, useState, useCallback, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import { useRouter, useSearchParams } from "next/navigation";
import { useProgress } from "@/lib/progress-context";
import { apiGenerateReport, apiGetLatestReport } from "@/lib/api";
import { eventBus, EVENTS } from "@/lib/event-bus";

type ReportSection = {
  key: string;
  title: string;
  content: string;
};

type Report = {
  id: string;
  report_data: ReportSection[];
  generated_at: string;
};

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId, progress, reload } = useProgress();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const autoGenerateTriggered = React.useRef(false);

  const onGenerate = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGenerateReport(userId);
      await reload();
      setReport(r as Report);
      eventBus.emit(EVENTS.DATA_UPDATED, { userId });
    } catch (error) {
      alert(`리포트 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [userId, reload]);

  // 기존 리포트 로드
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const r = await apiGetLatestReport(userId);
        if (r && r.report_data && r.report_data.length > 0) {
          setReport(r as Report);
        }
      } catch (error) {
        console.error('[ReportPage] Error loading report:', error);
      }
    })();
  }, [userId]);

  // URL에 ?generate=true 이면 자동 생성
  useEffect(() => {
    const shouldAutoGenerate = searchParams.get('generate') === 'true';
    if (
      shouldAutoGenerate &&
      !autoGenerateTriggered.current &&
      progress?.main_survey.status === 'COMPLETED' &&
      !report
    ) {
      autoGenerateTriggered.current = true;
      setLoading(true);
      onGenerate();
    }
  }, [searchParams, progress, onGenerate, report]);

  const disabled = progress?.main_survey.status !== 'COMPLETED';

  // 배경색 팔레트 (섹션 순서대로 순환)
  const colorPalette = [
    'bg-blue-50 border-blue-200 text-blue-600',
    'bg-purple-50 border-purple-200 text-purple-600',
    'bg-green-50 border-green-200 text-green-600',
    'bg-amber-50 border-amber-200 text-amber-600',
    'bg-indigo-50 border-indigo-200 text-indigo-600',
    'bg-teal-50 border-teal-200 text-teal-600',
    'bg-rose-50 border-rose-200 text-rose-600',
    'bg-slate-50 border-slate-200 text-slate-600',
  ];

  return (
    <div className="flex flex-col gap-6">
      <button className="btn btn-outline w-fit print:hidden" onClick={() => router.back()}>← 홈</button>
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-xl font-semibold">결과 리포트</h2>
        {report && report.report_data && report.report_data.length > 0 && (
          <button className="btn btn-primary text-sm" onClick={() => window.print()}>
            PDF 다운로드
          </button>
        )}
      </div>

      <div className="card p-6 flex flex-col gap-4">
        {report && report.report_data && report.report_data.length > 0 ? (
          <div className="space-y-4">
            <div id="print-report" className="space-y-4">
              <h2 className="text-xl font-bold hidden print:block mb-4">결과 리포트</h2>
              {report.report_data.map((section, idx) => {
                const colorClass = colorPalette[idx % colorPalette.length];
                const [bg, border, label] = colorClass.split(' ');
                return (
                  <div key={section.key} className={`${bg} p-4 rounded-lg border ${border}`}>
                    <div className={`text-sm font-medium mb-2 ${label}`}>
                      {idx + 1}. {section.title}
                    </div>
                    <div className="text-slate-800 leading-relaxed [&_strong]:font-bold [&_em]:italic [&_p]:mb-2 [&_p:last-child]:mb-0">
                      <ReactMarkdown>{typeof section.content === 'string' ? section.content : JSON.stringify(section.content)}</ReactMarkdown>
                    </div>
                  </div>
                );
              })}

              {report.generated_at && (
                <div className="text-xs text-slate-400 text-right pt-2 border-t">
                  생성일: {new Date(report.generated_at).toLocaleString('ko-KR')}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            {loading ? (
              <>
                <div className="animate-pulse text-center">
                  <div className="text-lg font-medium text-slate-700 mb-2">
                    생성형 AI가 리포트를 만들고 있어요. 잠시만 기다려주세요 😀
                  </div>
                  <div className="text-sm text-slate-500">평균 10-20초 정도 소요됩니다</div>
                </div>
                <div className="flex gap-2">
                  {[0, 150, 300].map(delay => (
                    <div key={delay} className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
                      style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-slate-600">리포트를 생성하여 결과를 확인하세요.</p>
                <button className="btn btn-primary" onClick={onGenerate} disabled={disabled}>
                  리포트 생성
                </button>
              </>
            )}
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
        <div className="card p-6 text-center text-slate-600">로딩 중...</div>
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}
