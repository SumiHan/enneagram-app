-- question_csv_versions 테이블 생성
-- 사전/본 설문 CSV 파일 버전 관리

CREATE TABLE IF NOT EXISTS question_csv_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('pre', 'main')),
  filename text NOT NULL,
  description text,
  question_count integer NOT NULL DEFAULT 0,
  question_data jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT false,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_question_csv_versions_type ON question_csv_versions(type);
CREATE INDEX IF NOT EXISTS idx_question_csv_versions_is_active ON question_csv_versions(is_active);

-- RLS 활성화
ALTER TABLE question_csv_versions ENABLE ROW LEVEL SECURITY;

-- 관리자만 읽기/쓰기 가능 (admin 역할 체크)
CREATE POLICY "Admin full access" ON question_csv_versions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
