"use client";
import React, { useEffect, useState, useCallback, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import { useRouter, useSearchParams } from "next/navigation";
import { useProgress } from "@/lib/progress-context";
import { apiGenerateReport, apiGetLatestReport } from "@/lib/api";
import { eventBus, EVENTS } from "@/lib/event-bus";
import { TYPES, TRIAD_STYLE, TRIADS } from "@/lib/enneagram-data";
import type { SkillCard, JobRecommendation } from "@/lib/openai";

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
  content: string | Record<string, string>;
  sub_keys?: { key: string; label: string }[];
  show_as_card?: boolean;
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

// ── 직무 추천 카드 ─────────────────────────────────────────────────────────────

// **bold** 마크다운 기호만 제거 (이미 CSS로 bold 처리된 요소용)
function stripMd(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
}

const mdInline = { p: ({ children }: any) => <span>{children}</span> };

function JobRecommendationSection({ data }: { data: JobRecommendation }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 도입 요약: 연파랑 배경 + 왼쪽 파랑 세로선 */}
      {data.summary && (
        <div style={{
          backgroundColor: '#EEF2FF',
          borderLeft: '4px solid #818CF8',
          borderRadius: '0 10px 10px 0',
          padding: '16px 20px',
          fontSize: '14px', color: '#4338CA', lineHeight: 1.8,
        }} className="[&_strong]:font-semibold [&_p]:m-0">
          <ReactMarkdown components={mdInline}>{data.summary}</ReactMarkdown>
        </div>
      )}

      {/* 추천 직무 3열 그리드 */}
      {data.jobs?.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '10px', fontWeight: 500 }}>추천 직무</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {data.jobs.map((job, i) => (
              <div key={i} style={{ backgroundColor: '#fff', border: '1.5px solid #C7D2FE', borderRadius: '12px', padding: '18px' }}>
                <div style={{ fontSize: '12px', color: '#818CF8', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.05em' }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
                  {stripMd(job.name)}
                </div>
                <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.6, marginBottom: '14px' }}
                  className="[&_strong]:font-semibold [&_p]:m-0">
                  <ReactMarkdown components={mdInline}>{job.description}</ReactMarkdown>
                </div>
                {job.fit_badge && (
                  <span style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px',
                    color: '#4338CA', backgroundColor: '#E0E7FF',
                    borderRadius: '999px', padding: '3px 12px', lineHeight: 1,
                  }}>
                    {stripMd(job.fit_badge)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 강점 / 주의 — 2열 */}
      {(data.strength || data.caution) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
          {data.strength && (
            <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '18px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#059669', marginBottom: '10px' }}>
                ◆ 이 유형의 강점
              </div>
              <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.7 }}
                className="[&_strong]:font-semibold [&_p]:m-0">
                <ReactMarkdown components={mdInline}>{data.strength}</ReactMarkdown>
              </div>
            </div>
          )}
          {data.caution && (
            <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '18px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#D97706', marginBottom: '10px' }}>
                △ 주의할 점
              </div>
              <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.7 }}
                className="[&_strong]:font-semibold [&_p]:m-0">
                <ReactMarkdown components={mdInline}>{data.caution}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 스킬 카드 ──────────────────────────────────────────────────────────────────

const CARD_ACCENT_COLORS = [
  { bg: '#EFF6FF', icon: '#DBEAFE' }, // blue
  { bg: '#F5F3FF', icon: '#EDE9FE' }, // purple
  { bg: '#FDF2F8', icon: '#FCE7F3' }, // pink
  { bg: '#F0FDF4', icon: '#DCFCE7' }, // green
  { bg: '#FFFBEB', icon: '#FEF3C7' }, // yellow
  { bg: '#FFF7ED', icon: '#FFEDD5' }, // orange
];

function getLevelStyle(level: string): { bg: string; color: string } {
  if (level.includes('실무 활용')) return { bg: '#CCFBF1', color: '#0F766E' };
  if (level.includes('입문') || level.includes('→')) return { bg: '#E0E7FF', color: '#4338CA' };
  if (level.includes('심화')) return { bg: '#FEE2E2', color: '#B91C1C' };
  return { bg: '#F1F5F9', color: '#475569' };
}

