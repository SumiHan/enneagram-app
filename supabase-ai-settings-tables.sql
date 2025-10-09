-- AI Prompts Table
CREATE TABLE IF NOT EXISTS public.ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Settings Table (single row for global settings)
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  openai_api_key TEXT,
  active_prompt_id UUID REFERENCES public.ai_prompts(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT single_row_constraint CHECK (id = 1)
);

-- Insert default settings
INSERT INTO public.ai_settings (id, openai_api_key, active_prompt_id)
VALUES (1, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Insert default prompt
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
);

-- Update active_prompt_id in settings to the newly created prompt
UPDATE public.ai_settings
SET active_prompt_id = (SELECT id FROM public.ai_prompts WHERE is_active = true LIMIT 1)
WHERE id = 1;

-- Enable RLS
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_prompts
-- Admins can do everything
CREATE POLICY "Admins can view ai_prompts"
  ON public.ai_prompts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert ai_prompts"
  ON public.ai_prompts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update ai_prompts"
  ON public.ai_prompts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete ai_prompts"
  ON public.ai_prompts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for ai_settings
CREATE POLICY "Admins can view ai_settings"
  ON public.ai_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update ai_settings"
  ON public.ai_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_prompts_updated_at
  BEFORE UPDATE ON public.ai_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_settings_updated_at
  BEFORE UPDATE ON public.ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

