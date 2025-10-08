# Supabase 설정 가이드

## 🗄️ 데이터베이스 테이블 구조

### 테이블 목록

1. **users** - 사용자 정보
2. **user_progress** - 사용자별 설문 진행 상태
3. **survey_answers** - 설문 응답 (사전/본)
4. **reports** - 생성된 리포트
5. **question_versions** - 설문 문항 버전 관리
6. **ai_prompts** - AI 프롬프트 관리
7. **ai_settings** - AI 설정 (API Key 등)

---

## 🚀 Step 1: Supabase 프로젝트 생성

### 1. Supabase 계정 생성
1. https://supabase.com 접속
2. "Start your project" 클릭
3. GitHub 계정으로 로그인

### 2. 새 프로젝트 생성
1. "New Project" 클릭
2. Organization 선택 (없으면 생성)
3. 프로젝트 정보 입력:
   - Name: `enneagram-app` (또는 원하는 이름)
   - Database Password: 강력한 비밀번호 입력 (기억할 것!)
   - Region: `Northeast Asia (Seoul)` 선택
4. "Create new project" 클릭
5. 프로젝트 생성 대기 (2-3분)

---

## 🗃️ Step 2: 데이터베이스 스키마 생성

### 1. SQL 편집기 접속
1. Supabase Dashboard → 왼쪽 메뉴 → "SQL Editor" 클릭
2. "+ New query" 클릭

### 2. 스키마 SQL 실행
1. `supabase-schema.sql` 파일 내용 복사
2. SQL 편집기에 붙여넣기
3. "Run" 또는 Cmd/Ctrl + Enter로 실행
4. 성공 메시지 확인

### 3. 테이블 생성 확인
1. 왼쪽 메뉴 → "Table Editor" 클릭
2. 생성된 테이블 목록 확인:
   - users
   - user_progress
   - survey_answers
   - reports
   - question_versions
   - ai_prompts
   - ai_settings

---

## 🔑 Step 3: API 키 확인

### 1. Project Settings 접속
1. 왼쪽 메뉴 → 설정 아이콘 → "Project Settings"
2. "API" 섹션 클릭

### 2. 필요한 키 복사
- **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
- **anon public**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **service_role**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (관리자 작업용)

---

## ⚙️ Step 4: 환경 변수 설정

### 로컬 개발 (.env.local)

기존 내용에 추가:
```env
# Existing
NEXT_PUBLIC_ADMIN_EMAILS=your-admin-email@example.com

# Supabase (추가)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Vercel 배포 환경

Vercel Dashboard → Settings → Environment Variables에 추가:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📦 Step 5: Supabase 클라이언트 설치

```bash
npm install @supabase/supabase-js
```

---

## 🔧 Step 6: 코드 마이그레이션

### 1. Supabase 클라이언트 초기화

`src/lib/supabase.ts` 생성:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### 2. API 함수 마이그레이션

기존 `src/lib/api.ts`의 localStorage 함수들을 Supabase API 호출로 변경:

#### 예시: 사용자 진행 상태 조회
```typescript
// 기존 (localStorage)
export async function apiGetProgress(userId: string): Promise<UserProgress> {
  const progress = getLocalStorage(`progress.v1:${userId}`, defaultProgress(userId));
  return progress;
}

// 변경 (Supabase)
export async function apiGetProgress(userId: string): Promise<UserProgress> {
  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error || !data) {
    return defaultProgress(userId);
  }
  
  return convertToUserProgress(data);
}
```

### 3. 인증 마이그레이션

기존 localStorage 기반 인증을 Supabase Auth로 변경:

```typescript
// src/lib/auth-context.tsx
import { supabase } from './supabase';

// 회원가입
const signup = async (name: string, email: string, password: string) => {
  // Supabase Auth로 사용자 생성
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (authError) throw authError;
  
  // users 테이블에 추가 정보 저장
  const { error: dbError } = await supabase
    .from('users')
    .insert({
      id: authData.user!.id,
      email,
      name,
      role: 'user',
    });
  
  if (dbError) throw dbError;
};

