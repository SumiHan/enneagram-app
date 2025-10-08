-- RLS 정책 수정: 회원가입 허용

-- 기존 정책 삭제 (필요시)
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- 새로운 정책 추가

-- 1. 회원가입 시 INSERT 허용 (누구나 회원가입 가능)
CREATE POLICY "Anyone can insert users during signup"
  ON users FOR INSERT
  WITH CHECK (true);

-- 2. 본인 프로필 조회 가능
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (
    auth.uid()::text = id::text 
    OR EXISTS (
      SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

-- 3. 본인 프로필 수정 가능
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid()::text = id::text);

-- User Progress 테이블도 동일하게 수정
DROP POLICY IF EXISTS "Users can view own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;

-- 회원가입 시 progress INSERT 허용
CREATE POLICY "Anyone can insert progress during signup"
  ON user_progress FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own progress"
  ON user_progress FOR SELECT
  USING (
    user_id::text = auth.uid()::text 
    OR EXISTS (
      SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

CREATE POLICY "Users can update own progress"
  ON user_progress FOR UPDATE
  USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can delete own progress"
  ON user_progress FOR DELETE
  USING (user_id::text = auth.uid()::text);

-- Survey Answers 테이블 수정
DROP POLICY IF EXISTS "Users can view own answers" ON survey_answers;
DROP POLICY IF EXISTS "Users can manage own answers" ON survey_answers;

CREATE POLICY "Anyone can insert answers"
  ON survey_answers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own answers"
  ON survey_answers FOR SELECT
  USING (
    user_id::text = auth.uid()::text 
    OR EXISTS (
      SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

CREATE POLICY "Users can update own answers"
  ON survey_answers FOR UPDATE
  USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can delete own answers"
  ON survey_answers FOR DELETE
  USING (user_id::text = auth.uid()::text);

-- Reports 테이블 수정
DROP POLICY IF EXISTS "Users can view own reports" ON reports;
DROP POLICY IF EXISTS "Users can manage own reports" ON reports;

CREATE POLICY "Anyone can insert reports"
  ON reports FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  USING (
    user_id::text = auth.uid()::text 
    OR EXISTS (
      SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

CREATE POLICY "Users can update own reports"
  ON reports FOR UPDATE
  USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can delete own reports"
  ON reports FOR DELETE
  USING (user_id::text = auth.uid()::text);

-- 완료!
-- Supabase SQL Editor에서 이 스크립트를 실행하세요.
