"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Likert } from "@/components/Likert";
import { MAIN_QUESTIONS_POOL } from "@/data/questions";
import { getMainSurveyQuestions } from "@/lib/survey-questions";
import type { QuestionItem } from "@/lib/types";
import { mulberry32, shuffleDeterministic } from "@/lib/rng";
import { apiCompleteMain, apiPatchMainAnswers, apiStartMainSession, apiGetMainResponse } from "@/lib/api";
import { useProgress } from "@/lib/progress-context";
import { getLocalStorage } from "@/lib/storage";
import { useSurveyStatus } from "@/hooks/useSurveyStatus";

export default function MainSurveyPage() {
  const router = useRouter();
  const { userId, progress, reload } = useProgress();
  const [seed, setSeed] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({}); // Current page answers
  const [allAnswers, setAllAnswers] = useState<Record<string, number>>({}); // All answers across all pages
  const [currentPage, setCurrentPage] = useState(0);
  const saveTimer = useRef<number | null>(null);
  const hasSetInProgressRef = useRef(false); // Track if we've set in_progress status
  
  // Use DB-based status hook
  const surveyStatus = useSurveyStatus(userId, 'main');

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

  const [allQuestions, setAllQuestions] = useState<QuestionItem[] | null>(null);

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
    if (seed == null || !allQuestions || allQuestions.length === 0) return [] as typeof MAIN_QUESTIONS_POOL;
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
  
  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);
  
  // Debug logging
  console.log('=== DEBUG INFO ===');
  console.log('Current page:', currentPage);
  console.log('Page range:', currentPage === 0 ? '1-30번' : currentPage === 1 ? '31-60번' : '61-90번');
  console.log('All questions length:', allQuestions?.length || 0);
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
      const nextCurrentPage = { ...answers };
      delete nextCurrentPage[questionId];
      setAnswers(nextCurrentPage);
      
      // Update allAnswers as well
      const nextAll = { ...allAnswers };
      delete nextAll[questionId];
      setAllAnswers(nextAll);
      
      // Auto-save all answers
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(async () => {
        const payload = Object.entries(nextAll).map(([q_id, value]) => ({ q_id, value, ts: Date.now() }));
        await apiPatchMainAnswers(userId, payload, { page: currentPage, index: 0 });
        // Don't reload on every save
      }, 500); // 500ms debounce
    } else {
      // Select new value
      console.log('Setting new answer for:', questionId, 'to', value);
      const nextCurrentPage = { ...answers, [questionId]: value };
      setAnswers(nextCurrentPage);
      
      // Update allAnswers as well
      const nextAll = { ...allAnswers, [questionId]: value };
      setAllAnswers(nextAll);
      
      // Set status to 'in_progress' on first answer
      if (Object.keys(nextAll).length > 0 && !hasSetInProgressRef.current && surveyStatus.status !== 'in_progress') {
        hasSetInProgressRef.current = true;
        surveyStatus.updateStatus('in_progress').catch(err => {
          console.error('Failed to set in_progress status:', err);
          hasSetInProgressRef.current = false; // Reset on error
        });
      }
      
      // Auto-save all answers
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(async () => {
        const payload = Object.entries(nextAll).map(([q_id, value]) => ({ q_id, value, ts: Date.now() }));
        await apiPatchMainAnswers(userId, payload, { page: currentPage, index: 0 });
        // Don't reload on every save
      }, 500); // 500ms debounce
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
      // Scroll to top immediately before state change
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setCurrentPage(currentPage + 1);
      // Don't clear answers here - let useEffect handle loading
    } else {
      console.log('Cannot proceed - either at last page or not all questions answered');
    }
  };

  const onPrevPage = () => {
    if (currentPage > 0) {
      // Scroll to top immediately before state change
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setCurrentPage(currentPage - 1);
      // Don't clear answers here - let useEffect handle loading
    }
  };

  // Load existing answers from Supabase
  useEffect(() => {
    console.log('useEffect triggered for loading answers');
    console.log('progress?.main_survey:', !!progress?.main_survey);
    console.log('allQuestions.length:', allQuestions?.length || 0);
    console.log('currentPage:', currentPage);
    console.log('questions.length:', questions.length);
    
    if (!progress?.main_survey || !allQuestions || !allQuestions.length || !userId) return;
    
    const loadExistingAnswers = async () => {
      try {
        const response = await apiGetMainResponse(userId);
        console.log('Loaded main-survey response:', response);
        
        if (response.answers && Object.keys(response.answers).length > 0) {
          // Store all answers
          setAllAnswers(response.answers);
          
          // Filter answers for current page
          const currentPageQuestionIds = questions.map(q => q.id);
          const currentPageAnswers: Record<string, number> = {};
          
          Object.entries(response.answers).forEach(([qId, value]) => {
            if (currentPageQuestionIds.includes(qId)) {
              currentPageAnswers[qId] = value;
            }
          });
          
          console.log('Current page question IDs:', currentPageQuestionIds);
          console.log('Loaded all answers:', response.answers);
          console.log('Loaded answers for current page:', currentPageAnswers);
          setAnswers(currentPageAnswers);
        } else {
          // No existing answers, start fresh
          console.log('No existing answers, starting fresh');
          setAllAnswers({});
          setAnswers({});
        }
      } catch (error) {
        console.error('Error loading existing main-survey:', error);
        setAllAnswers({});
        setAnswers({});
      }
    };
    
    loadExistingAnswers();
  }, [currentPage, userId, allQuestions, questions]);

  const onComplete = async () => {
    try {
      // Update status to 'completed' via hook (DB first)
      await surveyStatus.updateStatus('completed');
      
      // Then call API to update other tables
      await apiCompleteMain(userId);
      await reload();
      
      router.push("/");
    } catch (error) {
      console.error('Failed to complete main survey:', error);
      alert('설문 완료 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };


  // 로딩 중일 때 표시
  if (!allQuestions || surveyStatus.loading) {
    return (
      <div className="flex flex-col gap-6">
        <button className="btn btn-outline w-fit" onClick={() => router.back()}>← 홈</button>
        <h2 className="text-xl font-semibold">본 설문</h2>
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">
            {!allQuestions ? '질문을 불러오는 중...' : '설문 상태를 불러오는 중...'}
          </div>
        </div>
      </div>
    );
  }

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

      {/* 선택 가이드라인 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
        <div className="text-center mb-3">
          <div className="text-sm font-medium text-slate-700 mb-2">
            📋 아래 중에서 본인에게 해당되는 정도를 선택해주세요
          </div>
        </div>
        
        {/* 데스크톱용 레이블 (항상 표시) */}
        <div className="hidden sm:grid grid-cols-6 gap-2 text-center text-xs">
          <div className="flex flex-col items-center gap-1">
            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#F87171' }}></div>
            <span className="font-medium text-slate-700">전혀<br/>그렇지 않다</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#FB923C' }}></div>
            <span className="font-medium text-slate-700">그렇지<br/>않다</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#FBBF24' }}></div>
            <span className="font-medium text-slate-700">약간<br/>그렇지 않다</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#86EFAC' }}></div>
            <span className="font-medium text-slate-700">약간<br/>그렇다</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#34D399' }}></div>
            <span className="font-medium text-slate-700">그렇다</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#10B981' }}></div>
            <span className="font-medium text-slate-700">매우<br/>그렇다</span>
          </div>
        </div>
        
        {/* 모바일용 간단 가이드 */}
        <div className="sm:hidden flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#F87171' }}></div>
            <span className="text-slate-600">부정</span>
          </div>
          <span className="text-slate-400">←</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#FBBF24' }}></div>
            <span className="text-slate-600">중립</span>
          </div>
          <span className="text-slate-400">→</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#10B981' }}></div>
            <span className="text-slate-600">긍정</span>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {questions.map((question, questionIndex) => (
          <div key={question.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                  {currentPage * 30 + questionIndex + 1}
                </span>
                <span className="text-xs text-slate-500">
                  / {shuffledQuestions.length}
                </span>
              </div>
              <div className="text-lg font-semibold text-slate-800 leading-relaxed">
                {question.text}
              </div>
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


