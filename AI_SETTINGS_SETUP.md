# AI 설정 Supabase 테이블 설정 가이드

## 🚨 API Key 저장 실패 시 해결 방법

### Step 1: Supabase 테이블 생성

Supabase Dashboard → SQL Editor → 새 쿼리 생성 후 아래 내용 실행:

```sql
-- 1. 테이블이 이미 존재하는 경우 삭제 (선택사항)
-- DROP TABLE IF EXISTS public.ai_settings CASCADE;
-- DROP TABLE IF EXISTS public.ai_prompts CASCADE;

-- 2. ai_prompts 테이블 생성
CREATE TABLE IF NOT EXISTS public.ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ai_settings 테이블 생성
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  openai_api_key TEXT,
  active_prompt_id UUID REFERENCES public.ai_prompts(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT single_row_constraint CHECK (id = 1)
);

-- 4. 기본 설정 데이터 삽입
INSERT INTO public.ai_settings (id, openai_api_key, active_prompt_id)
VALUES (1, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 5. 기본 프롬프트 삽입
INSERT INTO public.ai_prompts (title, description, content, is_active)
VALUES (
  '기본 에니어그램 분석 프롬프트',
  '사용자의 설문 응답을 바탕으로 에니어그램 유형을 분석하고 상세한 리포트를 작성',
  '당신은 에니어그램 전문가입니다. 사용자의 설문 응답을 바탕으로 에니어그램 유형을 분석하고 상세한 리포트를 작성해주세요.

응답 형식은 반드시 다음 JSON 형태로 작성해주세요:
{
  "enneagram_type": "숫자 유형명 (예: 1번 개혁가, 2번 조력가 등 1-9번 중 하나)",
  "characteristics": "이 유형의 주요 특징을 3-5문장으로 설명",
  "job_recommendations": ["추천 직업 1", "추천 직업 2", "추천 직업 3"]
}

분석할 때는 사전 설문과 본 설문의 모든 응답을 종합적으로 고려해주세요.',
  true
)
ON CONFLICT DO NOTHING;

-- 6. active_prompt_id 업데이트
UPDATE public.ai_settings
SET active_prompt_id = (SELECT id FROM public.ai_prompts WHERE is_active = true LIMIT 1)
WHERE id = 1;
```

### Step 2: RLS (Row Level Security) 정책 수정

테이블을 생성한 후 RLS 정책을 설정합니다:

```sql
-- 1. RLS 활성화
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- 2. 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Admins can view ai_settings" ON public.ai_settings;
DROP POLICY IF EXISTS "Admins can update ai_settings" ON public.ai_settings;
DROP POLICY IF EXISTS "Admins can view ai_prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "Admins can insert ai_prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "Admins can update ai_prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "Admins can delete ai_prompts" ON public.ai_prompts;

-- 3. 새로운 정책 생성 (인증된 사용자 모두 허용)
CREATE POLICY "Allow authenticated users to view ai_settings"
  ON public.ai_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update ai_settings"
  ON public.ai_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view ai_prompts"
  ON public.ai_prompts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert ai_prompts"
  ON public.ai_prompts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update ai_prompts"
  ON public.ai_prompts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete ai_prompts"
  ON public.ai_prompts FOR DELETE
  TO authenticated
  USING (true);
```

### Step 3: Trigger 생성 (updated_at 자동 업데이트)

```sql
-- 1. 함수 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. ai_prompts 트리거
DROP TRIGGER IF EXISTS update_ai_prompts_updated_at ON public.ai_prompts;
CREATE TRIGGER update_ai_prompts_updated_at
  BEFORE UPDATE ON public.ai_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. ai_settings 트리거
DROP TRIGGER IF EXISTS update_ai_settings_updated_at ON public.ai_settings;
CREATE TRIGGER update_ai_settings_updated_at
  BEFORE UPDATE ON public.ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## 🧪 테스트 방법

### 1. 테이블 확인
```sql
-- ai_settings 테이블 조회
SELECT * FROM public.ai_settings;

-- ai_prompts 테이블 조회
SELECT * FROM public.ai_prompts;
```

### 2. 수동으로 API Key 저장 테스트
```sql
-- API Key 업데이트
UPDATE public.ai_settings
SET openai_api_key = 'sk-test-key-1234567890'
WHERE id = 1;

-- 확인
SELECT openai_api_key FROM public.ai_settings WHERE id = 1;
```

### 3. 웹 UI에서 테스트
1. 관리자로 로그인
2. 관리자 대시보드 → AI 설정
3. "OpenAI API Key 설정" 탭
4. API Key 입력 후 저장
5. 성공 메시지 확인

---

## 🔍 문제 해결

### 문제 1: "API Key 저장에 실패했습니다"
**원인**: RLS 정책이 제대로 설정되지 않음

**해결책**:
1. 위의 "Step 2: RLS 정책 수정" SQL 실행
2. 브라우저 새로고침
3. 다시 시도

### 문제 2: "테이블이 존재하지 않습니다"
**원인**: ai_settings 또는 ai_prompts 테이블이 생성되지 않음

**해결책**:
1. 위의 "Step 1: Supabase 테이블 생성" SQL 실행
2. Supabase Dashboard → Table Editor에서 테이블 확인

### 문제 3: "infinite recursion detected in policy"
**원인**: RLS 정책이 users 테이블을 참조하면서 순환 참조 발생

**해결책**:
1. 기존 정책 삭제
2. 간단한 정책으로 교체 (위의 Step 2 실행)

### 문제 4: Console에 에러 로그
**확인 방법**:
```javascript
// 브라우저 Console (F12)에서 확인
// 에러 메시지를 복사하여 알려주세요
```

---

## 📝 OpenAI API Key 발급 방법

1. https://platform.openai.com 접속
2. 로그인 (계정이 없으면 가입)
3. 우측 상단 프로필 → "API keys" 클릭
4. "+ Create new secret key" 클릭
5. 이름 입력 (예: "Enneagram App")
6. 생성된 키 복사 (sk-로 시작)
7. ⚠️ 키는 한 번만 표시되므로 반드시 저장!

---

## 💡 추가 정보

### API Key 보안
- Supabase에 저장된 API Key는 암호화되지 않습니다
- 프로덕션 환경에서는 Supabase의 "Secrets" 기능 사용 권장
- 정기적으로 API Key를 교체하세요

### 프롬프트 관리
- 여러 버전의 프롬프트를 저장 가능
- 한 번에 하나의 프롬프트만 활성화 가능
- 프롬프트 변경 후 즉시 적용됨

### 비용 관리
- GPT-4o-mini: 약 $0.15 / 1M input tokens
- 리포트 1회 생성: 약 $0.001~0.003
- OpenAI Dashboard에서 사용량 모니터링

