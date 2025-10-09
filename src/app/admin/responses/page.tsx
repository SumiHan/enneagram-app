"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPreQuestionsFromStorage, getMainQuestionsFromStorage } from "@/lib/dynamic-questions";
import type { SurveyAnswer, QuestionItem } from "@/lib/types";
import { SurveyStatusCell } from "@/components/SurveyStatusCell";
import { eventBus, EVENTS } from "@/lib/event-bus";
import { useRealtimeSubscription } from "@/lib/realtime";
import * as XLSX from 'xlsx';

type UserRecord = {
  userId: string;
  email: string;
  name: string;
  preStatus: string;
  preAnsweredCount: number;
  preTotalCount: number;
  mainStatus: string;
  mainAnsweredCount: number;
  mainTotalCount: number;
  reportStatus: string;
  preAnswers: SurveyAnswer[];
  mainAnswers: SurveyAnswer[];
  reportData: any;
};

export default function AdminResponsesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [records, setRecords] = useState<UserRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [preQuestions, setPreQuestions] = useState<QuestionItem[]>([]);
  const [mainQuestions, setMainQuestions] = useState<QuestionItem[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'pre' | 'main' | 'report'>('pre');
  const [loading, setLoading] = useState(true);
  const [currentReportData, setCurrentReportData] = useState<any>(null);
  
  // Initialize real-time subscriptions
  const isRealtimeConnected = useRealtimeSubscription();

  useEffect(() => {
    if (user?.role !== "admin") {
      router.replace("/");
      return;
    }
    loadData();
  }, [user, router]);
  
  // Refresh data on page focus (when user comes back to tab)
  useEffect(() => {
    const handleFocus = () => {
      if (user?.role === "admin") {
        console.log('Page focused, refreshing data...');
        loadData();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

  // Listen for report generation events
  useEffect(() => {
    const handleReportGenerated = (data: any) => {
      console.log('[AdminResponses] Report generated event received:', data);
      
      // Refresh data when any report is generated
      loadData();
      
      // If we're viewing the report tab for the user who generated the report, refresh report data
      if (selectedUser && data.userId === selectedUser && activeTab === 'report') {
        getFreshReportData(selectedUser).then(reportData => {
          setCurrentReportData(reportData);
        });
      }
    };

    const handleDataUpdated = (data: any) => {
      console.log('[AdminResponses] Data updated event received:', data);
      
      // Refresh data when any data is updated
      loadData();
      
      // If we're viewing the report tab for the user whose data was updated, refresh report data
      if (selectedUser && data.userId === selectedUser && activeTab === 'report') {
        getFreshReportData(selectedUser).then(reportData => {
          setCurrentReportData(reportData);
        });
      }
    };

    // Subscribe to events
    eventBus.on(EVENTS.REPORT_GENERATED, handleReportGenerated);
    eventBus.on(EVENTS.DATA_UPDATED, handleDataUpdated);

    // Cleanup on unmount
    return () => {
      eventBus.off(EVENTS.REPORT_GENERATED, handleReportGenerated);
      eventBus.off(EVENTS.DATA_UPDATED, handleDataUpdated);
    };
  }, [selectedUser, activeTab]);

  // Load fresh report data when report tab is activated
  useEffect(() => {
    if (selectedUser && activeTab === 'report') {
      console.log(`Loading fresh report data for user: ${selectedUser}`);
      getFreshReportData(selectedUser).then(reportData => {
        setCurrentReportData(reportData);
      });
    }
  }, [selectedUser, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Debug: Check all reports in database
      const { data: allReports, error: allReportsError } = await supabase
        .from('reports')
        .select('*');
      
      console.log('All reports in database:', { allReports, allReportsError });
      
      // Load questions from Supabase
      const { data: preQData } = await supabase
        .from('pre_survey_questions')
        .select('*');
      const { data: mainQData } = await supabase
        .from('main_survey_questions')
        .select('*');
      
      // Map question data to use q_id as id and text_ko as text
      const mappedPreQuestions = (preQData || []).map(q => ({
        ...q,
        id: q.q_id, // Use q_id as the id field
        text: q.text_ko, // Use text_ko as the text field
        // Parse options if it's a string separated by '/'
        options: typeof q.options === 'string' 
          ? q.options.split('/').map((opt: string) => opt.trim()) 
          : q.options
      }));
      
      const mappedMainQuestions = (mainQData || []).map(q => ({
        ...q,
        id: q.q_id, // Use q_id as the id field
        text: q.text_ko // Use text_ko as the text field
      }));
      
      console.log('Mapped pre questions:', mappedPreQuestions.slice(0, 2));
      console.log('Mapped main questions:', mappedMainQuestions.slice(0, 2));
      
      setPreQuestions(mappedPreQuestions);
      setMainQuestions(mappedMainQuestions);
      
      console.log('Loaded questions from Supabase:', {
        pre: preQData?.length || 0,
        main: mainQData?.length || 0
      });
      
      // Load only users with role='user' (exclude admins)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, name, role')
        .eq('role', 'user'); // Only load users with role='user'
      
      if (usersError) throw usersError;
      
      console.log('Loaded user-role users for responses:', usersData?.length);
      
      // Debug: Check current authenticated user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      console.log('Current authenticated user:', currentUser?.id, currentUser?.email);
      
      const userRecords: UserRecord[] = [];
      
      for (const userData of usersData || []) {
        
        // Load responses from responses table
        const { data: preResponseData } = await supabase
          .from('responses')
          .select('*')
          .eq('user_id', userData.id)
          .eq('survey_type', 'pre')
          .maybeSingle();
        
        const { data: mainResponseData } = await supabase
          .from('responses')
          .select('*')
          .eq('user_id', userData.id)
          .eq('survey_type', 'main')
          .maybeSingle();
        
        // Calculate status and counts based on actual response data
        const preTotalCount = preQData?.length || 20;
        const mainTotalCount = mainQData?.length || 90;
        
        // Calculate answered counts from responses data
        const preAnsweredCount = preResponseData?.answers 
          ? Object.keys(preResponseData.answers).length 
          : 0;
        const mainAnsweredCount = mainResponseData?.answers 
          ? Object.keys(mainResponseData.answers).length 
          : 0;
        
        // Determine status based on answered count
        const getStatus = (answered: number, total: number) => {
          if (answered === 0) return 'NOT_STARTED';
          if (answered < total) return 'IN_PROGRESS';
          return 'COMPLETED';
        };
        
        const preStatus = getStatus(preAnsweredCount, preTotalCount);
        const mainStatus = getStatus(mainAnsweredCount, mainTotalCount);
        
        console.log(`User ${userData.email}:`, {
          pre: { answered: preAnsweredCount, total: preTotalCount, status: preStatus },
          main: { answered: mainAnsweredCount, total: mainTotalCount, status: mainStatus }
        });
        
        // Load report (maybeSingle to avoid error when no data)
        const { data: reportData, error: reportError } = await supabase
          .from('reports')
          .select('*')
          .eq('user_id', userData.id)
          .order('id', { ascending: false }) // Use id instead of created_at
          .limit(1)
          .maybeSingle(); // Use maybeSingle instead of single to handle no data gracefully
        
        if (reportError) {
          console.error(`Error loading report for user ${userData.email}:`, reportError);
        }
        
        console.log(`Report data for user ${userData.email}:`, { reportData, reportError });
        
        // Determine report status - more strict check
        const reportStatus = (reportData && reportData.id && reportData.enneagram_type) ? 'COMPLETED' : 'NOT_STARTED';
        console.log(`Report status for ${userData.email}: ${reportStatus} (reportData exists: ${!!reportData}, has id: ${!!reportData?.id}, has type: ${!!reportData?.enneagram_type})`);
        
        userRecords.push({
          userId: userData.id,
          email: userData.email,
          name: userData.name || '-',
          preStatus: preStatus,
          preAnsweredCount: preAnsweredCount,
          preTotalCount: preTotalCount,
          mainStatus: mainStatus,
          mainAnsweredCount: mainAnsweredCount,
          mainTotalCount: mainTotalCount,
          reportStatus: reportStatus,
          preAnswers: preResponseData?.answers ? Object.entries(preResponseData.answers).map(([qId, value]) => ({
            q_id: qId,
            value: Number(value),
            ts: new Date(preResponseData.updated_at || new Date().toISOString()).getTime()
          })) : [],
          mainAnswers: mainResponseData?.answers ? Object.entries(mainResponseData.answers).map(([qId, value]) => ({
            q_id: qId,
            value: Number(value),
            ts: new Date(mainResponseData.updated_at || new Date().toISOString()).getTime()
          })) : [],
          reportData: reportData,
        });
      }
      
      setRecords(userRecords);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedRecord = records.find(r => r.userId === selectedUser);
  
  // Function to refresh selected user data
  const refreshSelectedUserData = async (userId: string) => {
    try {
      // Reload the entire dataset to get fresh data
      await loadData();
      console.log(`Refreshed data for user: ${userId}`);
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  // Function to get fresh report data for selected user
  const getFreshReportData = async (userId: string) => {
    try {
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', userId)
        .order('id', { ascending: false }) // Use id instead of created_at
        .limit(1)
        .maybeSingle();
      
      if (reportError) {
        console.error(`Error fetching fresh report data for user ${userId}:`, reportError);
        return null;
      }
      
      console.log(`Fresh report data for user ${userId}:`, reportData);
      return reportData;
    } catch (error) {
      console.error('Error fetching fresh report data:', error);
      return null;
    }
  };

  const getAnswerText = (answer: SurveyAnswer, questions: QuestionItem[]) => {
    console.log('getAnswerText called:', { answer, questionsCount: questions.length });
    
    const question = questions.find(q => q.id === answer.q_id);
    console.log('Found question:', { question, questionId: answer.q_id });
    
    if (!question) {
      console.log('Question not found for answer:', answer);
      return `${answer.q_id}: ${answer.value} (질문 텍스트 없음)`;
    }
    
    // Check if question has options (for pre-survey) or use Likert scale (for main-survey)
    if (question.options) {
      // Handle options - could be array or string separated by '/'
      let optionsArray: string[] = [];
      
      if (Array.isArray(question.options)) {
        optionsArray = question.options;
      } else if (typeof question.options === 'string') {
        // Split by '/' if it's a string
        optionsArray = (question.options as string).split('/').map((opt: string) => opt.trim());
      }
      
      console.log('Parsed options:', { original: question.options, parsed: optionsArray });
      
      if (optionsArray.length > 0) {
        const idx = parseInt(String(answer.value)) - 1;
        const optionText = optionsArray[idx];
        console.log('Using options:', { idx, optionText, optionsArray });
        return optionText || `선택 ${answer.value}`;
      }
    }
    
    // For main survey (Likert scale 1-6)
    const likertLabels = ["전혀 그렇지 않다", "그렇지 않다", "약간 그렇지 않다", "약간 그렇다", "그렇다", "매우 그렇다"];
    const likertText = likertLabels[parseInt(String(answer.value)) - 1] || String(answer.value);
    console.log('Using Likert scale:', { value: answer.value, likertText });
    return likertText;
  };

  const toggleUserSelection = (userId: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUsers(newSet);
  };

  const selectAll = () => {
    setSelectedUsers(new Set(records.map(r => r.userId)));
  };

  const deselectAll = () => {
    setSelectedUsers(new Set());
  };

  const bulkDelete = async () => {
    if (selectedUsers.size === 0) {
      alert('삭제할 사용자를 선택하세요.');
      return;
    }
    
    if (!confirm(`${selectedUsers.size}명의 사용자를 삭제하시겠습니까?`)) return;
    
    try {
      for (const userId of Array.from(selectedUsers)) {
        // Delete related data
        await supabase.from('reports').delete().eq('user_id', userId);
        await supabase.from('survey_answers').delete().eq('user_id', userId);
        await supabase.from('user_progress').delete().eq('user_id', userId);
        await supabase.from('users').delete().eq('id', userId);
      }
      
      // Reload data
      setSelectedUsers(new Set());
      await loadData();
      alert('삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting users:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  const downloadExcel = () => {
    if (selectedUsers.size === 0) {
      alert('다운로드할 사용자를 선택하세요.');
      return;
    }

    const selectedRecords = records.filter(r => selectedUsers.has(r.userId));

    // Pre-survey sheet
    const preHeaders = ['이메일', ...preQuestions.map(q => q.id)];
    const preRows = selectedRecords.map(r => {
      const row: any = { '이메일': r.email };
      preQuestions.forEach(q => {
        const answer = r.preAnswers.find(a => a.q_id === q.id);
        row[q.id] = answer ? String(answer.value) : '';
      });
      return row;
    });

    // Main survey sheet
    const mainHeaders = ['이메일', ...mainQuestions.map(q => q.id)];
    const mainRows = selectedRecords.map(r => {
      const row: any = { '이메일': r.email };
      mainQuestions.forEach(q => {
        const answer = r.mainAnswers.find(a => a.q_id === q.id);
        row[q.id] = answer ? String(answer.value) : '';
      });
      return row;
    });

    // Create workbook
    const wb = XLSX.utils.book_new();
    const preWs = XLSX.utils.json_to_sheet(preRows, { header: preHeaders });
    const mainWs = XLSX.utils.json_to_sheet(mainRows, { header: mainHeaders });
    XLSX.utils.book_append_sheet(wb, preWs, '사전 설문');
    XLSX.utils.book_append_sheet(wb, mainWs, '본 설문');

    // Download
    XLSX.writeFile(wb, `응답_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">방문자 응답 관리</h2>
        <div className="card p-6 text-center text-slate-600">
          로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">방문자 응답 관리</h2>
        <div className="flex gap-2">
          <button className="btn btn-outline text-sm" onClick={selectAll}>전체 선택</button>
          <button className="btn btn-outline text-sm" onClick={deselectAll}>선택 해제</button>
          <button className="btn btn-primary text-sm" onClick={downloadExcel}>엑셀 다운로드</button>
          <button className="btn btn-outline text-sm text-red-600" onClick={bulkDelete}>선택 삭제</button>
        </div>
      </div>

      <div className="card p-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="py-2 pr-4">
                <input
                  type="checkbox"
                  checked={selectedUsers.size === records.length && records.length > 0}
                  onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                />
              </th>
              <th className="py-2 pr-4">이메일</th>
              <th className="py-2 pr-4">사전 설문</th>
              <th className="py-2 pr-4">본 설문</th>
              <th className="py-2 pr-4">리포트</th>
              <th className="py-2 text-right">액션</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.userId} className="border-t">
                <td className="py-2 pr-4">
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(r.userId)}
                    onChange={() => toggleUserSelection(r.userId)}
                  />
                </td>
                <td className="py-2 pr-4">{r.email}</td>
                <td className="py-2 pr-4">
                  <SurveyStatusCell 
                    status={r.preStatus as "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"}
                    answered={r.preAnsweredCount}
                    total={r.preTotalCount}
                  />
                </td>
                <td className="py-2 pr-4">
                  <SurveyStatusCell 
                    status={r.mainStatus as "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"}
                    answered={r.mainAnsweredCount}
                    total={r.mainTotalCount}
                  />
                </td>
                <td className="py-2 pr-4">
                  <div className="flex flex-col gap-1">
                    <div className={`inline-flex items-center rounded-full px-3 h-7 text-sm font-semibold ${
                      r.reportStatus === 'COMPLETED' ? 'text-green-600 bg-green-50' : 'text-gray-500 bg-gray-100'
                    }`}>
                      {r.reportStatus === 'COMPLETED' ? 'Completed' : 'Not Started'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {r.reportStatus === 'COMPLETED' ? '리포트 생성 완료' : '대기 중'}
                    </div>
                  </div>
                </td>
                <td className="py-2 text-right">
                  <button 
                    className="btn btn-outline text-sm" 
                    onClick={async () => {
                      setSelectedUser(r.userId);
                      await refreshSelectedUserData(r.userId);
                    }}
                  >
                    상세보기
                  </button>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500">
                  등록된 사용자가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedUser && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{selectedRecord.email} - 상세 응답</h3>
                <button className="btn btn-outline" onClick={() => setSelectedUser(null)}>닫기</button>
              </div>
              {/* Tabs */}
              <div className="flex gap-2 mt-4">
                <button
                  className={`px-4 py-2 rounded ${activeTab === 'pre' ? 'bg-blue-500 text-white' : 'bg-slate-100'}`}
                  onClick={() => setActiveTab('pre')}
                >
                  사전 설문
                </button>
                <button
                  className={`px-4 py-2 rounded ${activeTab === 'main' ? 'bg-blue-500 text-white' : 'bg-slate-100'}`}
                  onClick={() => setActiveTab('main')}
                >
                  본 설문
                </button>
                <button
                  className={`px-4 py-2 rounded ${activeTab === 'report' ? 'bg-blue-500 text-white' : 'bg-slate-100'}`}
                  onClick={() => setActiveTab('report')}
                >
                  리포트
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'pre' && (
                <div className="space-y-2">
                  <div className="mb-4 p-3 bg-slate-50 rounded text-sm">
                    <p><strong>디버그 정보:</strong></p>
                    <p>사전 설문 문항 수: {preQuestions.length}</p>
                    <p>사용자 응답 수: {selectedRecord.preAnswers.length}</p>
                    <p>사용자 응답: {JSON.stringify(selectedRecord.preAnswers.slice(0, 2))}</p>
                    <p>매핑된 질문 샘플: {JSON.stringify(preQuestions.slice(0, 1).map(q => ({id: q.id, text: q.text?.substring(0, 50)})))}</p>
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-300 px-4 py-2 text-center font-semibold w-20">문항 번호</th>
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold">문항 내용</th>
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold w-1/3">사용자 응답</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preQuestions.map((q) => {
                        const answer = selectedRecord.preAnswers.find(a => a.q_id === q.id);
                        console.log(`Pre question ${q.id}:`, { question: q.text, answer: answer });
                        return (
                          <tr key={q.id}>
                            <td className="border border-slate-300 px-4 py-2 text-center font-medium">{q.id}</td>
                            <td className="border border-slate-300 px-4 py-2">{q.text || '문항 텍스트 없음'}</td>
                            <td className="border border-slate-300 px-4 py-2">
                              {answer ? getAnswerText(answer, preQuestions) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'main' && (
                <div className="space-y-2">
                  <div className="mb-4 p-3 bg-slate-50 rounded text-sm">
                    <p><strong>디버그 정보:</strong></p>
                    <p>본 설문 문항 수: {mainQuestions.length}</p>
                    <p>사용자 응답 수: {selectedRecord.mainAnswers.length}</p>
                    <p>사용자 응답: {JSON.stringify(selectedRecord.mainAnswers.slice(0, 2))}</p>
                    <p>매핑된 질문 샘플: {JSON.stringify(mainQuestions.slice(0, 1).map(q => ({id: q.id, text: q.text?.substring(0, 50)})))}</p>
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-300 px-4 py-2 text-center font-semibold w-20">문항 번호</th>
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold">문항 내용</th>
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold w-1/3">사용자 응답</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mainQuestions.map((q) => {
                        const answer = selectedRecord.mainAnswers.find(a => a.q_id === q.id);
                        console.log(`Main question ${q.id}:`, { question: q.text, answer: answer });
                        return (
                          <tr key={q.id}>
                            <td className="border border-slate-300 px-4 py-2 text-center font-medium">{q.id}</td>
                            <td className="border border-slate-300 px-4 py-2">{q.text || '문항 텍스트 없음'}</td>
                            <td className="border border-slate-300 px-4 py-2">
                              {answer ? getAnswerText(answer, mainQuestions) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'report' && (
                <div className="space-y-4">
                  {currentReportData ? (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">리포트 상세</h3>
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            if (selectedUser) {
                              getFreshReportData(selectedUser).then(reportData => {
                                setCurrentReportData(reportData);
                              });
                            }
                          }}
                        >
                          새로고침
                        </button>
                      </div>
                      <div className="card p-4 bg-blue-50">
                        <h4 className="font-semibold text-blue-900">유형</h4>
                        <p className="mt-2">{currentReportData.enneagram_type || '-'}</p>
                      </div>
                      <div className="card p-4">
                        <h4 className="font-semibold">특징</h4>
                        <div className="mt-2">
                          {typeof currentReportData.characteristics === 'string' 
                            ? <p>{currentReportData.characteristics}</p>
                            : <ul className="space-y-1 list-disc list-inside">
                                {(currentReportData.characteristics || []).map((trait: string, i: number) => (
                                  <li key={i}>{trait}</li>
                                ))}
                              </ul>
                          }
                        </div>
                      </div>
                      <div className="card p-4">
                        <h4 className="font-semibold">추천 직업</h4>
                        <ul className="mt-2 space-y-1 list-disc list-inside">
                          {(currentReportData.job_recommendations || []).map((job: string, i: number) => (
                            <li key={i}>{job}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="card p-4 bg-slate-50">
                        <h4 className="font-semibold">생성 정보</h4>
                        <p className="mt-2 text-sm text-slate-600">
                          생성일: {currentReportData.created_at 
                            ? new Date(currentReportData.created_at).toLocaleString('ko-KR')
                            : currentReportData.generated_at 
                            ? new Date(currentReportData.generated_at).toLocaleString('ko-KR')
                            : currentReportData.id 
                            ? `ID: ${currentReportData.id}`
                            : '정보 없음'
                          }
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-slate-500 py-8">
                      <div className="mb-4">
                        <p>리포트가 아직 생성되지 않았습니다.</p>
                        <p className="text-sm mt-2">사용자가 본 설문을 완료한 후 리포트를 생성할 수 있습니다.</p>
                      </div>
                      <button 
                        className="btn btn-outline"
                        onClick={() => {
                          if (selectedUser) {
                            getFreshReportData(selectedUser).then(reportData => {
                              setCurrentReportData(reportData);
                            });
                          }
                        }}
                      >
                        새로고침
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <button className="btn btn-outline" onClick={() => router.push("/admin/dashboard")}>← 대시보드로</button>
      </div>
    </div>
  );
}