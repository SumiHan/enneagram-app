"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Prompt = {
  id: string;
  title: string;
  description: string | null;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type AISettings = {
  id: number;
  openai_api_key: string | null;
  active_prompt_id: string | null;
  updated_at: string;
};

export default function AISettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'prompts' | 'apikey'>('prompts');
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  
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
    
    loadData();
  }, [user, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (settingsError) throw settingsError;
      setSettings(settingsData);
      
      // Load prompts
      const { data: promptsData, error: promptsError } = await supabase
        .from('ai_prompts')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (promptsError) throw promptsError;
      setPrompts(promptsData || []);
      
    } catch (error) {
      console.error('Error loading AI settings:', error);
      showToast('설정을 불러오는데 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Prompt management functions
  const filteredPrompts = prompts
    .filter(p => 
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      const dateA = new Date(a.updated_at).getTime();
      const dateB = new Date(b.updated_at).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  const handleCreatePrompt = () => {
    setEditingPrompt({
      id: '',
      title: '',
      description: '',
      content: '',
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setShowPromptModal(true);
  };

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setShowPromptModal(true);
  };

  const handleSavePrompt = async () => {
    if (!editingPrompt) return;
    
    try {
      setLoading(true);
      
      if (editingPrompt.id) {
        // Update existing prompt
        const { error } = await supabase
          .from('ai_prompts')
          .update({
            title: editingPrompt.title,
            description: editingPrompt.description,
            content: editingPrompt.content,
          })
          .eq('id', editingPrompt.id);
        
        if (error) throw error;
        showToast('프롬프트가 수정되었습니다.');
      } else {
        // Create new prompt
        const { error } = await supabase
          .from('ai_prompts')
          .insert({
            title: editingPrompt.title,
            description: editingPrompt.description,
            content: editingPrompt.content,
            is_active: false,
          });
        
        if (error) throw error;
        showToast('프롬프트가 생성되었습니다.');
      }
      
      setShowPromptModal(false);
      setEditingPrompt(null);
      await loadData();
    } catch (error) {
      console.error('Error saving prompt:', error);
      showToast('프롬프트 저장에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleActivatePrompt = async (promptId: string) => {
    try {
      setLoading(true);
      
      // Deactivate all prompts
      await supabase
        .from('ai_prompts')
        .update({ is_active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Activate selected prompt
      const { error: activateError } = await supabase
        .from('ai_prompts')
        .update({ is_active: true })
        .eq('id', promptId);
      
      if (activateError) throw activateError;
      
      // Update settings
      const { error: settingsError } = await supabase
        .from('ai_settings')
        .update({ active_prompt_id: promptId })
        .eq('id', 1);
      
      if (settingsError) throw settingsError;
      
      showToast('프롬프트가 활성화되었습니다.');
      await loadData();
    } catch (error) {
      console.error('Error activating prompt:', error);
      showToast('프롬프트 활성화에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePrompts = async () => {
    if (selectedPrompts.size === 0) return;
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('ai_prompts')
        .delete()
        .in('id', Array.from(selectedPrompts));
      
      if (error) throw error;
      
      showToast(`${selectedPrompts.size}개의 프롬프트가 삭제되었습니다.`);
      setSelectedPrompts(new Set());
      setShowDeleteConfirm(false);
      await loadData();
    } catch (error) {
      console.error('Error deleting prompts:', error);
      showToast('프롬프트 삭제에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApiKey = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('ai_settings')
        .update({ openai_api_key: tempApiKey })
        .eq('id', 1);
      
      if (error) throw error;
      
      showToast('API Key가 저장되었습니다.');
      setEditingApiKey(false);
      setTempApiKey('');
      await loadData();
    } catch (error) {
      console.error('Error saving API key:', error);
      showToast('API Key 저장에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const togglePromptSelection = (id: string) => {
    const newSet = new Set(selectedPrompts);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedPrompts(newSet);
  };

  const selectAllPrompts = () => {
    setSelectedPrompts(new Set(filteredPrompts.map(p => p.id)));
  };

  const deselectAllPrompts = () => {
    setSelectedPrompts(new Set());
  };

  if (loading && !settings) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">AI 설정</h2>
        <div className="card p-6 text-center text-slate-600">
          로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">AI 설정</h2>
        <button className="btn btn-outline" onClick={() => router.push('/admin/dashboard')}>
          ← 대시보드
        </button>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex border-b">
          <button
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'prompts'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => setActiveTab('prompts')}
          >
            리포트 생성 프롬프트 관리
          </button>
          <button
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'apikey'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => setActiveTab('apikey')}
          >
            OpenAI API Key 설정
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'prompts' && (
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex items-center justify-between gap-4">
                <input
                  type="text"
                  placeholder="제목 또는 설명으로 검색..."
                  className="input flex-1 max-w-md"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="flex gap-2">
                  <button className="btn btn-outline text-sm" onClick={selectAllPrompts}>
                    전체 선택
                  </button>
                  <button className="btn btn-outline text-sm" onClick={deselectAllPrompts}>
                    선택 해제
                  </button>
                  <button 
                    className="btn btn-outline text-sm text-red-600" 
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={selectedPrompts.size === 0}
                  >
                    삭제 ({selectedPrompts.size})
                  </button>
                  <button className="btn btn-primary text-sm" onClick={handleCreatePrompt}>
                    + 새 프롬프트
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="text-left text-slate-600">
                      <th className="py-2 px-4">선택</th>
                      <th className="py-2 px-4">프롬프트명</th>
                      <th className="py-2 px-4">설명</th>
                      <th className="py-2 px-4">업데이트일</th>
                      <th className="py-2 px-4">상태</th>
                      <th className="py-2 px-4 text-right">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrompts.map((prompt) => (
                      <tr key={prompt.id} className="border-t">
                        <td className="py-2 px-4">
                          <input
                            type="checkbox"
                            checked={selectedPrompts.has(prompt.id)}
                            onChange={() => togglePromptSelection(prompt.id)}
                          />
                        </td>
                        <td className="py-2 px-4 font-medium">{prompt.title}</td>
                        <td className="py-2 px-4 text-slate-600">
                          {prompt.description ? (
                            prompt.description.length > 50
                              ? prompt.description.substring(0, 50) + '...'
                              : prompt.description
                          ) : '-'}
                        </td>
                        <td className="py-2 px-4 text-slate-600">
                          {new Date(prompt.updated_at).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="py-2 px-4">
                          {prompt.is_active ? (
                            <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
                              활성화됨
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                              비활성
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-right space-x-2">
                          {!prompt.is_active && (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => handleActivatePrompt(prompt.id)}
                            >
                              적용
                            </button>
                          )}
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleEditPrompt(prompt)}
                          >
                            수정
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {filteredPrompts.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    프롬프트를 추가하세요
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'apikey' && (
            <div className="space-y-4">
              {!settings?.openai_api_key && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-yellow-800">
                  ⚠️ API Key가 설정되어야 리포트 생성이 가능합니다.
                </div>
              )}

              <div className="space-y-2">
                <label className="block font-medium">OpenAI API Key</label>
                {editingApiKey ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      className="input w-full"
                      value={tempApiKey}
                      onChange={(e) => setTempApiKey(e.target.value)}
                      placeholder="sk-..."
                    />
                    <div className="flex gap-2">
                      <button className="btn btn-primary" onClick={handleSaveApiKey}>
                        저장
                      </button>
                      <button className="btn btn-outline" onClick={() => {
                        setEditingApiKey(false);
                        setTempApiKey('');
                      }}>
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      className="input w-full"
                      value={settings?.openai_api_key 
                        ? (apiKeyMasked ? '••••••••••••••••' : settings.openai_api_key)
                        : '(설정되지 않음)'
                      }
                      readOnly
                    />
                    {settings?.openai_api_key && (
                      <button
                        className="btn btn-outline"
                        onClick={() => setApiKeyMasked(!apiKeyMasked)}
                      >
                        {apiKeyMasked ? '보기' : '숨기기'}
                      </button>
                    )}
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setEditingApiKey(true);
                        setTempApiKey(settings?.openai_api_key || '');
                      }}
                    >
                      수정
                    </button>
                  </div>
                )}
              </div>

              <div className="text-sm text-slate-600 bg-slate-50 p-4 rounded">
                <p className="font-semibold mb-2">사용 방법:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>OpenAI 플랫폼에서 API Key를 발급받으세요</li>
                  <li>위 입력창에 API Key를 입력하고 저장하세요</li>
                  <li>'리포트 생성 프롬프트 관리' 탭에서 프롬프트를 활성화하세요</li>
                  <li>사용자가 설문을 완료하면 AI가 자동으로 리포트를 생성합니다</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Prompt Modal */}
      {showPromptModal && editingPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">
                {editingPrompt.id ? '프롬프트 수정' : '새 프롬프트'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block font-medium mb-1">제목</label>
                <input
                  type="text"
                  className="input w-full"
                  value={editingPrompt.title}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-medium mb-1">설명</label>
                <input
                  type="text"
                  className="input w-full"
                  value={editingPrompt.description || ''}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, description: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-medium mb-1">프롬프트 내용</label>
                <textarea
                  className="input w-full"
                  rows={12}
                  value={editingPrompt.content}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, content: e.target.value })}
                />
              </div>
            </div>
            <div className="p-6 border-t flex gap-2 justify-end">
              <button className="btn btn-outline" onClick={() => {
                setShowPromptModal(false);
                setEditingPrompt(null);
              }}>
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSavePrompt}
                disabled={!editingPrompt.title || !editingPrompt.content}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4">삭제 확인</h3>
            <p className="text-slate-600 mb-6">
              선택한 {selectedPrompts.size}개의 프롬프트를 삭제하시겠습니까?
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-outline" onClick={() => setShowDeleteConfirm(false)}>
                취소
              </button>
              <button className="btn btn-primary bg-red-600 hover:bg-red-700" onClick={handleDeletePrompts}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded shadow-lg ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        } text-white z-50`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
