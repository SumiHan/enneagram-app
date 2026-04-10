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
import { TYPES, TRIAD_STYLE, TRIADS } from "@/lib/enneagram-data";

function parseTypeNumber(content: string): number | null {
  const numMatch = content.match(/(\d+)/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= 9) return n;
  }
  const found = TYPES.find(t => content.includes(t.name) || content.includes(t.subtitle));
  return found?.number ?? null;
}

const CARD_STYLE = { bg: '#F8F9FA', border: '#E5E7EB' };

function EnneagramTypeCard({ typeNumber }: { typeNumber: number }) {
  const current = TYPES.find(t => t.number === typeNumber)!;
  const ts = TRIAD_STYLE[current.triad];
  const triad = TRIADS.find(tr => tr.key === current.triad)!;
  const wingTypes = current.wings.map(w => TYPES.find(t => t.number === w)!);
  const growthType = TYPES.find(t => t.number === current.growth)!;
  const stressType = TYPES.find(t => t.number === current.stress)!;

  return (
    <div className="relative mt-5">
      <div className="absolute -top-3.5 left-4 px-3 py-0.5 text-base font-semibold z-10 text-white" style={{ backgroundColor: '#4F46E5', borderRadius: '6px' }}>1. 에니어그램 유형</div>
      <div className="p-5 pt-7 rounded-lg border" style={{ backgroundColor: CARD_STYLE.bg, borderColor: CARD_STYLE.border }}>
        <div className="flex items-baseline gap-1.5 flex-wrap mb-4">
          <span className="text-3xl font-bold text-slate-800">{current.number}</span>
          <span className="text-lg font-semibold text-slate-800">{current.name}</span>
          <span className="text-slate-300">·</span>
          <span className="text-sm text-slate-400">{current.subtitle}</span>
        </div>
        <div className="flex gap-4 mb-4 items-stretch">
          <div className="sm:w-[180px] shrink-0">
            <img src={`/images/${current.number}_${current.name}.png`} alt={current.name} className="w-full h-full rounded-lg object-contain" />
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ts.nodeActive }} />
              <span className="text-xs font-medium" style={{ color: ts.textColor }}>{triad.name}</span>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="text-xs text-slate-400 mb-0.5">핵심 욕구</div>
              <div className="text-sm text-slate-700">{current.coreDesire}</div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="text-xs text-slate-400 mb-0.5">핵심 두려움</div>
              <div className="text-sm text-slate-700">{current.coreFear}</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {current.keywords.map(kw => (
                <span key={kw} className={`text-xs px-2 py-1 rounded-full ${ts.tag}`}>{kw}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="mb-4">
          <div className="text-xs font-medium mb-2" style={{ color: '#818CF8' }}>날개 (Wings)</div>
          <div className="grid grid-cols-2 gap-2">
            {wingTypes.map(w => {
              const ws = TRIAD_STYLE[w.triad];
              return (
                <div key={w.number} className="bg-white rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
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
                </div>
              );
            })}
          </div>
        </div>
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
      </div>
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState<'pre' | 'main' | 'report'>('pre');
  const [loading, setLoading] = useState(cachedRecords === null);
  const [currentReportData, setCurrentReportData] = useState<any>(null);
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

  const downloadExcel = () => {
    if (selectedUsers.size === 0) {
      alert('다운로드할 사용자를 선택하세요.');
      return;
    }

    const selectedRecords = records.filter(r => selectedUsers.has(r.userId));

    // Pre-survey sheet - with question text in headers
    const preHeaders = ['이메일', ...preQuestions.map(q => `${q.id}_${q.text}`)];
    const preRows = selectedRecords.map(r => {
      const row: any = { '이메일': r.email };
      preQuestions.forEach(q => {
        const answer = r.preAnswers.find(a => a.q_id === q.id);
        const columnName = `${q.id}_${q.text}`;
        // Use getAnswerText to get the same display value as detail view
        row[columnName] = answer ? getAnswerText(answer, preQuestions) : '';
      });
      return row;
    });

    // Main survey sheet - with question text in headers
    const mainHeaders = ['이메일', ...mainQuestions.map(q => `${q.id}_${q.text}`)];
    const mainRows = selectedRecords.map(r => {
      const row: any = { '이메일': r.email };
      mainQuestions.forEach(q => {
        const answer = r.mainAnswers.find(a => a.q_id === q.id);
        const columnName = `${q.id}_${q.text}`;
        // Use getAnswerText to get the same display value as detail view
        row[columnName] = answer ? getAnswerText(answer, mainQuestions) : '';
      });
      return row;
    });

    // Report sheet
    const reportHeaders = ['이메일', '리포트 결과'];
    const reportRows = selectedRecords.map(r => {
      let reportText = '';
      
      if (r.reportData && r.reportData.enneagram_type) {
        // Format report data into readable text
        reportText = `유형: ${r.reportData.enneagram_type}\n\n`;
        
        if (r.reportData.characteristics) {
          reportText += `특성:\n${r.reportData.characteristics}\n\n`;
        }
        
        if (r.reportData.job_recommendations) {
          reportText += `직업 추천:\n${r.reportData.job_recommendations}`;
        }
      } else {
        reportText = '리포트 미생성';
      }
      
      return {
        '이메일': r.email,
        '리포트 결과': reportText
      };
    });

    // Create workbook
    const wb = XLSX.utils.book_new();
    const preWs = XLSX.utils.json_to_sheet(preRows, { header: preHeaders });
    const mainWs = XLSX.utils.json_to_sheet(mainRows, { header: mainHeaders });
    const reportWs = XLSX.utils.json_to_sheet(reportRows, { header: reportHeaders });
    
    // Append sheets
    XLSX.utils.book_append_sheet(wb, preWs, '사전 설문');
    XLSX.utils.book_append_sheet(wb, mainWs, '본 설문');
    XLSX.utils.book_append_sheet(wb, reportWs, '리포트');

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
                <td className="py-2 text-right">
                  <button
                    className="btn btn-outline text-sm"
                    onClick={() => {
                      setCurrentReportData(r.reportData);
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
                          <div className="space-y-8">
                            {currentReportData.report_data.map((section: { key: string; title: string; content: string }, idx: number) => {
                              if (section.key === 'enneagram_type') {
                                const typeNumber = parseTypeNumber(section.content);
                                if (typeNumber) {
                                  return <EnneagramTypeCard key={section.key} typeNumber={typeNumber} />;
                                }
                              }
                              return (
                                <div key={section.key} className="relative mt-5">
                                  <div className="absolute -top-3.5 left-4 px-3 py-0.5 text-base font-semibold z-10 text-white" style={{ backgroundColor: '#4F46E5', borderRadius: '6px' }}>
                                    {idx + 1}. {section.title}
                                  </div>
                                  <div className="p-5 pt-7 rounded-lg border" style={{ backgroundColor: CARD_STYLE.bg, borderColor: CARD_STYLE.border }}>
                                    <div className="leading-[1.7] text-[14px] [&_strong]:font-semibold [&_em]:italic [&_p]:mb-2 [&_p:last-child]:mb-0" style={{ color: '#6B7280' }}>
                                      <ReactMarkdown>{typeof section.content === 'string' ? section.content : JSON.stringify(section.content)}</ReactMarkdown>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {currentReportData.generated_at && (
                              <div className="text-xs text-slate-400 text-right pt-2 border-t">
                                생성일: {new Date(currentReportData.generated_at).toLocaleString('ko-KR')}
                              </div>
                            )}
                          </div>
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
            </div>
          </div>
        </div>
      )}

    </div>
  );
}