"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useProgress } from "@/lib/progress-context";
import { apiSubmitInterview } from "@/lib/api";

const Q4_OPTIONS = [
  { id: "fit",         label: "내 성격·강점과의 적합성" },
  { id: "salary",      label: "연봉·안정성" },
  { id: "growth",      label: "성장 가능성·커리어 전망" },
  { id: "meaning",     label: "일의 의미·가치" },
  { id: "balance",     label: "워라밸" },
  { id: "expectation", label: "주변의 기대" },
];

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "12px", borderRadius: "8px",
  border: "1.5px solid #E5E7EB", fontSize: "13px",
  color: "#374151", resize: "none", boxSizing: "border-box",
  lineHeight: 1.6, fontFamily: "inherit",
};

export default function InterviewPage() {
  const router = useRouter();
  const { userId, progress } = useProgress();
  const reportId = progress?.report.report_id ?? "";

  const [q1, setQ1] = useState<number | null>(null);
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");
  const [q4, setQ4] = useState<string[]>([]);
  const [q5, setQ5] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleQ4 = (id: string) => {
    setQ4(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 2 ? [...prev, id] : prev
    );
  };

  const handleSubmit = async () => {
    if (!q1) return;
    setLoading(true);
    try {
      await apiSubmitInterview({
        userId,
        reportId,
        q1,
        q2,
        q3,
        q4,
        q5,
      });
      setSubmitted(true);
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col gap-6">
        <button className="btn btn-outline w-fit" onClick={() => router.push("/dashboard")}>
          ← 대시보드
        </button>
        <div className="card p-10 text-center">
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🙏</div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#111827", marginBottom: "8px" }}>
            소중한 의견 감사합니다!
          </div>
          <div style={{ fontSize: "14px", color: "#9CA3AF", marginBottom: "28px" }}>
            더 나은 서비스를 만드는 데 활용하겠습니다.
          </div>
          <button className="btn btn-primary" onClick={() => router.push("/dashboard")}>
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <button className="btn btn-outline w-fit" onClick={() => router.back()}>
        ← 뒤로
      </button>

      <div className="card p-6" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        {/* 헤더 */}
        <div>
<div style={{ fontSize: "20px", fontWeight: 700, color: "#111827", marginBottom: "4px" }}>
            리포트를 보고 나서 어떠셨나요?
          </div>
          <div style={{ fontSize: "13px", color: "#9CA3AF" }}>
            3분 소요 · 서비스 개선에 큰 도움이 됩니다
          </div>
        </div>

        {/* Q1 */}
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#374151", marginBottom: "14px" }}>
            Q1. 에니어그램 유형 결과가 본인과 얼마나 일치한다고 느꼈나요?
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setQ1(n)}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: "8px",
                  border: q1 === n ? "2px solid #4F46E5" : "1.5px solid #E5E7EB",
                  backgroundColor: q1 === n ? "#EEF2FF" : "#fff",
                  color: q1 === n ? "#4F46E5" : "#6B7280",
                  fontSize: "15px", fontWeight: q1 === n ? 700 : 400,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#9CA3AF", marginTop: "6px", padding: "0 2px" }}>
            <span>전혀 안 맞음</span><span>매우 잘 맞음</span>
          </div>
        </div>

        {/* Q2 */}
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#374151", marginBottom: "8px" }}>
            Q2. 추천받은 직업 중 가장 끌렸던 것과 그 이유는?
          </div>
          <textarea
            value={q2}
            onChange={e => setQ2(e.target.value)}
            placeholder="예: UX 디자이너가 끌렸어요. 사람들이 편하게 쓸 수 있는 걸 만드는 게 제 성향과 맞는 것 같아서요."
            rows={3}
            style={inputStyle}
          />
        </div>

        {/* Q3 */}
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#374151", marginBottom: "8px" }}>
            Q3. 지금 진로와 관련해서 가장 고민되는 게 뭔가요?
          </div>
          <textarea
            value={q3}
            onChange={e => setQ3(e.target.value)}
            placeholder="예: 어떤 직무가 나한테 맞는지 모르겠어요 / 좋아하는 건 알겠는데 취업이 될지 모르겠어요"
            rows={3}
            style={inputStyle}
          />
        </div>

        {/* Q4 */}
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
            Q4. 직업을 고를 때 가장 중요하게 보는 것은?
          </div>
          <div style={{ fontSize: "12px", color: "#9CA3AF", marginBottom: "12px" }}>최대 2개 선택</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {Q4_OPTIONS.map(opt => {
              const selected = q4.includes(opt.id);
              const maxed = !selected && q4.length >= 2;
              return (
                <button
                  key={opt.id}
                  onClick={() => !maxed && toggleQ4(opt.id)}
                  style={{
                    padding: "11px 14px", borderRadius: "8px", textAlign: "left",
                    border: selected ? "2px solid #4F46E5" : "1.5px solid #E5E7EB",
                    backgroundColor: selected ? "#EEF2FF" : maxed ? "#F9FAFB" : "#fff",
                    color: selected ? "#4F46E5" : maxed ? "#D1D5DB" : "#374151",
                    fontSize: "13px", fontWeight: selected ? 600 : 400,
                    cursor: maxed ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", gap: "10px",
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{
                    width: "18px", height: "18px", borderRadius: "4px", flexShrink: 0,
                    border: selected ? "2px solid #4F46E5" : "1.5px solid #D1D5DB",
                    backgroundColor: selected ? "#4F46E5" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {selected && <span style={{ color: "#fff", fontSize: "11px", lineHeight: 1, fontWeight: 700 }}>✓</span>}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Q5 */}
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#374151", marginBottom: "8px" }}>
            Q5. 리포트를 보고 나서 솔직한 느낌 한 마디만 남겨주세요.
          </div>
          <textarea
            value={q5}
            onChange={e => setQ5(e.target.value)}
            placeholder="예: 생각보다 나를 잘 알고 있어서 놀랐어요 / 직업 추천이 좀 더 구체적이었으면 좋겠어요"
            rows={2}
            style={inputStyle}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!q1 || loading}
          style={{
            width: "100%", padding: "14px", borderRadius: "10px",
            backgroundColor: !q1 ? "#E5E7EB" : "#4F46E5",
            color: !q1 ? "#9CA3AF" : "#fff",
            fontSize: "15px", fontWeight: 600, border: "none",
            cursor: !q1 ? "not-allowed" : "pointer",
            transition: "background-color 0.15s",
          }}
        >
          {loading ? "제출 중..." : "제출하기"}
        </button>
      </div>
    </div>
  );
}
