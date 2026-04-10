"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { parseQuestionsCsv, savePreSurveyQuestions, saveMainSurveyQuestions } from "@/lib/survey-questions";

type CsvVersion = {
  id: string;
  type: "pre" | "main";
  filename: string;
  description: string | null;
  question_count: number;
  question_data: any[];
  is_active: boolean;
  uploaded_at: string;
};

export default function AdminQuestionsSimplePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"pre" | "main">("pre");
  const [versions, setVersions] = useState<CsvVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDescModal, setShowDescModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [editingVersion, setEditingVersion] = useState<CsvVersion | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.replace("/");
      return;
    }
    loadVersions();
  }, [user, router]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("question_csv_versions")
        .select("*")
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error(error);
      showToast("데이터를 불러오는데 실패했습니다.", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const currentVersions = versions.filter((v) => v.type === activeTab);

  const filteredVersions = currentVersions
    .filter(
      (v) =>
        v.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.description || "").toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const dateA = new Date(a.uploaded_at).getTime();
      const dateB = new Date(b.uploaded_at).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

  const handleUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setLoading(true);
      try {
        let items: any[];
        if (activeTab === "pre") {
          items = await parseQuestionsCsv(file, {
            idColumn: "q_id",
            textColumn: "text_ko",
            optionsColumn: "options",
            categoryColumn: "category",
            purposeColumn: "purpose",
            requiredColumn: "required",
            answerTypeColumn: "answer_type",
          });
        } else {
          items = await parseQuestionsCsv(file, {
            idColumn: "q_id",
            textColumn: "text_ko",
            typeColumn: "유형",
            typeNameColumn: "유형명",
          });
        }

        const { error } = await supabase.from("question_csv_versions").insert({
          type: activeTab,
          filename: file.name,
          description: null,
          question_count: items.length,
          question_data: items,
          is_active: false,
        });

        if (error) throw error;

        showToast(`${items.length}개 문항이 업로드되었습니다.`);
        await loadVersions();
      } catch (error) {
        console.error(error);
        showToast("CSV 업로드 중 오류가 발생했습니다.", "error");
      } finally {
        setLoading(false);
      }
    };
    input.click();
  };

  const handleActivate = async (version: CsvVersion) => {
    setLoading(true);
    try {
      // 같은 타입의 모든 버전 비활성화
      await supabase
        .from("question_csv_versions")
        .update({ is_active: false })
        .eq("type", activeTab);

      // 선택한 버전 활성화
      const { error } = await supabase
        .from("question_csv_versions")
        .update({ is_active: true })
        .eq("id", version.id);

      if (error) throw error;

      // 실제 설문 테이블에 문항 적용
      if (activeTab === "pre") {
        const questions = version.question_data.map((item: any) => ({
          q_id: item.id,
          category: item.category || undefined,
          text_ko: item.text,
          options: item.options ? item.options.join("/") : undefined,
          purpose: item.purpose || undefined,
          required: item.required || 'y',
          answer_type: item.answerType || '객관식-단일선택',
        }));
        await savePreSurveyQuestions(questions);
      } else {
        const questions = version.question_data.map((item: any) => ({
          type: item.type || "default",
          type_name: item.typeName || undefined,
          q_id: item.id,
          text_ko: item.text,
        }));
        await saveMainSurveyQuestions(questions);
      }

      showToast("버전이 활성화되었습니다.");
      await loadVersions();
    } catch (error) {
      console.error(error);
      showToast("활성화 중 오류가 발생했습니다.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDesc = async () => {
    if (!editingVersion) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("question_csv_versions")
        .update({ description: editingVersion.description })
        .eq("id", editingVersion.id);
      if (error) throw error;
      showToast("설명이 저장되었습니다.");
      setShowDescModal(false);
      setEditingVersion(null);
      await loadVersions();
    } catch (error) {
      showToast("저장 중 오류가 발생했습니다.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const toDelete = Array.from(selectedIds);
    if (toDelete.length === 0) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("question_csv_versions")
        .delete()
        .in("id", toDelete);
      if (error) throw error;
      showToast(`${toDelete.length}개 버전이 삭제되었습니다.`);
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
      await loadVersions();
    } catch (error) {
      showToast("삭제 중 오류가 발생했습니다.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredVersions.length && filteredVersions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredVersions.map((v) => v.id)));
    }
  };

  const indeterminate =
    selectedIds.size > 0 && selectedIds.size < filteredVersions.length;

  if (user?.role !== "admin") return null;

  return (
    <div className="space-y-6">
      <button className="btn btn-outline w-fit" onClick={() => router.push("/admin/dashboard")}>← 대시보드로</button>
      <h2 className="text-xl font-semibold">설문 문항 관리</h2>

      {/* 탭 */}
      <div className="flex border-b">
        {(["pre", "main"] as const).map((tab) => (
          <button
            key={tab}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => {
              setActiveTab(tab);
              setSelectedIds(new Set());
            }}
          >
            {tab === "pre" ? "사전 설문" : "본 설문"}
          </button>
        ))}
      </div>

      {/* 툴바 */}
      <div className="flex justify-between items-center gap-4">
        <input
          type="text"
          placeholder="파일명 또는 설명으로 검색..."
          className="input flex-1 max-w-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="flex gap-2">
          <select
            className="input"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
          >
            <option value="desc">최신순</option>
            <option value="asc">오래된순</option>
          </select>
          {selectedIds.size > 0 && (
            <button
              className="btn bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
              onClick={() => setShowDeleteConfirm(true)}
            >
              선택 삭제 ({selectedIds.size})
            </button>
          )}
          <button className="btn btn-primary" onClick={handleUpload} disabled={loading}>
            + CSV 업로드
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="card overflow-hidden">
        <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-100 sticky top-0 z-10">
              <tr className="text-left text-slate-700 font-semibold">
                <th className="py-3 px-4 border">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.size === filteredVersions.length &&
                      filteredVersions.length > 0
                    }
                    ref={(el) => {
                      if (el) el.indeterminate = indeterminate;
                    }}
                    onChange={handleSelectAll}
                    className="checkbox"
                  />
                </th>
                <th className="py-3 px-4 border">파일명</th>
                <th className="py-3 px-4 border">설명</th>
                <th className="py-3 px-4 border">문항 수</th>
                <th className="py-3 px-4 border">업로드일</th>
                <th className="py-3 px-4 border">상태</th>
                <th className="py-3 px-4 border">액션</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredVersions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="text-slate-400">
                      <div className="text-4xl mb-2">📄</div>
                      <div className="text-lg font-medium">
                        {loading ? "불러오는 중..." : "CSV 파일을 업로드하세요"}
                      </div>
                      {!loading && (
                        <div className="text-sm mt-1">
                          오른쪽 상단의 "+ CSV 업로드" 버튼을 클릭하세요
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVersions.map((version) => (
                  <tr key={version.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 border">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(version.id)}
                        onChange={() => handleToggleSelect(version.id)}
                        className="checkbox"
                      />
                    </td>
                    <td className="py-3 px-4 border font-medium">{version.filename}</td>
                    <td className="py-3 px-4 border">
                      <div className="max-w-xs truncate" title={version.description || ""}>
                        {version.description || "-"}
                      </div>
                    </td>
                    <td className="py-3 px-4 border text-center">{version.question_count}개</td>
                    <td className="py-3 px-4 border text-sm text-slate-600">
                      {new Date(version.uploaded_at).toLocaleString("ko-KR")}
                    </td>
                    <td className="py-3 px-4 border">
                      {version.is_active ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                          활성화됨
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded">
                          비활성
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 border">
                      <div className="flex gap-2">
                        {!version.is_active && (
                          <button
                            className="btn btn-xs btn-primary"
                            onClick={() => handleActivate(version)}
                            disabled={loading}
                          >
                            적용
                          </button>
                        )}
                        <button
                          className="btn btn-xs btn-outline"
                          onClick={() => {
                            setEditingVersion({ ...version });
                            setShowDescModal(true);
                          }}
                          disabled={loading}
                        >
                          설명 수정
                        </button>
                        <button
                          className="btn btn-xs btn-outline"
                          onClick={() => {
                            setEditingVersion(version);
                            setShowPreviewModal(true);
                          }}
                          disabled={loading}
                        >
                          목록 보기
                        </button>
                        <button
                          className="btn btn-xs bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                          onClick={() => {
                            setSelectedIds(new Set([version.id]));
                            setShowDeleteConfirm(true);
                          }}
                          disabled={loading}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 설명 수정 모달 */}
      {showDescModal && editingVersion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 pt-12 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">설명 수정</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">파일명</label>
                <input
                  type="text"
                  className="input w-full bg-slate-50"
                  value={editingVersion.filename}
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">설명 (선택)</label>
                <input
                  type="text"
                  className="input w-full"
                  value={editingVersion.description || ""}
                  onChange={(e) =>
                    setEditingVersion({ ...editingVersion, description: e.target.value })
                  }
                  placeholder="예: 2025년 1월 버전"
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <button
                className="btn btn-outline"
                onClick={() => {
                  setShowDescModal(false);
                  setEditingVersion(null);
                }}
                disabled={loading}
              >
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveDesc}
                disabled={loading}
              >
                {loading ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 문항 목록 미리보기 모달 */}
      {showPreviewModal && editingVersion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 pt-12 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mb-12">
            <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">{editingVersion.filename}</h3>
                <p className="text-sm text-slate-500 mt-1">
                  총 {editingVersion.question_count}개 문항
                </p>
              </div>
              <button
                className="btn btn-outline"
                onClick={() => {
                  setShowPreviewModal(false);
                  setEditingVersion(null);
                }}
              >
                닫기
              </button>
            </div>
            <div className="p-6">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-slate-100 sticky top-0">
                  <tr className="text-left text-slate-700 font-semibold">
                    <th className="py-2 px-3 border w-10">#</th>
                    <th className="py-2 px-3 border w-24">ID</th>
                    {activeTab === "pre" && <th className="py-2 px-3 border w-24">카테고리</th>}
                    <th className="py-2 px-3 border">문항 내용</th>
                    {activeTab === "pre" && <th className="py-2 px-3 border w-48">선택지</th>}
                    {activeTab === "pre" && <th className="py-2 px-3 border w-28">답변유형</th>}
                    {activeTab === "pre" && <th className="py-2 px-3 border w-16">필수</th>}
                    {activeTab === "pre" && <th className="py-2 px-3 border w-40">목적 및 활용도</th>}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {editingVersion.question_data.map((q: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2 px-3 border text-center text-slate-500">{i + 1}</td>
                      <td className="py-2 px-3 border text-slate-600 text-xs">{q.id}</td>
                      {activeTab === "pre" && (
                        <td className="py-2 px-3 border text-xs text-slate-600">{q.category || "-"}</td>
                      )}
                      <td className="py-2 px-3 border">{q.text}</td>
                      {activeTab === "pre" && (
                        <td className="py-2 px-3 border text-xs text-slate-600">
                          {q.options ? q.options.join(" / ") : "-"}
                        </td>
                      )}
                      {activeTab === "pre" && (
                        <td className="py-2 px-3 border text-xs text-slate-600">
                          {q.answerType || "객관식-단일선택"}
                        </td>
                      )}
                      {activeTab === "pre" && (
                        <td className="py-2 px-3 border text-center text-xs">
                          {q.required === "n" ? (
                            <span className="text-slate-400">선택</span>
                          ) : (
                            <span className="text-blue-600 font-medium">필수</span>
                          )}
                        </td>
                      )}
                      {activeTab === "pre" && (
                        <td className="py-2 px-3 border text-xs text-slate-600">
                          {q.purpose || "-"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 pt-12 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">삭제 확인</h3>
              <p className="text-slate-600">
                선택한 {selectedIds.size}개의 버전을 삭제하시겠습니까?
              </p>
              <p className="text-sm text-red-600 mt-2">이 작업은 되돌릴 수 없습니다.</p>
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <button
                className="btn btn-outline"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedIds(new Set());
                }}
                disabled={loading}
              >
                취소
              </button>
              <button
                className="btn bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div
          className={`fixed top-4 right-4 px-4 py-3 rounded shadow-lg z-50 ${
            toast.type === "success"
              ? "bg-green-100 text-green-800 border border-green-200"
              : "bg-red-100 text-red-800 border border-red-200"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
