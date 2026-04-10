"use client";
import React, { useEffect, useState, useCallback, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import { useRouter, useSearchParams } from "next/navigation";
import { useProgress } from "@/lib/progress-context";
import { apiGenerateReport, apiGetLatestReport } from "@/lib/api";
import { eventBus, EVENTS } from "@/lib/event-bus";
import { TYPES, TRIAD_STYLE, TRIADS } from "@/lib/enneagram-data";

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

function parseTypeNumber(content: string): number | null {
  const numMatch = content.match(/(\d+)/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= 9) return n;
  }
  const found = TYPES.find(t =>
    content.includes(t.name) || content.includes(t.subtitle)
  );
  return found?.number ?? null;
}

// 카드 제목 floating label
// top-0: wrapper의 paddingTop(14px) 덕분에 시각적 위치는 동일하나 캡처 영역 안에 포함됨
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute top-0 left-4 px-3 text-base font-semibold z-10 text-white"
      style={{ backgroundColor: '#4F46E5', borderRadius: '6px', display: 'flex', alignItems: 'center', height: '28px', lineHeight: 1 }}
    >
      {children}
    </div>
  );
}

function EnneagramTypeCard({ typeNumber, cardStyle }: { typeNumber: number; cardStyle: { bg: string; border: string } }) {
  const current = TYPES.find(t => t.number === typeNumber)!;
  const ts = TRIAD_STYLE[current.triad];
  const triad = TRIADS.find(tr => tr.key === current.triad)!;
  const wingTypes = current.wings.map(w => TYPES.find(t => t.number === w)!);
  const growthType = TYPES.find(t => t.number === current.growth)!;
  const stressType = TYPES.find(t => t.number === current.stress)!;

  return (
    <div className="relative mt-10" style={{ paddingTop: '14px' }}>
      <SectionLabel>1. 에니어그램 유형</SectionLabel>
      <div className="p-5 pt-7 rounded-lg border" style={{ backgroundColor: cardStyle.bg, borderColor: cardStyle.border }}>

        {/* 상단: 번호 + 유형명 · 영문명 */}
        <div className="flex items-baseline gap-1.5 flex-wrap mb-4">
          <span className="text-3xl font-bold text-slate-800">{current.number}</span>
          <span className="text-lg font-semibold text-slate-800">{current.name}</span>
          <span className="text-slate-300">·</span>
          <span className="text-sm text-slate-400">{current.subtitle}</span>
        </div>

        {/* 하단 2열 */}
        <div className="flex gap-4 mb-4 items-stretch">
          {/* 왼쪽: 캐릭터 이미지 */}
          <div className="sm:w-[180px] shrink-0">
            <img
              src={`/images/${current.number}_${current.name}.png`}
              alt={current.name}
              className="w-full h-full rounded-lg object-contain"
            />
          </div>
          {/* 오른쪽: 중심 배지 + 핵심 욕구/두려움 + 키워드 */}
          <div className="flex-1 flex flex-col gap-2">
            {/* 중심 배지 — flex + align-items:center */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1 }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ts.nodeActive }} />
              <span className="text-xs font-medium" style={{ color: ts.textColor, lineHeight: 1 }}>{triad.name}</span>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="text-xs text-slate-400 mb-0.5">핵심 욕구</div>
              <div className="text-sm text-slate-700">{current.coreDesire}</div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="text-xs text-slate-400 mb-0.5">핵심 두려움</div>
              <div className="text-sm text-slate-700">{current.coreFear}</div>
            </div>
            {/* 키워드 태그 — flex + align-items:center */}
            <div className="flex flex-wrap gap-1.5">
              {current.keywords.map(kw => (
                <span
                  key={kw}
                  className={`text-xs px-2 rounded-full ${ts.tag}`}
                  style={{ display: 'flex', alignItems: 'center', lineHeight: 1, height: '22px' }}
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 날개 */}
        <div className="mb-4">
          <div className="text-xs font-medium mb-2" style={{ color: '#818CF8' }}>날개 (Wings)</div>
          <div className="grid grid-cols-2 gap-2">
            {wingTypes.map(w => {
              const ws = TRIAD_STYLE[w.triad];
              return (
                <div key={w.number} className="bg-white rounded-lg border border-slate-200 p-3">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', lineHeight: 1 }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ws.nodeActive }} />
                    <span className="text-xs text-slate-400" style={{ lineHeight: 1 }}>{current.number}w{w.number}</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-800">{w.number}. {w.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{w.subtitle}</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {w.keywords.slice(0, 3).map(kw => (
                      <span
                        key={kw}
                        className={`text-xs px-1.5 rounded ${ws.tag}`}
                        style={{ display: 'flex', alignItems: 'center', lineHeight: 1, height: '20px' }}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 성장 & 스트레스 방향 */}
        <div>
          <div className="text-xs font-medium mb-2" style={{ color: '#818CF8' }}>성장 &amp; 스트레스 방향</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-medium text-green-600 mb-1">성장 방향</div>
              <div className="text-sm font-semibold text-slate-800">{growthType.number}. {growthType.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">{growthType.subtitle}</div>
              <div className="text-xs text-slate-500 mt-1.5 leading-snug">건강할 때 이 유형의 장점을 흡수해요</div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-medium text-orange-500 mb-1">스트레스 방향</div>
              <div className="text-sm font-semibold text-slate-800">{stressType.number}. {stressType.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">{stressType.subtitle}</div>
              <div className="text-xs text-slate-500 mt-1.5 leading-snug">힘들 때 이 유형의 단점이 나타나요</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const cardStyle = { bg: '#F8F9FA', border: '#E5E7EB' };

  return (
    <div className="flex flex-col gap-6">
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
          /* ① pdf-content: 상하좌우 padding 추가 */
          <div id="pdf-content" style={{ padding: '24px' }}>
            {report.report_data.map((section, idx) => {
              if (section.key === 'enneagram_type') {
                const typeNumber = parseTypeNumber(section.content);
                if (typeNumber) {
                  return <EnneagramTypeCard key={section.key} typeNumber={typeNumber} cardStyle={cardStyle} />;
                }
              }
              return (
                <div key={section.key} className="relative mt-10" style={{ paddingTop: '14px' }}>
                  <SectionLabel>{idx + 1}. {section.title}</SectionLabel>
                  <div className="p-5 pt-7 rounded-lg border" style={{ backgroundColor: cardStyle.bg, borderColor: cardStyle.border }}>
                    <div className="leading-[1.7] text-[14px] [&_strong]:font-semibold [&_em]:italic [&_p]:mb-2 [&_p:last-child]:mb-0" style={{ color: '#6B7280' }}>
                      <ReactMarkdown>{typeof section.content === 'string' ? section.content : JSON.stringify(section.content)}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              );
            })}

            {report.generated_at && (
              <div className="text-xs text-slate-400 text-right pt-2 border-t mt-8">
                생성일: {new Date(report.generated_at).toLocaleString('ko-KR')}
              </div>
            )}
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
