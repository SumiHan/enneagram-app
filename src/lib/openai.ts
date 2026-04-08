import { supabase } from "./supabase";

export type ReportSection = {
  key: string;
  title: string;
  content: string;
};

export type OpenAIReportResult = {
  sections: ReportSection[];
};

export async function generateReportWithOpenAI(
  userId: string,
  preAnswers: any[],
  mainAnswers: any[]
): Promise<OpenAIReportResult> {
  // 1. API Key 및 활성 시스템 프롬프트 로드
  const { data: settings, error: settingsError } = await supabase
    .from('ai_settings')
    .select('openai_api_key, active_prompt_id')
    .eq('id', 1)
    .single();

  if (settingsError) throw settingsError;

  if (!settings.openai_api_key) {
    throw new Error('OpenAI API Key가 설정되지 않았습니다. 관리자 설정에서 API Key를 등록해주세요.');
  }

  // 2. 시스템 프롬프트 로드
  let systemPromptContent = '당신은 에니어그램 전문가입니다. 사용자의 설문 응답을 분석하여 상세한 리포트를 작성해주세요.';
  if (settings.active_prompt_id) {
    const { data: systemPrompt } = await supabase
      .from('ai_prompts')
      .select('content')
      .eq('id', settings.active_prompt_id)
      .single();
    if (systemPrompt?.content) {
      systemPromptContent = systemPrompt.content;
    }
  }

  // 3. 활성 사용자 프롬프트 섹션 로드 (sort_order 순)
  const { data: sections, error: sectionsError } = await supabase
    .from('ai_prompt_sections')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (sectionsError) throw sectionsError;

  if (!sections || sections.length === 0) {
    throw new Error('활성화된 사용자 프롬프트 항목이 없습니다. 관리자 설정에서 항목을 활성화해주세요.');
  }

  // 4. 설문 문항 로드
  const { data: preQuestions } = await supabase
    .from('pre_survey_questions')
    .select('*')
    .order('sort_order', { ascending: true });

  const { data: mainQuestions } = await supabase
    .from('main_survey_questions')
    .select('*')
    .order('q_id');

  // 5. 설문 응답 포맷팅
  const formattedPre = formatPreSurveyResponses(preAnswers, preQuestions || []);
  const formattedMain = formatMainSurveyResponses(mainAnswers, mainQuestions || []);

  console.log('[OpenAI] formattedPre (first 500 chars):', formattedPre.slice(0, 500));
  console.log('[OpenAI] formattedMain (first 500 chars):', formattedMain.slice(0, 500));

  // 5-1. 시스템 프롬프트의 플레이스홀더 치환
  systemPromptContent = replacePlaceholders(
    systemPromptContent,
    formattedPre,
    formattedMain,
    preAnswers,
    mainAnswers,
    preQuestions || [],
    mainQuestions || []
  );

  // 6. 사용자 프롬프트 조합
  const sectionBlocks = sections
    .map(s => `### ${s.title}\n${replacePlaceholders(s.content, formattedPre, formattedMain, preAnswers, mainAnswers, preQuestions || [], mainQuestions || [])}`)
    .join('\n\n');

  const jsonFormat = sections
    .map(s => `  "${s.section_key}": "내용을 여기에 작성"`)
    .join(',\n');

  const userPrompt = `${sectionBlocks}

---

## 사전 설문 응답
${formattedPre}

## 본 설문 응답
${formattedMain}

---

위 내용을 바탕으로 반드시 아래 JSON 형식으로만 응답해주세요. JSON 외 다른 텍스트는 포함하지 마세요:
{
${jsonFormat}
}`;

  // 7. OpenAI API 호출
  console.log('[OpenAI] system prompt length:', systemPromptContent.length);
  console.log('[OpenAI] user prompt length:', userPrompt.length);
  console.log('[OpenAI] sections:', sections.map(s => s.section_key));

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.openai_api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPromptContent },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[OpenAI] API Error:', errorData);
    throw new Error(`OpenAI API 호출 실패: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const aiText = data.choices?.[0]?.message?.content ?? '';
  console.log('[OpenAI] response length:', aiText.length);

  // 8. JSON 파싱
  let parsed: Record<string, string> = {};
  try {
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('[OpenAI] JSON parse error:', e);
  }

  // 9. 섹션별로 결과 구성
  const resultSections: ReportSection[] = sections.map(s => {
    const raw = parsed[s.section_key] ?? '';
    const content = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
    return { key: s.section_key, title: s.title, content };
  });

  return { sections: resultSections };
}

export type PromptPreview = {
  systemPrompt: string;
  userPrompt: string;
  sectionKeys: string[];
  preAnswerCount: number;
  mainAnswerCount: number;
};

export async function previewPrompts(
  preAnswers: any[],
  mainAnswers: any[]
): Promise<PromptPreview> {
  // 1. 활성 시스템 프롬프트 로드
  const { data: settings } = await supabase
    .from('ai_settings')
    .select('active_prompt_id')
    .eq('id', 1)
    .single();

  let systemPromptContent = '당신은 에니어그램 전문가입니다. 사용자의 설문 응답을 분석하여 상세한 리포트를 작성해주세요.';
  if (settings?.active_prompt_id) {
    const { data: systemPrompt } = await supabase
      .from('ai_prompts')
      .select('content')
      .eq('id', settings.active_prompt_id)
      .single();
    if (systemPrompt?.content) {
      systemPromptContent = systemPrompt.content;
    }
  }

  // 2. 활성 사용자 프롬프트 섹션 로드
  const { data: sections } = await supabase
    .from('ai_prompt_sections')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  // 3. 설문 문항 로드
  const { data: preQuestions } = await supabase
    .from('pre_survey_questions')
    .select('*')
    .order('sort_order', { ascending: true });

  const { data: mainQuestions } = await supabase
    .from('main_survey_questions')
    .select('*')
    .order('q_id');

  // 4. 포맷팅
  const formattedPre = formatPreSurveyResponses(preAnswers, preQuestions || []);
  const formattedMain = formatMainSurveyResponses(mainAnswers, mainQuestions || []);

  // 5. 시스템 프롬프트 플레이스홀더 치환
  const finalSystemPrompt = replacePlaceholders(
    systemPromptContent,
    formattedPre,
    formattedMain,
    preAnswers,
    mainAnswers,
    preQuestions || [],
    mainQuestions || []
  );

  // 6. 사용자 프롬프트 조합
  const activeSections = sections || [];
  const sectionBlocks = activeSections
    .map(s => `### ${s.title}\n${replacePlaceholders(s.content, formattedPre, formattedMain, preAnswers, mainAnswers, preQuestions || [], mainQuestions || [])}`)
    .join('\n\n');
  const jsonFormat = activeSections.map(s => `  "${s.section_key}": "내용을 여기에 작성"`).join(',\n');

  const userPrompt = `${sectionBlocks}

---

## 사전 설문 응답
${formattedPre}

## 본 설문 응답
${formattedMain}

---

위 내용을 바탕으로 반드시 아래 JSON 형식으로만 응답해주세요. JSON 외 다른 텍스트는 포함하지 마세요:
{
${jsonFormat}
}`;

  return {
    systemPrompt: finalSystemPrompt,
    userPrompt,
    sectionKeys: activeSections.map(s => s.section_key),
    preAnswerCount: preAnswers.length,
    mainAnswerCount: mainAnswers.length,
  };
}

