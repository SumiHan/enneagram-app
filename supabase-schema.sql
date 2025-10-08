-- Supabase 데이터베이스 스키마
-- SQL 편집기에서 실행하세요

-- 1. Users 테이블 (사용자 정보)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL, -- 실제로는 bcrypt 등으로 해시화 필요
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User Progress 테이블 (사용자별 진행 상태)
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- 사전 설문 진행 상태
  pre_survey_status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (pre_survey_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  pre_survey_answered_count INTEGER DEFAULT 0,
  pre_survey_total_count INTEGER DEFAULT 0,
  
  -- 본 설문 진행 상태
  main_survey_status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (main_survey_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  main_survey_sets INTEGER DEFAULT 0,
  main_survey_total_sets INTEGER DEFAULT 3,
  main_survey_seed INTEGER,
  main_survey_current_page INTEGER DEFAULT 0,
  
  -- 리포트 상태
  report_status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (report_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  report_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- 3. Survey Answers 테이블 (설문 응답)
CREATE TABLE IF NOT EXISTS survey_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  survey_type TEXT NOT NULL CHECK (survey_type IN ('PRE', 'MAIN')),
  q_id TEXT NOT NULL, -- 질문 ID
  value INTEGER NOT NULL, -- 선택한 값 (1-based index)
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 사용자별, 설문 타입별, 질문 ID별로 유니크
  UNIQUE(user_id, survey_type, q_id)
);

-- 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_survey_answers_user_type ON survey_answers(user_id, survey_type);
CREATE INDEX IF NOT EXISTS idx_survey_answers_user_qid ON survey_answers(user_id, q_id);

-- 4. Reports 테이블 (생성된 리포트)
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  enneagram_type TEXT NOT NULL, -- 예: "3 성취가"
  characteristics TEXT, -- 특징 설명
  job_recommendations JSONB, -- 직업 추천 배열 ["직업1", "직업2", "직업3"]
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id) -- 사용자당 하나의 최신 리포트만 유지
);

-- 5. Question Versions 테이블 (설문 문항 버전 관리)
CREATE TABLE IF NOT EXISTS question_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_type TEXT NOT NULL CHECK (survey_type IN ('PRE', 'MAIN')),
  version_name TEXT NOT NULL,
  filename TEXT NOT NULL,
  description TEXT,
  question_count INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  questions_data JSONB NOT NULL, -- 전체 문항 데이터 배열
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES users(id)
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_question_versions_type_active ON question_versions(survey_type, is_active);

-- 6. AI Prompts 테이블 (AI 프롬프트 관리)
CREATE TABLE IF NOT EXISTS ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- 7. AI Settings 테이블 (OpenAI API Key 등)
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 데이터: OpenAI API Key 설정
INSERT INTO ai_settings (setting_key, setting_value) 
VALUES ('openai_api_key', NULL)
ON CONFLICT (setting_key) DO NOTHING;

-- 8. Row Level Security (RLS) 설정

-- Users 테이블: 본인 정보만 읽기/수정 가능
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid()::text = id::text OR EXISTS (
    SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
  ));

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid()::text = id::text);

-- User Progress 테이블: 본인 진행 상태만 읽기/수정 가능
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON user_progress FOR SELECT
  USING (user_id::text = auth.uid()::text OR EXISTS (
    SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
  ));

CREATE POLICY "Users can update own progress"
  ON user_progress FOR ALL
  USING (user_id::text = auth.uid()::text);

-- Survey Answers 테이블: 본인 응답만 읽기/수정 가능
ALTER TABLE survey_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own answers"
  ON survey_answers FOR SELECT
  USING (user_id::text = auth.uid()::text OR EXISTS (
    SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
  ));

CREATE POLICY "Users can manage own answers"
  ON survey_answers FOR ALL
  USING (user_id::text = auth.uid()::text);

-- Reports 테이블: 본인 리포트만 읽기 가능
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  USING (user_id::text = auth.uid()::text OR EXISTS (
    SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
  ));

CREATE POLICY "Users can manage own reports"
  ON reports FOR ALL
  USING (user_id::text = auth.uid()::text);

-- Question Versions: 관리자만 수정 가능, 모든 사용자 읽기 가능
ALTER TABLE question_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view question versions"
  ON question_versions FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage question versions"
  ON question_versions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
  ));

-- AI Prompts: 관리자만 관리 가능
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active prompts"
  ON ai_prompts FOR SELECT
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
  ));

CREATE POLICY "Only admins can manage prompts"
  ON ai_prompts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
  ));

-- AI Settings: 관리자만 관리 가능
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage ai settings"
  ON ai_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
  ));

-- 9. Functions (자동 타임스탬프 업데이트)

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_progress_updated_at
  BEFORE UPDATE ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_ai_prompts_updated_at
  BEFORE UPDATE ON ai_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_ai_settings_updated_at
  BEFORE UPDATE ON ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 10. 유용한 뷰 (관리자용)

-- 사용자별 진행 상황 요약
CREATE OR REPLACE VIEW v_user_progress_summary AS
SELECT 
  u.id,
  u.email,
  u.name,
  u.role,
  up.pre_survey_status,
  up.pre_survey_answered_count,
  up.pre_survey_total_count,
  up.main_survey_status,
  up.main_survey_sets,
  up.main_survey_total_sets,
  up.report_status,
  (SELECT COUNT(*) FROM survey_answers WHERE user_id = u.id AND survey_type = 'PRE') as pre_actual_count,
  (SELECT COUNT(*) FROM survey_answers WHERE user_id = u.id AND survey_type = 'MAIN') as main_actual_count,
  u.created_at,
  up.updated_at as last_activity
FROM users u
LEFT JOIN user_progress up ON u.id = up.user_id
WHERE u.role = 'user'
ORDER BY up.updated_at DESC NULLS LAST;

-- 활성 설문 문항 조회
CREATE OR REPLACE VIEW v_active_questions AS
SELECT 
  survey_type,
  version_name,
  question_count,
  questions_data,
  uploaded_at
FROM question_versions
WHERE is_active = true;

-- 활성 AI 프롬프트 조회
CREATE OR REPLACE VIEW v_active_prompt AS
SELECT 
  title,
  content,
  updated_at
FROM ai_prompts
WHERE is_active = true
LIMIT 1;

-- 완료!
-- 이제 Supabase Dashboard → SQL Editor에서 위 SQL을 실행하세요.
