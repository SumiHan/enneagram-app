"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

const Q4_LABELS: Record<string, string> = {
  fit:         "내 성격·강점과의 적합성",
  salary:      "연봉·안정성",
  growth:      "성장 가능성·커리어 전망",
  meaning:     "일의 의미·가치",
  balance:     "워라밸",
  expectation: "주변의 기대",
};

type InterviewRow = {
  id: string;
  user_id: string;
  enneagram_type: string | null;
  q1_accuracy: number;
  q2_job_resonance: string | null;
  q3_career_concern: string | null;
  q4_job_criteria: string[];
  q5_feedback: string | null;
  created_at: string;
  users?: { email: string; name: string } | null;
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-5 flex flex-col gap-1">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function HBar({ label, count, total, color = "#4F46E5" }: { label: string; count: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-36 shrink-0 text-slate-600 truncate">{label}</div>
      <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="w-14 text-right text-slate-500 shrink-0">{count}건 ({pct}%)</div>
    </div>
  );
}

export default function AdminInterviewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<InterviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") { router.replace("/"); return; }
    load();
  }, [user, router]);

  const load = async () => {
    setLoading(true);
    try {
      // interview_responses 전체 조회 (최신순)
      const { data: itvData, error: itvError } = await supabase
        .from("interview_responses")
        .select("*")
        .order("created_at", { ascending: false });

      if (itvError) throw itvError;
      const all = (itvData ?? []) as InterviewRow[];

      // user_id 기준 최신 1건만 유지
      const seen = new Set<string>();
      const deduped = all.filter(r => {
        if (seen.has(r.user_id)) return false;
        seen.add(r.user_id);
        return true;
      });

      const userIds = deduped.map(r => r.user_id);

      // 이메일 + 리포트 에니어그램 유형 병렬 조회
      const [{ data: usersData }, { data: reportsData }] = await Promise.all([
        userIds.length > 0
          ? supabase.from("users").select("id, email, name").in("id", userIds)
          : Promise.resolve({ data: [] }),
        userIds.length > 0
          ? supabase.from("reports").select("user_id, enneagram_type").in("user_id", userIds).order("id", { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

      const userMap = Object.fromEntries((usersData ?? []).map(u => [u.id, u]));
      // user_id 기준 최신 리포트의 enneagram_type만 사용
      const reportTypeMap: Record<string, string> = {};
      for (const r of (reportsData ?? [])) {
        if (!reportTypeMap[r.user_id] && r.enneagram_type) {
          reportTypeMap[r.user_id] = r.enneagram_type;
        }
      }

      setRows(deduped.map(r => ({
        ...r,
        enneagram_type: r.enneagram_type ?? reportTypeMap[r.user_id] ?? null,
        users: userMap[r.user_id] ?? null,
      })));
    } catch (e) {
      console.error("인터뷰 데이터 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  };

  // ── 통계 계산 ──────────────────────────────────────────────────────────────
  const total = rows.length;
  const q1Avg = total > 0
    ? (rows.reduce((s, r) => s + (r.q1_accuracy ?? 0), 0) / total).toFixed(2)
    : "—";

  const q1Dist = [1, 2, 3, 4, 5].map(n => ({
    score: n,
    count: rows.filter(r => r.q1_accuracy === n).length,
  }));

  const q4Counts: Record<string, number> = {};
  for (const id of Object.keys(Q4_LABELS)) q4Counts[id] = 0;
  for (const row of rows) {
    for (const id of (row.q4_job_criteria ?? [])) {
      if (id in q4Counts) q4Counts[id]++;
    }
  }
  const q4Total = Object.values(q4Counts).reduce((a, b) => a + b, 0);
  const topQ4 = Object.entries(q4Counts).sort((a, b) => b[1] - a[1])[0];

  const downloadExcel = () => {
    const sheetData = rows.map((r, i) => ({
      "번호": i + 1,
      "이메일": r.users?.email ?? r.user_id,
      "이름": r.users?.name ?? "",
      "에니어그램 유형": r.enneagram_type ?? "",
      "Q1. 유형 일치도 (1~5)": r.q1_accuracy,
      "Q2. 끌렸던 직업과 이유": r.q2_job_resonance ?? "",
      "Q3. 진로 고민": r.q3_career_concern ?? "",
      "Q4. 직업 선택 기준": (r.q4_job_criteria ?? []).map(id => Q4_LABELS[id] ?? id).join(", "),
      "Q5. 솔직한 느낌": r.q5_feedback ?? "",
      "응답일": new Date(r.created_at).toLocaleString("ko-KR"),
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "인터뷰 응답");
    XLSX.writeFile(wb, `인터뷰_응답_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">인터뷰 통계</h2>
        <div className="card p-6 text-center text-slate-500">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button className="btn btn-outline w-fit" onClick={() => router.push("/admin/dashboard")}>
          ← 대시보드로
        </button>
        <div className="flex gap-2">
          <button className="btn btn-outline text-sm" onClick={load}>새로고침</button>
          <button className="btn btn-primary text-sm" onClick={downloadExcel} disabled={rows.length === 0}>
            엑셀 다운로드
          </button>
        </div>
      </div>

      <h2 className="text-xl font-semibold">인터뷰 통계</h2>

      {total === 0 ? (
        <div className="card p-10 text-center text-slate-400">아직 인터뷰 응답이 없습니다.</div>
      ) : (
        <>
          {/* ── 요약 카드 3개 ── */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="총 응답 수" value={`${total}명`} />
            <StatCard
              label="Q1 유형 일치도 평균"
              value={`${q1Avg} / 5`}
              sub={Number(q1Avg) >= 3.5 ? "✓ TypeClassifier 유지 기준 충족" : "△ 프롬프트 재검토 권장"}
            />
            <StatCard
              label="Q4 가장 많이 선택된 항목"
              value={topQ4 ? Q4_LABELS[topQ4[0]] : "—"}
              sub={topQ4 ? `${topQ4[1]}건 선택` : ""}
            />
          </div>

          {/* ── Q1 점수 분포 ── */}
          <div className="card p-6 space-y-4">
            <div className="font-semibold text-slate-700">Q1. 에니어그램 유형 일치도 분포</div>
            <div className="space-y-2.5">
              {q1Dist.map(({ score, count }) => (
                <HBar
                  key={score}
                  label={`${score}점 ${"★".repeat(score)}${"☆".repeat(5 - score)}`}
                  count={count}
                  total={total}
                  color={score >= 4 ? "#4F46E5" : score === 3 ? "#94A3B8" : "#F87171"}
                />
              ))}
            </div>
          </div>

          {/* ── Q4 직업 선택 기준 분포 ── */}
          <div className="card p-6 space-y-4">
            <div className="font-semibold text-slate-700">Q4. 직업 선택 시 중요 기준 (복수 선택)</div>
            <div className="space-y-2.5">
              {Object.entries(q4Counts)
                .sort((a, b) => b[1] - a[1])
                .map(([id, count]) => (
                  <HBar key={id} label={Q4_LABELS[id]} count={count} total={q4Total} />
                ))}
            </div>
          </div>

          {/* ── Q2·Q3·Q5 텍스트 응답 목록 ── */}
          <div className="card p-6 space-y-3">
            <div className="font-semibold text-slate-700">텍스트 응답 목록</div>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={row.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* 행 헤더 */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-slate-50 transition-colors"
                    onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-xs w-5">{i + 1}</span>
                      <span className="font-medium text-slate-700">
                        {row.users?.email ?? row.user_id.slice(0, 8) + "…"}
                      </span>
                      {row.enneagram_type && (
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                          {row.enneagram_type}유형
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        Q1: {row.q1_accuracy}점
                      </span>
                      <span className="text-xs text-slate-400">
                        Q4: {(row.q4_job_criteria ?? []).map(id => Q4_LABELS[id] ?? id).join(", ") || "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-400">
                        {new Date(row.created_at).toLocaleDateString("ko-KR")}
                      </span>
                      <span className="text-slate-400 text-xs">{openIdx === i ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {/* 펼침 상세 */}
                  {openIdx === i && (
                    <div className="px-4 pb-4 pt-1 space-y-3 bg-slate-50 border-t border-slate-200">
                      {[
                        { label: "Q2. 가장 끌렸던 직업과 이유", value: row.q2_job_resonance },
                        { label: "Q3. 진로 관련 가장 큰 고민", value: row.q3_career_concern },
                        { label: "Q5. 솔직한 느낌 한 마디", value: row.q5_feedback },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div className="text-xs font-medium text-slate-500 mb-1">{label}</div>
                          <div className="text-sm text-slate-700 leading-relaxed bg-white rounded px-3 py-2 border border-slate-200">
                            {value || <span className="text-slate-300 italic">응답 없음</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
