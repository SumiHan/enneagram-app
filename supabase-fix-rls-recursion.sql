-- ============================================
-- Supabase RLS 무한 재귀 문제 해결
-- ============================================
-- 이 스크립트는 기존의 잘못된 RLS 정책을 삭제하고
-- 올바른 정책으로 교체합니다.

-- 1. 기존 정책 모두 삭제
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON users;
DROP POLICY IF EXISTS "Allow users to read own data" ON users;
DROP POLICY IF EXISTS "Allow users to update own data" ON users;

DROP POLICY IF EXISTS "Users can read own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;
DROP POLICY IF EXISTS "Allow authenticated users to insert progress" ON user_progress;

DROP POLICY IF EXISTS "Users can read own answers" ON survey_answers;
DROP POLICY IF EXISTS "Users can insert own answers" ON survey_answers;
DROP POLICY IF EXISTS "Users can update own answers" ON survey_answers;

DROP POLICY IF EXISTS "Users can read own reports" ON reports;
DROP POLICY IF EXISTS "Users can insert own reports" ON reports;
DROP POLICY IF EXISTS "Users can update own reports" ON reports;

-- 2. users 테이블: 간단한 정책
-- 인증된 사용자는 자신의 데이터만 읽고 쓸 수 있음
CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. user_progress 테이블
CREATE POLICY "progress_select_own"
  ON user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "progress_insert_own"
  ON user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "progress_update_own"
  ON user_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. survey_answers 테이블
CREATE POLICY "answers_select_own"
  ON survey_answers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "answers_insert_own"
  ON survey_answers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "answers_update_own"
  ON survey_answers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. reports 테이블
CREATE POLICY "reports_select_own"
  ON reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "reports_insert_own"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reports_update_own"
  ON reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. 관리자용 정책 추가 (선택사항)
-- 관리자는 모든 데이터를 볼 수 있음
-- 주의: 이 정책은 users 테이블을 참조하므로 재귀 위험이 있습니다.
-- 대신 service_role 키를 사용하는 것을 권장합니다.

-- 완료!
-- 이제 Supabase Dashboard에서 이 SQL을 실행하세요.
