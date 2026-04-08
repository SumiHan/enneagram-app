-- pre_survey_questions 테이블에 sort_order 컬럼 추가
ALTER TABLE pre_survey_questions
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pre_survey_sort_order ON pre_survey_questions(sort_order);
