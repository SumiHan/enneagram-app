"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PRE_QUESTIONS } from "@/data/questions";
import { getPreSurveyQuestions } from "@/lib/survey-questions";
import type { QuestionItem } from "@/lib/types";
import { RadioOptions } from "@/components/RadioOptions";
import { apiCompletePre, apiPatchPreAnswers, apiGetPreResponse } from "@/lib/api";
import { useProgress } from "@/lib/progress-context";

export default function PreSurveyPage() {
  const router = useRouter();
  const { userId, progress, reload } = useProgress();
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const saveTimer = useRef<number | null>(null);

  const [preList, setPreList] = useState<QuestionItem[] | null>(null);

  useEffect(() => {
    // Load questions from Supabase
    const loadQuestions = async () => {
      try {
        const questions = await getPreSurveyQuestions();
        setPreList(questions.length > 0 ? questions : PRE_QUESTIONS);
      } catch (error) {
        console.error('Failed to load pre-survey questions:', error);
        setPreList(PRE_QUESTIONS); // Fallback to default
      }
    };
    
    loadQuestions();
  }, []);

  useEffect(() => {
    // Load existing answers from Supabase (after questions are loaded)
    if (!preList || preList.length === 0 || !userId) return;
    
    const loadExistingAnswers = async () => {
      try {
        const response = await apiGetPreResponse(userId);
        console.log('Loaded pre-survey response:', response);
        
        if (response.answers && Object.keys(response.answers).length > 0) {
          const loadedAnswers: Record<string, string | null> = {};
          
          // Convert from { q_id: value_index } to { q_id: option_text }
          Object.entries(response.answers).forEach(([qId, valueIndex]) => {
            const question = preList.find(q => q.id === qId);
            if (question && question.options) {
              const optionIndex = valueIndex - 1; // 1-based to 0-based
              if (optionIndex >= 0 && optionIndex < question.options.length) {
                const optionText = question.options[optionIndex];
                loadedAnswers[qId] = optionText ? optionText.trim() : null;
              }
            }
          });
          
          console.log('Converted loaded answers:', loadedAnswers);
          setAnswers(loadedAnswers);
        }
      } catch (error) {
        console.error('Error loading existing pre-survey:', error);
      }
    };
    
    loadExistingAnswers();
  }, [userId, preList]);

  const validAnswerCount = Object.keys(answers).filter(id => answers[id] !== null).length;
  const pct = Math.round((validAnswerCount / (preList?.length || 1)) * 100);

  const onSelect = (qId: string, value: string | null) => {
    console.log(`onSelect called: qId=${qId}, value=${value}`);
    
    // Use functional update to avoid state race conditions
    setAnswers(prev => {
      let next: Record<string, string | null>;
      
      if (value === null) {
        // Deselect
        console.log('Deselecting answer for:', qId);
        next = { ...prev };
        delete next[qId];
      } else {
        // Select or change
        console.log('Selecting value for:', qId);
        next = { ...prev, [qId]: value };
      }
      
      console.log('Updated answers count:', Object.keys(next).filter(k => next[k] !== null).length);
      
      // Trigger save with updated state
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(async () => {
        const payload = (preList || [])
          .map((q) => {
            const selected = next[q.id];
            
            if (!selected || selected === null) {
              return null;
            }
            
            const normalizedSelected = String(selected).trim();
            const opts = (q.options ?? []).map(o => String(o).trim());
            const idx = opts.indexOf(normalizedSelected);
            
            if (idx === -1) {
              console.warn(`Question ${q.id}: selected "${normalizedSelected}" not found in options`, opts);
              return null;
            }
            
            return { q_id: q.id, value: idx + 1, ts: Date.now() };
          })
          .filter((a): a is { q_id: string; value: number; ts: number } => a !== null);
        
        console.log('Saving pre-survey answers:');
        console.log('Total questions:', preList?.length || 0);
        console.log('Valid answers to save:', payload.length);
        console.log('Payload:', payload);
        
        await apiPatchPreAnswers(userId, payload, { page: 0, index: 0 });
        // Don't reload on every save - only reload on complete
      }, 500); // 500ms debounce for auto-save
      
      return next;
    });
  };

  const onComplete = async () => {
    await apiCompletePre(userId);
    await reload();
    router.push("/");
  };

  // 로딩 중일 때 표시
  if (!preList) {
    return (
      <div className="flex flex-col gap-6">
        <button className="btn btn-outline w-fit" onClick={() => router.back()}>← 홈</button>
        <h2 className="text-xl font-semibold">사전 설문</h2>
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">질문을 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <button className="btn btn-outline w-fit" onClick={() => router.back()}>← 홈</button>
      <h2 className="text-xl font-semibold">사전 설문</h2>
      <div className="flex flex-col gap-6">
        {preList.map((q, index) => (
          <div key={q.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex flex-col gap-4">
              {/* 문항 번호와 질문 텍스트 */}
              <div className="flex flex-col gap-2">
                <div className="text-sm font-medium text-slate-500">
                  문항 {index + 1} / {preList.length}
                </div>
                <div className="text-lg font-semibold text-slate-800 leading-relaxed">
                  {q.text}
                </div>
              </div>
              
              {/* 선택 옵션들 */}
              <div className="mt-2">
                <RadioOptions
                  name={q.id}
                  options={q.options ?? ["예", "아니오"]}
                  selected={answers[q.id] ?? null}
                  onSelect={(val) => onSelect(q.id, val)}
                />
              </div>
            </div>
          </div>
        ))}
        
        {/* 완료 버튼 섹션 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>완료율: {pct}% ({validAnswerCount}/{preList?.length || 0})</span>
            <button className="btn btn-primary" onClick={onComplete} disabled={validAnswerCount < (preList?.length || 0)}>완료</button>
          </div>
        </div>
      </div>
    </div>
  );
}


