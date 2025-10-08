"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPreQuestionsFromStorage, getMainQuestionsFromStorage } from "@/lib/dynamic-questions";
import type { SurveyAnswer, QuestionItem } from "@/lib/types";
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

  useEffect(() => {
    if (user?.role !== "admin") {
      router.replace("/");
      return;
    }
    loadData();
  }, [user, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load questions
      const preQ = getPreQuestionsFromStorage([]);
      const mainQ = getMainQuestionsFromStorage([]);
      setPreQuestions(preQ);
      setMainQuestions(mainQ);
      
      // Load only users with role='user' (exclude admins)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, name, role')
        .eq('role', 'user'); // Only load users with role='user'
      
      if (usersError) throw usersError;
      
      console.log('Loaded user-role users for responses:', usersData?.length);
      
      const userRecords: UserRecord[] = [];
      
      for (const userData of usersData || []) {
        
        // Load progress
        const { data: progressData } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', userData.id)
          .single();
        
        // Load pre-survey answers (maybeSingle to avoid error when no data)
        const { data: preAnswersData } = await supabase
          .from('survey_answers')
          .select('*')
          .eq('user_id', userData.id)
          .eq('survey_type', 'PRE')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        // Load main survey answers (maybeSingle to avoid error when no data)
        const { data: mainAnswersData } = await supabase
          .from('survey_answers')
          .select('*')
          .eq('user_id', userData.id)
          .eq('survey_type', 'MAIN')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        // Load report (maybeSingle to avoid error when no data)
        const { data: reportData } = await supabase
          .from('reports')
          .select('*')
          .eq('user_id', userData.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(); // Use maybeSingle instead of single to handle no data gracefully
        
        userRecords.push({
          userId: userData.id,
          email: userData.email,
          name: userData.name || '-',
          preStatus: progressData?.pre_survey_status || 'NOT_STARTED',
          preAnsweredCount: preAnswersData?.answers?.length || 0,
          preTotalCount: preQ.length,
          mainStatus: progressData?.main_survey_status || 'NOT_STARTED',
          mainAnsweredCount: mainAnswersData?.answers?.length || 0,
          mainTotalCount: mainQ.length,
          reportStatus: progressData?.report_status || 'NOT_STARTED',
          preAnswers: preAnswersData?.answers || [],
          mainAnswers: mainAnswersData?.answers || [],
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

  const getAnswerText = (answer: SurveyAnswer, questions: QuestionItem[]) => {
    const question = questions.find(q => q.id === answer.q_id);
    if (!question) {
      return `${answer.q_id}: ${answer.value} (질문 텍스트 없음)`;
    }
    
    if (question.options && question.options.length > 0) {
      const idx = parseInt(String(answer.value)) - 1;
      const optionText = question.options[idx];
      return optionText || `선택 ${answer.value}`;
    } else {
      const likertLabels = ["전혀 그렇지 않다", "그렇지 않다", "약간 그렇지 않다", "약간 그렇다", "그렇다", "매우 그렇다"];
      const likertText = likertLabels[parseInt(String(answer.value)) - 1] || String(answer.value);
      return likertText;
    }
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
                  <div className="text-xs">
                    <div className="font-medium">{r.preStatus}</div>
                    <div className="text-slate-500">{r.preAnsweredCount} / {r.preTotalCount}</div>
                  </div>
                </td>
                <td className="py-2 pr-4">
                  <div className="text-xs">
                    <div className="font-medium">{r.mainStatus}</div>
                    <div className="text-slate-500">{r.mainAnsweredCount} / {r.mainTotalCount} 문항</div>
                  </div>
                </td>
                <td className="py-2 pr-4">
                  <span className={`text-xs px-2 py-1 rounded ${
                    r.reportStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {r.reportStatus}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <button className="btn btn-outline text-sm" onClick={() => setSelectedUser(r.userId)}>
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
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold">문항 내용</th>
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold w-1/3">사용자 응답</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preQuestions.map((q) => {
                        const answer = selectedRecord.preAnswers.find(a => a.q_id === q.id);
                        return (
                          <tr key={q.id}>
                            <td className="border border-slate-300 px-4 py-2">{q.text}</td>
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
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold">문항 내용</th>
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold w-1/3">사용자 응답</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mainQuestions.map((q) => {
                        const answer = selectedRecord.mainAnswers.find(a => a.q_id === q.id);
                        return (
                          <tr key={q.id}>
                            <td className="border border-slate-300 px-4 py-2">{q.text}</td>
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
                  {selectedRecord.reportData ? (
                    <>
                      <div className="card p-4 bg-blue-50">
                        <h4 className="font-semibold text-blue-900">유형</h4>
                        <p className="mt-2">{selectedRecord.reportData.enneagram_type || '-'}</p>
                      </div>
                      <div className="card p-4">
                        <h4 className="font-semibold">특징</h4>
                        <ul className="mt-2 space-y-1 list-disc list-inside">
                          {(selectedRecord.reportData.characteristics || []).map((trait: string, i: number) => (
                            <li key={i}>{trait}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="card p-4">
                        <h4 className="font-semibold">추천 직업</h4>
                        <ul className="mt-2 space-y-1 list-disc list-inside">
                          {(selectedRecord.reportData.job_recommendations || []).map((job: string, i: number) => (
                            <li key={i}>{job}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-slate-500 py-8">
                      리포트가 아직 생성되지 않았습니다.
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