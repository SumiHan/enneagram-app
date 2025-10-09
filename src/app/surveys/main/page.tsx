"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Likert } from "@/components/Likert";
import { MAIN_QUESTIONS_POOL } from "@/data/questions";
import { getMainSurveyQuestions } from "@/lib/survey-questions";
import { mulberry32, shuffleDeterministic } from "@/lib/rng";
import { apiCompleteMain, apiPatchMainAnswers, apiStartMainSession } from "@/lib/api";
import { useProgress } from "@/lib/progress-context";
import { getLocalStorage } from "@/lib/storage";

export default function MainSurveyPage() {
  const router = useRouter();
  const { userId, progress, reload } = useProgress();
  const [seed, setSeed] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!progress) return;
    if (progress.pre_survey.status !== "COMPLETED") {
      router.replace("/");
      return;
    }
    const existingSeed = progress.main_survey.seed ?? null;
    const s = existingSeed ?? Math.floor(Math.random() * 1_000_000);
    setSeed(s);
    if (existingSeed == null) {
      apiStartMainSession(userId, s).then(reload);
    }
    const ptr = progress.main_survey.last_pointer;
    if (ptr) {
      setCurrentPage(ptr.page || 0);
    }
  }, [progress, reload, router, userId]);

  const [allQuestions, setAllQuestions] = useState(MAIN_QUESTIONS_POOL);

  useEffect(() => {
    // Load questions from Supabase
    const loadQuestions = async () => {
      try {
        const questions = await getMainSurveyQuestions();
        setAllQuestions(questions.length > 0 ? questions : MAIN_QUESTIONS_POOL);
      } catch (error) {
        console.error('Failed to load main-survey questions:', error);
        setAllQuestions(MAIN_QUESTIONS_POOL); // Fallback to default
      }
    };
    
    loadQuestions();
  }, []);

  const shuffledQuestions = useMemo(() => {
    if (seed == null || allQuestions.length === 0) return [] as typeof MAIN_QUESTIONS_POOL;
    const shuffled = shuffleDeterministic(allQuestions, seed);
    return shuffled.slice(0, 90); // 90 questions total
  }, [allQuestions, seed]);

  const questions = useMemo(() => {
    const startIndex = currentPage * 30;
    return shuffledQuestions.slice(startIndex, startIndex + 30);
  }, [shuffledQuestions, currentPage]);

  const currentPageQuestionCount = questions.length;
  const pct = Math.round(((Object.keys(answers).length) / currentPageQuestionCount) * 100);
  const totalProgress = Math.round(((currentPage * 30 + Object.keys(answers).length) / shuffledQuestions.length) * 100);
  
  // Debug logging
  console.log('=== DEBUG INFO ===');
  console.log('Current page:', currentPage);
  console.log('Page range:', currentPage === 0 ? '1-30번' : currentPage === 1 ? '31-60번' : '61-90번');
  console.log('All questions length:', allQuestions.length);
  console.log('Questions length:', questions.length);
  console.log('Answers count:', Object.keys(answers).length);
  console.log('Current page question count:', currentPageQuestionCount);
  console.log('Answers object:', answers);
  console.log('Questions IDs:', questions.map(q => q.id));
  console.log('Answer keys:', Object.keys(answers));
  
  // Check for missing answers
  const questionIds = questions.map(q => q.id);
  const answerKeys = Object.keys(answers);
  const missingAnswers = questionIds.filter(id => !answerKeys.includes(id));
  const extraAnswers = answerKeys.filter(key => !questionIds.includes(key));
  
  console.log('Missing answers:', missingAnswers);
  console.log('Extra answers:', extraAnswers);
  console.log('==================');

  const onSelect = (questionId: string, value: number) => {
    console.log('onSelect called:', questionId, value);
    console.log('Current answers before:', Object.keys(answers).length);
    
    // If the same value is selected, toggle it off (cancel selection)
    if (answers[questionId] === value) {
      console.log('Toggling off answer for:', questionId);
      const next = { ...answers };
      delete next[questionId];
      setAnswers(next);
      
      // Auto-save
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(async () => {
        const payload = Object.entries(next).map(([q_id, value]) => ({ q_id, value, ts: Date.now() }));
        await apiPatchMainAnswers(userId, payload, { page: currentPage, index: 0 });
        reload();
      }, 800);
    } else {
      // Select new value
      console.log('Setting new answer for:', questionId, 'to', value);
      const next = { ...answers, [questionId]: value };
      setAnswers(next);
      
      // Auto-save
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(async () => {
        const payload = Object.entries(next).map(([q_id, value]) => ({ q_id, value, ts: Date.now() }));
        await apiPatchMainAnswers(userId, payload, { page: currentPage, index: 0 });
        reload();
      }, 800);
    }
  };


  const onNextPage = () => {
    console.log('onNextPage called');
    console.log('Current page before:', currentPage);
    console.log('Answers count:', Object.keys(answers).length);
    console.log('Questions length:', questions.length);
    console.log('Can proceed:', Object.keys(answers).length >= questions.length);
    
    if (currentPage < 2 && Object.keys(answers).length >= questions.length) {
      console.log('Moving to page:', currentPage + 1);
      setCurrentPage(currentPage + 1);
      // Don't clear answers here - let useEffect handle loading
    } else {
      console.log('Cannot proceed - either at last page or not all questions answered');
    }
  };

  const onPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      // Don't clear answers here - let useEffect handle loading
    }
  };

  // Load existing answers for current page
  useEffect(() => {
    console.log('useEffect triggered for loading answers');
    console.log('progress?.main_survey:', !!progress?.main_survey);
    console.log('allQuestions.length:', allQuestions.length);
    console.log('currentPage:', currentPage);
    
    if (!progress?.main_survey || !allQuestions.length) return;
    
    // Load answers from localStorage for current page
    const surveyKey = `survey.main.v1:${userId}`;
    const existingSurvey = getLocalStorage<{ answers?: any[] } | null>(surveyKey, null);
    console.log('Existing survey:', existingSurvey);
    
    if (existingSurvey?.answers) {
      const currentPageAnswers: Record<string, number> = {};
      
      // Filter answers for current page - use current page's questions directly
      const currentPageQuestionIds = questions.map(q => q.id);
      console.log('Current page question IDs:', currentPageQuestionIds);
      
      existingSurvey.answers.forEach((answer: any) => {
        const isInCurrentPage = currentPageQuestionIds.includes(answer.q_id);
        console.log('Answer:', answer.q_id, 'is in current page:', isInCurrentPage);
        if (isInCurrentPage) {
          currentPageAnswers[answer.q_id] = answer.value;
        }
      });
      
      console.log('Loaded answers for current page:', currentPageAnswers);
      setAnswers(currentPageAnswers);
    } else {
      // No existing answers, start fresh
      console.log('No existing answers, starting fresh');
      setAnswers({});
    }
  }, [currentPage, userId, allQuestions]); // progress 제거

  const onComplete = async () => {
    await apiCompleteMain(userId);
    await reload();
    router.push("/");
  };


  return (
    <div className="flex flex-col gap-6">
      <button className="btn btn-outline w-fit" onClick={() => router.back()}>← 홈</button>
      <h2 className="text-xl font-semibold">본 설문</h2>
      
      {/* 페이지 진행 표시 */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium">전체 진행률: {totalProgress}%</span>
          <span className="text-sm text-slate-500">
            {currentPage === 0 && "1-30번 문항"}
            {currentPage === 1 && "31-60번 문항"}
            {currentPage === 2 && "61-90번 문항"}
          </span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${totalProgress}%` }}
          ></div>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          {currentPage === 0 && "첫 번째 페이지: 1-30번 문항"}
          {currentPage === 1 && "두 번째 페이지: 31-60번 문항"}
          {currentPage === 2 && "세 번째 페이지: 61-90번 문항"}
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((question, questionIndex) => (
          <div key={question.id} className="card p-4">
            <div className="mb-3">
              <span className="text-sm text-slate-500">
                {currentPage * 30 + questionIndex + 1}번 문항
              </span>
              <div className="text-slate-700 mt-1">{question.text}</div>
            </div>
            <Likert 
              value={answers[question.id]} 
              onChange={(value) => onSelect(question.id, value)} 
            />
          </div>
        ))}
        
      </div>

      {/* 페이지 네비게이션 */}
      <div className="flex justify-center gap-2">
        <button 
          className="btn btn-outline" 
          onClick={onPrevPage} 
          disabled={currentPage === 0}
        >
          ← 이전 페이지
        </button>
        <span className="px-4 py-2 text-sm text-slate-600">
          {currentPage === 0 && "1-30번 문항"}
          {currentPage === 1 && "31-60번 문항"}
          {currentPage === 2 && "61-90번 문항"}
        </span>
        {currentPage === 0 || currentPage === 1 ? (
          <button 
            className="btn btn-primary" 
            onClick={onNextPage} 
            disabled={Object.keys(answers).length < questions.length}
          >
            다음페이지 {Object.keys(answers).length}/{questions.length} 완료
          </button>
        ) : (
          <button 
            className="btn btn-primary" 
            onClick={onComplete} 
            disabled={Object.keys(answers).length < questions.length}
          >
            설문 완료 {Object.keys(answers).length}/{questions.length} 완료
          </button>
        )}
      </div>
    </div>
  );
}


