"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { parseQuestionsCsv, saveMainSurveyQuestions, savePreSurveyQuestions, getPreSurveyQuestionsCount, getMainSurveyQuestionsCount } from "@/lib/survey-questions";

export default function AdminQuestionsSimplePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pre' | 'main'>('pre');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [preCount, setPreCount] = useState(0);
  const [mainCount, setMainCount] = useState(0);

  React.useEffect(() => {
    if (user?.role !== "admin") {
      router.replace("/");
      return;
    }
    loadCounts();
  }, [user, router]);

  const loadCounts = async () => {
    try {
      const pre = await getPreSurveyQuestionsCount();
      const main = await getMainSurveyQuestionsCount();
      setPreCount(pre);
      setMainCount(main);
    } catch (error) {
      console.error('Failed to load counts:', error);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    
    setLoading(true);
    try {
      if (activeTab === 'pre') {
        // 사전 설문 CSV 파싱
        const items = await parseQuestionsCsv(file, {
          idColumn: "q_id",
          textColumn: "text_ko",
          optionsColumn: "options",
          categoryColumn: "카테고리",
          purposeColumn: "목적 및 활용도"
        });

        // Supabase에 저장
        const preQuestions = items.map(item => ({
          q_id: item.id,
          category: item.category || undefined,
          text_ko: item.text,
          options: item.options ? item.options.join('/') : undefined,
          purpose: item.purpose || undefined
        }));

        await savePreSurveyQuestions(preQuestions);
        showMessage(`사전 설문 ${items.length}개 문항이 저장되었습니다.`);
      } else {
        // 본 설문 CSV 파싱
        const items = await parseQuestionsCsv(file, {
          idColumn: "q_id",
          textColumn: "text_ko",
          typeColumn: "type",
          typeNameColumn: "type_name"
        });
        
        console.log('Parsed main survey items:', items.length);
        console.log('Sample item:', items[0]);

        // Supabase에 저장
        const mainQuestions = items.map(item => ({
          type: item.type || 'default',
          type_name: item.typeName || undefined,
          q_id: item.id,
          text_ko: item.text
        }));

        await saveMainSurveyQuestions(mainQuestions);
        showMessage(`본 설문 ${items.length}개 문항이 저장되었습니다.`);
      }

      // 개수 업데이트
      await loadCounts();
    } catch (error) {
      console.error('Upload error:', error);
      showMessage('CSV 업로드 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFileUpload(file);
      }
    };
    input.click();
  };

  if (user?.role !== "admin") {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">설문 문항 관리</h2>
        <button className="btn btn-outline" onClick={() => router.push("/admin/dashboard")}>
          ← 대시보드로
        </button>
      </div>

      {/* 메시지 */}
      {message && (
        <div className={`p-4 rounded-md ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 border-b-2 ${
            activeTab === 'pre' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-600'
          }`}
          onClick={() => setActiveTab('pre')}
        >
          사전 설문
        </button>
        <button
          className={`px-4 py-2 border-b-2 ${
            activeTab === 'main' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-600'
          }`}
          onClick={() => setActiveTab('main')}
        >
          본 설문
        </button>
      </div>

      {/* 현재 상태 */}
      <div className="card p-6">
        <h3 className="font-semibold mb-4">
          {activeTab === 'pre' ? '사전 설문' : '본 설문'} 현황
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-slate-600">현재 문항 수</div>
            <div className="text-2xl font-bold">
              {activeTab === 'pre' ? preCount : mainCount}개
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-600">마지막 업데이트</div>
            <div className="text-sm">Supabase DB에서 관리</div>
          </div>
        </div>
      </div>

      {/* 업로드 섹션 */}
      <div className="card p-6">
        <h3 className="font-semibold mb-4">CSV 파일 업로드</h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">
              {activeTab === 'pre' ? '사전 설문' : '본 설문'} CSV 형식
            </h4>
            <div className="text-sm text-slate-600 space-y-1">
              {activeTab === 'pre' ? (
                <>
                  <div>• <strong>q_id</strong>: 문항 고유 ID</div>
                  <div>• <strong>카테고리</strong>: 문항 카테고리</div>
                  <div>• <strong>text_ko</strong>: 문항 내용 (한글)</div>
                  <div>• <strong>options</strong>: 선택지 (슬래시 구분)</div>
                  <div>• <strong>목적 및 활용도</strong>: 목적 및 활용도</div>
                </>
              ) : (
                <>
                  <div>• <strong>type</strong>: 유형 코드</div>
                  <div>• <strong>type_name</strong>: 유형명</div>
                  <div>• <strong>q_id</strong>: 문항 고유 ID</div>
                  <div>• <strong>text_ko</strong>: 문항 내용 (한글)</div>
                </>
              )}
            </div>
          </div>

          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
            <div className="space-y-4">
              <div className="text-slate-600">
                CSV 파일을 업로드하여 설문 문항을 업데이트하세요
              </div>
              <button
                className="btn btn-primary"
                onClick={handleUploadClick}
                disabled={loading}
              >
                {loading ? '업로드 중...' : 'CSV 파일 선택'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 주의사항 */}
      <div className="card p-6 bg-yellow-50">
        <h4 className="font-medium text-yellow-800 mb-2">⚠️ 주의사항</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• CSV 업로드 시 기존 문항이 <strong>모두 교체</strong>됩니다</li>
          <li>• 업로드 후 모든 사용자에게 즉시 반영됩니다</li>
          <li>• CSV 파일은 UTF-8 인코딩으로 저장해주세요</li>
          <li>• 첫 번째 행은 헤더(컬럼명)여야 합니다</li>
        </ul>
      </div>
    </div>
  );
}
