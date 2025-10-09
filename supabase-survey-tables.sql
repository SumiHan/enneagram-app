-- ============================================
-- 설문 문항 테이블 생성
-- ============================================

-- 1. 사전 설문 문항 테이블
CREATE TABLE IF NOT EXISTS pre_survey_questions (
  id SERIAL PRIMARY KEY,
  q_id VARCHAR(50) UNIQUE NOT NULL,
  category VARCHAR(100),
  text_ko TEXT NOT NULL,
  options TEXT, -- JSON 문자열 또는 쉼표 구분
  purpose TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 본 설문 문항 테이블
CREATE TABLE IF NOT EXISTS main_survey_questions (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  type_name VARCHAR(100),
  q_id VARCHAR(50) NOT NULL,
  text_ko TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_pre_survey_q_id ON pre_survey_questions(q_id);
CREATE INDEX IF NOT EXISTS idx_main_survey_q_id ON main_survey_questions(q_id);
CREATE INDEX IF NOT EXISTS idx_main_survey_type ON main_survey_questions(type);

-- 4. RLS 정책 설정 (모든 인증된 사용자가 읽기 가능)
ALTER TABLE pre_survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE main_survey_questions ENABLE ROW LEVEL SECURITY;

-- 읽기 정책
CREATE POLICY "authenticated_read_pre_questions"
  ON pre_survey_questions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_read_main_questions"
  ON main_survey_questions FOR SELECT
  TO authenticated
  USING (true);

-- 관리자만 쓰기 가능
CREATE POLICY "admins_write_pre_questions"
  ON pre_survey_questions FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid() LIMIT 1) = 'admin'
  );

CREATE POLICY "admins_write_main_questions"
  ON main_survey_questions FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid() LIMIT 1) = 'admin'
  );

-- 완료!