// ── 플레이스홀더 치환 ─────────────────────────────────────────────────────────
// 지원 문법:
//   {{pre_survey_responses}}    → 사전 설문 전체 응답
//   {{main_survey_responses}}   → 본 설문 전체 응답
//   {{pre_survey.37}}           → 사전 설문 q_id=37 의 응답 텍스트만
//   {{main_survey.37}}          → 본 설문 q_id=37 의 응답 텍스트만
function replacePlaceholders(
  text: string,
  formattedPre: string,
  formattedMain: string,
  preAnswers: any[],
  mainAnswers: any[],
  preQuestions: any[],
  mainQuestions: any[]
): string {
  return text
    .replace(/\{\{pre_survey_responses\}\}/g, formattedPre)
    .replace(/\{\{main_survey_responses\}\}/g, formattedMain)
    .replace(/\{\{pre_survey\.([^}]+)\}\}/g, (_, qId) =>
      formatSinglePreAnswer(String(qId).trim(), preAnswers, preQuestions)
    )
    .replace(/\{\{main_survey\.([^}]+)\}\}/g, (_, qId) =>
      formatSingleMainAnswer(String(qId).trim(), mainAnswers, mainQuestions)
    );
}

function formatSinglePreAnswer(qId: string, answers: any[], questions: any[]): string {
  const answer = answers.find(a => String(a.q_id) === qId);
  const question = questions.find(q => String(q.q_id) === qId);

  if (!answer) return `(q_id ${qId} 미응답)`;

  const questionText = question?.text_ko ?? `q_id ${qId}`;

  let answerText: string;
  if (answer.text_value) {
    answerText = answer.text_value;
  } else if (question?.options) {
    const opts: string[] = typeof question.options === 'string'
      ? question.options.split('/').map((o: string) => o.trim())
      : question.options;

    if (Array.isArray(answer.value)) {
      answerText = answer.value.map((v: number) => opts[v - 1] ?? `선택 ${v}`).join(', ');
    } else {
      const idx = parseInt(String(answer.value)) - 1;
      answerText = opts[idx] ?? String(answer.value);
    }
  } else {
    answerText = String(answer.value);
  }

  return `${questionText}\n→ ${answerText}`;
}

