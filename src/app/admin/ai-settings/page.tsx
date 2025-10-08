"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { getLocalStorage, setLocalStorage } from "@/lib/storage";

type Prompt = {
  id: string;
  title: string;
  description: string;
  content: string;
  updatedAt: string;
  isActive: boolean;
};

type AISettings = {
  openaiApiKey: string;
  prompts: Prompt[];
  activePromptId: string | null;
};

const DEFAULT_PROMPT: Prompt = {
  id: "default-1",
  title: "기본 에니어그램 분석 프롬프트",
  description: "사용자의 설문 응답을 바탕으로 에니어그램 유형을 분석하고 상세한 리포트를 작성",
  content: `당신은 에니어그램 전문가입니다. 사용자의 설문 응답을 바탕으로 에니어그램 유형을 분석하고 상세한 리포트를 작성해주세요.

응답 형식:
1. 에니어그램 유형: [1-9번 중 하나]
2. 주요 특징: [3-4줄로 설명]
3. 강점과 약점: [각각 2-3개씩]
4. 직업 추천 3개: [구체적인 직업명과 이유]

분석할 때는 사전 설문과 본 설문의 모든 응답을 종합적으로 고려해주세요.`,
  updatedAt: new Date().toISOString(),
  isActive: true,
};

export default function AISettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'prompts' | 'apikey'>('prompts');
  const [settings, setSettings] = useState<AISettings>({
    openaiApiKey: "",
    prompts: [DEFAULT_PROMPT],
    activePromptId: DEFAULT_PROMPT.id,
  });
  
  // Prompts tab state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPrompts, setSelectedPrompts] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // API Key tab state
  const [apiKeyMasked, setApiKeyMasked] = useState(true);
  const [editingApiKey, setEditingApiKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");
  
  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.replace("/");
      return;
    }
    
    // Load existing settings
    const savedSettings = getLocalStorage<AISettings>("ai.settings.v1", {
      openaiApiKey: "",
      prompts: [DEFAULT_PROMPT],
      activePromptId: DEFAULT_PROMPT.id,
    });
    setSettings(savedSettings);
  }, [user, router]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const saveSettings = (newSettings: AISettings) => {
    setLocalStorage("ai.settings.v1", newSettings);
    setSettings(newSettings);
  };

  // Prompt management functions
  const filteredPrompts = settings.prompts
    .filter(p => 
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  const handleSelectAll = () => {
    if (selectedPrompts.size === filteredPrompts.length) {
      setSelectedPrompts(new Set());
    } else {
      setSelectedPrompts(new Set(filteredPrompts.map(p => p.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedPrompts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPrompts(newSelected);
  };

  const handleCreatePrompt = () => {
    setEditingPrompt({
      id: `prompt-${Date.now()}`,
      title: "",
      description: "",
      content: "",
      updatedAt: new Date().toISOString(),
      isActive: false,
    });
    setShowPromptModal(true);
  };

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPrompt({ ...prompt });
    setShowPromptModal(true);
  };

  const handleSavePrompt = () => {
    if (!editingPrompt) return;
    
    setLoading(true);
    try {
      const updatedPrompt = {
        ...editingPrompt,
        updatedAt: new Date().toISOString(),
      };
      
      const promptIndex = settings.prompts.findIndex(p => p.id === editingPrompt.id);
      const newPrompts = [...settings.prompts];
      
      if (promptIndex >= 0) {
        newPrompts[promptIndex] = updatedPrompt;
      } else {
        newPrompts.push(updatedPrompt);
      }
      
      saveSettings({
        ...settings,
        prompts: newPrompts,
      });
      
      setShowPromptModal(false);
      setEditingPrompt(null);
      showToast('프롬프트가 저장되었습니다.');
    } catch (error) {
      showToast('저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleActivatePrompt = (id: string) => {
    setLoading(true);
    try {
      const newPrompts = settings.prompts.map(p => ({
        ...p,
        isActive: p.id === id,
      }));
      
      saveSettings({
        ...settings,
        prompts: newPrompts,
        activePromptId: id,
      });
      
      showToast('프롬프트가 활성화되었습니다.');
    } catch (error) {
      showToast('활성화 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePrompts = () => {
    setLoading(true);
    try {
      const promptsToDelete = selectedPrompts.size > 0 
        ? Array.from(selectedPrompts) 
        : editingPrompt 
        ? [editingPrompt.id] 
        : [];
      
      const newPrompts = settings.prompts.filter(p => !promptsToDelete.includes(p.id));
      
      // If active prompt is deleted, activate the first remaining prompt
      let newActiveId = settings.activePromptId;
      if (promptsToDelete.includes(settings.activePromptId || '')) {
        newActiveId = newPrompts.length > 0 ? newPrompts[0].id : null;
        if (newActiveId) {
          newPrompts[0].isActive = true;
        }
      }
      
      saveSettings({
        ...settings,
        prompts: newPrompts,
        activePromptId: newActiveId,
      });
      
      setSelectedPrompts(new Set());
      setShowDeleteConfirm(false);
      showToast(`${promptsToDelete.length}개의 프롬프트가 삭제되었습니다.`);
    } catch (error) {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // API Key management functions
  const handleSaveApiKey = () => {
    setLoading(true);
    try {
      saveSettings({
        ...settings,
        openaiApiKey: tempApiKey,
      });
      
      setEditingApiKey(false);
      setApiKeyMasked(true);
      setTempApiKey("");
      showToast('API Key가 저장되었습니다.');
    } catch (error) {
      showToast('저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditApiKey = () => {
    setTempApiKey(settings.openaiApiKey);
    setEditingApiKey(true);
    setApiKeyMasked(false);
  };

  const indeterminate = selectedPrompts.size > 0 && selectedPrompts.size < filteredPrompts.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">AI 설정</h2>
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
            activeTab === 'prompts'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('prompts')}
        >
          리포트 생성 프롬프트 관리
        </button>
        <button
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'apikey'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('apikey')}
        >
          OpenAI API Key 설정
        </button>
      </div>

      {/* Tab 1: Prompts Management */}
      {activeTab === 'prompts' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex justify-between items-center gap-4">
            <input
              type="text"
              placeholder="제목 또는 설명으로 검색..."
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
              {selectedPrompts.size > 0 && (
                <button
                  className="btn bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  선택 삭제 ({selectedPrompts.size})
                </button>
              )}
              <button className="btn btn-primary" onClick={handleCreatePrompt}>
                + 새 프롬프트
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <table className="w-full text-sm border-collapse">
                <thead className="bg-slate-100 sticky top-0 z-10">
                  <tr className="text-left text-slate-700 font-semibold">
                    <th className="py-3 px-4 border">
                      <input
                        type="checkbox"
                        checked={selectedPrompts.size === filteredPrompts.length && filteredPrompts.length > 0}
                        ref={(el) => {
                          if (el) el.indeterminate = indeterminate;
                        }}
                        onChange={handleSelectAll}
                        className="checkbox"
                      />
                    </th>
                    <th className="py-3 px-4 border">프롬프트명</th>
                    <th className="py-3 px-4 border">설명</th>
                    <th className="py-3 px-4 border">업데이트일</th>
                    <th className="py-3 px-4 border">상태</th>
                    <th className="py-3 px-4 border">액션</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredPrompts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <div className="text-slate-400">
                          <div className="text-4xl mb-2">📝</div>
                          <div className="text-lg font-medium">프롬프트를 추가하세요</div>
                          <div className="text-sm mt-1">오른쪽 상단의 "+ 새 프롬프트" 버튼을 클릭하세요</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPrompts.map((prompt) => (
                      <tr key={prompt.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 border">
                          <input
                            type="checkbox"
                            checked={selectedPrompts.has(prompt.id)}
                            onChange={() => handleToggleSelect(prompt.id)}
                            className="checkbox"
                          />
                        </td>
                        <td className="py-3 px-4 border font-medium">{prompt.title}</td>
                        <td className="py-3 px-4 border">
                          <div className="max-w-md truncate" title={prompt.description}>
                            {prompt.description}
                          </div>
                        </td>
                        <td className="py-3 px-4 border text-sm text-slate-600">
                          {new Date(prompt.updatedAt).toLocaleString('ko-KR')}
                        </td>
                        <td className="py-3 px-4 border">
                          {prompt.isActive ? (
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
                            {!prompt.isActive && (
                              <button
                                className="btn btn-xs btn-primary"
                                onClick={() => handleActivatePrompt(prompt.id)}
                                disabled={loading}
                              >
                                적용
                              </button>
                            )}
                            <button
                              className="btn btn-xs btn-outline"
                              onClick={() => handleEditPrompt(prompt)}
                              disabled={loading}
                            >
                              수정
                            </button>
                            <button
                              className="btn btn-xs bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                              onClick={() => {
                                setEditingPrompt(prompt);
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
      )}

      {/* Tab 2: API Key Settings */}
      {activeTab === 'apikey' && (
        <div className="space-y-4">
          {/* Warning Banner */}
          {!settings.openaiApiKey && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <div className="flex items-center gap-2">
                <span className="text-yellow-600 text-xl">⚠️</span>
                <div>
                  <div className="font-semibold text-yellow-800">API Key가 설정되어야 리포트 생성이 가능합니다.</div>
                  <div className="text-sm text-yellow-700">OpenAI API Key를 아래에 입력하고 저장하세요.</div>
                </div>
              </div>
            </div>
          )}

          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">OpenAI API Key</h3>
            
            {editingApiKey ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">API Key</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="sk-..."
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    OpenAI API 키를 입력하세요. 이 키는 리포트 생성에 사용됩니다.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveApiKey}
                    disabled={loading || !tempApiKey}
                  >
                    {loading ? '저장 중...' : '저장'}
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setEditingApiKey(false);
                      setTempApiKey("");
                      setApiKeyMasked(true);
                    }}
                    disabled={loading}
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {settings.openaiApiKey ? (
                  <div>
                    <label className="block text-sm font-medium mb-2">현재 API Key</label>
                    <div className="flex items-center gap-3">
                      <div className="input w-full bg-slate-50 font-mono text-slate-600">
                        {apiKeyMasked 
                          ? '••••••••••••••••••••••••••••••••••••••••'
                          : settings.openaiApiKey
                        }
                      </div>
                      <button
                        className="btn btn-outline"
                        onClick={() => setApiKeyMasked(!apiKeyMasked)}
                      >
                        {apiKeyMasked ? '표시' : '숨기기'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 py-4">
                    API Key가 설정되지 않았습니다.
                  </div>
                )}
                <div>
                  <button
                    className="btn btn-primary"
                    onClick={handleEditApiKey}
                  >
                    {settings.openaiApiKey ? '수정' : '설정'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prompt Modal */}
      {showPromptModal && editingPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">
                {editingPrompt.id.startsWith('prompt-') && !settings.prompts.find(p => p.id === editingPrompt.id)
                  ? '새 프롬프트 추가'
                  : '프롬프트 수정'
                }
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">프롬프트명 *</label>
                <input
                  type="text"
                  className="input w-full"
                  value={editingPrompt.title}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, title: e.target.value })}
                  placeholder="예: 기본 에니어그램 분석 프롬프트"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">설명 *</label>
                <input
                  type="text"
                  className="input w-full"
                  value={editingPrompt.description}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, description: e.target.value })}
                  placeholder="예: 사용자의 설문 응답을 바탕으로 에니어그램 유형을 분석"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">프롬프트 내용 *</label>
                <textarea
                  className="textarea w-full h-96"
                  value={editingPrompt.content}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, content: e.target.value })}
                  placeholder="프롬프트 내용을 입력하세요..."
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-2 sticky bottom-0 bg-white">
              <button
                className="btn btn-outline"
                onClick={() => {
                  setShowPromptModal(false);
                  setEditingPrompt(null);
                }}
                disabled={loading}
              >
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSavePrompt}
                disabled={loading || !editingPrompt.title || !editingPrompt.description || !editingPrompt.content}
              >
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">프롬프트 삭제 확인</h3>
              <p className="text-slate-600">
                {selectedPrompts.size > 0
                  ? `선택한 ${selectedPrompts.size}개의 프롬프트를 삭제하시겠습니까?`
                  : '이 프롬프트를 삭제하시겠습니까?'
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
                  setEditingPrompt(null);
                }}
                disabled={loading}
              >
                취소
              </button>
              <button
                className="btn bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                onClick={handleDeletePrompts}
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
