import { supabase } from '../supabase';
import { TYPES } from '../enneagram-data';
import {
  replacePlaceholders,
  formatPreSurveyResponses,
  formatMainSurveyResponses,
} from '../openai';
import type { ReportSection } from '../openai';
import jobMappingRaw from '../../data/enneagram_job_mapping.json';
import jobPersonaMapRaw from '../../data/job_persona_map.json';

export type ProgressCallback = (step: string, pct: number) => void;

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const TAVILY_API = 'https://api.tavily.com/search';
const CLASSIFIER_MODEL = 'openai/gpt-4o-mini';
const WRITER_MODEL = 'openai/gpt-4o-mini';

// ── 역할별 시스템 프롬프트 ────────────────────────────────────────────────────

const CLASSIFIER_SYSTEM = `당신은 에니어그램 전문 심리 분석가입니다.

## 역할
설문 응답 데이터를 체계적으로 분석하여 사용자의 에니어그램 핵심 유형을 정확하게 결정합니다.
이 결과는 이후 모든 리포트 작성의 기반이 되므로 신중하게 판단하세요.

## 분석 절차

### Step 1: 사전 설문 파악
- 직업·전공·관심사·가치관 등 배경 정보를 파악합니다
- 자기 인식 수준과 표현 방식을 관찰합니다

### Step 2: 본 설문 패턴 분석
- 점수가 높은(5~6점) 문항들의 공통 주제를 찾습니다
- 점수가 낮은(1~2점) 문항들이 피하는 패턴을 파악합니다
- 극단적인 응답(1점, 6점)에 특히 주목합니다

### Step 3: 에니어그램 유형 대조
- 9가지 유형의 핵심 욕구·두려움과 응답 패턴을 대조합니다
- 가장 일치하는 유형 2~3개를 후보로 추립니다
- 최종적으로 가장 적합한 유형 하나를 결정합니다

## 출력 규칙
- 반드시 JSON 형식으로만 응답합니다
- JSON 외 텍스트는 절대 포함하지 않습니다
- type_number는 1~9 사이의 정수입니다`;

// 도메인별 시스템 프롬프트가 없을 때 사용하는 기본값
const WRITER_SYSTEM_DEFAULT = `당신은 에니어그램 기반 커리어·자기계발 전문 컨설턴트입니다.
확정된 에니어그램 유형과 사용자 응답 데이터를 바탕으로 맞춤형 리포트를 작성합니다.
반드시 JSON 형식으로만 응답하며, JSON 외 텍스트는 포함하지 않습니다.`;

// ── 도메인별 시스템 프롬프트 ──────────────────────────────────────────────────

