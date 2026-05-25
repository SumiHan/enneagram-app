# 에니어그램 진로 탐색 플랫폼 — 개발 컨텍스트

> Claude Code가 세션 시작 시 자동으로 읽는 파일입니다.
> 이전 작업 흐름을 이어받아 바로 개발을 시작할 수 있도록 작성되었습니다.

---

## 프로젝트 개요

에니어그램 설문(사전 + 본 설문)을 통해 성격 유형을 분석하고,
멀티 에이전트 AI 파이프라인으로 개인화된 **진로 리포트**를 생성하는 Next.js 웹앱.

- **배포 URL**: GitHub `hahhhh77/enneagram-app` → Vercel 자동 배포 (main 브랜치)
- **관리자 이메일**: `hyejin8799@hanmail.net`

---

## 핵심 기술 스택

| 역할 | 기술 |
|---|---|
| Frontend | Next.js 14 App Router + TypeScript |
| Styling | TailwindCSS |
| DB | Supabase (PostgreSQL) |
| AI | OpenRouter API (`openai/gpt-4o-mini`) |
| Web Search | Tavily API |
| PDF Export | html2canvas + jsPDF |

---

## 핵심 파일 구조

```
src/lib/
├── agents/orchestrator.ts   ← AI 파이프라인 핵심 (여기서 모든 AI 로직)
├── openai.ts                ← 타입 정의 + 설문 포맷팅 유틸 (AI 호출 없음)
├── api.ts                   ← Supabase CRUD API 함수들
├── supabase.ts              ← Supabase 클라이언트 + DB 타입
├── types.ts                 ← 공통 타입 (UserProgress, SurveyAnswer 등)
└── enneagram-data.ts        ← TYPES, TRIADS, TRIAD_STYLE (정적 데이터)

src/data/
├── enneagram_job_mapping.json   ← 워크넷 직업 × 에니어그램 유형 적합도 (LLM-as-Judge 검증)
└── job_persona_map.json         ← Nemotron 직업 페르소나 맵 (189개 직업 × 최대 5개 페르소나)

src/app/
├── report/page.tsx          ← 리포트 뷰어 (공용 ReportViewer 컴포넌트 사용)
├── admin/
│   ├── ai-settings/         ← AI 설정 관리 UI
│   ├── responses/page.tsx   ← 방문자 응답 관리 + 엑셀 다운로드
│   └── dashboard/page.tsx   ← 관리자 대시보드
├── surveys/pre/             ← 사전 설문
├── surveys/main/            ← 본 설문 (Likert 6점)
└── dashboard/               ← 사용자 대시보드

src/components/
└── ReportViewer.tsx         ← 리포트 렌더링 공용 컴포넌트 (report/page + admin/responses 공유)

reference/
├── build_persona_map.py     ← Nemotron 스트리밍 → job_persona_map.json 빌드 스크립트
├── make_doc.py              ← Word 문서 생성 스크립트 (발표자료_데이터셋구축및검증.docx)
└── data/
    ├── job_list_raw.json        ← 워크넷 직업 원본 목록 (462개)
    ├── job_persona_map.json     ← 빌드 원본 (src/data와 동일)
    ├── enneagram_job_mapping.json
    ├── judged_all.json          ← LLM-as-Judge 검증 결과 전체
    └── judged_sample.json
```

---

## AI 파이프라인 (`src/lib/agents/orchestrator.ts`)

### 구조
```
TypeClassifier (temperature=0)
  → 에니어그램 유형 1~9 확정
  → typeContext 생성

SectionWriter × N (temperature=0.5, Promise.all 병렬)
  → 각 섹션별 도메인 시스템 프롬프트 사용 (DOMAIN_SYSTEMS)
  → career_guidance: Tavily 웹 검색 선행
  → major_based_career_path: 워크넷 검증 직업 목록 RAG 주입
  → JSON 형식으로 출력
```

### 주요 상수
```typescript
const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const TAVILY_API = 'https://api.tavily.com/search';
const CLASSIFIER_MODEL = 'openai/gpt-4o-mini';
const WRITER_MODEL = 'openai/gpt-4o-mini';
```

### API Key 저장 위치
- Supabase `ai_settings` 테이블 (id=1)
- 컬럼: `openai_api_key` (OpenRouter key), `tavily_api_key`
- 관리자 UI에서 입력: `/admin/ai-settings` → API Key 탭

