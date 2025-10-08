"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { parseQuestionsCsv, saveMainQuestions, savePreQuestions } from "@/lib/dynamic-questions";
import { getLocalStorage, setLocalStorage } from "@/lib/storage";

type QuestionVersion = {
  id: string;
  filename: string;
  description: string;
  uploadedAt: string;
  questionCount: number;
  isActive: boolean;
  data: any[]; // Parsed question data
};

type QuestionSettings = {
  preVersions: QuestionVersion[];
  mainVersions: QuestionVersion[];
  activePreId: string | null;
  activeMainId: string | null;
};

export default function AdminQuestionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pre' | 'main'>('pre');
  const [settings, setSettings] = useState<QuestionSettings>({
    preVersions: [],
    mainVersions: [],
    activePreId: null,
    activeMainId: null,
  });
  
  // State for each tab
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVersions, setSelectedVersions] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [editingVersion, setEditingVersion] = useState<QuestionVersion | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCsvEditModal, setShowCsvEditModal] = useState(false);
  const [editedQuestions, setEditedQuestions] = useState<any[]>([]);
  
  // Toast and loading state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.replace("/");
      return;
    }
    
    // Load existing settings
    const savedSettings = getLocalStorage<QuestionSettings>("question.settings.v1", {
      preVersions: [],
      mainVersions: [],
      activePreId: null,
      activeMainId: null,
    });
    setSettings(savedSettings);
  }, [user, router]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const saveSettings = (newSettings: QuestionSettings) => {
    setLocalStorage("question.settings.v1", newSettings);
    setSettings(newSettings);
  };

  const currentVersions = activeTab === 'pre' ? settings.preVersions : settings.mainVersions;
  const activeVersionId = activeTab === 'pre' ? settings.activePreId : settings.activeMainId;

  const filteredVersions = currentVersions
    .filter(v => 
      v.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const dateA = new Date(a.uploadedAt).getTime();
      const dateB = new Date(b.uploadedAt).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  const handleSelectAll = () => {
    if (selectedVersions.size === filteredVersions.length) {
      setSelectedVersions(new Set());
    } else {
      setSelectedVersions(new Set(filteredVersions.map(v => v.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedVersions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedVersions(newSelected);
  };

  const handleUploadNew = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      setLoading(true);
      try {
        const items = await parseQuestionsCsv(file, { 
          idColumn: "q_id", 
          textColumn: "text_ko", 
          optionsColumn: "options" 
        });
        
        setEditingVersion({
          id: `version-${Date.now()}`,
          filename: file.name,
          description: "",
          uploadedAt: new Date().toISOString(),
          questionCount: items.length,
          isActive: false,
          data: items,
        });
        setShowVersionModal(true);
      } catch (error) {
        showToast('CSV 파일 파싱 중 오류가 발생했습니다.', 'error');
      } finally {
        setLoading(false);
      }
    };
    input.click();
  };

  const handleEditVersion = (version: QuestionVersion) => {
    setEditingVersion({ ...version });
    setShowVersionModal(true);
  };

  const handleEditQuestions = (version: QuestionVersion) => {
    // Open CSV preview & edit modal
    setEditingVersion({ ...version });
    setEditedQuestions([...version.data]);
    setShowCsvEditModal(true);
  };

  const handleSaveCsvEdit = () => {
    if (!editingVersion) return;
    
    setLoading(true);
    try {
      const updatedVersion = {
        ...editingVersion,
        data: editedQuestions,
        questionCount: editedQuestions.length,
        uploadedAt: new Date().toISOString(),
      };
      
      const isPreTab = activeTab === 'pre';
      const currentList = isPreTab ? settings.preVersions : settings.mainVersions;
      const versionIndex = currentList.findIndex(v => v.id === editingVersion.id);
      const newVersions = [...currentList];
      
      if (versionIndex >= 0) {
        newVersions[versionIndex] = updatedVersion;
        
        // If this is the active version, update the dynamic-questions storage
        if (updatedVersion.isActive) {
          if (isPreTab) {
            savePreQuestions(editedQuestions);
          } else {
            saveMainQuestions(editedQuestions);
          }
        }
      }
      
      const newSettings = {
        ...settings,
        ...(isPreTab 
          ? { preVersions: newVersions }
          : { mainVersions: newVersions }
        ),
      };
      
      saveSettings(newSettings);
      setShowCsvEditModal(false);
      setEditingVersion(null);
      setEditedQuestions([]);
      showToast('문항이 수정되었습니다.');
      
      // Refresh if active version was edited
      if (updatedVersion.isActive) {
        setTimeout(() => router.refresh(), 100);
      }
    } catch (error) {
      showToast('저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuestion = (index: number, field: string, value: string | string[]) => {
    const newQuestions = [...editedQuestions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setEditedQuestions(newQuestions);
  };

  const handleDeleteQuestion = (index: number) => {
    const newQuestions = editedQuestions.filter((_, i) => i !== index);
    setEditedQuestions(newQuestions);
  };

  const handleAddQuestion = () => {
    const newQuestion = {
      id: `q_${Date.now()}`,
      text: "",
      options: activeTab === 'pre' ? [] : undefined,
    };
    setEditedQuestions([...editedQuestions, newQuestion]);
  };

  const handleSaveVersion = () => {
    if (!editingVersion) return;
    
    setLoading(true);
    try {
      const updatedVersion = {
        ...editingVersion,
        uploadedAt: new Date().toISOString(),
      };
      
      const isPreTab = activeTab === 'pre';
      const currentList = isPreTab ? settings.preVersions : settings.mainVersions;
      const versionIndex = currentList.findIndex(v => v.id === editingVersion.id);
      const newVersions = [...currentList];
      
      if (versionIndex >= 0) {
        newVersions[versionIndex] = updatedVersion;
      } else {
        newVersions.push(updatedVersion);
      }
      
      const newSettings = {
        ...settings,
        ...(isPreTab 
          ? { preVersions: newVersions }
          : { mainVersions: newVersions }
        ),
      };
      
      saveSettings(newSettings);
      setShowVersionModal(false);
      setEditingVersion(null);
      showToast('버전이 저장되었습니다.');
    } catch (error) {
      showToast('저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleActivateVersion = (id: string) => {
    setLoading(true);
    try {
      const isPreTab = activeTab === 'pre';
      const version = currentVersions.find(v => v.id === id);
      
      if (!version) {
        showToast('버전을 찾을 수 없습니다.', 'error');
        return;
      }
      
      // Update active status
      const newVersions = currentVersions.map(v => ({
        ...v,
        isActive: v.id === id,
      }));
      
      // Save to dynamic-questions storage
      if (isPreTab) {
        savePreQuestions(version.data);
      } else {
        saveMainQuestions(version.data);
      }
      
      const newSettings = {
        ...settings,
        ...(isPreTab 
          ? { preVersions: newVersions, activePreId: id }
          : { mainVersions: newVersions, activeMainId: id }
        ),
      };
      
      saveSettings(newSettings);
      showToast('버전이 활성화되었습니다.');
      
      // Refresh to update question counts
      setTimeout(() => router.refresh(), 100);
    } catch (error) {
      showToast('활성화 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVersions = () => {
    setLoading(true);
    try {
      const versionsToDelete = selectedVersions.size > 0 
        ? Array.from(selectedVersions) 
        : editingVersion 
        ? [editingVersion.id] 
        : [];
      
      const isPreTab = activeTab === 'pre';
      const newVersions = currentVersions.filter(v => !versionsToDelete.includes(v.id));
      
      // If active version is deleted, activate the first remaining version
      let newActiveId = isPreTab ? settings.activePreId : settings.activeMainId;
      if (versionsToDelete.includes(newActiveId || '')) {
        newActiveId = newVersions.length > 0 ? newVersions[0].id : null;
        if (newActiveId) {
          newVersions[0].isActive = true;
          // Save to dynamic-questions storage
          const activeVersion = newVersions[0];
          if (isPreTab) {
            savePreQuestions(activeVersion.data);
          } else {
            saveMainQuestions(activeVersion.data);
          }
        }
      }
      
      const newSettings = {
        ...settings,
        ...(isPreTab 
          ? { preVersions: newVersions, activePreId: newActiveId }
          : { mainVersions: newVersions, activeMainId: newActiveId }
        ),
      };
      
      saveSettings(newSettings);
      setSelectedVersions(new Set());
      setShowDeleteConfirm(false);
      showToast(`${versionsToDelete.length}개의 버전이 삭제되었습니다.`);
    } catch (error) {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const indeterminate = selectedVersions.size > 0 && selectedVersions.size < filteredVersions.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">설문 문항 수정</h2>
        <button 
          className="btn btn-outline"
          onClick={() => router.push("/admin/dashboard")}
        >
          ← 대시보드로
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b">
        <button
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'pre'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => {
            setActiveTab('pre');
            setSelectedVersions(new Set());
          }}
        >
          사전 설문
        </button>
        <button
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'main'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => {
            setActiveTab('main');
            setSelectedVersions(new Set());
          }}
        >
          본 설문
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {/* Toolbar */}
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
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            >
              <option value="desc">최신순</option>
              <option value="asc">오래된순</option>
            </select>
            {selectedVersions.size > 0 && (
              <button
                className="btn bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                onClick={() => setShowDeleteConfirm(true)}
              >
                선택 삭제 ({selectedVersions.size})
              </button>
            )}
            <button className="btn btn-primary" onClick={handleUploadNew}>
              + CSV 업로드
            </button>
          </div>
        </div>

        {/* Version Table */}
        <div className="card overflow-hidden">
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-100 sticky top-0 z-10">
                <tr className="text-left text-slate-700 font-semibold">
                  <th className="py-3 px-4 border">
                    <input
                      type="checkbox"
                      checked={selectedVersions.size === filteredVersions.length && filteredVersions.length > 0}
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
                        <div className="text-lg font-medium">CSV 파일을 업로드하세요</div>
                        <div className="text-sm mt-1">오른쪽 상단의 "+ CSV 업로드" 버튼을 클릭하세요</div>
                        <div className="text-xs text-slate-500 mt-2">
                          필수 컬럼: q_id, text_ko | 선택 컬럼: options (/ 구분)
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredVersions.map((version) => (
                    <tr key={version.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 border">
                        <input
                          type="checkbox"
                          checked={selectedVersions.has(version.id)}
                          onChange={() => handleToggleSelect(version.id)}
                          className="checkbox"
                        />
                      </td>
                      <td className="py-3 px-4 border font-medium">{version.filename}</td>
                      <td className="py-3 px-4 border">
                        <div className="max-w-md truncate" title={version.description}>
                          {version.description || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4 border text-center">{version.questionCount}개</td>
                      <td className="py-3 px-4 border text-sm text-slate-600">
                        {new Date(version.uploadedAt).toLocaleString('ko-KR')}
                      </td>
                      <td className="py-3 px-4 border">
                        {version.isActive ? (
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
                          {!version.isActive && (
                            <button
                              className="btn btn-xs btn-primary"
                              onClick={() => handleActivateVersion(version.id)}
                              disabled={loading}
                            >
                              적용
                            </button>
                          )}
                          <button
                            className="btn btn-xs btn-outline"
                            onClick={() => handleEditVersion(version)}
                            disabled={loading}
                          >
                            설명 수정
                          </button>
                          <button
                            className="btn btn-xs btn-outline"
                            onClick={() => handleEditQuestions(version)}
                            disabled={loading}
                          >
                            CSV 편집
                          </button>
                          <button
                            className="btn btn-xs bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                            onClick={() => {
                              setEditingVersion(version);
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
      </div>

      {/* Version Edit Modal */}
      {showVersionModal && editingVersion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">
                {currentVersions.find(v => v.id === editingVersion.id)
                  ? '버전 수정'
                  : '새 버전 추가'
                }
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">파일명</label>
                <input
                  type="text"
                  className="input w-full bg-slate-50"
                  value={editingVersion.filename}
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">문항 수</label>
                <input
                  type="text"
                  className="input w-full bg-slate-50"
                  value={`${editingVersion.questionCount}개`}
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">설명 (선택)</label>
                <input
                  type="text"
                  className="input w-full"
                  value={editingVersion.description}
                  onChange={(e) => setEditingVersion({ ...editingVersion, description: e.target.value })}
                  placeholder="예: 2025년 1월 버전"
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <button
                className="btn btn-outline"
                onClick={() => {
                  setShowVersionModal(false);
                  setEditingVersion(null);
                }}
                disabled={loading}
              >
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveVersion}
                disabled={loading}
              >
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Edit Modal */}
      {showCsvEditModal && editingVersion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">CSV 편집: {editingVersion.filename}</h3>
                <p className="text-sm text-slate-600 mt-1">문항을 직접 수정하거나 추가/삭제할 수 있습니다.</p>
              </div>
              <button
                className="btn btn-sm btn-outline"
                onClick={handleAddQuestion}
                disabled={loading}
              >
                + 문항 추가
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="border rounded overflow-hidden">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr className="text-left text-slate-700 font-semibold">
                      <th className="py-3 px-4 border w-12">#</th>
                      <th className="py-3 px-4 border w-32">질문 ID</th>
                      <th className="py-3 px-4 border">문항 내용</th>
                      {activeTab === 'pre' && <th className="py-3 px-4 border w-64">선택지 (/ 구분)</th>}
                      <th className="py-3 px-4 border w-24">삭제</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {editedQuestions.map((question, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="py-3 px-4 border text-center text-slate-500">{index + 1}</td>
                        <td className="py-3 px-4 border">
                          <input
                            type="text"
                            className="input w-full text-sm"
                            value={question.id}
                            onChange={(e) => handleUpdateQuestion(index, 'id', e.target.value)}
                          />
                        </td>
                        <td className="py-3 px-4 border">
                          <textarea
                            className="textarea w-full text-sm"
                            rows={2}
                            value={question.text}
                            onChange={(e) => handleUpdateQuestion(index, 'text', e.target.value)}
                          />
                        </td>
                        {activeTab === 'pre' && (
                          <td className="py-3 px-4 border">
                            <input
                              type="text"
                              className="input w-full text-sm"
                              value={question.options?.join(' / ') || ''}
                              onChange={(e) => {
                                const options = e.target.value.split('/').map(o => o.trim()).filter(Boolean);
                                handleUpdateQuestion(index, 'options', options);
                              }}
                              placeholder="옵션1 / 옵션2 / 옵션3"
                            />
                          </td>
                        )}
                        <td className="py-3 px-4 border text-center">
                          <button
                            className="btn btn-xs bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                            onClick={() => handleDeleteQuestion(index)}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                    {editedQuestions.length === 0 && (
                      <tr>
                        <td colSpan={activeTab === 'pre' ? 5 : 4} className="py-8 text-center text-slate-400">
                          문항이 없습니다. "+ 문항 추가" 버튼을 클릭하세요.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="p-6 border-t flex justify-between items-center">
              <div className="text-sm text-slate-600">
                총 {editedQuestions.length}개 문항
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setShowCsvEditModal(false);
                    setEditingVersion(null);
                    setEditedQuestions([]);
                  }}
                  disabled={loading}
                >
                  취소
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveCsvEdit}
                  disabled={loading}
                >
                  {loading ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">버전 삭제 확인</h3>
              <p className="text-slate-600">
                {selectedVersions.size > 0
                  ? `선택한 ${selectedVersions.size}개의 버전을 삭제하시겠습니까?`
                  : '이 버전을 삭제하시겠습니까?'
                }
              </p>
              <p className="text-sm text-red-600 mt-2">
                이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <button
                className="btn btn-outline"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setEditingVersion(null);
                }}
                disabled={loading}
              >
                취소
              </button>
              <button
                className="btn bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                onClick={handleDeleteVersions}
                disabled={loading}
              >
                {loading ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded shadow-lg ${
          toast.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
