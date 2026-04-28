import { supabase } from '../supabase';
import { TYPES } from '../enneagram-data';
import {
  replacePlaceholders,
  formatPreSurveyResponses,
  formatMainSurveyResponses,
} from '../openai';
import type { ReportSection } from '../openai';

export type ProgressCallback = (step: string, pct: number) => void;

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const CLASSIFIER_MODEL = 'claude-haiku-4-5-20251001';
const WRITER_MODEL = 'claude-haiku-4-5-20251001';

async function callClaude(
  apiKey: string,
  options: {
    model: string;
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    max_tokens: number;
    temperature?: number;
  }
): Promise<string> {
  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: options.max_tokens,
      temperature: options.temperature ?? 0.5,
      ...(options.system ? { system: options.system } : {}),
      messages: options.messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Claude API 오류: ${response.status} ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? '';
}

// ── 1단계: 유형 분류 에이전트 ────────────────────────────────────────────────
async function runTypeClassifier(
  apiKey: string,
  formattedPre: string,
  formattedMain: string
): Promise<{ typeNumber: number; typeName: string; evidence: string }> {
  const typeDescriptions = TYPES.map(
    t =>
      `유형 ${t.number} (${t.name}/${t.subtitle}): 핵심욕구-${t.coreDesire}, 핵심두려움-${t.coreFear}, 키워드-${t.keywords.join('·')}`
  ).join('\n');

  const prompt = `당신은 에니어그램 전문 심리 분석가입니다. 아래 설문 응답을 분석하여 사용자의 에니어그램 핵심 유형을 결정하세요.

## 에니어그램 9가지 유형
${typeDescriptions}

## 사전 설문 응답
${formattedPre}

## 본 설문 응답 (리커트 1=전혀아님, 6=매우그렇다)
${formattedMain}

---
응답 패턴을 종합 분석하여 가장 적합한 핵심 유형 하나를 결정하고, 아래 JSON 형식으로만 응답하세요. JSON 외 텍스트는 포함하지 마세요:
{
  "type_number": 숫자(1~9),
  "type_name": "유형명",
  "confidence": 확신도(0~100),
  "evidence": "이 유형으로 판단한 핵심 근거 (2~3문장)"
}`;

  const text = await callClaude(apiKey, {
    model: CLASSIFIER_MODEL,
    max_tokens: 400,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('유형 분류 실패: JSON 없음');

  const parsed = JSON.parse(jsonMatch[0]);
  const typeNum = Number(parsed.type_number);
  if (!typeNum || typeNum < 1 || typeNum > 9) throw new Error('유형 분류 실패: 유효하지 않은 번호');

  return {
    typeNumber: typeNum,
    typeName: parsed.type_name ?? TYPES.find(t => t.number === typeNum)?.name ?? '',
    evidence: parsed.evidence ?? '',
  };
}

// ── 2단계: 섹션 작성 에이전트 ────────────────────────────────────────────────
async function runSectionWriter(
  apiKey: string,
  section: {
    section_key: string;
    title: string;
    content: string;
    sub_keys?: { key: string; label: string }[];
  },
  typeContext: string,
  systemPrompt: string,
  formattedPre: string,
  formattedMain: string,
  userName: string,
  preAnswers: any[],
  mainAnswers: any[],
  preQuestions: any[],
  mainQuestions: any[]
): Promise<ReportSection> {
  const subKeys = section.sub_keys ?? [];
  const sectionContent = replacePlaceholders(
    section.content,
    formattedPre,
    formattedMain,
    preAnswers,
    mainAnswers,
    preQuestions,
    mainQuestions,
    userName
  );

  let jsonFormat: string;
  if (subKeys.length > 0) {
    const inner = subKeys.map(sk => `    "${sk.key}": "내용 (${sk.label})"`).join(',\n');
    jsonFormat = `{\n${inner}\n  }`;
  } else {
    jsonFormat = '"내용을 여기에 작성"';
  }

  const userMsg = `${typeContext}

---

## 작성할 항목: ${section.title}
${sectionContent}

## 사용자 사전 설문 응답
${formattedPre}

## 사용자 본 설문 응답
${formattedMain}

---
위 내용을 바탕으로 반드시 아래 JSON 형식으로만 응답해주세요. JSON 외 다른 텍스트는 포함하지 마세요:
{
  "${section.section_key}": ${jsonFormat}
}`;

  const text = await callClaude(apiKey, {
    model: WRITER_MODEL,
    system: systemPrompt,
    max_tokens: 1800,
    temperature: 0.5,
    messages: [{ role: 'user', content: userMsg }],
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { key: section.section_key, title: section.title, content: text };
  }

  let raw: any = '';
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    raw = parsed[section.section_key] ?? '';
  } catch {
    raw = text;
  }

  if (subKeys.length > 0 && raw && typeof raw === 'object') {
    return { key: section.section_key, title: section.title, content: raw as Record<string, string>, sub_keys: subKeys };
  }

  return {
    key: section.section_key,
    title: section.title,
    content: typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2),
    ...(subKeys.length > 0 ? { sub_keys: subKeys } : {}),
  };
}

// ── 메인 오케스트레이터 ───────────────────────────────────────────────────────
export async function generateReportWithAgents(
  userId: string,
  preAnswers: any[],
  mainAnswers: any[],
  onProgress?: ProgressCallback
): Promise<{ sections: ReportSection[] }> {
  onProgress?.('설문 데이터 준비 중...', 5);

  // 1. 설정 로드
  const { data: settingsData, error: settingsError } = await supabase
    .from('ai_settings')
    .select('openai_api_key, active_prompt_id')
    .eq('id', 1)
    .single();

  if (settingsError) throw new Error('AI 설정을 불러올 수 없습니다.');
  if (!settingsData?.openai_api_key) {
    throw new Error('Claude API Key가 설정되지 않았습니다. 관리자 설정에서 API Key를 등록해주세요.');
  }

  const apiKey = settingsData.openai_api_key;

  // 2. 시스템 프롬프트
  let systemPromptContent = '당신은 에니어그램 전문가입니다. 사용자의 설문 응답을 분석하여 상세한 리포트를 작성해주세요.';
  if (settingsData.active_prompt_id) {
    const { data: sp } = await supabase
      .from('ai_prompts')
      .select('content')
      .eq('id', settingsData.active_prompt_id)
      .single();
    if (sp?.content) systemPromptContent = sp.content;
  }

  // 3. 활성 섹션 목록
  const { data: sections, error: sectionsError } = await supabase
    .from('ai_prompt_sections')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (sectionsError) throw new Error('프롬프트 섹션을 불러올 수 없습니다.');
  if (!sections || sections.length === 0) {
    throw new Error('활성화된 프롬프트 항목이 없습니다. 관리자 설정에서 항목을 활성화해주세요.');
  }

  // 4. 사용자 정보 + 설문 문항 병렬 로드
  const [{ data: userData }, { data: preQuestions }, { data: mainQuestions }] = await Promise.all([
    supabase.from('users').select('name').eq('id', userId).single(),
    supabase.from('pre_survey_questions').select('*').order('sort_order', { ascending: true }),
    supabase.from('main_survey_questions').select('*').order('q_id'),
  ]);

  const userName = userData?.name ?? '';
  const preQList = preQuestions ?? [];
  const mainQList = mainQuestions ?? [];

  const formattedPre = formatPreSurveyResponses(preAnswers, preQList);
  const formattedMain = formatMainSurveyResponses(mainAnswers, mainQList);
  const finalSystemPrompt = replacePlaceholders(
    systemPromptContent, formattedPre, formattedMain, preAnswers, mainAnswers, preQList, mainQList, userName
  );

  // 5. 유형 분류 (Step 1 — deterministic, temperature=0)
  onProgress?.('에니어그램 유형 분석 중...', 20);

  let typeNumber = 1;
  let typeContext = '';

  try {
    const classified = await runTypeClassifier(apiKey, formattedPre, formattedMain);
    typeNumber = classified.typeNumber;
    const typeData = TYPES.find(t => t.number === typeNumber);
    typeContext = `[확정된 에니어그램 유형: ${typeNumber}번 ${typeData?.name ?? ''} (${typeData?.subtitle ?? ''})]
핵심 욕구: ${typeData?.coreDesire ?? ''}
핵심 두려움: ${typeData?.coreFear ?? ''}
분류 근거: ${classified.evidence}

이 유형에 기반하여 아래 섹션을 작성하세요. 유형을 임의로 변경하지 마세요.`;
  } catch (e) {
    console.error('[TypeClassifier] 실패, 기본값 사용:', e);
    typeContext = '[에니어그램 유형 분류 실패 - 설문 내용을 바탕으로 최선을 다해 작성하세요]';
  }

  // 6. 섹션 작성 (Step 2 — 병렬)
  onProgress?.('리포트 섹션 작성 중...', 40);

  const writableSections = sections.filter(s => s.section_key !== 'enneagram_type');
  const typeSectionDef = sections.find(s => s.section_key === 'enneagram_type');

  const sectionResults = await Promise.all(
    writableSections.map(s =>
      runSectionWriter(
        apiKey, s, typeContext, finalSystemPrompt,
        formattedPre, formattedMain, userName,
        preAnswers, mainAnswers, preQList, mainQList
      )
    )
  );

  onProgress?.('결과 정리 중...', 90);

  // 7. 섹션 순서 복원
  const finalSections: ReportSection[] = [];

  for (const section of sections) {
    if (section.section_key === 'enneagram_type') {
      finalSections.push({
        key: 'enneagram_type',
        title: typeSectionDef?.title ?? '에니어그램 유형',
        content: String(typeNumber),
      });
    } else {
      const result = sectionResults.find(r => r.key === section.section_key);
      if (result) finalSections.push(result);
    }
  }

  onProgress?.('완료!', 100);
  return { sections: finalSections };
}
