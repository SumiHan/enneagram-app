"use client";
import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useProgress } from "@/lib/progress-context";
import { apiGenerateReport, apiGetLatestReport } from "@/lib/api";
import { eventBus, EVENTS } from "@/lib/event-bus";
import { ReportViewer, type ReportSection } from "@/components/ReportViewer";

async function downloadPdf() {
  const container = document.getElementById("pdf-content");
  if (!container) return;
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const gap = 10; // mm between cards
  let currentY = margin;
  let firstCard = true;
  const cards = Array.from(container.children) as HTMLElement[];
  for (const card of cards) {
    const canvas = await html2canvas(card, { scale: 2, useCORS: true, backgroundColor: null });
    const imgH = (canvas.height * contentW) / canvas.width;
    if (!firstCard && currentY + imgH > pageH - margin) {
      pdf.addPage();
      currentY = margin;
    }
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, currentY, contentW, imgH);
    currentY += imgH + gap;
    firstCard = false;
  }
  pdf.save("결과_리포트.pdf");
}

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
  const [progressSteps, setProgressSteps] = useState<{ step: string; pct: number }[]>([]);
  const autoGenerateTriggered = React.useRef(false);

  const onGenerate = useCallback(async () => {
    setLoading(true);
    setProgressSteps([]);
    try {
      const r = await apiGenerateReport(userId, (step, pct) => {
        setProgressSteps(prev => {
          const filtered = prev.filter(s => s.step !== step);
          return [...filtered, { step, pct }];
        });
      });
      await reload();
      setReport(r as Report);
      eventBus.emit(EVENTS.DATA_UPDATED, { userId });
    } catch (error) {
      alert(`리포트 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
      setProgressSteps([]);
    }
  }, [userId, reload]);

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

  return (
    <div className="flex flex-col gap-6">
      {/* 모바일 전용 가로 화면 안내 배너 */}
      <div className="block md:hidden rounded-lg px-4 py-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 space-y-1">
        <div>가로 화면으로 보시면 더 편하게 읽을 수 있어요 📱</div>
        <div>리포트 결과를 PDF로 저장하려면, 'PDF 다운로드' 버튼 클릭 후 열린 파일에서 공유(⬆️) → 카카오톡을 선택하세요</div>
      </div>
      <button className="btn btn-outline w-fit" onClick={() => router.back()}>← 홈</button>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">결과 리포트</h2>
        {report && report.report_data && report.report_data.length > 0 && (
          <button className="btn btn-primary text-sm" onClick={downloadPdf}>
            PDF 다운로드
          </button>
        )}
      </div>

      <div className="card p-6 flex flex-col gap-4">
        {report && report.report_data && report.report_data.length > 0 ? (
          <div id="pdf-content" style={{ padding: '24px' }}>
            <ReportViewer reportData={report.report_data} generatedAt={report.generated_at} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            {loading ? (
              <div className="w-full max-w-sm flex flex-col gap-5">
                {/* 헤더 */}
                <div className="text-center">
                  <div className="text-base font-semibold text-slate-700 mb-1">
                    AI가 리포트를 분석하고 있어요
                  </div>
                  <div className="text-sm text-slate-400">보통 20~40초 소요됩니다</div>
                </div>

                {/* 전체 프로그레스 바 */}
                <div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                      style={{
                        width: progressSteps.length === 0 ? '4%' :
                          `${Math.round(progressSteps.reduce((s, x) => s + x.pct, 0) / progressSteps.length)}%`
                      }}
                    />
                  </div>
                </div>

                {/* 단계 리스트 */}
                <div className="flex flex-col gap-2">
                  {progressSteps.length === 0 ? (
                    <div className="text-sm text-slate-400 text-center animate-pulse">준비 중...</div>
                  ) : (
                    progressSteps.map(({ step, pct }) => (
                      <div key={step} className="flex items-center gap-3">
                        {pct === 100 ? (
                          <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                              <path d="M2 5.5L4.5 8L9 3" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                          </span>
                        )}
                        <span className={`text-sm transition-colors ${pct === 100 ? 'text-slate-500' : 'text-indigo-600 font-medium'}`}>
                          {step}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
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