function SkillCardsSection({ skills }: { skills: SkillCard[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
      {skills.map((skill, i) => {
        const accent = CARD_ACCENT_COLORS[i % CARD_ACCENT_COLORS.length];
        const levelStyle = getLevelStyle(skill.level);
        return (
          <div key={i} style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
            {/* 아이콘 + 스킬명 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                backgroundColor: accent.icon,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '24px', flexShrink: 0,
              }}>
                {skill.icon}
              </div>
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B' }}>{stripMd(skill.name)}</span>
            </div>
            {/* 설명 */}
            <div style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.6, marginBottom: '16px' }}
              className="[&_strong]:font-semibold [&_p]:m-0">
              <ReactMarkdown components={mdInline}>{skill.description}</ReactMarkdown>
            </div>
            {/* 구분선 + 강의 정보 */}
            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8', width: '28px', flexShrink: 0, paddingTop: '2px' }}>강의</span>
                {skill.course_url ? (
                  <a
                    href={skill.course_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '13px', color: '#4F46E5', textDecoration: 'underline', textUnderlineOffset: '2px', wordBreak: 'break-all' }}
                  >
                    {skill.course}
                  </a>
                ) : (
                  <span style={{ fontSize: '13px', color: '#334155' }}>{skill.course}</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8', width: '28px', flexShrink: 0 }}>목표</span>
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                  fontSize: '12px', fontWeight: 500,
                  backgroundColor: levelStyle.bg, color: levelStyle.color,
                  padding: '2px 10px', borderRadius: '999px',
                }}>
                  {skill.level}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EnneagramTypeCard({ typeNumber, cardStyle, characteristicsText }: { typeNumber: number; cardStyle: { bg: string; border: string }; characteristicsText?: string }) {
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
          <div className="w-[110px] sm:w-[180px] shrink-0">
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
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, height: '22px' }}
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
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, height: '20px' }}
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

        {/* 유형 특성 요약 */}
        {characteristicsText && (
          <div className="mt-4">
            <div className="text-xs font-medium mb-2" style={{ color: '#818CF8' }}>나에 대한 이야기</div>
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="text-sm leading-[1.8] text-slate-600 [&_strong]:font-semibold [&_p]:m-0">
                <ReactMarkdown components={mdInline}>{characteristicsText}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
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
  const cardStyle = { bg: '#F8F9FA', border: '#E5E7EB' };

  return (
    <div className="flex flex-col gap-6">
      {/* 모바일 전용 가로 화면 안내 배너 */}
      <div className="block md:hidden rounded-lg px-4 py-2.5 text-sm text-amber-700 bg-amber-50 border border-amber-200">
        가로 화면으로 보시면 더 편하게 읽을 수 있어요 📱
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
            {(() => {
              let visibleIdx = 0;
              return report.report_data.map((section) => {
              // show_as_card가 명시적으로 false인 섹션은 독립 카드 렌더링 스킵
              if (section.show_as_card === false) return null;
              const idx = visibleIdx++;

              if (section.key === 'enneagram_type') {
                const typeNumber = parseTypeNumber(typeof section.content === 'string' ? section.content : JSON.stringify(section.content));
                if (typeNumber) {
                  const charSection = report.report_data.find(s => s.key === 'characteristics');
                  const charText = typeof charSection?.content === 'string'
                    ? charSection.content
                    : charSection?.content && typeof charSection.content === 'object'
                      ? Object.values(charSection.content as Record<string, string>).join('\n\n')
                      : undefined;
                  return <EnneagramTypeCard key={section.key} typeNumber={typeNumber} cardStyle={cardStyle} characteristicsText={charText} />;
                }
              }
              // major_based_career_path: 직무 추천 카드 렌더링
              if (section.key === 'major_based_career_path') {
                const jobData = section.content as any;
                if (jobData && typeof jobData === 'object' && (jobData.jobs || jobData.summary)) {
                  return (
                    <div key={section.key} className="relative mt-10" style={{ paddingTop: '14px' }}>
                      <SectionLabel>{idx + 1}. {section.title}</SectionLabel>
                      <div className="p-5 pt-7 rounded-lg border" style={{ backgroundColor: cardStyle.bg, borderColor: cardStyle.border }}>
                        <JobRecommendationSection data={jobData as JobRecommendation} />
                      </div>
                    </div>
                  );
                }
              }

              // career_guidance: 스킬 카드 렌더링
              if (section.key === 'career_guidance') {
                const content = section.content as any;
                const skills = content?.skills;
                const skillSummary = content?.skill_summary;
                if (Array.isArray(skills) && skills.length > 0) {
                  return (
                    <div key={section.key} className="relative mt-10" style={{ paddingTop: '14px' }}>
                      <SectionLabel>{idx + 1}. {section.title}</SectionLabel>
                      <div className="p-5 pt-7 rounded-lg border" style={{ backgroundColor: cardStyle.bg, borderColor: cardStyle.border }}>
                        {skillSummary && (
                          <div style={{
                            backgroundColor: '#EEF2FF',
                            borderLeft: '4px solid #818CF8',
                            borderRadius: '0 10px 10px 0',
                            padding: '16px 20px',
                            fontSize: '14px', color: '#4338CA', lineHeight: 1.8,
                            marginBottom: '20px',
                          }} className="[&_strong]:font-semibold [&_p]:m-0">
                            <ReactMarkdown components={mdInline}>{skillSummary}</ReactMarkdown>
                          </div>
                        )}
                        <SkillCardsSection skills={skills} />
                      </div>
                    </div>
                  );
                }
              }

              const isNested = section.content !== null && typeof section.content === 'object';
              const subKeys = section.sub_keys ?? (isNested ? Object.keys(section.content as Record<string, string>).map(k => ({ key: k, label: k })) : []);
              return (
                <div key={section.key} className="relative mt-10" style={{ paddingTop: '14px' }}>
                  <SectionLabel>{idx + 1}. {section.title}</SectionLabel>
                  <div className="p-5 pt-7 rounded-lg border" style={{ backgroundColor: cardStyle.bg, borderColor: cardStyle.border }}>
                    {isNested ? (
                      <div className="space-y-4">
                        {subKeys.map(sk => {
                          const val = (section.content as Record<string, string>)[sk.key] ?? '';
                          return (
                            <div key={sk.key}>
                              <div className="text-xs font-semibold text-indigo-500 mb-1">{sk.label}</div>
                              <div className="leading-[1.7] text-[14px] [&_strong]:font-semibold [&_em]:italic [&_p]:mb-2 [&_p:last-child]:mb-0" style={{ color: '#6B7280' }}>
                                <ReactMarkdown>{val}</ReactMarkdown>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="leading-[1.7] text-[14px] [&_strong]:font-semibold [&_em]:italic [&_p]:mb-2 [&_p:last-child]:mb-0" style={{ color: '#6B7280' }}>
                        <ReactMarkdown>{section.content as string}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              );
            });
            })()}

            {report.generated_at && (
              <div className="text-xs text-slate-400 text-right pt-2 border-t mt-8">
                생성일: {new Date(report.generated_at).toLocaleString('ko-KR')}
              </div>
            )}
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