const DOMAIN_SYSTEMS: Record<string, string> = {

  characteristics: `당신은 에니어그램 심리 분석 전문가입니다.

## 역할
확정된 에니어그램 유형을 바탕으로 사용자의 성격 특성을 심층 분석합니다.
이론적 설명이 아닌, 이 사람의 실제 응답에서 드러나는 고유한 패턴에 집중하세요.

## 작성 원칙
- 해당 유형의 핵심 동기(욕구·두려움)가 행동으로 어떻게 나타나는지 구체적으로 서술합니다
- 건강한 상태와 스트레스 상태에서의 차이를 균형 있게 다룹니다
- 사용자의 설문 응답에서 근거를 찾아 일반론이 아닌 개인화된 분석을 제공합니다
- 강점은 자신감을 주고, 개선점은 비판 없이 성장 가능성으로 표현합니다

## 출력 규칙
- 반드시 JSON 형식으로만 응답합니다
- 지정된 하위 키 구조를 정확히 따릅니다
- 각 하위 항목은 3~5문장 이상의 충분한 깊이로 작성합니다`,

  famous_examples: `당신은 에니어그램과 인물 연구를 결합한 문화 분석 전문가입니다.

## 역할
확정된 에니어그램 유형에 해당하는 유명인 사례를 제시하고,
그들의 행동·성취·갈등 방식을 사용자와 연결하여 자기 이해를 돕습니다.

## 작성 원칙
- 해당 유형으로 잘 알려진 실존 인물(정치인·예술가·기업인·운동선수 등)을 2~3명 선정합니다
- 단순 나열이 아니라, 그 인물이 이 유형의 특성을 어떻게 보여주는지 구체적으로 설명합니다
- 유명인의 성공 사례뿐 아니라 그들이 극복한 내면의 도전도 균형 있게 다룹니다
- 사용자가 "나도 이런 면이 있구나"라고 공감할 수 있는 연결 고리를 제시합니다
- 한국인에게 친숙한 인물을 우선적으로 포함하되, 세계적 인물도 균형 있게 섞습니다

## 출력 규칙
- 반드시 JSON 형식으로만 응답합니다
- 지정된 하위 키 구조를 정확히 따릅니다
- 실존 인물만 언급하며, 불확실한 유형 분류는 언급하지 않습니다`,

  major_based_career_path: `당신은 에니어그램 기반 커리어 매칭 전문가입니다.

## 역할
사용자의 전공·관심사·에니어그램 유형을 교차 분석하여
가장 적합한 직무와 커리어 경로를 구체적으로 추천합니다.

## 작성 원칙
- 에니어그램 유형의 핵심 강점(동기, 사고방식, 대인관계 스타일)이 직무에서 어떻게 발휘되는지 설명합니다
- 사용자의 전공과 관심 분야를 반드시 반영하여 현실적인 직무를 추천합니다
- 단순 직업명 나열이 아닌, 그 직무에서 이 유형이 빛나는 이유를 서술합니다
- 적합한 직무와 함께 상대적으로 어려울 수 있는 환경도 솔직하게 제시합니다
- 국내 취업 시장과 직무 현실을 반영한 실용적인 관점을 유지합니다

## 출력 규칙
- 반드시 JSON 형식으로만 응답합니다
- JSON 외 다른 텍스트는 절대 포함하지 않습니다
- 직무명은 실제 채용 시장에서 통용되는 명칭을 사용합니다
- jobs는 정확히 3개를 작성합니다
- summary, strength, caution은 각 2문장 이내로 압축합니다
- fit_badge는 "키워드 · 키워드 적합" 형식으로 간결하게 작성합니다`,

  career_guidance: `당신은 에니어그램 기반 커리어 개발 코치입니다.

## 역할
사용자의 에니어그램 유형, 전공, 관심 직무를 바탕으로
실무에서 즉시 활용 가능한 핵심 스킬 4~6가지를 선정하고
각 스킬별 학습 로드맵을 제시합니다.

## 스킬 선정 기준
- 해당 에니어그램 유형의 강점을 살릴 수 있는 스킬을 우선 선정합니다
- 사용자의 전공·배경과 연계되는 스킬을 포함합니다
- 취업 시장에서 실제로 요구되는 기술 스택 위주로 구성합니다

## 강의 추천 기준
- 실제 존재하는 플랫폼(Coursera, Udemy, LinkedIn Learning, edX, 인프런, 패스트캠퍼스 등)의 강의를 추천합니다
- 강의명은 실제 강의명과 최대한 유사하게 작성합니다
- 수준(level)은 현재 사용자 수준을 고려해 현실적으로 설정합니다

## course_url 작성 규칙
- 검색 결과에 실제 강의 URL이 있으면 그 URL을 그대로 사용합니다
- 검색 결과에 URL이 없을 경우 플랫폼별 검색 URL을 생성합니다:
  - 인프런: https://www.inflearn.com/search?q={스킬명}
  - Coursera: https://www.coursera.org/search?query={스킬명}
  - Udemy: https://www.udemy.com/courses/search/?q={스킬명}
  - LinkedIn Learning: https://www.linkedin.com/learning/search?keywords={스킬명}
  - edX: https://www.edx.org/search?q={스킬명}
  - 패스트캠퍼스: https://fastcampus.co.kr/search?keyword={스킬명}

## 출력 규칙
- 반드시 JSON 형식으로만 응답합니다
- JSON 외 다른 텍스트는 절대 포함하지 않습니다
- 아이콘(icon)은 스킬을 잘 표현하는 이모지 1개를 사용합니다
- level 예시: "입문 → 실무", "실무 활용", "심화"`,

  growth_advice: `당신은 에니어그램 기반 자기계발 멘토입니다.

## 역할
사용자의 에니어그램 유형이 가진 성장 잠재력을 발굴하고,
내면의 패턴을 이해하여 더 건강하고 통합된 삶을 살 수 있도록 안내합니다.

## 작성 원칙
- 이 유형의 핵심 성장 과제(해방되어야 할 두려움, 개발할 덕목)를 진심 어린 언어로 다룹니다
- 성장 방향(통합 유형)의 긍정적 특성을 어떻게 흡수할 수 있는지 구체적으로 안내합니다
- 스트레스 방향으로 퇴행하는 신호를 알아차리는 방법을 제시합니다
- 일상에서 실천 가능한 루틴·습관·마음챙김 방법을 포함합니다
- 자기비판이 아닌 자기수용에서 출발하는 성장 관점을 유지합니다

## 출력 규칙
- 반드시 JSON 형식으로만 응답합니다
- 지정된 하위 키 구조를 정확히 따릅니다
- 조언의 깊이는 심리적 통찰과 실용적 실천 사이의 균형을 맞춥니다`,

};

