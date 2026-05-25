"use client";
import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPreQuestionsFromStorage, getMainQuestionsFromStorage } from "@/lib/dynamic-questions";
import type { SurveyAnswer, QuestionItem } from "@/lib/types";
import { SurveyStatusCell } from "@/components/SurveyStatusCell";
import * as XLSX from 'xlsx';
import { ReportViewer } from "@/components/ReportViewer";

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
  interviewStatus: 'COMPLETED' | 'NOT_STARTED';
  interviewQ1: number | null;
  interviewAllData: {
    q1: number | null;
    q2: string | null;
    q3: string | null;
    q4: string[];
    q5: string | null;
  } | null;
  preAnswers: SurveyAnswer[];
  mainAnswers: SurveyAnswer[];
  reportData: any;
};

// Module-level cache: survives navigation, cleared on manual refresh
let cachedRecords: UserRecord[] | null = null;
let cachedPreQuestions: QuestionItem[] | null = null;
let cachedMainQuestions: QuestionItem[] | null = null;

export default function AdminResponsesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [records, setRecords] = useState<UserRecord[]>(cachedRecords ?? []);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [preQuestions, setPreQuestions] = useState<QuestionItem[]>(cachedPreQuestions ?? []);
  const [mainQuestions, setMainQuestions] = useState<QuestionItem[]>(cachedMainQuestions ?? []);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'pre' | 'main' | 'report' | 'interview'>('pre');
  const [loading, setLoading] = useState(cachedRecords === null);
  const [currentReportData, setCurrentReportData] = useState<any>(null);
  const [currentInterviewData, setCurrentInterviewData] = useState<any>(null);
  const [emailSearch, setEmailSearch] = useState('');

  useEffect(() => {
    if (user?.role !== "admin") {
      router.replace("/");
      return;
    }
    // Skip fetch if cache already populated
    if (cachedRecords !== null) return;
    loadData();
  }, [user, router]);
  

  const loadData = async () => {
    try {
      setLoading(true);
      
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
      
      cachedPreQuestions = mappedPreQuestions;
      cachedMainQuestions = mappedMainQuestions;
      setPreQuestions(mappedPreQuestions);
      setMainQuestions(mappedMainQuestions);
      
      // Load only users with role='user' (exclude admins)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, name, role')
        .eq('role', 'user'); // Only load users with role='user'
      
      if (usersError) throw usersError;

      // 인터뷰 응답 배치 조회 — user_id별 최신 1건 기준 (쿼리 1회)
      const allUserIds = (usersData || []).map(u => u.id);
      const { data: interviewData } = allUserIds.length > 0
        ? await supabase
            .from('interview_responses')
            .select('user_id, q1_accuracy, q2_job_resonance, q3_career_concern, q4_job_criteria, q5_feedback, created_at')
            .in('user_id', allUserIds)
            .order('created_at', { ascending: false })
        : { data: [] };
      // user_id 기준 최신 행만 유지
      const interviewMap: Record<string, { q1: number | null; q2: string | null; q3: string | null; q4: string[]; q5: string | null }> = {};
      for (const row of (interviewData ?? []) as any[]) {
        if (!interviewMap[row.user_id]) {
          interviewMap[row.user_id] = {
            q1: row.q1_accuracy,
            q2: row.q2_job_resonance ?? null,
            q3: row.q3_career_concern ?? null,
            q4: row.q4_job_criteria ?? [],
            q5: row.q5_feedback ?? null,
          };
        }
      }

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
          interviewStatus: interviewMap[userData.id] ? 'COMPLETED' : 'NOT_STARTED',
          interviewQ1: interviewMap[userData.id]?.q1 ?? null,
          interviewAllData: interviewMap[userData.id] ?? null,
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
      
      cachedRecords = userRecords;
      setRecords(userRecords);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedRecord = records.find(r => r.userId === selectedUser);
  
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
    const question = questions.find(q => q.id === answer.q_id);
    
    if (!question) {
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
      
      if (optionsArray.length > 0) {
        const idx = parseInt(String(answer.value)) - 1;
        const optionText = optionsArray[idx];
        return optionText || `선택 ${answer.value}`;
      }
    }
    
    // For main survey (Likert scale 1-6)
    const likertLabels = ["전혀 그렇지 않다", "그렇지 않다", "약간 그렇지 않다", "약간 그렇다", "그렇다", "매우 그렇다"];
    const likertText = likertLabels[parseInt(String(answer.value)) - 1] || String(answer.value);
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

  const Q4_LABELS: Record<string, string> = {
    fit: '내 성격·강점과의 적합성',
    salary: '연봉·안정성',
    growth: '성장 가능성·커리어 전망',
    meaning: '일의 의미·가치',
    balance: '워라밸',
    expectation: '주변의 기대',
  };

  const stripMd = (text: string) => text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');

  const extractReportFields = (reportData: any) => {
    if (!reportData || !Array.isArray(reportData.report_data)) {
      return { enneagramType: '', job1: '', job2: '', job3: '', careerKeywords: '' };
    }
    const sections = reportData.report_data;

    const typeSection = sections.find((s: any) => s.key === 'enneagram_type');
    let enneagramType = '';
    if (typeSection) {
      const c = typeof typeSection.content === 'string' ? typeSection.content : JSON.stringify(typeSection.content);
      const m = c.match(/(\d+)/);
      if (m) enneagramType = `${m[1]}유형`;
    }

    const careerSection = sections.find((s: any) => s.key === 'major_based_career_path');
    const jobs: any[] = careerSection?.content?.jobs ?? [];
    const job1 = jobs[0] ? stripMd(jobs[0].name ?? '') : '';
    const job2 = jobs[1] ? stripMd(jobs[1].name ?? '') : '';
    const job3 = jobs[2] ? stripMd(jobs[2].name ?? '') : '';

    const guidanceSection = sections.find((s: any) => s.key === 'career_guidance');
    const skills: any[] = guidanceSection?.content?.skills ?? [];
    const careerKeywords = skills.map((s: any) => stripMd(s.name ?? '')).filter(Boolean).join(', ');

    return { enneagramType, job1, job2, job3, careerKeywords };
  };

  const downloadExcel = () => {
    if (selectedUsers.size === 0) {
      alert('다운로드할 사용자를 선택하세요.');
      return;
    }

    const selectedRecords = records.filter(r => selectedUsers.has(r.userId));

    // 사전 설문 시트
    const preHeaders = ['이메일', ...preQuestions.map(q => `${q.id}_${q.text}`)];
    const preRows = selectedRecords.map(r => {
      const row: any = { '이메일': r.email };
      preQuestions.forEach(q => {
        const answer = r.preAnswers.find(a => a.q_id === q.id);
        row[`${q.id}_${q.text}`] = answer ? getAnswerText(answer, preQuestions) : '';
      });
      return row;
    });

    // 본 설문 시트
    const mainHeaders = ['이메일', ...mainQuestions.map(q => `${q.id}_${q.text}`)];
    const mainRows = selectedRecords.map(r => {
      const row: any = { '이메일': r.email };
      mainQuestions.forEach(q => {
        const answer = r.mainAnswers.find(a => a.q_id === q.id);
        row[`${q.id}_${q.text}`] = answer ? getAnswerText(answer, mainQuestions) : '';
      });
      return row;
    });

    // 리포트 시트
    const reportHeaders = ['이메일', '에니어그램 유형', '추천 직무', '커리어 가이드 키워드'];
    const reportRows = selectedRecords.map(r => {
      const { enneagramType, job1, job2, job3, careerKeywords } = extractReportFields(r.reportData);
      return {
        '이메일': r.email,
        '에니어그램 유형': enneagramType || '미생성',
        '추천 직무': [job1, job2, job3].filter(Boolean).join(', '),
        '커리어 가이드 키워드': careerKeywords,
      };
    });

    // 인터뷰 시트
    const interviewHeaders = ['이메일', 'Q1. 유형 일치도 (1~5)', 'Q2. 끌렸던 직업과 이유', 'Q3. 진로 고민', 'Q4. 직업 선택 기준', 'Q5. 솔직한 느낌'];
    const interviewRows = selectedRecords.map(r => {
      const d = r.interviewAllData;
      return {
        '이메일': r.email,
        'Q1. 유형 일치도 (1~5)': d?.q1 ?? '',
        'Q2. 끌렸던 직업과 이유': d?.q2 ?? '',
        'Q3. 진로 고민': d?.q3 ?? '',
        'Q4. 직업 선택 기준': d ? (d.q4 ?? []).map(id => Q4_LABELS[id] ?? id).join(', ') : '',
        'Q5. 솔직한 느낌': d?.q5 ?? '',
      };
    });

    // 워크북 생성
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(preRows, { header: preHeaders }), '사전 설문');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mainRows, { header: mainHeaders }), '본 설문');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportRows, { header: reportHeaders }), '리포트');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(interviewRows, { header: interviewHeaders }), '인터뷰');

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
      <button className="btn btn-outline w-fit" onClick={() => router.push("/admin/dashboard")}>← 대시보드로</button>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">방문자 응답 관리</h2>
        <div className="flex gap-2">
          <button className="btn btn-outline text-sm" onClick={() => { cachedRecords = null; cachedPreQuestions = null; cachedMainQuestions = null; loadData(); }}>새로고침</button>
          <button className="btn btn-outline text-sm" onClick={selectAll}>전체 선택</button>
          <button className="btn btn-outline text-sm" onClick={deselectAll}>선택 해제</button>
          <button className="btn btn-primary text-sm" onClick={downloadExcel}>엑셀 다운로드</button>
          <button className="btn btn-outline text-sm text-red-600" onClick={bulkDelete}>선택 삭제</button>
        </div>
      </div>

      <input
        type="text"
        placeholder="이메일로 검색..."
        className="input max-w-md"
        value={emailSearch}
        onChange={e => setEmailSearch(e.target.value)}
      />

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
              <th className="py-2 pr-4">인터뷰</th>
              <th className="py-2 text-right">액션</th>
            </tr>
          </thead>
          <tbody>
            {records.filter(r => r.email.toLowerCase().includes(emailSearch.toLowerCase())).map((r) => (
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
                <td className="py-2 pr-4">
                  <div className="flex flex-col gap-1">
                    <div className={`inline-flex items-center rounded-full px-3 h-7 text-sm font-semibold ${
                      r.interviewStatus === 'COMPLETED' ? 'text-green-600 bg-green-50' : 'text-gray-500 bg-gray-100'
                    }`}>
                      {r.interviewStatus === 'COMPLETED' ? 'Completed' : 'Not Started'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {r.interviewStatus === 'COMPLETED' ? '인터뷰 완료' : '대기 중'}
                    </div>
                  </div>
                </td>
                <td className="py-2 text-right">
                  <button
                    className="btn btn-outline text-sm"
                    onClick={() => {
                      setCurrentReportData(r.reportData);
                      setCurrentInterviewData(null);
                      setActiveTab('pre');
                      setSelectedUser(r.userId);
                    }}
                  >
                    상세보기
                  </button>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-500">
                  등록된 사용자가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedUser && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-12 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-4xl flex flex-col mb-12">
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
                <button
                  className={`px-4 py-2 rounded ${activeTab === 'interview' ? 'bg-blue-500 text-white' : 'bg-slate-100'}`}
                  onClick={async () => {
                    setActiveTab('interview');
                    if (!currentInterviewData && selectedUser) {
                      const { data } = await supabase
                        .from('interview_responses')
                        .select('*')
                        .eq('user_id', selectedUser)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                      setCurrentInterviewData(data ?? null);
                    }
                  }}
                >
                  인터뷰
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {activeTab === 'pre' && (
                <div className="space-y-2">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-300 px-4 py-2 text-center font-semibold" style={{ width: '100px' }}>문항 번호</th>
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold" style={{ minWidth: '300px' }}>문항 내용</th>
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold" style={{ width: '200px' }}>사용자 응답</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...preQuestions].sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true })).map((q) => {
                        const answer = selectedRecord.preAnswers.find(a => a.q_id === q.id);
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
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-300 px-4 py-2 text-center font-semibold" style={{ width: '100px' }}>문항 번호</th>
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold" style={{ minWidth: '300px' }}>문항 내용</th>
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold" style={{ width: '200px' }}>사용자 응답</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mainQuestions.map((q) => {
                        const answer = selectedRecord.mainAnswers.find(a => a.q_id === q.id);
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
                  {(() => {
                    const hasNewFormat = currentReportData && Array.isArray(currentReportData.report_data) && currentReportData.report_data.length > 0;
                    const hasLegacy = currentReportData && (currentReportData.enneagram_type || currentReportData.characteristics || currentReportData.career_guidance);

                    const refreshBtn = (
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
                    );

                    if (hasNewFormat) {
                      return (
                        <>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">리포트 상세</h3>
                            {refreshBtn}
                          </div>
                          <ReportViewer
                            reportData={currentReportData.report_data}
                            generatedAt={currentReportData.generated_at}
                          />
                        </>
                      );
                    }

                    if (hasLegacy) {
                      return (
                        <>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">리포트 상세 <span className="text-xs font-normal text-slate-400 ml-2">(구버전)</span></h3>
                            {refreshBtn}
                          </div>
                          <div className="space-y-4">
                            {currentReportData.enneagram_type && (
                              <div className="card p-4 bg-blue-50">
                                <h4 className="font-semibold text-blue-900">에니어그램 유형</h4>
                                <p className="mt-2">{currentReportData.enneagram_type}</p>
                              </div>
                            )}
                            {currentReportData.characteristics && (
                              <div className="card p-4">
                                <h4 className="font-semibold">특징</h4>
                                <p className="mt-2 text-slate-700 leading-relaxed whitespace-pre-line">
                                  {typeof currentReportData.characteristics === 'string'
                                    ? currentReportData.characteristics
                                    : JSON.stringify(currentReportData.characteristics)}
                                </p>
                              </div>
                            )}
                            {currentReportData.career_guidance && (
                              <div className="card p-4">
                                <h4 className="font-semibold">진로 가이드</h4>
                                <p className="mt-2 text-slate-700 leading-relaxed whitespace-pre-line">{currentReportData.career_guidance}</p>
                              </div>
                            )}
                            {currentReportData.growth_advice && (
                              <div className="card p-4">
                                <h4 className="font-semibold">성장 조언</h4>
                                <p className="mt-2 text-slate-700 leading-relaxed whitespace-pre-line">{currentReportData.growth_advice}</p>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    }

                    return (
                      <div className="text-center text-slate-500 py-8">
                        <div className="mb-4">
                          <p>리포트가 아직 생성되지 않았습니다.</p>
                          <p className="text-sm mt-2">사용자가 본 설문을 완료한 후 리포트를 생성할 수 있습니다.</p>
                        </div>
                        {refreshBtn}
                      </div>
                    );
                  })()}
                </div>
              )}

              {activeTab === 'interview' && (
                <div className="space-y-4">
                  {currentInterviewData ? (
                    <>
                      {[
                        { label: 'Q1. 에니어그램 유형 일치도', value: `${currentInterviewData.q1_accuracy}점 / 5점` },
                        { label: 'Q2. 가장 끌렸던 직업과 이유', value: currentInterviewData.q2_job_resonance },
                        { label: 'Q3. 진로 관련 가장 큰 고민', value: currentInterviewData.q3_career_concern },
                        {
                          label: 'Q4. 직업 선택 기준',
                          value: (currentInterviewData.q4_job_criteria ?? []).map((id: string) => ({
                            fit: '내 성격·강점과의 적합성', salary: '연봉·안정성',
                            growth: '성장 가능성·커리어 전망', meaning: '일의 의미·가치',
                            balance: '워라밸', expectation: '주변의 기대',
                          }[id] ?? id)).join(', ') || '—',
                        },
                        { label: 'Q5. 솔직한 느낌', value: currentInterviewData.q5_feedback },
                      ].map(({ label, value }) => (
                        <div key={label} className="card p-4">
                          <div className="text-xs font-medium text-slate-400 mb-1">{label}</div>
                          <div className="text-sm text-slate-700 leading-relaxed">
                            {value || <span className="text-slate-300 italic">응답 없음</span>}
                          </div>
                        </div>
                      ))}
                      <div className="text-xs text-slate-400 text-right">
                        응답일: {new Date(currentInterviewData.created_at).toLocaleString('ko-KR')}
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-slate-500 py-8">인터뷰 응답이 없습니다.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}