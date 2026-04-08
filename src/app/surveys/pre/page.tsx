"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PRE_QUESTIONS } from "@/data/questions";
import { getPreSurveyQuestions } from "@/lib/survey-questions";
import type { QuestionItem } from "@/lib/types";
import { RadioOptions } from "@/components/RadioOptions";
import { CheckboxOptions } from "@/components/CheckboxOptions";
import { apiCompletePre, apiPatchPreAnswers, apiGetPreResponse } from "@/lib/api";
import { useProgress } from "@/lib/progress-context";
import { useSurveyStatus } from "@/hooks/useSurveyStatus";

export default function PreSurveyPage() {
  const router = useRouter();
  const { userId, progress, reload } = useProgress();
  const [answers, setAnswers] = useState<Record<string, string | null | string[]>>({});
  const saveTimer = useRef<number | null>(null);
  const hasSetInProgressRef = useRef(false);
  const [preList, setPreList] = useState<QuestionItem[] | null>(null);
  const surveyStatus = useSurveyStatus(userId, 'pre');

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const questions = await getPreSurveyQuestions();
        const finalQuestions = questions.length > 0 ? questions : PRE_QUESTIONS;
        setPreList(finalQuestions);
      } catch (error) {
        console.error('Failed to load pre-survey questions:', error);
        setPreList(PRE_QUESTIONS);
      }
    };
    loadQuestions();
  }, []);

  useEffect(() => {
    if (!preList || preList.length === 0 || !userId) return;

    const loadExistingAnswers = async () => {
      try {
        const response = await apiGetPreResponse(userId);

        if (response.answers && Object.keys(response.answers).length > 0) {
          const loadedAnswers: Record<string, string | null | string[]> = {};

          Object.entries(response.answers).forEach(([qId, storedValue]) => {
            const question = preList.find(q => String(q.id) === String(qId));
            if (!question) return;

            const answerType = question.answerType || '객관식-단일선택';

            // 주관식: 텍스트 그대로 복원
            if (answerType === '주관식') {
              if (typeof storedValue === 'string') {
                loadedAnswers[qId] = storedValue;
              }
              return;
            }

            // 객관식 (선택지 index → 선택지 텍스트 변환)
            if (!question.options) return;

            if (answerType === '객관식-다중선택') {
              let valueArray: number[] = [];
              if (Array.isArray(storedValue)) {
                valueArray = storedValue as number[];
              } else if (typeof storedValue === 'number') {
                valueArray = [storedValue];
              }
              const selectedOptions = valueArray
                .map(idx => {
                  const optionIndex = idx - 1;
                  return optionIndex >= 0 && optionIndex < question.options!.length
                    ? question.options![optionIndex].trim()
                    : null;
                })
                .filter((opt): opt is string => opt !== null);
              loadedAnswers[qId] = selectedOptions;
            } else {
              // 객관식-단일선택
              if (typeof storedValue === 'number') {
                const optionIndex = storedValue - 1;
                if (optionIndex >= 0 && optionIndex < question.options.length) {
                  loadedAnswers[qId] = question.options[optionIndex].trim();
                }
              }
            }
          });

          setAnswers(loadedAnswers);
        }
      } catch (error) {
        console.error('[PreSurvey] Error loading answers:', error);
      }
    };

    loadExistingAnswers();
  }, [userId, preList]);

  // 필수 문항 기준으로 완료 여부 판단
  const requiredQuestions = (preList || []).filter(q => q.required !== 'n');
  const validRequiredCount = requiredQuestions.filter(q => {
    const answer = answers[q.id];
    if (!answer || answer === null) return false;
    const answerType = q.answerType || '객관식-단일선택';
    if (answerType === '객관식-다중선택') {
      return Array.isArray(answer) && answer.length > 0;
    }
    if (answerType === '주관식') {
      return typeof answer === 'string' && answer.trim().length > 0;
    }
    return typeof answer === 'string' && answer.trim().length > 0;
  }).length;

  const totalAnswered = (preList || []).filter(q => {
    const answer = answers[q.id];
    if (!answer || answer === null) return false;
    if (Array.isArray(answer)) return answer.length > 0;
    return typeof answer === 'string' && answer.trim().length > 0;
  }).length;

  const pct = Math.round((totalAnswered / (preList?.length || 1)) * 100);
  const canComplete = validRequiredCount >= requiredQuestions.length;

  const triggerSave = (next: Record<string, string | null | string[]>) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const payload: { q_id: string; value: number; ts: number; text_value?: string }[] = [];

      (preList || []).forEach((q) => {
        const selected = next[q.id];
        const answerType = q.answerType || '객관식-단일선택';

        if (!selected || selected === null) return;

        if (answerType === '주관식') {
          if (typeof selected === 'string' && selected.trim()) {
            payload.push({ q_id: q.id, value: 0, ts: Date.now(), text_value: selected.trim() });
          }
          return;
        }

        const opts = (q.options ?? []).map(o => String(o).trim());

        if (answerType === '객관식-다중선택' && Array.isArray(selected)) {
          selected.forEach(opt => {
            const idx = opts.indexOf(opt.trim());
            if (idx !== -1) {
              payload.push({ q_id: q.id, value: idx + 1, ts: Date.now() });
            }
          });
        } else if (typeof selected === 'string') {
          const idx = opts.indexOf(selected.trim());
          if (idx !== -1) {
            payload.push({ q_id: q.id, value: idx + 1, ts: Date.now() });
          }
        }
      });

      await apiPatchPreAnswers(userId, payload, { page: 0, index: 0 });
    }, 500);
  };

  const markInProgressIfNeeded = (next: Record<string, string | null | string[]>) => {
    const hasAny = Object.values(next).some(v => {
      if (!v || v === null) return false;
      if (Array.isArray(v)) return v.length > 0;
      return true;
    });
    if (hasAny && !hasSetInProgressRef.current && surveyStatus.status !== 'in_progress') {
      hasSetInProgressRef.current = true;
      surveyStatus.updateStatus('in_progress').catch(() => {
        hasSetInProgressRef.current = false;
      });
    }
  };

  const onSelect = (qId: string, value: string | null) => {
    setAnswers(prev => {
      const next = value === null
        ? (() => { const n = { ...prev }; delete n[qId]; return n; })()
        : { ...prev, [qId]: value };
      markInProgressIfNeeded(next);
      triggerSave(next);
      return next;
    });
  };

  const onSelectMulti = (qId: string, values: string[]) => {
    setAnswers(prev => {
      const next = values.length === 0
        ? (() => { const n = { ...prev }; delete n[qId]; return n; })()
        : { ...prev, [qId]: values };
      markInProgressIfNeeded(next);
      triggerSave(next);
      return next;
    });
  };

  const onTextChange = (qId: string, value: string) => {
    setAnswers(prev => {
      const next = value.trim() === ''
        ? (() => { const n = { ...prev }; delete n[qId]; return n; })()
        : { ...prev, [qId]: value };
      markInProgressIfNeeded(next);
      triggerSave(next);
      return next;
    });
  };

  const onComplete = async () => {
    try {
      await surveyStatus.updateStatus('completed');
      await apiCompletePre(userId);
      await reload();
      router.push("/");
    } catch (error) {
      console.error('Failed to complete pre-survey:', error);
      alert('설문 완료 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  if (!preList || surveyStatus.loading) {
    return (
      <div className="flex flex-col gap-6">
        <button className="btn btn-outline w-fit" onClick={() => router.back()}>← 홈</button>
        <h2 className="text-xl font-semibold">사전 설문</h2>
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">
            {!preList ? '질문을 불러오는 중...' : '설문 상태를 불러오는 중...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <button className="btn btn-outline w-fit" onClick={() => router.back()}>← 홈</button>
      <h2 className="text-xl font-semibold">사전 설문</h2>
      <div className="flex flex-col gap-6">
        {preList.map((q, index) => {
          const answerType = q.answerType || '객관식-단일선택';
          const isRequired = q.required !== 'n';

          return (
            <div key={q.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-slate-500">
                      문항 {index + 1} / {preList.length}
                    </div>
                    {!isRequired && (
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
                        선택
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-semibold text-slate-800 leading-relaxed">
                    {q.text}
                  </div>
                </div>

                <div className="mt-2">
                  {answerType === '주관식' ? (
                    <textarea
                      className="w-full border border-slate-300 rounded-lg p-3 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                      rows={3}
                      placeholder="답변을 입력해주세요..."
                      value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                      onChange={(e) => onTextChange(q.id, e.target.value)}
                    />
                  ) : answerType === '객관식-다중선택' ? (
                    <CheckboxOptions
                      name={String(q.id)}
                      options={q.options ?? []}
                      selected={Array.isArray(answers[q.id]) ? answers[q.id] as string[] : []}
                      onSelect={(vals) => onSelectMulti(q.id, vals)}
                    />
                  ) : (
                    <RadioOptions
                      name={String(q.id)}
                      options={q.options ?? ["예", "아니오"]}
                      selected={Array.isArray(answers[q.id]) ? null : (answers[q.id] as string | null) ?? null}
                      onSelect={(val) => onSelect(q.id, val)}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>완료율: {pct}% ({totalAnswered}/{preList?.length || 0})</span>
            <button
              className="btn btn-primary"
              onClick={onComplete}
              disabled={!canComplete}
            >
              완료
            </button>
          </div>
          {!canComplete && requiredQuestions.length > 0 && (
            <div className="text-xs text-slate-400 mt-2">
              필수 문항 {requiredQuestions.length - validRequiredCount}개가 남아있습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