// 로그인
const login = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data.user;
};
```

---

## 📊 데이터 마이그레이션 전략

### 옵션 1: 수동 마이그레이션 (소규모)
- 기존 사용자에게 재가입 요청
- 새로운 시스템에서 처음부터 시작

### 옵션 2: 스크립트 마이그레이션 (대규모)
- localStorage 데이터를 JSON으로 추출
- Supabase API로 일괄 삽입
- 마이그레이션 스크립트 작성 필요

---

## 🔐 보안 설정

### 1. Row Level Security (RLS)
- ✅ 모든 테이블에 RLS 활성화
- ✅ 사용자는 본인 데이터만 접근
- ✅ 관리자는 모든 데이터 접근

### 2. API Key 관리
- `anon key`: 클라이언트에서 사용 (공개 가능)
- `service_role key`: 서버에서만 사용 (비공개)

### 3. 인증 설정
Supabase Dashboard → Authentication → Settings:
- Email confirmations: 필요시 활성화
- Password requirements: 최소 8자
- JWT expiry: 기본값 (3600초)

---

## 📱 관리자 페이지에서 확인할 데이터

### 방문자 응답 관리에서 조회
```sql
-- 모든 사용자의 진행 상황
SELECT 
  u.email,
  up.pre_survey_status,
  up.pre_survey_answered_count,
  up.pre_survey_total_count,
  up.main_survey_status,
  (SELECT COUNT(*) FROM survey_answers WHERE user_id = u.id AND survey_type = 'MAIN') as main_answered,
  up.report_status
FROM users u
LEFT JOIN user_progress up ON u.id = up.user_id
WHERE u.role = 'user';
```

### 특정 사용자의 사전 설문 응답
```sql
SELECT 
  sa.q_id,
  sa.value,
  sa.answered_at
FROM survey_answers sa
WHERE sa.user_id = '[USER_ID]' 
  AND sa.survey_type = 'PRE'
ORDER BY sa.q_id;
```

### 특정 사용자의 본 설문 응답
```sql
SELECT 
  sa.q_id,
  sa.value,
  sa.answered_at
FROM survey_answers sa
WHERE sa.user_id = '[USER_ID]' 
  AND sa.survey_type = 'MAIN'
ORDER BY sa.q_id;
```

### 특정 사용자의 리포트
```sql
SELECT 
  enneagram_type,
  characteristics,
  job_recommendations,
  generated_at
FROM reports
WHERE user_id = '[USER_ID]';
```

---

## 🧪 테스트

### 1. 테이블 생성 확인
```sql
-- 모든 테이블 조회
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

### 2. 샘플 데이터 삽입
```sql
-- 테스트 사용자 생성
INSERT INTO users (email, name, password_hash, role)
VALUES ('test@example.com', '테스트 사용자', 'hashed_password', 'user');
```

### 3. RLS 테스트
- Supabase Dashboard → Table Editor
- 데이터 삽입/조회/수정 테스트
- 권한 확인

---

## 🔄 마이그레이션 체크리스트

### 데이터베이스
- [ ] Supabase 프로젝트 생성
- [ ] SQL 스키마 실행
- [ ] 테이블 생성 확인
- [ ] RLS 정책 확인

### 환경 설정
- [ ] `.env.local`에 Supabase URL/Key 추가
- [ ] Vercel에 환경 변수 추가

### 코드 변경
- [ ] `@supabase/supabase-js` 설치
- [ ] `src/lib/supabase.ts` 생성
- [ ] `src/lib/api.ts` 마이그레이션
- [ ] `src/lib/auth-context.tsx` Supabase Auth 사용

### 테스트
- [ ] 회원가입 테스트
- [ ] 로그인 테스트
- [ ] 설문 응답 저장 테스트
- [ ] 관리자 페이지 확인

---

## 📚 참고 자료

- [Supabase 공식 문서](https://supabase.com/docs)
- [Supabase + Next.js 가이드](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Row Level Security 가이드](https://supabase.com/docs/guides/auth/row-level-security)

---

## 💡 다음 단계

1. **Supabase 스키마 생성** (위 SQL 실행)
2. **Supabase 클라이언트 설치** (`npm install @supabase/supabase-js`)
3. **환경 변수 설정** (URL, API Key)
4. **코드 마이그레이션** (localStorage → Supabase)
5. **테스트 및 배포**

도움이 필요하시면 언제든지 말씀해주세요! 🚀
