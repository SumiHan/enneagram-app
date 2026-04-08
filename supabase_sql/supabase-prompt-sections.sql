-- 사용자 프롬프트 항목(섹션) 테이블
CREATE TABLE IF NOT EXISTS public.ai_prompt_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,                  -- 섹션 표시명 (예: "성격 특성 분석")
  section_key TEXT NOT NULL UNIQUE,     -- AI 응답 JSON 키 (예: "personality_traits")
  description TEXT,                     -- 관리자용 설명
  content TEXT NOT NULL,                -- 이 항목에 대한 프롬프트 내용
  is_active BOOLEAN DEFAULT false,      -- 활성화 여부 (보고서에 포함)
  sort_order INTEGER DEFAULT 0,         -- 출력 순서
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_sections_active ON public.ai_prompt_sections(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_sections_order ON public.ai_prompt_sections(sort_order);

-- RLS
ALTER TABLE public.ai_prompt_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access ai_prompt_sections"
  ON public.ai_prompt_sections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- updated_at 트리거
CREATE TRIGGER update_ai_prompt_sections_updated_at
  BEFORE UPDATE ON public.ai_prompt_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
