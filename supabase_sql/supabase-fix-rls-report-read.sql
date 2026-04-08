-- 리포트 생성 시 일반 사용자도 AI 설정을 읽을 수 있도록 SELECT 정책 추가

-- ai_settings: 인증된 사용자 읽기 허용
CREATE POLICY "Authenticated users can read ai_settings"
  ON public.ai_settings FOR SELECT
  TO authenticated
  USING (true);

-- ai_prompts: 인증된 사용자 읽기 허용 (시스템 프롬프트 로드용)
CREATE POLICY "Authenticated users can read ai_prompts"
  ON public.ai_prompts FOR SELECT
  TO authenticated
  USING (true);

-- ai_prompt_sections: 인증된 사용자 읽기 허용 (사용자 프롬프트 섹션 로드용)
CREATE POLICY "Authenticated users can read ai_prompt_sections"
  ON public.ai_prompt_sections FOR SELECT
  TO authenticated
  USING (true);