// ── 워크넷 직업 데이터 RAG ────────────────────────────────────────────────────

type JobFit = { type: number; name: string; score: number; grade: string };
type JobEntry = { job_code: string; job_name: string; category: string; enneagram_fit: JobFit[] };

const jobMapping = jobMappingRaw as JobEntry[];
const jobPersonaMap = jobPersonaMapRaw as Record<string, string[]>;

function getJobsForType(typeNumber: number, limit = 12): string {
  const jobs = jobMapping
    .filter(j => j.enneagram_fit[0]?.type === typeNumber && j.enneagram_fit[0]?.grade !== 'C')
    .sort((a, b) => b.enneagram_fit[0].score - a.enneagram_fit[0].score)
    .slice(0, limit);

  if (jobs.length === 0) return '';

  return jobs
    .map(j => `- ${j.job_name} [${j.category}]`)
    .join('\n');
}

function getPersonasForJobs(jobNames: string[]): string {
  const blocks: string[] = [];
  for (const name of jobNames) {
    const personas = jobPersonaMap[name];
    if (personas && personas.length > 0) {
      blocks.push(`### ${name}\n${personas.slice(0, 2).map((p, i) => `${i + 1}. ${p}`).join('\n')}`);
    }
  }
  return blocks.join('\n\n');
}

// ── OpenRouter 호출 공통 함수 ─────────────────────────────────────────────────

async function callOpenRouter(
  apiKey: string,
  options: {
    model: string;
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
    max_tokens: number;
    temperature?: number;
  }
): Promise<string> {
  const response = await fetch(OPENROUTER_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://enneagram-app-12qh.vercel.app',
      'X-Title': 'Enneagram Report App',
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: options.max_tokens,
      temperature: options.temperature ?? 0.5,
      messages: options.messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter API 오류: ${response.status} ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ── Tavily 웹 검색 ────────────────────────────────────────────────────────────

async function searchTavily(tavilyKey: string, query: string): Promise<string> {
  try {
    const response = await fetch(TAVILY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
      }),
    });
    if (!response.ok) return '';
    const data = await response.json();
    const answer = data.answer ? `요약: ${data.answer}\n\n` : '';
    const results = (data.results ?? [])
      .map((r: any) => `[${r.title}]\nURL: ${r.url}\n${r.content}`)
      .join('\n\n');
    return answer + results;
  } catch {
    return '';
  }
}

async function searchCareerData(
  tavilyKey: string,
  typeName: string,
  typeKeywords: string[],
  formattedPre: string
): Promise<string> {
  const keywordStr = typeKeywords.slice(0, 3).join(', ');
  const [skillResult, courseResult] = await Promise.all([
    searchTavily(tavilyKey, `에니어그램 ${typeName} 유형 적합 직무 핵심 스킬 자격요건 채용공고`),
    searchTavily(tavilyKey, `${keywordStr} 역량 온라인 강의 추천 인프런 Coursera 2024 2025`),
  ]);

  const parts: string[] = [];
  if (skillResult) parts.push(`### 관련 직무 스킬 검색 결과\n${skillResult}`);
  if (courseResult) parts.push(`### 추천 강의 검색 결과\n${courseResult}`);
  return parts.join('\n\n');
}

