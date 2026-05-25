import { supabase } from "./supabase";

export type JobCard = {
  name: string;
  description: string;
  fit_badge: string;
};

export type JobRecommendation = {
  summary: string;
  jobs: JobCard[];
  strength: string;
  caution: string;
  connection?: string;
};

export type SkillCard = {
  icon: string;
  name: string;
  description: string;
  course: string;
  course_url?: string;
  level: string;
};

export type ReportSection = {
  key: string;
  title: string;
  content: string | Record<string, any>;
  sub_keys?: { key: string; label: string }[];
  show_as_card?: boolean;
};

export type OpenAIReportResult = {
  sections: ReportSection[];
};

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

  const { data: sections } = await supabase
    .from('ai_prompt_sections')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const { data: preQuestions } = await supabase
    .from('pre_survey_questions')
    .select('*')
    .order('sort_order', { ascending: true });

  const { data: mainQuestions } = await supabase
    .from('main_survey_questions')
    .select('*')
    .order('q_id');

  const formattedPre = formatPreSurveyResponses(preAnswers, preQuestions || []);
  const formattedMain = formatMainSurveyResponses(mainAnswers, mainQuestions || []);

  const finalSystemPrompt = replacePlaceholders(
    systemPromptContent,
    formattedPre,
    formattedMain,
    preAnswers,
    mainAnswers,
    preQuestions || [],
    mainQuestions || []
  );

  const activeSections = sections || [];
  const sectionBlocks = activeSections
    .map(s => `### ${s.title}\n${replacePlaceholders(s.content, formattedPre, formattedMain, preAnswers, mainAnswers, preQuestions || [], mainQuestions || [])}`)
    .join('\n\n');
  const jsonFormat = activeSections
    .map(s => {
      const subKeys = s.sub_keys ?? [];
      if (subKeys.length > 0) {
        const inner = subKeys.map((sk: any) => `    "${sk.key}": "내용 (${sk.label})"`).join(',\n');
        return `  "${s.section_key}": {\n${inner}\n  }`;
      }
      return `  "${s.section_key}": "내용을 여기에 작성"`;
    })
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
//   {{user_name}}               → 사용자 이름
//   {{pre_survey_responses}}    → 사전 설문 전체 응답
//   {{main_survey_responses}}   → 본 설문 전체 응답
//   {{pre_survey.37}}           → 사전 설문 q_id=37 의 응답 텍스트만
//   {{main_survey.37}}          → 본 설문 q_id=37 의 응답 텍스트만
export function replacePlaceholders(
  text: string,
  formattedPre: string,
  formattedMain: string,
  preAnswers: any[],
  mainAnswers: any[],
  preQuestions: any[],
  mainQuestions: any[],
  userName: string = ''
): string {
  return text
    .replace(/\{\{user_name\}\}/g, userName)
    .replace(/\{\{pre_survey_responses\}\}/g, formattedPre)
    .replace(/\{\{main_survey_responses\}\}/g, formattedMain)
    .replace(/\{\{pre_survey\.([^}]+)\}\}/g, (_, qId) =>
      formatSinglePreAnswer(String(qId).trim(), preAnswers, preQuestions)
    )
    .replace(/\{\{main_survey\.([^}]+)\}\}/g, (_, qId) =>
      formatSingleMainAnswer(String(qId).trim(), mainAnswers, mainQuestions)
    );
}

export function formatSinglePreAnswer(qId: string, answers: any[], questions: any[]): string {
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

export function formatSingleMainAnswer(qId: string, answers: any[], questions: any[]): string {
  const answer = answers.find(a => String(a.q_id) === qId);
  const question = questions.find(q => String(q.q_id) === qId);

  if (!answer) return `(q_id ${qId} 미응답)`;

  const questionText = question?.text_ko ?? `q_id ${qId}`;
  const likertLabels = ['전혀 그렇지 않다', '그렇지 않다', '약간 그렇지 않다', '약간 그렇다', '그렇다', '매우 그렇다'];
  const value = parseInt(String(answer.value));
  const label = likertLabels[value - 1] ?? String(value);
  return `${questionText}\n→ ${value}점 (${label})`;
}

export function formatPreSurveyResponses(answers: any[], questions: any[]): string {
  if (!questions.length) return '사전 설문 질문 정보 없음';

  return questions.map((q, idx) => {
    const answer = answers.find(a => String(a.q_id) === String(q.q_id));
    if (!answer) return `Q${idx + 1}. ${q.text_ko}\n→ 미응답`;

    let answerText = String(answer.value);

    if (answer.text_value) {
      answerText = answer.text_value;
    } else if (q.options) {
      const optionsArray: string[] = typeof q.options === 'string'
        ? q.options.split('/').map((o: string) => o.trim())
        : q.options;

      if (Array.isArray(answer.value)) {
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

export function formatMainSurveyResponses(answers: any[], questions: any[]): string {
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