### 섹션별 AI 출력 형식
| section_key | 출력 타입 | 비고 |
|---|---|---|
| `enneagram_type` | `string` (숫자 "1"~"9") | TypeClassifier 결과 직접 사용 |
| `characteristics` | nested object (sub_keys 기반) | |
| `famous_examples` | nested object (sub_keys 기반) | |
| `major_based_career_path` | `JobRecommendation` JSON | `summary`, `jobs[]`, `strength`, `caution` |
| `career_guidance` | `{ skill_summary, skills[] }` JSON | Tavily 검색 후 생성 |
| `growth_advice` | nested object (sub_keys 기반) | |

---

## 리포트 렌더링 (`src/components/ReportViewer.tsx`)

### 공용 컴포넌트 (2025-05-25 추출)
- `report/page.tsx`와 `admin/responses/page.tsx` 양쪽에서 동일하게 사용
- Export: `ReportViewer`, `EnneagramTypeCard`, `parseTypeNumber`, `ReportSection` 타입

### 특수 렌더링 섹션
- `enneagram_type` → `EnneagramTypeCard` 컴포넌트
  - `characteristics` 섹션 데이터를 `report_data`에서 찾아 "나에 대한 이야기" 박스로 임베드
- `major_based_career_path` → `JobRecommendationSection` 컴포넌트
- `career_guidance` → `skill_summary` 인디고 박스 + `SkillCardsSection` 컴포넌트

### show_as_card 기능
- `section.show_as_card === false`이면 독립 카드 렌더링 스킵
- 단, `report_data`에는 데이터가 존재 (다른 카드에서 참조 가능)
- 현재 `characteristics`를 이 방식으로 유형 카드에 임베드하도록 설계

---

## Supabase 주요 테이블

| 테이블 | 핵심 컬럼 |
|---|---|
| `ai_settings` | `openai_api_key`, `tavily_api_key`, `active_prompt_id` |
| `ai_prompt_sections` | `section_key`, `title`, `content`, `is_active`, `show_as_card`, `sub_keys` (jsonb), `sort_order` |
| `ai_prompts` | `content` (시스템 프롬프트), `is_active` |
| `reports` | `user_id`, `report_data` (jsonb 배열), `enneagram_type` |
| `responses` | `user_id`, `survey_type` (pre/main), `answers` (jsonb), `status` |
| `user_progress` | `user_id`, `pre_survey_status`, `main_survey_status`, `report_status` |

---

## 관리자 UI 주요 기능 (`/admin`)

### `/admin/ai-settings`
- **시스템 프롬프트 탭**: 여러 프롬프트 관리, 활성화 전환
- **섹션 탭**: 각 리포트 섹션 프롬프트 + 활성화/카드표시 토글 + sub_keys 설정
- **API Key 탭**: OpenRouter / Tavily API Key 등록
- **미리보기 탭**: 사용자 이메일로 실제 프롬프트 미리보기

### `/admin/responses`
- 방문자 응답 목록 + 탭(리포트 / 사전설문 / 본설문 / 인터뷰)
- **엑셀 다운로드** (2025-05-25 개선):
  - 시트 1 — 리포트: 이메일, 에니어그램 유형, 추천 직무(쉼표 구분), 커리어 가이드 키워드
  - 시트 2 — 인터뷰: Q1(유형 일치도 숫자→레이블), Q2~Q5 텍스트 응답 전체

---

## Nemotron 직업 페르소나 데이터 (특허 고도화 핵심)

### 데이터 현황
- **출처**: `nvidia/Nemotron-Personas-Korea` (HuggingFace) — 100만 레코드, 700만 페르소나
- **핵심 필드**: `occupation` (직업명), `professional_persona` (직업 종사자 서사 텍스트)
- **빌드 결과**: `src/data/job_persona_map.json`
  - 189개 직업 × 최대 5개 페르소나 (각 100~200자 한국어 서사)
  - 워크넷 462개 직업 중 189개 커버 (~41%)
  - 매칭 방식: 정확 일치 → WorkNet명이 occ에 포함 → occ가 WorkNet명에 포함
  - 무직(36.57%) 제거

### 현재 코드 상태
- `job_persona_map.json`은 `src/data/`에 존재하고 `orchestrator.ts`에 import됨
- `getPersonasForJobs()` 함수도 `orchestrator.ts`에 존재
- **단, 현재 실제 AI 프롬프트에는 미주입 상태** (불안정 판단으로 렌더링만 제거)
- 즉, 인프라는 갖춰져 있고 "어떻게 활용할지"만 결정하면 됨

