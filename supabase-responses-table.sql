-- =============================================
-- responses 테이블: 설문 응답 저장 (서버 기반)
-- =============================================

-- responses 테이블 생성
CREATE TABLE IF NOT EXISTS public.responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    survey_type TEXT NOT NULL CHECK (survey_type IN ('pre', 'main')),
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
    answers JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, survey_type) -- 한 사용자당 각 설문 타입마다 하나의 레코드만
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_responses_user_id ON public.responses(user_id);
CREATE INDEX IF NOT EXISTS idx_responses_survey_type ON public.responses(survey_type);
CREATE INDEX IF NOT EXISTS idx_responses_status ON public.responses(status);
CREATE INDEX IF NOT EXISTS idx_responses_user_survey ON public.responses(user_id, survey_type);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_responses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS responses_updated_at_trigger ON public.responses;
CREATE TRIGGER responses_updated_at_trigger
  BEFORE UPDATE ON public.responses
  FOR EACH ROW
  EXECUTE FUNCTION update_responses_updated_at();

-- =============================================
-- RLS (Row Level Security) 정책
-- =============================================

ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 응답만 조회 가능
CREATE POLICY "Users can view their own responses"
  ON public.responses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 사용자는 자신의 응답 생성 가능
CREATE POLICY "Users can create their own responses"
  ON public.responses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 응답 수정 가능
CREATE POLICY "Users can update their own responses"
  ON public.responses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 관리자는 모든 응답 조회 가능
CREATE POLICY "Admins can view all responses"
  ON public.responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- 관리자는 모든 응답 삭제 가능
CREATE POLICY "Admins can delete any responses"
  ON public.responses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- =============================================
-- 샘플 데이터 조회 쿼리 (참고용)
-- =============================================

-- 특정 사용자의 사전 설문 응답 조회
-- SELECT * FROM public.responses 
-- WHERE user_id = 'USER_UUID' AND survey_type = 'pre';

-- 진행 중인 모든 응답 조회
-- SELECT r.*, u.email, u.name
-- FROM public.responses r
-- JOIN public.users u ON r.user_id = u.id
-- WHERE r.status = 'in_progress';

-- 완료된 사전 설문 수 조회
-- SELECT COUNT(*) FROM public.responses 
-- WHERE survey_type = 'pre' AND status = 'completed';

