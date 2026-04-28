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

src/app/
├── report/page.tsx          ← 리포트 뷰어 (카드 UI 렌더링)
├── admin/ai-settings/       ← AI 설정 관리 UI
├── surveys/pre/             ← 사전 설문
├── surveys/main/            ← 본 설문 (Likert 6점)
└── dashboard/               ← 사용자 대시보드
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
  → career_guidance만 Tavily 웹 검색 선행
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

## 리포트 렌더링 (`src/app/report/page.tsx`)

### 특수 렌더링 섹션
- `enneagram_type` → `EnneagramTypeCard` 컴포넌트
  - `characteristics` 섹션 데이터를 `report_data`에서 찾아 "나에 대한 이야기" 박스로 임베드
- `major_based_career_path` → `JobRecommendationSection` 컴포넌트
- `career_guidance` → `skill_summary` 인디고 박스 + `SkillCardsSection` 컴포넌트

### show_as_card 기능
- `section.show_as_card === false`이면 독립 카드 렌더링 스킵
- 단, `report_data`에는 데이터가 존재 (다른 카드에서 참조 가능)
- 현재 `characteristics`를 이 방식으로 유형 카드에 임베드하도록 설계

### 넘버링
- `show_as_card === false` 섹션은 번호 카운트에서 제외
- `visibleIdx` 변수로 별도 추적

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

## 관리자 UI 주요 기능 (`/admin/ai-settings`)

- **시스템 프롬프트 탭**: 여러 프롬프트 관리, 활성화 전환
- **섹션 탭**: 각 리포트 섹션 프롬프트 + 활성화/카드표시 토글 + sub_keys 설정
- **API Key 탭**: OpenRouter / Tavily API Key 등록
- **미리보기 탭**: 사용자 이메일로 실제 프롬프트 미리보기

---

## 다음 개발 예정 작업

### 우선순위 높음
- [ ] `major_based_career_path`에 Tavily 연동
  - 현재: AI 내부 학습 데이터만 사용
  - 목표: `career_guidance`처럼 실시간 채용 데이터 기반 직무 추천
  - 참고: `orchestrator.ts`의 `searchCareerData()`, `career_guidance` Tavily 로직을 참고해서 동일하게 적용

### 우선순위 낮음
- [ ] 배포 이후 Vercel 환경 변수 확인
- [ ] 리포트 PDF 다운로드 스타일 최적화

---

## 주요 결정 사항 (히스토리)

| 결정 | 이유 |
|---|---|
| OpenRouter 사용 | Anthropic/OpenAI 직접 결제 불가 → OpenRouter로 통합 |
| TypeClassifier 분리 (temperature=0) | 유형이 섹션마다 달라지는 불일치 문제 해결 |
| Tavily를 career_guidance에만 적용 | major_based_career_path는 아직 미적용 (다음 작업) |
| show_as_card 도입 | characteristics를 유형 카드에 임베드하면서 독립 카드는 숨기기 위해 |
| characteristics → 유형 카드 임베드 | "나에 대한 이야기" 박스로 에니어그램 유형 카드에 통합 |
| max_tokens: 1200 | OpenRouter 토큰 한도 오류 방지 |