### 특허 관점 핵심 차별점
```
에니어그램 유형 분류 (TypeClassifier)
  + 워크넷 공공 직업 데이터 (LLM-as-Judge 검증)
  + Nemotron 직업 페르소나 (실제 종사자 서사)
  = 개인화된 진로 리포트
```

#### 기존 시스템과의 차이
| 항목 | 기존 | 본 시스템 |
|---|---|---|
| 직업 추천 근거 | AI 내부 학습 데이터 | 워크넷 공공 데이터 + LLM-as-Judge 검증 점수 |
| 직무 적합도 표현 | 일반적 설명 | 실제 종사자 페르소나 서사 기반 |
| 검증 방식 | 없음 | judge_score + grade(A/B/C) 체계 |
| 데이터 출처 투명성 | 불명확 | 워크넷 + Nemotron 명시 가능 |

---

## 다음 개발 예정 작업

### 우선순위 높음 — 페르소나 활용 방식 고도화 (특허 연계)

현재 `job_persona_map.json`과 `getPersonasForJobs()` 함수가 준비되어 있음.
아래 중 하나 또는 복합으로 활용 방식을 결정해야 함:

#### 옵션 A: 직무 적합도 점수에 페르소나 문체 반영
- TypeClassifier가 분류한 유형 → 워크넷 상위 직업 추출
- 해당 직업의 페르소나 텍스트를 임베딩하여 사용자 응답과 유사도 계산
- 유사도가 높은 직업을 우선 추천 (현재는 judge_score만 사용)
- **특허 포인트**: "설문 응답 임베딩 × 직업 페르소나 임베딩 코사인 유사도 기반 매칭"

#### 옵션 B: 리포트 서사 품질 향상 (RAG 프롬프트)
- `major_based_career_path` 섹션 생성 시 추천 직업의 페르소나 텍스트를 컨텍스트로 주입
- AI가 실제 종사자 특성을 참조하여 더 생생한 직무 설명 생성
- **이전 시도**: `connection` 필드로 구현했으나 출력 품질 불안정으로 롤백
- **개선 방향**: `connection`을 별도 필드로 추가하는 대신 `description`이나 `fit_badge` 품질 자체를 높이는 방향으로 재시도

#### 옵션 C: LLM-as-Judge 검증 파이프라인 고도화
- 현재: `judged_all.json` (462직업 × 9유형 매칭 점수 존재)
- 개선: 페르소나 텍스트를 Judge 프롬프트에 포함하여 적합도 재평가
- "이 페르소나를 가진 사람이 이 에니어그램 유형과 얼마나 일치하는가"

### 우선순위 중간
- [ ] `major_based_career_path`에 Tavily 연동 강화
  - 현재: 워크넷 검증 직업 목록 주입 + Tavily 검색 결과 병행
  - 목표: 실시간 채용공고 데이터와 연계

### 우선순위 낮음
- [ ] 리포트 PDF 다운로드 스타일 최적화
- [ ] 워크넷 직업 커버리지 41% → 70% 이상으로 확대 (build_persona_map.py 샘플 수 증가)

---

## 주요 결정 사항 (히스토리)

| 날짜 | 결정 | 이유 |
|---|---|---|
| - | OpenRouter 사용 | Anthropic/OpenAI 직접 결제 불가 → OpenRouter로 통합 |
| - | TypeClassifier 분리 (temperature=0) | 유형이 섹션마다 달라지는 불일치 문제 해결 |
| - | Tavily를 career_guidance에만 적용 | major_based_career_path는 RAG 방식으로 대체 |
| - | show_as_card 도입 | characteristics를 유형 카드에 임베드하면서 독립 카드는 숨기기 위해 |
| - | max_tokens: 1200 | OpenRouter 토큰 한도 오류 방지 |
| 2025-05-25 | ReportViewer 공용 컴포넌트 추출 | report/page와 admin/responses 렌더링 중복 제거 |
| 2025-05-25 | 엑셀 다운로드 개선 | 리포트(유형+직무+키워드) + 인터뷰(Q1~Q5) 시트 추가 |
| 2025-05-25 | 모바일 TopNav 레이아웃 개편 | 제목+이메일 좌측 세로스택, 로그아웃 우측 고정 |
| 2025-05-25 | Nemotron 페르소나 맵 빌드 | 189개 직업 페르소나 확보, src/data에 저장 |
| 2025-05-25 | connection 필드 롤백 | 페르소나 RAG → connection 출력 품질 불안정, 인프라만 유지 |
