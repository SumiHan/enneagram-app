-- ===================================
-- 설문 문항 개수 및 중복 확인
-- ===================================

-- 1. 사전 설문 문항 개수
SELECT 
  'pre_survey_questions' AS table_name,
  COUNT(*) AS total_count,
  COUNT(DISTINCT q_id) AS unique_q_id_count
FROM public.pre_survey_questions;

-- 2. 본 설문 문항 개수
SELECT 
  'main_survey_questions' AS table_name,
  COUNT(*) AS total_count,
  COUNT(DISTINCT q_id) AS unique_q_id_count
FROM public.main_survey_questions;

-- 3. 본 설문 문항 중복 확인
SELECT 
  q_id,
  COUNT(*) AS duplicate_count
FROM public.main_survey_questions
GROUP BY q_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 4. 본 설문 문항 목록 (처음 10개)
SELECT 
  q_id,
  text_ko,
  type,
  type_name
FROM public.main_survey_questions
ORDER BY q_id
LIMIT 10;

-- 5. 본 설문 문항 목록 (마지막 10개)
SELECT 
  q_id,
  text_ko,
  type,
  type_name
FROM public.main_survey_questions
ORDER BY q_id DESC
LIMIT 10;

-- 6. q_id 범위 확인
SELECT 
  MIN(q_id::integer) AS min_q_id,
  MAX(q_id::integer) AS max_q_id,
  COUNT(*) AS total_count
FROM public.main_survey_questions
WHERE q_id ~ '^[0-9]+$';  -- 숫자만 있는 q_id

-- 7. 중복 또는 빈 행 삭제 (필요시 실행)
-- ⚠️ 실행 전 위의 쿼리로 먼저 확인하세요!

-- 중복된 q_id 중 최신 것만 유지하고 나머지 삭제
-- DELETE FROM public.main_survey_questions
-- WHERE id NOT IN (
--   SELECT MIN(id)
--   FROM public.main_survey_questions
--   GROUP BY q_id
-- );

-- 빈 text_ko가 있는 행 삭제
-- DELETE FROM public.main_survey_questions
-- WHERE text_ko IS NULL OR text_ko = '';

-- 90개만 유지 (q_id 1~90)
-- DELETE FROM public.main_survey_questions
-- WHERE q_id::integer > 90 OR q_id::integer < 1;

