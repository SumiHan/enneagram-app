"use client";
import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TYPES, TRIAD_STYLE, type Triad } from "@/lib/enneagram-data";
import { EnneagramDiagram } from "@/components/EnneagramDiagram";

// 이 페이지 전용 TRIADS (긴 부제목 버전)
const TRIADS = [
  { key: "gut",   name: "본능 중심", subtitle: "분노를 핵심 감정으로 삼고, 자율·통제·평화를 추구", types: [1, 8, 9], color: "text-red-600",   bg: "bg-red-50",   border: "border-red-200" },
  { key: "heart", name: "감정 중심", subtitle: "수치심을 핵심 감정으로 삼고, 사랑·인정·정체성을 추구", types: [2, 3, 4], color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  { key: "head",  name: "사고 중심", subtitle: "두려움을 핵심 감정으로 삼고, 안전·확신·자유를 추구", types: [5, 6, 7], color: "text-blue-600",  bg: "bg-blue-50",  border: "border-blue-200" },
];

function EnneagramIntroContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramType = parseInt(searchParams.get("type") ?? "1", 10);
  const validInitial = TYPES.some(t => t.number === paramType) ? paramType : 1;
  const [selected, setSelected] = useState(validInitial);

  const current = TYPES.find(t => t.number === selected)!;
  const ts = TRIAD_STYLE[current.triad];
  const triad = TRIADS.find(tr => tr.key === current.triad)!;
  const wingTypes = current.wings.map(w => TYPES.find(t => t.number === w)!);
  const growthType = TYPES.find(t => t.number === current.growth)!;
  const stressType = TYPES.find(t => t.number === current.stress)!;

  return (
    <div className="flex flex-col gap-6 pb-10">

      {/* 뒤로 가기 */}
      <button className="btn btn-outline w-fit" onClick={() => router.back()}>← 홈</button>

      {/* 헤더 소개 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">에니어그램이란?</h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          에니어그램은 <strong>9가지 핵심 동기</strong>로 사람의 성격을 설명하는 심리 모델이에요.<br />
          단순한 행동 분류가 아니라, <strong>"왜 그렇게 행동하는가"</strong>에 초점을 맞춰요.<br />
          이 앱에서는 유형별 강점과 동기를 분석해 나에게 맞는 직무를 안내해줘요.
        </p>
      </div>

      {/* 세 가지 중심 */}
      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-1">세 가지 중심</h2>
        <p className="text-xs text-slate-500 mb-1">에니어그램은 9가지 유형을 세 가지 중심으로 묶어요. 각 중심은 세상을 인식하는 방식과 핵심 감정을 공유해요.</p>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex-1 min-w-0 order-first sm:order-last">
            <img src="/images/enneagram_triad.svg" alt="에니어그램 세 가지 중심 다이어그램" className="w-full" />
          </div>
          <div className="flex flex-col gap-3 w-full sm:w-[300px] shrink-0 order-last sm:order-first">
            {TRIADS.map((tr) => (
              <div key={tr.key} className="card p-3">
                <div className={`text-sm font-semibold ${tr.color}`}>{tr.name}</div>
                <div className="text-xs text-slate-400 mt-2">{tr.subtitle}</div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {tr.types.map(n => (
                    <span key={n} className={`text-xs font-medium px-1.5 py-0.5 rounded ${TRIAD_STYLE[tr.key as Triad].tag}`}>
                      {n}유형
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 9가지 유형: 다이어그램 + 상세 패널 */}
      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-1">9가지 유형</h2>
        <p className="text-xs text-slate-500 mb-3">번호를 클릭하면 각 유형의 핵심 욕구, 두려움, 키워드를 확인할 수 있어요.</p>
        <div className="card p-5">
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start mb-5">
            <div className="w-full sm:w-[280px] shrink-0">
              <EnneagramDiagram selected={selected} onSelect={setSelected} />
            </div>
            <div className="flex-1 w-full">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ts.nodeActive }} />
                <span className="text-xs font-medium" style={{ color: ts.textColor }}>{triad.name}</span>
              </div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold text-slate-800">{current.number}</span>
                <div>
                  <div className="text-lg font-semibold text-slate-800">{current.name}</div>
                  <div className="text-sm text-slate-400">{current.subtitle}</div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="card p-3">
                  <div className="text-xs text-slate-400 mb-0.5">핵심 욕구</div>
                  <div className="text-sm text-slate-700">{current.coreDesire}</div>
                </div>
                <div className="card p-3">
                  <div className="text-xs text-slate-400 mb-0.5">핵심 두려움</div>
                  <div className="text-sm text-slate-700">{current.coreFear}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {current.keywords.map(kw => (
                  <span key={kw} className={`text-xs px-2 py-1 rounded-full ${ts.tag}`}>{kw}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 날개 */}
      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-1">날개 (Wings)</h2>
        <p className="text-xs text-slate-500 mb-3">
          내 주 유형 양옆 번호가 날개예요. 날개의 특성이 주 유형에 섞여 성격을 다채롭게 만들어요.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {wingTypes.map(w => {
            const ws = TRIAD_STYLE[w.triad];
            return (
              <button
                key={w.number}
                className="card p-4 text-left hover:border-slate-300 transition-colors"
                onClick={() => setSelected(w.number)}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ws.nodeActive }} />
                  <span className="text-xs text-slate-400">{current.number}w{w.number}</span>
                </div>
                <div className="text-sm font-semibold text-slate-800">{w.number}. {w.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{w.subtitle}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {w.keywords.slice(0, 3).map(kw => (
                    <span key={kw} className={`text-xs px-1.5 py-0.5 rounded ${ws.tag}`}>{kw}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 성장 & 스트레스 방향 */}
      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-1">성장 & 스트레스 방향</h2>
        <p className="text-xs text-slate-500 mb-3">
          건강할 때는 성장 방향 유형의 긍정적 특성을 닮고, 스트레스를 받을 때는 스트레스 방향 유형의 부정적 특성이 나타나요.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button className="card p-4 text-left hover:border-slate-300 transition-colors" onClick={() => setSelected(growthType.number)}>
            <div className="text-xs font-medium text-green-600 mb-1.5">성장 방향</div>
            <div className="text-sm font-semibold text-slate-800">{growthType.number}. {growthType.name}</div>
            <div className="text-xs text-slate-400 mt-0.5">{growthType.subtitle}</div>
            <div className="text-xs text-slate-500 mt-2 leading-snug">건강할 때 이 유형의 장점을 흡수해요</div>
          </button>
          <button className="card p-4 text-left hover:border-slate-300 transition-colors" onClick={() => setSelected(stressType.number)}>
            <div className="text-xs font-medium text-orange-500 mb-1.5">스트레스 방향</div>
            <div className="text-sm font-semibold text-slate-800">{stressType.number}. {stressType.name}</div>
            <div className="text-xs text-slate-400 mt-0.5">{stressType.subtitle}</div>
            <div className="text-xs text-slate-500 mt-2 leading-snug">힘들 때 이 유형의 단점이 나타나요</div>
          </button>
        </div>
      </div>

    </div>
  );
}

export default function EnneagramIntroPage() {
  return (
    <Suspense fallback={<div className="text-slate-500 text-sm py-10 text-center">불러오는 중...</div>}>
      <EnneagramIntroContent />
    </Suspense>
  );
}
