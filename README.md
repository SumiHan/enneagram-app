# 에니어그램 성향 기반 진로 탐색 플랫폼

에니어그램 설문을 통해 사용자의 성격 유형을 분석하고, 멀티 에이전트 AI 파이프라인으로 개인화된 진로 리포트를 생성하는 웹 애플리케이션입니다.

## 주요 기능

### 일반 사용자
- 회원가입 및 로그인
- 사전 설문 (인적 사항, 전공, 관심 직무 등 주·객관식 혼합)
- 본 설문 (에니어그램 문항, 6점 Likert 척도, 30문항씩 3페이지)
- 자동 저장 및 이어하기
- AI 기반 개인화 진로 리포트 확인 (PDF 다운로드)

### 관리자
- 설문 문항 관리 (CSV 업로드, 인라인 편집)
- 사용자 및 응답 관리 (개별 확인, 일괄 다운로드)
- AI 설정 (시스템 프롬프트, 섹션별 사용자 프롬프트, API Key)
- 프롬프트 미리보기

---

## 기술 스택

| 구분 | 기술 |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | TailwindCSS |
| Database | Supabase (PostgreSQL) |
| AI | OpenRouter API (openai/gpt-4o-mini) |
| Web Search | Tavily API |
| Report Export | html2canvas + jsPDF |

---

## AI 리포트 생성 파이프라인

멀티 에이전트 구조로 일관성 있는 분석과 병렬 처리를 구현합니다.

```
사용자 설문 응답 (사전 + 본 설문)
        │
        ▼
┌─────────────────────────────┐
│   TypeClassifier Agent      │  temperature=0 (결정론적)
│   에니어그램 유형 확정 (1~9) │
└────────────┬────────────────┘
             │ 유형 컨텍스트 고정
             ▼
┌─────────────────────────────────────────────────────────────┐
│                  SectionWriter Agents (병렬)                 │
│                                                             │
│  characteristics      ─ 성격 특성 분석                      │
│  famous_examples      ─ 유명인 예시                         │
│  major_based_career   ─ 전공 기반 직무 추천 (JSON)           │
│  career_guidance      ─ 커리어 스킬 가이드 (Tavily + JSON)   │
│  growth_advice        ─ 성장 조언                           │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
   report_data 저장 (Supabase)
```

### TypeClassifier
- 모델: `openai/gpt-4o-mini` via OpenRouter, temperature=0
- 역할: 설문 응답 기반 에니어그램 유형(1~9) 확정
- 출력: `{ typeNumber, typeName, evidence }`
- 이후 모든 SectionWriter가 동일한 유형 컨텍스트를 공유

### SectionWriter
- 모델: `openai/gpt-4o-mini` via OpenRouter, temperature=0.5
- 도메인별 시스템 프롬프트 분리 (`DOMAIN_SYSTEMS`)
- `career_guidance`: Tavily 실시간 채용 데이터 검색 후 스킬 카드 JSON 생성
- `major_based_career_path`: 직무 추천 JSON 생성 (summary + 3개 직무 카드 + 강점/주의)

---

## 리포트 구성

| 섹션 | 설명 | 렌더링 방식 |
|---|---|---|
| 에니어그램 유형 | 유형 카드 (날개·성장·스트레스 방향 포함) | 커스텀 카드 + "나에 대한 이야기" 박스 |
| 유형 특성 | 성격 특성 심층 분석 | (유형 카드 내 임베드, 독립 카드 미표시 가능) |
| 유명인 예시 | 동일 유형 유명인 2~3명 | 마크다운 렌더링 |
| 전공 기반 직무 추천 | 요약 + 3개 직무 카드 + 강점/주의 | JobRecommendation 카드 |
| 커리어 가이드 | 실무 스킬 4~6개 + 강의 링크 | SkillCard 2열 그리드 |
| 성장 조언 | 에니어그램 기반 성장 방향 | 마크다운 렌더링 |

---

## 관리자 설정

### AI 설정 (`/admin/ai-settings`)

**시스템 프롬프트 탭**
- 여러 시스템 프롬프트 등록 후 활성화 전환 가능
- 플레이스홀더 지원: `{{user_name}}`, `{{pre_survey_responses}}`, `{{main_survey_responses}}`, `{{pre_survey.q_id}}`, `{{main_survey.q_id}}`

**섹션 탭**
- 각 리포트 섹션의 사용자 프롬프트 개별 관리
- 활성화 토글: AI 실행 여부
- 카드 표시 토글: 독립 카드로 렌더링 여부 (OFF시 데이터는 생성되나 카드 미표시)
- 하위 키(sub_keys) 설정으로 중첩 JSON 구조 정의
- 순서 변경 가능

**API Key 탭**
- OpenRouter API Key 등록
- Tavily API Key 등록

---

## 로컬 개발

### 설치

```bash
npm install
```

### 환경 변수 설정

`.env.local` 파일 생성:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_ADMIN_EMAILS=your-admin-email@example.com
```

### 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인

---

## Supabase 테이블 구조

| 테이블 | 용도 |
|---|---|
| `users` | 사용자 계정 |
| `user_progress` | 설문 진행 상태 |
| `responses` | 설문 응답 (pre/main) |
| `reports` | AI 생성 리포트 |
| `ai_settings` | OpenRouter/Tavily API Key |
| `ai_prompts` | 시스템 프롬프트 |
| `ai_prompt_sections` | 섹션별 사용자 프롬프트 |
| `pre_survey_questions` | 사전 설문 문항 |
| `main_survey_questions` | 본 설문 문항 |

---

## 배포 (Vercel)

1. GitHub에 코드 푸시
2. [vercel.com](https://vercel.com) 에서 Import
3. 환경 변수 설정 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ADMIN_EMAILS`)
4. Deploy 클릭
5. 관리자 UI에서 OpenRouter / Tavily API Key 등록

---

## 파일 구조

```
src/
├── app/
│   ├── page.tsx               # 랜딩
│   ├── dashboard/             # 사용자 대시보드
│   ├── surveys/pre/           # 사전 설문
│   ├── surveys/main/          # 본 설문
│   ├── report/                # 리포트 뷰어
│   └── admin/
│       ├── dashboard/         # 관리자 대시보드
│       ├── ai-settings/       # AI 설정
│       ├── users/             # 사용자 관리
│       ├── responses/         # 응답 관리
│       └── questions/         # 문항 관리
└── lib/
    ├── agents/
    │   └── orchestrator.ts    # 멀티 에이전트 파이프라인
    ├── openai.ts              # 타입 정의 + 프롬프트 유틸
    ├── api.ts                 # Supabase API 함수
    ├── supabase.ts            # Supabase 클라이언트
    ├── types.ts               # 공통 타입
    └── enneagram-data.ts      # 에니어그램 유형 데이터
```