function formatSingleMainAnswer(qId: string, answers: any[], questions: any[]): string {
  const answer = answers.find(a => String(a.q_id) === qId);
  const question = questions.find(q => String(q.q_id) === qId);

  if (!answer) return `(q_id ${qId} 미응답)`;

  const questionText = question?.text_ko ?? `q_id ${qId}`;
  const likertLabels = ['전혀 그렇지 않다', '그렇지 않다', '약간 그렇지 않다', '약간 그렇다', '그렇다', '매우 그렇다'];
  const value = parseInt(String(answer.value));
  const label = likertLabels[value - 1] ?? String(value);
  return `${questionText}\n→ ${value}점 (${label})`;
}

// 사전 설문 응답 포맷
function formatPreSurveyResponses(answers: any[], questions: any[]): string {
  if (!questions.length) return '사전 설문 질문 정보 없음';

  return questions.map((q, idx) => {
    const answer = answers.find(a => String(a.q_id) === String(q.q_id));
    if (!answer) return `Q${idx + 1}. ${q.text_ko}\n→ 미응답`;

    let answerText = String(answer.value);

    // 주관식 텍스트 답변
    if (answer.text_value) {
      answerText = answer.text_value;
    } else if (q.options) {
      const optionsArray: string[] = typeof q.options === 'string'
        ? q.options.split('/').map((o: string) => o.trim())
        : q.options;

      if (Array.isArray(answer.value)) {
        // 다중 선택
        answerText = answer.value
          .map((v: number) => optionsArray[v - 1] ?? `선택 ${v}`)
          .join(', ');
      } else {
        const idx = parseInt(String(answer.value)) - 1;
        answerText = optionsArray[idx] ?? `선택 ${answer.value}`;
      }
    }

    return `Q${idx + 1}. ${q.text_ko}\n→ ${answerText}`;
  }).join('\n\n');
}

// 본 설문 응답 포맷 (리커트 1-6)
function formatMainSurveyResponses(answers: any[], questions: any[]): string {
  if (!questions.length) return '본 설문 질문 정보 없음';

  const likertLabels = [
    '전혀 그렇지 않다', '그렇지 않다', '약간 그렇지 않다',
    '약간 그렇다', '그렇다', '매우 그렇다',
  ];

  return questions.map((q, idx) => {
    const answer = answers.find(a => String(a.q_id) === String(q.q_id));
    if (!answer) return `Q${idx + 1}. ${q.text_ko}\n→ 미응답`;

    const value = parseInt(String(answer.value));
    const label = likertLabels[value - 1] ?? String(value);
    return `Q${idx + 1}. ${q.text_ko}\n→ ${value}점 (${label})`;
  }).join('\n\n');
}
