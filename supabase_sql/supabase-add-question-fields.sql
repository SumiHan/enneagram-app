-- pre_survey_questions 테이블에 required, answer_type 컬럼 추가
ALTER TABLE pre_survey_questions
  ADD COLUMN IF NOT EXISTS required TEXT DEFAULT 'y',
  ADD COLUMN IF NOT EXISTS answer_type TEXT DEFAULT '객관식-단일선택';