async function searchJobData(
  tavilyKey: string,
  typeName: string,
  typeKeywords: string[],
): Promise<string> {
  const keywordStr = typeKeywords.slice(0, 3).join(', ');
  const [jobTrendResult, hiringResult] = await Promise.all([
    searchTavily(tavilyKey, `에니어그램 ${typeName} 유형 추천 직업 직무 커리어 진로`),
    searchTavily(tavilyKey, `${keywordStr} 성향 적합 직업 취업 채용 트렌드 2024 2025`),
  ]);

  const parts: string[] = [];
  if (jobTrendResult) parts.push(`### 에니어그램 유형별 추천 직업 검색 결과\n${jobTrendResult}`);
  if (hiringResult) parts.push(`### 관련 직무 채용 트렌드 검색 결과\n${hiringResult}`);
  return parts.join('\n\n');
}

// ── 1단계: 유형 분류 에이전트 ────────────────────────────────────────────────

async function runTypeClassifier(
  apiKey: string,
  formattedPre: string,
  formattedMain: string
): Promise<{ typeNumber: number; typeName: string; evidence: string }> {
  const typeDescriptions = TYPES.map(
    t =>
      `유형 ${t.number} (${t.name}/${t.subtitle})\n  핵심욕구: ${t.coreDesire}\n  핵심두려움: ${t.coreFear}\n  키워드: ${t.keywords.join(', ')}`
  ).join('\n\n');

  const userMsg = `## 에니어그램 9가지 유형 정보
${typeDescriptions}

---

## 사전 설문 응답
${formattedPre}

---

## 본 설문 응답 (리커트 1=전혀 아님 ~ 6=매우 그렇다)
${formattedMain}

---

위 응답을 분석하여 아래 JSON 형식으로만 응답하세요:
{
  "type_number": 숫자(1~9),
  "type_name": "유형명",
  "confidence": 확신도(0~100),
  "evidence": "이 유형으로 판단한 핵심 근거 (2~3문장)"
}`;

  const text = await callOpenRouter(apiKey, {
    model: CLASSIFIER_MODEL,
    max_tokens: 400,
    temperature: 0,
    messages: [
      { role: 'system', content: CLASSIFIER_SYSTEM },
      { role: 'user', content: userMsg },
    ],
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
  adminContext: string,
  formattedPre: string,
  formattedMain: string,
  userName: string,
  preAnswers: any[],
  mainAnswers: any[],
  preQuestions: any[],
  mainQuestions: any[],
  tavilyKey?: string,
  typeData?: { name: string; keywords: string[] },
  typeNumber?: number
): Promise<ReportSection> {
  // career_guidance / major_based_career_path: Tavily로 실시간 채용 데이터 검색
  let webSearchContext = '';
  let webSearchLabel = '실시간 채용 시장 검색 결과';
  if (section.section_key === 'career_guidance' && tavilyKey && typeData) {
    webSearchContext = await searchCareerData(tavilyKey, typeData.name, typeData.keywords, formattedPre);
    webSearchLabel = '실시간 채용 시장 검색 결과';
  } else if (section.section_key === 'major_based_career_path' && tavilyKey && typeData) {
    webSearchContext = await searchJobData(tavilyKey, typeData.name, typeData.keywords);
    webSearchLabel = '실시간 직업·진로 검색 결과';
  }

  const subKeys = section.sub_keys ?? [];
  const sectionPrompt = replacePlaceholders(
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
  if (section.section_key === 'major_based_career_path') {
    jsonFormat = `{
    "summary": "전공과 에니어그램 유형의 연결을 1~2문장으로 압축",
    "jobs": [
      {
        "name": "직무명",
        "description": "이 직무가 하는 일 한 문장",
        "fit_badge": "이 유형에 적합한 이유 키워드 (예: 분석·협력 적합)"
      }
    ],
    "strength": "이 유형의 직무 강점 2문장 이내",
    "caution": "주의할 점 2문장 이내",
    "connection": "추천 직무에서 실제로 일하는 사람들의 이야기를 바탕으로, 이 유형의 사람이 해당 직무에서 어떤 방식으로 빛나는지를 2~3문장으로 생생하게 서술하세요. 페르소나 데이터의 구체적인 장면(예: 어떤 상황, 어떤 습관, 어떤 태도)을 녹여서 현실감 있게 작성하세요."
  }`;
  } else if (section.section_key === 'career_guidance') {
    jsonFormat = `{
    "skill_summary": "이 유형에게 중요한 스킬 방향을 2~3문장으로 요약",
    "skills": [
      {
        "icon": "이모지",
        "name": "스킬명",
        "description": "이 스킬이 중요한 이유 한 문장",
        "course": "플랫폼명 · 강의명",
        "course_url": "https://실제강의URL (검색결과 URL 우선, 없으면 플랫폼 검색 URL)",
        "level": "수준 (예: 입문 → 실무, 실무 활용)"
      }
    ]
  }`;
  } else if (subKeys.length > 0) {
    const inner = subKeys.map(sk => `    "${sk.key}": "내용 (${sk.label})"`).join(',\n');
    jsonFormat = `{\n${inner}\n  }`;
  } else {
    jsonFormat = '"내용을 여기에 작성"';
  }

  const webSearchBlock = webSearchContext
    ? `## ${webSearchLabel} (Tavily)\n${webSearchContext}\n\n---\n\n`
    : '';

  // major_based_career_path: 워크넷 검증 직업 목록 주입 (RAG)
  const jobsList = (section.section_key === 'major_based_career_path' && typeNumber)
    ? getJobsForType(typeNumber)
    : '';
  const jobDataBlock = jobsList
    ? `## 워크넷 검증 직업 데이터 (${typeNumber}유형 적합 직무)\n한국고용정보원 워크넷 데이터 기반으로 검증된 직업 목록입니다.\n사용자의 전공·관심사에 맞게 이 목록에서 선별하여 추천하세요:\n${jobsList}\n\n---\n\n`
    : '';

  // major_based_career_path: 워크넷 상위 직업의 Nemotron 직업 페르소나 주입 (RAG)
  let personaBlock = '';
  if (section.section_key === 'major_based_career_path' && typeNumber) {
    const topJobNames = jobMapping
      .filter(j => j.enneagram_fit[0]?.type === typeNumber && j.enneagram_fit[0]?.grade !== 'C')
      .sort((a, b) => b.enneagram_fit[0].score - a.enneagram_fit[0].score)
      .slice(0, 6)
      .map(j => j.job_name);
    const personaText = getPersonasForJobs(topJobNames);
    if (personaText) {
      personaBlock = `## 직업 페르소나 데이터 (Nemotron-Personas-Korea)\n실제 해당 직업에 종사하는 사람들의 구체적인 특성을 담은 페르소나 데이터입니다.\n이 내용을 참고하여 connection 필드를 작성하세요:\n${personaText}\n\n---\n\n`;
    }
  }

  const userMsg = `## 사용자 컨텍스트
${adminContext}

---

## 확정된 에니어그램 유형
${typeContext}

---

${jobDataBlock}${personaBlock}${webSearchBlock}## 작성 요구사항: ${section.title}
${sectionPrompt}

---

## 사용자 사전 설문 응답
${formattedPre}

## 사용자 본 설문 응답
${formattedMain}

---

아래 JSON 형식으로만 응답하세요:
{
  "${section.section_key}": ${jsonFormat}
}`;

  const domainSystem = DOMAIN_SYSTEMS[section.section_key] ?? WRITER_SYSTEM_DEFAULT;

  const text = await callOpenRouter(apiKey, {
    model: WRITER_MODEL,
    max_tokens: 1200,
    temperature: 0.5,
    messages: [
      { role: 'system', content: domainSystem },
      { role: 'user', content: userMsg },
    ],
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

  // 구조화 JSON 섹션: 객체 그대로 반환
  if ((section.section_key === 'career_guidance' || section.section_key === 'major_based_career_path') && raw && typeof raw === 'object') {
    return { key: section.section_key, title: section.title, content: raw };
  }

  // 하위 키가 있는 일반 중첩 섹션
  if (subKeys.length > 0 && raw && typeof raw === 'object') {
    return {
      key: section.section_key,
      title: section.title,
      content: raw as Record<string, string>,
      sub_keys: subKeys,
    };
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
    .select('openai_api_key, tavily_api_key, active_prompt_id')
    .eq('id', 1)
    .single();

  if (settingsError) throw new Error('AI 설정을 불러올 수 없습니다.');
  if (!settingsData?.openai_api_key) {
    throw new Error('OpenRouter API Key가 설정되지 않았습니다. 관리자 설정에서 API Key를 등록해주세요.');
  }

  const apiKey = settingsData.openai_api_key;
  const tavilyKey = settingsData.tavily_api_key ?? undefined;

  // 2. 관리자 설정 컨텍스트 (사용자 특성 설명용)
  let adminContext = '에니어그램 기반 맞춤형 리포트를 작성합니다.';
  if (settingsData.active_prompt_id) {
    const { data: sp } = await supabase
      .from('ai_prompts')
      .select('content')
      .eq('id', settingsData.active_prompt_id)
      .single();
    if (sp?.content) adminContext = sp.content;
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

  // 관리자 컨텍스트 플레이스홀더 치환
  const resolvedAdminContext = replacePlaceholders(
    adminContext, formattedPre, formattedMain, preAnswers, mainAnswers, preQList, mainQList, userName
  );

  // 5. TypeClassifier: 유형 확정 (temperature=0, 결정론적)
  onProgress?.('에니어그램 유형 분석 중...', 20);

  let typeNumber = 1;
  let typeContext = '';
  let resolvedTypeData: { name: string; keywords: string[] } | undefined;

  try {
    const classified = await runTypeClassifier(apiKey, formattedPre, formattedMain);
    typeNumber = classified.typeNumber;
    const typeData = TYPES.find(t => t.number === typeNumber);
    resolvedTypeData = typeData ? { name: typeData.name, keywords: typeData.keywords } : undefined;
    typeContext = `${typeNumber}번 ${typeData?.name ?? ''} (${typeData?.subtitle ?? ''})
- 핵심 욕구: ${typeData?.coreDesire ?? ''}
- 핵심 두려움: ${typeData?.coreFear ?? ''}
- 키워드: ${typeData?.keywords.join(', ') ?? ''}
- 분류 근거: ${classified.evidence}

이 유형에 기반하여 섹션을 작성하세요. 유형 번호를 임의로 변경하지 마세요.`;
  } catch (e) {
    console.error('[TypeClassifier] 실패:', e);
    typeContext = '[유형 분류 실패 — 설문 내용을 바탕으로 최선을 다해 작성하세요]';
  }

  // 6. SectionWriters: 병렬 실행
  onProgress?.('리포트 섹션 작성 중...', 40);

  const writableSections = sections.filter(s => s.section_key !== 'enneagram_type');
  const typeSectionDef = sections.find(s => s.section_key === 'enneagram_type');

  const sectionResults = await Promise.all(
    writableSections.map(s =>
      runSectionWriter(
        apiKey, s, typeContext, resolvedAdminContext,
        formattedPre, formattedMain, userName,
        preAnswers, mainAnswers, preQList, mainQList,
        tavilyKey, resolvedTypeData, typeNumber
      )
    )
  );

  onProgress?.('결과 정리 중...', 90);

  // 7. 섹션 순서 복원하여 조합
  const finalSections: ReportSection[] = [];

  for (const section of sections) {
    if (section.section_key === 'enneagram_type') {
      finalSections.push({
        key: 'enneagram_type',
        title: typeSectionDef?.title ?? '에니어그램 유형',
        content: String(typeNumber),
        show_as_card: section.show_as_card ?? true,
      });
    } else {
      const result = sectionResults.find(r => r.key === section.section_key);
      if (result) finalSections.push({ ...result, show_as_card: section.show_as_card ?? true });
    }
  }

  onProgress?.('완료!', 100);
  return { sections: finalSections };
}
