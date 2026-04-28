"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiPreviewPrompts } from "@/lib/api";
import type { PromptPreview } from "@/lib/openai";
import type { SubKey } from "@/lib/supabase";

// ── 타입 ──────────────────────────────────────────────
type SystemPrompt = {
  id: string;
  title: string;
  description: string | null;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type PromptSection = {
  id: string;
  title: string;
  section_key: string;
  description: string | null;
  content: string;
  is_active: boolean;
  show_as_card: boolean;
  sort_order: number;
  sub_keys: SubKey[];
  created_at: string;
  updated_at: string;
};

type AISettings = {
  id: number;
  openai_api_key: string | null;
  tavily_api_key: string | null;
  active_prompt_id: string | null;
};

// ── 메인 컴포넌트 ──────────────────────────────────────
export default function AISettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'system' | 'sections' | 'apikey' | 'preview'>('system');

  // 공통
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 시스템 프롬프트
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([]);
  const [selectedSystemIds, setSelectedSystemIds] = useState<Set<string>>(new Set());
  const [systemSearch, setSystemSearch] = useState('');
  const [showSystemModal, setShowSystemModal] = useState(false);
  const [editingSystem, setEditingSystem] = useState<SystemPrompt | null>(null);
  const [showSystemDeleteConfirm, setShowSystemDeleteConfirm] = useState(false);

  // 사용자 프롬프트 섹션
  const [sections, setSections] = useState<PromptSection[]>([]);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState<PromptSection | null>(null);
  const [showSectionDeleteConfirm, setShowSectionDeleteConfirm] = useState(false);
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null);
  const subKeyLabelRef = useRef<HTMLInputElement>(null);
  const subKeyKeyRef = useRef<HTMLInputElement>(null);

  // 프롬프트 미리보기
  const [previewUserId, setPreviewUserId] = useState('');
  const [previewResult, setPreviewResult] = useState<PromptPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewActiveSection, setPreviewActiveSection] = useState<'system' | 'user'>('system');

  // API Keys
  const [apiKeyMasked, setApiKeyMasked] = useState(true);
  const [editingApiKey, setEditingApiKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

  const [tavilyKeyMasked, setTavilyKeyMasked] = useState(true);
  const [editingTavilyKey, setEditingTavilyKey] = useState(false);
  const [tempTavilyKey, setTempTavilyKey] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') { router.replace('/'); return; }
    loadAll();
  }, [user, router]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: s }, { data: p }, { data: sec }] = await Promise.all([
        supabase.from('ai_settings').select('*').eq('id', 1).single(),
        supabase.from('ai_prompts').select('*').order('updated_at', { ascending: false }),
        supabase.from('ai_prompt_sections').select('*').order('sort_order', { ascending: true }),
      ]);
      setSettings(s);
      setSystemPrompts(p || []);
      setSections(sec || []);
    } catch (e) {
      showToast('데이터 로드 실패', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── 시스템 프롬프트 ───────────────────────────────────
  const filteredSystem = systemPrompts.filter(p =>
    p.title.toLowerCase().includes(systemSearch.toLowerCase()) ||
    (p.description ?? '').toLowerCase().includes(systemSearch.toLowerCase())
  );

  const handleActivateSystem = async (id: string) => {
    setLoading(true);
    try {
      await supabase.from('ai_prompts').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('ai_prompts').update({ is_active: true }).eq('id', id);
      await supabase.from('ai_settings').update({ active_prompt_id: id }).eq('id', 1);
      showToast('시스템 프롬프트가 활성화되었습니다.');
      await loadAll();
    } catch { showToast('활성화 실패', 'error'); } finally { setLoading(false); }
  };

  const handleSaveSystem = async () => {
    if (!editingSystem) return;
    setLoading(true);
    try {
      if (editingSystem.id) {
        await supabase.from('ai_prompts').update({
          title: editingSystem.title,
          description: editingSystem.description,
          content: editingSystem.content,
        }).eq('id', editingSystem.id);
        showToast('수정되었습니다.');
      } else {
        await supabase.from('ai_prompts').insert({
          title: editingSystem.title,
          description: editingSystem.description,
          content: editingSystem.content,
          is_active: false,
        });
        showToast('생성되었습니다.');
      }
      setShowSystemModal(false);
      setEditingSystem(null);
      await loadAll();
    } catch { showToast('저장 실패', 'error'); } finally { setLoading(false); }
  };

  const handleDeleteSystems = async () => {
    setLoading(true);
    try {
      await supabase.from('ai_prompts').delete().in('id', Array.from(selectedSystemIds));
      showToast(`${selectedSystemIds.size}개 삭제되었습니다.`);
      setSelectedSystemIds(new Set());
      setShowSystemDeleteConfirm(false);
      await loadAll();
    } catch { showToast('삭제 실패', 'error'); } finally { setLoading(false); }
  };

  const toggleSystemSelect = (id: string) => {
    const next = new Set(selectedSystemIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedSystemIds(next);
  };

  // ── 사용자 프롬프트 섹션 ──────────────────────────────
  const handleToggleSectionActive = async (section: PromptSection) => {
    setLoading(true);
    try {
      await supabase.from('ai_prompt_sections')
        .update({ is_active: !section.is_active })
        .eq('id', section.id);
      showToast(section.is_active ? '비활성화되었습니다.' : '활성화되었습니다.');
      await loadAll();
    } catch { showToast('변경 실패', 'error'); } finally { setLoading(false); }
  };

  const handleToggleShowAsCard = async (section: PromptSection) => {
    setLoading(true);
    try {
      await supabase.from('ai_prompt_sections')
        .update({ show_as_card: !section.show_as_card })
        .eq('id', section.id);
      showToast(!section.show_as_card ? '카드로 표시됩니다.' : '카드 표시를 숨겼습니다.');
      await loadAll();
    } catch { showToast('변경 실패', 'error'); } finally { setLoading(false); }
  };

  const handleMoveSectionOrder = async (section: PromptSection, direction: 'up' | 'down') => {
    const sorted = [...sections].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(s => s.id === section.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const swapTarget = sorted[swapIdx];
    setLoading(true);
    try {
      await Promise.all([
        supabase.from('ai_prompt_sections').update({ sort_order: swapTarget.sort_order }).eq('id', section.id),
        supabase.from('ai_prompt_sections').update({ sort_order: section.sort_order }).eq('id', swapTarget.id),
      ]);
      await loadAll();
    } catch { showToast('순서 변경 실패', 'error'); } finally { setLoading(false); }
  };

  const handleSaveSection = async () => {
    if (!editingSection) return;
    if (!editingSection.title.trim() || !editingSection.section_key.trim() || !editingSection.content.trim()) {
      showToast('섹션명, 키, 프롬프트 내용은 필수입니다.', 'error');
      return;
    }
    setLoading(true);
    try {
      if (editingSection.id) {
        await supabase.from('ai_prompt_sections').update({
          title: editingSection.title,
          section_key: editingSection.section_key,
          description: editingSection.description,
          content: editingSection.content,
          sub_keys: editingSection.sub_keys,
        }).eq('id', editingSection.id);
        showToast('수정되었습니다.');
      } else {
        const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.sort_order)) + 1 : 0;
        await supabase.from('ai_prompt_sections').insert({
          title: editingSection.title,
          section_key: editingSection.section_key,
          description: editingSection.description,
          content: editingSection.content,
          sub_keys: editingSection.sub_keys,
          is_active: false,
          sort_order: maxOrder,
        });
        showToast('섹션이 추가되었습니다.');
      }
      setShowSectionModal(false);
      setEditingSection(null);
      await loadAll();
    } catch (e: any) {
      showToast(e?.message?.includes('unique') ? '이미 사용 중인 섹션 키입니다.' : '저장 실패', 'error');
    } finally { setLoading(false); }
  };

  const handleDeleteSection = async () => {
    if (!deletingSectionId) return;
    setLoading(true);
    try {
      await supabase.from('ai_prompt_sections').delete().eq('id', deletingSectionId);
      showToast('삭제되었습니다.');
      setShowSectionDeleteConfirm(false);
      setDeletingSectionId(null);
      await loadAll();
    } catch { showToast('삭제 실패', 'error'); } finally { setLoading(false); }
  };

  // ── 프롬프트 미리보기 ──────────────────────────────────
  const handlePreview = async () => {
    if (!previewUserId.trim()) return;
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewResult(null);
    try {
      const result = await apiPreviewPrompts(previewUserId.trim());
      setPreviewResult(result);
    } catch (e: any) {
      setPreviewError(e?.message || '미리보기 실패');
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── API Key ──────────────────────────────────────────
  const handleSaveApiKey = async () => {
    setLoading(true);
    try {
      await supabase.from('ai_settings').update({ openai_api_key: tempApiKey }).eq('id', 1);
      showToast('API Key가 저장되었습니다.');
      setEditingApiKey(false);
      setTempApiKey('');
      await loadAll();
    } catch { showToast('저장 실패', 'error'); } finally { setLoading(false); }
  };

  const handleSaveTavilyKey = async () => {
    setLoading(true);
    try {
      await supabase.from('ai_settings').update({ tavily_api_key: tempTavilyKey }).eq('id', 1);
      showToast('Tavily API Key가 저장되었습니다.');
      setEditingTavilyKey(false);
      setTempTavilyKey('');
      await loadAll();
    } catch { showToast('저장 실패', 'error'); } finally { setLoading(false); }
  };

  if (loading && !settings) {
    return <div className="card p-6 text-center text-slate-600">로딩 중...</div>;
  }

  const activeSections = sections.filter(s => s.is_active);

  return (
    <div className="space-y-4">
      <button className="btn btn-outline w-fit" onClick={() => router.push('/admin/dashboard')}>← 대시보드로</button>
      <h2 className="text-xl font-semibold">AI 설정</h2>

      <div className="card">
        {/* 탭 */}
        <div className="flex border-b">
          {([
            ['system', '시스템 프롬프트'],
            ['sections', `사용자 프롬프트 항목 (${activeSections.length}개 활성)`],
            ['preview', '프롬프트 미리보기'],
            ['apikey', 'OpenRouter API Key'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ── 시스템 프롬프트 탭 ── */}
          {activeTab === 'system' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                AI의 역할과 응답 방식을 정의하는 프롬프트입니다. 1개만 활성화됩니다.
              </div>
              <div className="flex items-center justify-between gap-4">
                <input
                  type="text"
                  placeholder="제목 또는 설명으로 검색..."
                  className="input flex-1 max-w-md"
                  value={systemSearch}
                  onChange={e => setSystemSearch(e.target.value)}
                />
                <div className="flex gap-2">
                  {selectedSystemIds.size > 0 && (
                    <button className="btn btn-outline text-sm text-red-600"
                      onClick={() => setShowSystemDeleteConfirm(true)}>
                      삭제 ({selectedSystemIds.size})
                    </button>
                  )}
                  <button className="btn btn-primary text-sm"
                    onClick={() => {
                      setEditingSystem({ id: '', title: '', description: '', content: '', is_active: false, created_at: '', updated_at: '' });
                      setShowSystemModal(true);
                    }}>
                    + 새 시스템 프롬프트
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-slate-600">
                      <th className="py-2 px-4">선택</th>
                      <th className="py-2 px-4">제목</th>
                      <th className="py-2 px-4">설명</th>
                      <th className="py-2 px-4">업데이트일</th>
                      <th className="py-2 px-4">상태</th>
                      <th className="py-2 px-4 text-right">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSystem.map(p => (
                      <tr key={p.id} className="border-t hover:bg-slate-50">
                        <td className="py-2 px-4">
                          <input type="checkbox" checked={selectedSystemIds.has(p.id)}
                            onChange={() => toggleSystemSelect(p.id)} />
                        </td>
                        <td className="py-2 px-4 font-medium">{p.title}</td>
                        <td className="py-2 px-4 text-slate-500 max-w-xs truncate">
                          {p.description ? (p.description.length > 50 ? p.description.slice(0, 50) + '...' : p.description) : '-'}
                        </td>
                        <td className="py-2 px-4 text-slate-500">
                          {new Date(p.updated_at).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="py-2 px-4">
                          {p.is_active
                            ? <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">활성화됨</span>
                            : <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-xs">비활성</span>}
                        </td>
                        <td className="py-2 px-4 text-right space-x-2">
                          {!p.is_active && (
                            <button className="btn btn-outline btn-sm" onClick={() => handleActivateSystem(p.id)}>적용</button>
                          )}
                          <button className="btn btn-outline btn-sm" onClick={() => { setEditingSystem(p); setShowSystemModal(true); }}>수정</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredSystem.length === 0 && (
                  <div className="text-center py-10 text-slate-400">시스템 프롬프트를 추가하세요</div>
                )}
              </div>
            </div>
          )}

          {/* ── 사용자 프롬프트 항목 탭 ── */}
          {activeTab === 'sections' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                보고서에 포함할 항목별 프롬프트를 관리합니다. 활성화된 항목들이 순서대로 조합되어 AI에게 전달됩니다.
                현재 <strong>{activeSections.length}개</strong> 항목이 활성화되어 있습니다.
              </div>

              <div className="flex justify-end">
                <button className="btn btn-primary text-sm"
                  onClick={() => {
                    setEditingSection({ id: '', title: '', section_key: '', description: '', content: '', is_active: false, show_as_card: true, sort_order: 0, sub_keys: [], created_at: '', updated_at: '' });
                    setShowSectionModal(true);
                  }}>
                  + 새 항목 추가
                </button>
              </div>

              {sections.length === 0 ? (
                <div className="text-center py-10 text-slate-400">항목을 추가하세요</div>
              ) : (
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-slate-600">
                        <th className="py-2 px-4 w-16">순서</th>
                        <th className="py-2 px-4">항목명</th>
                        <th className="py-2 px-4">섹션 키</th>
                        <th className="py-2 px-4">하위 키</th>
                        <th className="py-2 px-4 w-24 text-center">보고서 포함</th>
                        <th className="py-2 px-4 w-24 text-center">카드 표시</th>
                        <th className="py-2 px-4 text-right">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...sections].sort((a, b) => a.sort_order - b.sort_order).map((s, idx, arr) => (
                        <tr key={s.id} className={`border-t ${s.is_active ? 'bg-green-50' : 'hover:bg-slate-50'}`}>
                          <td className="py-2 px-4">
                            <div className="flex gap-1">
                              <button className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                disabled={idx === 0 || loading}
                                onClick={() => handleMoveSectionOrder(s, 'up')}>▲</button>
                              <button className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                disabled={idx === arr.length - 1 || loading}
                                onClick={() => handleMoveSectionOrder(s, 'down')}>▼</button>
                            </div>
                          </td>
                          <td className="py-2 px-4 font-medium">{s.title}</td>
                          <td className="py-2 px-4">
                            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{s.section_key}</code>
                          </td>
                          <td className="py-2 px-4">
                            {(s.sub_keys ?? []).length === 0 ? (
                              <span className="text-slate-300 text-xs">-</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {(s.sub_keys ?? []).map(sk => (
                                  <span key={sk.key} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 rounded px-1.5 py-0.5">
                                    <span>{sk.label}</span>
                                    <code className="text-indigo-400">·{sk.key}</code>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-4 text-center">
                            <button
                              onClick={() => handleToggleSectionActive(s)}
                              disabled={loading}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                s.is_active ? 'bg-blue-500' : 'bg-slate-300'
                              }`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                s.is_active ? 'translate-x-6' : 'translate-x-1'
                              }`} />
                            </button>
                          </td>
                          <td className="py-2 px-4 text-center">
                            <button
                              onClick={() => handleToggleShowAsCard(s)}
                              disabled={loading || !s.is_active}
                              title={!s.is_active ? '비활성 섹션은 카드 표시 불가' : ''}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                s.show_as_card && s.is_active ? 'bg-indigo-500' : 'bg-slate-300'
                              }`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                s.show_as_card && s.is_active ? 'translate-x-6' : 'translate-x-1'
                              }`} />
                            </button>
                          </td>
                          <td className="py-2 px-4 text-right space-x-2">
                            <button className="btn btn-outline btn-sm"
                              onClick={() => { setEditingSection({ ...s, sub_keys: s.sub_keys ?? [] }); setShowSectionModal(true); }}>
                              수정
                            </button>
                            <button className="btn btn-sm bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                              onClick={() => { setDeletingSectionId(s.id); setShowSectionDeleteConfirm(true); }}>
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── 프롬프트 미리보기 탭 ── */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded p-3 text-sm text-purple-800">
                특정 사용자의 설문 응답이 AI에게 어떻게 전달되는지 실제 프롬프트를 확인합니다. OpenAI 호출 없이 미리보기만 합니다.
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="사용자 이메일 입력 (예: user@example.com)"
                  value={previewUserId}
                  onChange={e => setPreviewUserId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePreview()}
                />
                <button
                  className="btn btn-primary"
                  onClick={handlePreview}
                  disabled={previewLoading || !previewUserId.trim()}
                >
                  {previewLoading ? '로딩 중...' : '미리보기'}
                </button>
              </div>

              {previewError && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                  {previewError}
                </div>
              )}

              {previewResult && (
                <div className="space-y-4">
                  {/* 통계 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 border rounded p-3 text-center">
                      <div className="text-2xl font-bold text-blue-600">{previewResult.preAnswerCount}</div>
                      <div className="text-xs text-slate-500 mt-1">사전 설문 응답 수</div>
                    </div>
                    <div className="bg-slate-50 border rounded p-3 text-center">
                      <div className="text-2xl font-bold text-green-600">{previewResult.mainAnswerCount}</div>
                      <div className="text-xs text-slate-500 mt-1">본 설문 응답 수</div>
                    </div>
                    <div className="bg-slate-50 border rounded p-3 text-center">
                      <div className="text-2xl font-bold text-purple-600">{previewResult.sectionKeys.length}</div>
                      <div className="text-xs text-slate-500 mt-1">활성 섹션 수</div>
                    </div>
                  </div>

                  {/* 활성 섹션 키 목록 */}
                  {previewResult.sectionKeys.length > 0 && (
                    <div className="text-sm text-slate-600">
                      <span className="font-medium">섹션: </span>
                      {previewResult.sectionKeys.map(k => (
                        <code key={k} className="bg-slate-100 px-1.5 py-0.5 rounded text-xs mr-1">{k}</code>
                      ))}
                    </div>
                  )}

                  {/* 탭 전환 */}
                  <div className="flex gap-2 border-b">
                    {(['system', 'user'] as const).map(tab => (
                      <button
                        key={tab}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          previewActiveSection === tab
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                        onClick={() => setPreviewActiveSection(tab)}
                      >
                        {tab === 'system' ? `시스템 프롬프트 (${previewResult.systemPrompt.length}자)` : `사용자 프롬프트 (${previewResult.userPrompt.length}자)`}
                      </button>
                    ))}
                  </div>

                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-auto max-h-[500px] whitespace-pre-wrap leading-relaxed">
                    {previewActiveSection === 'system' ? previewResult.systemPrompt : previewResult.userPrompt}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* ── API Key 탭 ── */}
          {activeTab === 'apikey' && (
            <div className="space-y-4">
              {!settings?.openai_api_key && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-yellow-800">
                  ⚠️ API Key가 설정되어야 리포트 생성이 가능합니다.
                </div>
              )}
              <div className="space-y-2">
                <label className="block font-medium">OpenRouter API Key</label>
                {editingApiKey ? (
                  <div className="space-y-2">
                    <input type="text" className="input w-full" value={tempApiKey}
                      onChange={e => setTempApiKey(e.target.value)} placeholder="sk-or-..." />
                    <div className="flex gap-2">
                      <button className="btn btn-primary" onClick={handleSaveApiKey}>저장</button>
                      <button className="btn btn-outline" onClick={() => { setEditingApiKey(false); setTempApiKey(''); }}>취소</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="text" className="input w-full" readOnly
                      value={settings?.openai_api_key ? (apiKeyMasked ? '••••••••••••••••' : settings.openai_api_key) : '(설정되지 않음)'} />
                    {settings?.openai_api_key && (
                      <button className="btn btn-outline" onClick={() => setApiKeyMasked(!apiKeyMasked)}>
                        {apiKeyMasked ? '보기' : '숨기기'}
                      </button>
                    )}
                    <button className="btn btn-primary" onClick={() => { setEditingApiKey(true); setTempApiKey(settings?.openai_api_key || ''); }}>수정</button>
                  </div>
                )}
              </div>

              {/* Tavily API Key */}
              <div className="space-y-2 pt-4 border-t">
                <label className="block font-medium">Tavily API Key
                  <span className="ml-2 text-xs font-normal text-slate-400">커리어 가이드 실시간 채용 검색용</span>
                </label>
                {!settings?.tavily_api_key && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 text-blue-700 text-sm">
                    설정하면 커리어 가이드 섹션에서 실시간 채용 공고 데이터를 반영합니다.
                  </div>
                )}
                {editingTavilyKey ? (
                  <div className="space-y-2">
                    <input type="text" className="input w-full" value={tempTavilyKey}
                      onChange={e => setTempTavilyKey(e.target.value)} placeholder="tvly-..." />
                    <div className="flex gap-2">
                      <button className="btn btn-primary" onClick={handleSaveTavilyKey}>저장</button>
                      <button className="btn btn-outline" onClick={() => { setEditingTavilyKey(false); setTempTavilyKey(''); }}>취소</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="text" className="input w-full" readOnly
                      value={settings?.tavily_api_key ? (tavilyKeyMasked ? '••••••••••••••••' : settings.tavily_api_key) : '(설정되지 않음)'} />
                    {settings?.tavily_api_key && (
                      <button className="btn btn-outline" onClick={() => setTavilyKeyMasked(!tavilyKeyMasked)}>
                        {tavilyKeyMasked ? '보기' : '숨기기'}
                      </button>
                    )}
                    <button className="btn btn-primary" onClick={() => { setEditingTavilyKey(true); setTempTavilyKey(settings?.tavily_api_key || ''); }}>수정</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 시스템 프롬프트 모달 ── */}
      {showSystemModal && editingSystem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">{editingSystem.id ? '시스템 프롬프트 수정' : '새 시스템 프롬프트'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block font-medium mb-1">제목 <span className="text-red-500">*</span></label>
                <input type="text" className="input w-full" value={editingSystem.title}
                  onChange={e => setEditingSystem({ ...editingSystem, title: e.target.value })} />
              </div>
              <div>
                <label className="block font-medium mb-1">설명</label>
                <input type="text" className="input w-full" value={editingSystem.description || ''}
                  onChange={e => setEditingSystem({ ...editingSystem, description: e.target.value })} />
              </div>
              <div>
                <label className="block font-medium mb-1">프롬프트 내용 <span className="text-red-500">*</span></label>
                <textarea className="input w-full" rows={12} value={editingSystem.content}
                  onChange={e => setEditingSystem({ ...editingSystem, content: e.target.value })} />
              </div>
            </div>
            <div className="p-6 border-t flex gap-2 justify-end">
              <button className="btn btn-outline" onClick={() => { setShowSystemModal(false); setEditingSystem(null); }}>취소</button>
              <button className="btn btn-primary" onClick={handleSaveSystem}
                disabled={!editingSystem.title || !editingSystem.content || loading}>
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 섹션 모달 ── */}
      {showSectionModal && editingSection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">{editingSection.id ? '항목 수정' : '새 항목 추가'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block font-medium mb-1">항목명 <span className="text-red-500">*</span></label>
                <input type="text" className="input w-full" placeholder="예: 성격 특성 분석"
                  value={editingSection.title}
                  onChange={e => setEditingSection({ ...editingSection, title: e.target.value })} />
              </div>
              <div>
                <label className="block font-medium mb-1">
                  섹션 키 <span className="text-red-500">*</span>
                  <span className="text-xs text-slate-500 ml-2">영문·숫자·언더스코어만 사용, 고유해야 함</span>
                </label>
                <input type="text" className="input w-full font-mono" placeholder="예: personality_traits"
                  value={editingSection.section_key}
                  onChange={e => setEditingSection({ ...editingSection, section_key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                  disabled={!!editingSection.id} />
                {editingSection.id && (
                  <p className="text-xs text-slate-400 mt-1">섹션 키는 수정할 수 없습니다.</p>
                )}
              </div>
              <div>
                <label className="block font-medium mb-1">설명 (관리자용)</label>
                <input type="text" className="input w-full" placeholder="이 항목에 대한 간단한 설명"
                  value={editingSection.description || ''}
                  onChange={e => setEditingSection({ ...editingSection, description: e.target.value })} />
              </div>
              <div>
                <label className="block font-medium mb-1">
                  프롬프트 내용 <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  이 항목에 대해 AI에게 전달할 지시 내용을 작성하세요.
                  설문 응답 전체는 자동으로 함께 전달됩니다.
                </p>
                <textarea className="input w-full" rows={10} value={editingSection.content}
                  onChange={e => setEditingSection({ ...editingSection, content: e.target.value })}
                  placeholder="예: 사용자의 에니어그램 유형을 분석하고 핵심 성격 특성을 3-5문장으로 설명해주세요." />
              </div>

              {/* 하위 키 관리 */}
              <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
                <div>
                  <label className="block font-medium text-sm mb-0.5">하위 키 (선택사항)</label>
                  <p className="text-xs text-slate-500">
                    섹션을 여러 항목으로 분리하면 AI가 각 항목별로 구조화된 내용을 생성합니다.
                  </p>
                </div>

                {editingSection.sub_keys.length > 0 && (
                  <div className="space-y-2">
                    {editingSection.sub_keys.map((sk, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-white rounded border text-sm">
                        <span className="flex-1 font-medium">{sk.label}</span>
                        <code className="text-xs bg-slate-100 border px-1.5 py-0.5 rounded text-slate-600">{sk.key}</code>
                        <button
                          type="button"
                          className="text-red-400 hover:text-red-600 text-xs px-1"
                          onClick={() => setEditingSection({
                            ...editingSection,
                            sub_keys: editingSection.sub_keys.filter((_, j) => j !== i),
                          })}
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">레이블 (표시용)</label>
                    <input
                      ref={subKeyLabelRef}
                      type="text"
                      className="input w-full text-sm"
                      placeholder="예: 핵심 근거"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">키 (영문)</label>
                    <input
                      ref={subKeyKeyRef}
                      type="text"
                      className="input w-full text-sm font-mono"
                      placeholder="예: evidence"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline text-sm"
                    onClick={() => {
                      const label = subKeyLabelRef.current?.value.trim() ?? '';
                      const rawKey = subKeyKeyRef.current?.value.trim() ?? '';
                      const key = rawKey.replace(/[^a-zA-Z0-9_]/g, '');
                      if (!label || !key) return;
                      setEditingSection(prev => prev ? { ...prev, sub_keys: [...prev.sub_keys, { label, key }] } : prev);
                      if (subKeyLabelRef.current) subKeyLabelRef.current.value = '';
                      if (subKeyKeyRef.current) subKeyKeyRef.current.value = '';
                    }}
                  >
                    + 추가
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex gap-2 justify-end">
              <button className="btn btn-outline" onClick={() => { setShowSectionModal(false); setEditingSection(null); }}>취소</button>
              <button className="btn btn-primary" onClick={handleSaveSection}
                disabled={!editingSection.title || !editingSection.section_key || !editingSection.content || loading}>
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 시스템 프롬프트 삭제 확인 ── */}
      {showSystemDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">삭제 확인</h3>
            <p className="text-slate-600 mb-6">선택한 {selectedSystemIds.size}개의 프롬프트를 삭제하시겠습니까?</p>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-outline" onClick={() => setShowSystemDeleteConfirm(false)}>취소</button>
              <button className="btn bg-red-600 text-white hover:bg-red-700" onClick={handleDeleteSystems}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 섹션 삭제 확인 ── */}
      {showSectionDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">항목 삭제 확인</h3>
            <p className="text-slate-600 mb-6">이 항목을 삭제하시겠습니까?</p>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-outline" onClick={() => { setShowSectionDeleteConfirm(false); setDeletingSectionId(null); }}>취소</button>
              <button className="btn bg-red-600 text-white hover:bg-red-700" onClick={handleDeleteSection}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 토스트 ── */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded shadow-lg text-white z-50 ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
