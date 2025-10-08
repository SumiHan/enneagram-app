"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { getLocalStorage } from "@/lib/storage";
import { getPreQuestionsFromStorage, getMainQuestionsFromStorage } from "@/lib/dynamic-questions";
import type { SurveyResponse, SurveyAnswer, QuestionItem } from "@/lib/types";
import * as XLSX from 'xlsx';

type Progress = any;

export default function AdminResponsesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [records, setRecords] = useState<Array<{ email: string; progress: Progress; preAnswers?: SurveyResponse | null; mainAnswers?: SurveyResponse | null; reportData?: any }>>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [preQuestions, setPreQuestions] = useState<QuestionItem[]>([]);
  const [mainQuestions, setMainQuestions] = useState<QuestionItem[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'pre' | 'main' | 'report'>('pre');

  useEffect(() => {
    if (user?.role !== "admin") {
      router.replace("/");
      return;
    }
    // scan localStorage for progress keys
    if (typeof window === "undefined") return;
    const out: Array<{ email: string; progress: Progress; preAnswers?: SurveyResponse | null; mainAnswers?: SurveyResponse | null; reportData?: any }> = [];
    
    // Get admin emails from environment variable
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
    
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)!;
      const m = key.match(/^progress\.v1:(.+)$/);
      if (m) {
        const email = m[1];
        
        // Skip admin users
        if (adminEmails.includes(email)) {
          continue;
        }
        
        try {
          const progress = JSON.parse(window.localStorage.getItem(key) || "null");
          const preAnswers = getLocalStorage<SurveyResponse | null>(`survey.pre.v1:${email}`, null);
          const mainAnswers = getLocalStorage<SurveyResponse | null>(`survey.main.v1:${email}`, null);
          const reportData = getLocalStorage<any>(`report.v1:${email}`, null);
          out.push({ email, progress, preAnswers, mainAnswers, reportData });
        } catch {}
      }
    }
    setRecords(out);
    
    // Load questions for display
    const preQuestions = getPreQuestionsFromStorage([]);
    const mainQuestions = getMainQuestionsFromStorage([]);
    setPreQuestions(preQuestions);
    setMainQuestions(mainQuestions);
    
    // Debug logging
    console.log('Pre questions loaded:', preQuestions.length);
    console.log('Main questions loaded:', mainQuestions.length);
  }, [user, router]);

  const rows = useMemo(() => {
    return records.map(({ email, progress, preAnswers, mainAnswers, reportData }) => {
      const pre = progress?.pre_survey;
      const main = progress?.main_survey;
      const report = progress?.report;
      // Calculate survey progress by actual answered questions
      const preAnsweredCount = preAnswers?.answers?.length ?? 0;
      const preTotalCount = preQuestions.length;
      const mainAnsweredCount = mainAnswers?.answers?.length ?? 0;
      const mainTotalCount = mainQuestions.length;
      
      return {
        email,
        preStatus: pre?.status ?? "-",
        preDetail: `${preAnsweredCount} / ${preTotalCount}`,
        mainStatus: main?.status ?? "-",
        mainDetail: `${mainAnsweredCount} / ${mainTotalCount} 문항`,
        reportStatus: report?.status ?? "-",
        reportData,
        preAnswers,
        mainAnswers,
      };
    });
  }, [records, preQuestions, mainQuestions]);

  const selectedRecord = records.find(r => r.email === selectedUser);

  const getAnswerText = (answer: SurveyAnswer, questions: QuestionItem[]) => {
    const question = questions.find(q => q.id === answer.q_id);
    if (!question) {
      // 질문을 찾지 못한 경우 더 자세한 정보 표시
      return `${answer.q_id}: ${answer.value} (질문 텍스트 없음)`;
    }
    
    if (question.options && question.options.length > 0) {
      const optionIndex = parseInt(String(answer.value)) - 1;
      const optionText = question.options[optionIndex] || answer.value;
      return `${question.text}: ${optionText}`;
    } else {
      const likertLabels = ["전혀 그렇지 않다", "그렇지 않다", "약간 그렇지 않다", "약간 그렇다", "그렇다", "매우 그렇다"];
      const likertText = likertLabels[parseInt(String(answer.value)) - 1] || answer.value;
      return `${question.text}: ${likertText}`;
    }
  };

  const toggleUserSelection = (email: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedUsers(newSelected);
  };

  const selectAllUsers = () => {
    setSelectedUsers(new Set(records.map(r => r.email)));
  };

  const clearSelection = () => {
    setSelectedUsers(new Set());
  };

  const bulkDeleteUsers = () => {
    if (selectedUsers.size === 0) {
      return;
    }
    
    if (!confirm(`선택한 ${selectedUsers.size}명의 사용자 데이터를 모두 삭제하시겠습니까?`)) {
      return;
    }
    
    // Delete all selected users' data
    selectedUsers.forEach(email => {
      window.localStorage.removeItem(`progress.v1:${email}`);
      window.localStorage.removeItem(`survey.pre.v1:${email}`);
      window.localStorage.removeItem(`survey.main.v1:${email}`);
      window.localStorage.removeItem(`report.v1:${email}`);
      window.localStorage.removeItem(`user.v1:${email}`);
    });
    
    // Refresh records
    setRecords(records.filter(r => !selectedUsers.has(r.email)));
    
    // Clear selection
    setSelectedUsers(new Set());
    
    // Close detail view if it's open for a deleted user
    if (selectedUser && selectedUsers.has(selectedUser)) {
      setSelectedUser(null);
    }
  };

  const exportToExcel = () => {
    const selectedRecords = records.filter(r => selectedUsers.has(r.email));
    if (selectedRecords.length === 0) {
      alert('선택된 사용자가 없습니다.');
      return;
    }

    // Create sheet data function
    const createSheetData = (surveyType: 'pre' | 'main', questions: QuestionItem[]) => {
      const sheetData = [];
      
      // Create headers: 이메일 + 모든 질문 ID
      const headers = ['이메일', ...questions.map(q => q.id)];
      sheetData.push(headers);
      
      // Create data rows
      selectedRecords.forEach(record => {
        const answers = surveyType === 'pre' ? record.preAnswers : record.mainAnswers;
        const row = [record.email];
        
        // For each question, find the answer or leave empty
        questions.forEach(question => {
          const answer = answers?.answers.find(a => a.q_id === question.id);
          if (answer) {
            if (question.options && question.options.length > 0) {
              // For pre-survey with options
              const optionIndex = parseInt(String(answer.value)) - 1;
              const optionText = question.options[optionIndex] || String(answer.value);
              row.push(optionText);
            } else {
              // For main survey with Likert scale
              const likertLabels = ["전혀 그렇지 않다", "그렇지 않다", "약간 그렇지 않다", "약간 그렇다", "그렇다", "매우 그렇다"];
              const likertText = likertLabels[parseInt(String(answer.value)) - 1] || String(answer.value);
              row.push(likertText);
            }
          } else {
            row.push(''); // No answer
          }
        });
        
        sheetData.push(row);
      });
      
      return sheetData;
    };

    // Create pre-survey sheet
    const preSurveyData = createSheetData('pre', preQuestions);
    const mainSurveyData = createSheetData('main', mainQuestions);

    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Create worksheets
    const preSurveyWS = XLSX.utils.aoa_to_sheet(preSurveyData);
    const mainSurveyWS = XLSX.utils.aoa_to_sheet(mainSurveyData);

    // Add worksheets to workbook
    XLSX.utils.book_append_sheet(workbook, preSurveyWS, '사전 설문');
    XLSX.utils.book_append_sheet(workbook, mainSurveyWS, '본 설문');

    // Generate Excel file and download
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `설문_응답_${dateStr}.xlsx`;
    
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">방문자 응답 관리</h2>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={selectAllUsers}>
            전체 선택
          </button>
          <button className="btn btn-outline" onClick={clearSelection}>
            선택 해제
          </button>
          <button 
            className="btn btn-primary" 
            onClick={exportToExcel}
            disabled={selectedUsers.size === 0}
          >
            엑셀 다운로드 ({selectedUsers.size})
          </button>
          <button 
            className="btn bg-red-50 text-red-600 hover:bg-red-100 border-red-200" 
            onClick={bulkDeleteUsers}
            disabled={selectedUsers.size === 0}
          >
            선택 삭제 ({selectedUsers.size})
          </button>
        </div>
      </div>
      
      <div className="card p-6">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-100">
            <tr className="text-left text-slate-700 font-semibold">
              <th className="py-3 px-4 border">선택</th>
              <th className="py-3 px-4 border">이메일</th>
              <th className="py-3 px-4 border">사전 설문</th>
              <th className="py-3 px-4 border">사전 진행</th>
              <th className="py-3 px-4 border">본 설문</th>
              <th className="py-3 px-4 border">본 진행</th>
              <th className="py-3 px-4 border">리포트</th>
              <th className="py-3 px-4 border">상세보기</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.map((r) => (
              <tr key={r.email} className="hover:bg-slate-50">
                <td className="py-3 px-4 border">
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(r.email)}
                    onChange={() => toggleUserSelection(r.email)}
                    className="checkbox"
                  />
                </td>
                <td className="py-3 px-4 border font-medium">{r.email}</td>
                <td className="py-3 px-4 border text-center">{r.preStatus}</td>
                <td className="py-3 px-4 border text-center">{r.preDetail}</td>
                <td className="py-3 px-4 border text-center">{r.mainStatus}</td>
                <td className="py-3 px-4 border text-center">{r.mainDetail}</td>
                <td className="py-3 px-4 border text-center">{r.reportStatus}</td>
                <td className="py-3 px-4 border text-center">
                  <button 
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      setSelectedUser(r.email);
                      setActiveTab('pre'); // 기본 탭은 사전 설문
                    }}
                  >
                    보기
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 px-4 border text-center text-slate-500">데이터가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 사용자 상세 응답 */}
      {selectedUser && selectedRecord && (
        <div className="card p-6 max-h-screen flex flex-col">
          {/* 고정 헤더 */}
          <div className="flex justify-between items-center mb-4 pb-4 border-b">
            <h3 className="text-lg font-semibold">{selectedUser}의 상세 응답</h3>
            <button 
              className="btn btn-sm btn-outline"
              onClick={() => setSelectedUser(null)}
            >
              닫기
            </button>
          </div>
          
          {/* 고정 탭 네비게이션 */}
          <div className="flex border-b mb-6">
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'pre'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setActiveTab('pre')}
            >
              사전 설문
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'main'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setActiveTab('main')}
            >
              본 설문
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'report'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setActiveTab('report')}
            >
              리포트
            </button>
          </div>

          {/* 스크롤 가능한 탭 콘텐츠 */}
          <div className="flex-1 max-h-[600px] overflow-y-auto">
            {/* 사전 설문 탭 */}
            {activeTab === 'pre' && (
              <div>
                {selectedRecord.preAnswers && selectedRecord.preAnswers.answers.length > 0 ? (
                  <div>
                    <h4 className="font-semibold mb-3">사전 설문 응답 ({selectedRecord.preAnswers.answers.length}개)</h4>
                    <div className="border rounded overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="p-3 text-left font-semibold border-r">문항 내용</th>
                            <th className="p-3 text-left font-semibold">사용자 응답</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRecord.preAnswers.answers.map((answer, idx) => {
                            const question = preQuestions.find(q => q.id === answer.q_id);
                            const responseText = question?.options 
                              ? question.options[parseInt(String(answer.value)) - 1] || String(answer.value)
                              : String(answer.value);
                            return (
                              <tr key={idx} className="border-t hover:bg-slate-50">
                                <td className="p-3 border-r align-top">
                                  <div className="font-medium text-slate-700">
                                    {question?.text || `문항 ${answer.q_id}`}
                                  </div>
                                </td>
                                <td className="p-3 align-top">
                                  <div className="text-blue-600 font-medium">
                                    {responseText}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-8">
                    사전 설문 응답이 없습니다.
                  </div>
                )}
              </div>
            )}

            {/* 본 설문 탭 */}
            {activeTab === 'main' && (
              <div>
                {selectedRecord.mainAnswers && selectedRecord.mainAnswers.answers.length > 0 ? (
                  <div>
                    <h4 className="font-semibold mb-3">
                      본 설문 응답 ({selectedRecord.mainAnswers.answers.length}개)
                      {mainQuestions.length > 0 && ` - 총 ${mainQuestions.length}개 문항 중`}
                    </h4>
                    <div className="border rounded overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="p-3 text-left font-semibold border-r">문항 내용</th>
                            <th className="p-3 text-left font-semibold">사용자 응답</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRecord.mainAnswers.answers.map((answer, idx) => {
                            const question = mainQuestions.find(q => q.id === answer.q_id);
                            const likertLabels = ["전혀 그렇지 않다", "그렇지 않다", "약간 그렇지 않다", "약간 그렇다", "그렇다", "매우 그렇다"];
                            const responseText = likertLabels[parseInt(String(answer.value)) - 1] || String(answer.value);
                            return (
                              <tr key={idx} className="border-t hover:bg-slate-50">
                                <td className="p-3 border-r align-top">
                                  <div className="font-medium text-slate-700">
                                    {question?.text || `문항 ${answer.q_id}`}
                                  </div>
                                </td>
                                <td className="p-3 align-top">
                                  <div className="text-blue-600 font-medium">
                                    {responseText}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-8">
                    본 설문 응답이 없습니다.
                  </div>
                )}
              </div>
            )}

            {/* 리포트 탭 */}
            {activeTab === 'report' && (
              <div>
                {selectedRecord.reportData ? (
                  <div>
                    <h4 className="font-semibold mb-3">리포트 결과</h4>
                    <div className="space-y-4 border rounded p-4 bg-blue-50">
                      {selectedRecord.reportData.type && (
                        <div className="bg-white p-3 rounded border">
                          <h5 className="font-semibold text-blue-700 mb-2">에니어그램 유형</h5>
                          <p className="text-lg font-bold text-blue-800">{selectedRecord.reportData.type}</p>
                        </div>
                      )}
                      
                      {selectedRecord.reportData.characteristics && (
                        <div className="bg-white p-3 rounded border">
                          <h5 className="font-semibold text-blue-700 mb-2">특징</h5>
                          <p className="text-sm leading-relaxed">{selectedRecord.reportData.characteristics}</p>
                        </div>
                      )}
                      
                      {selectedRecord.reportData.job_recommendations && selectedRecord.reportData.job_recommendations.length > 0 && (
                        <div className="bg-white p-3 rounded border">
                          <h5 className="font-semibold text-blue-700 mb-2">추천 직업</h5>
                          <ul className="space-y-1">
                            {selectedRecord.reportData.job_recommendations.map((job: string, idx: number) => (
                              <li key={idx} className="text-sm flex items-center">
                                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold mr-2">
                                  {idx + 1}
                                </span>
                                {job}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {selectedRecord.reportData.generated_at && (
                        <div className="text-xs text-slate-500">
                          생성일: {new Date(selectedRecord.reportData.generated_at).toLocaleString('ko-KR')}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-8">
                    리포트가 아직 생성되지 않았습니다.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <button className="btn btn-outline" onClick={() => router.push("/admin/dashboard")}>← 대시보드로</button>
      </div>
    </div>
  );
}


