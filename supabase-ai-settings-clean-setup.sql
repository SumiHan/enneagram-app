-- ===================================
-- AI Settings 완전 초기화 및 재설정
-- ===================================

-- 1단계: 기존 정책 모두 삭제
DROP POLICY IF EXISTS "Allow authenticated users to view ai_settings" ON public.ai_settings;
DROP POLICY IF EXISTS "Allow authenticated users to update ai_settings" ON public.ai_settings;
DROP POLICY IF EXISTS "Allow authenticated users to view ai_prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "Allow authenticated users to insert ai_prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "Allow authenticated users to update ai_prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "Allow authenticated users to delete ai_prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "Admins can view ai_settings" ON public.ai_settings;
DROP POLICY IF EXISTS "Admins can update ai_settings" ON public.ai_settings;
DROP POLICY IF EXISTS "Admins can view ai_prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "Admins can insert ai_prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "Admins can update ai_prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "Admins can delete ai_prompts" ON public.ai_prompts;

-- 2단계: 기존 트리거 삭제
DROP TRIGGER IF EXISTS update_ai_settings_updated_at ON public.ai_settings;
DROP TRIGGER IF EXISTS update_ai_prompts_updated_at ON public.ai_prompts;

-- 3단계: 기존 테이블 삭제 (CASCADE로 모든 의존성 삭제)
DROP TABLE IF EXISTS public.ai_settings CASCADE;
DROP TABLE IF EXISTS public.ai_prompts CASCADE;

-- 4단계: ai_prompts 테이블 생성
CREATE TABLE public.ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5단계: ai_settings 테이블 생성
CREATE TABLE public.ai_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  openai_api_key TEXT,
  active_prompt_id UUID REFERENCES public.ai_prompts(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT single_row_constraint CHECK (id = 1)
);

-- 6단계: RLS 활성화
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- 7단계: RLS 정책 생성 (인증된 사용자 모두 허용)
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

-- 8단계: updated_at 자동 업데이트 함수 생성 (이미 존재하면 재생성)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9단계: 트리거 생성
CREATE TRIGGER update_ai_prompts_updated_at
  BEFORE UPDATE ON public.ai_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_settings_updated_at
  BEFORE UPDATE ON public.ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 10단계: 기본 데이터 삽입
-- 기본 설정 생성
INSERT INTO public.ai_settings (id, openai_api_key, active_prompt_id)
VALUES (1, NULL, NULL);

-- 기본 프롬프트 생성
INSERT INTO public.ai_prompts (title, description, content, is_active)
VALUES (
  '기본 에니어그램 분석 프롬프트',
  '사용자의 설문 응답을 바탕으로 에니어그램 유형을 분석하고 상세한 리포트를 작성',
  '당신은 에니어그램 전문 심리 분석가이자 진로 컨설턴트입니다.  
아래의 사전 설문과 본 설문 응답 데이터를 바탕으로, 사용자가 에니어그램 9유형 중 어떤 유형에 가장 가까운지 종합적으로 분석하세요.

분석 시 단순 점수 합산이 아닌 다음 요소를 함께 고려하세요:
- 응답 전반에 드러난 정서적 패턴, 사고방식, 가치관, 행동 동기
- 성격의 강점과 한계, 대인관계 스타일, 의사결정 경향
- 대학생 1학년으로서 전공 선택과 진로 탐색 단계에 있는 맥락

출력은 반드시 아래 JSON 형식으로만 작성하세요.  
JSON 이외의 문장은 절대 포함하지 마세요.

{
  "enneagram_type": "숫자 유형명 (예: 1번 개혁가, 2번 조력가 등 1-9번 중 하나)",
  "characteristics": "이 유형의 주요 특징을 3-5문장으로 설명",
  "job_recommendations": ["추천 직업 1", "추천 직업 2", "추천 직업 3"],
  "career_guidance": "이 유형에게 어울리는 전공 선택 및 진로 탐색 방향에 대한 구체적 조언 (3~4문장)",
  "growth_advice": "이 유형이 균형 잡힌 성장을 위해 유념해야 할 조언 (2~3문장)"
}

이제 다음 데이터를 분석하세요:
---
사전 설문 응답:
{{pre_survey_responses}}

본 설문 응답:
{{main_survey_responses}}
---',
  true
);

-- 11단계: active_prompt_id 업데이트
UPDATE public.ai_settings
SET active_prompt_id = (SELECT id FROM public.ai_prompts WHERE is_active = true LIMIT 1)
WHERE id = 1;

-- 12단계: 확인 쿼리
SELECT 'ai_settings 테이블:', * FROM public.ai_settings;
SELECT 'ai_prompts 테이블:', * FROM public.ai_prompts;

-- 완료 메시지
SELECT '✅ AI Settings 테이블이 성공적으로 생성되었습니다!' AS status;

