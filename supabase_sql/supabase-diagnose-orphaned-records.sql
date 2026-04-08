-- ===================================
-- 고아 레코드 진단 및 정리
-- ===================================

-- Step 1: responses 테이블의 고아 레코드 찾기
SELECT 
  r.user_id,
  r.survey_type,
  r.status,
  r.updated_at,
  'NOT IN USERS TABLE' AS issue
FROM public.responses r
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = r.user_id
)
ORDER BY r.updated_at DESC;

-- Step 2: user_progress 테이블의 고아 레코드 찾기
SELECT 
  up.user_id,
  up.pre_survey_status,
  up.main_survey_status,
  'NOT IN USERS TABLE' AS issue
FROM public.user_progress up
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = up.user_id
)
ORDER BY up.user_id;

-- Step 3: reports 테이블의 고아 레코드 찾기
SELECT 
  rep.user_id,
  rep.enneagram_type,
  rep.id,
  'NOT IN USERS TABLE' AS issue
FROM public.reports rep
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = rep.user_id
)
ORDER BY rep.id DESC;

-- Step 4: 고아 레코드 개수 요약
SELECT 
  (SELECT COUNT(*) FROM public.responses WHERE user_id NOT IN (SELECT id FROM public.users)) AS orphaned_responses,
  (SELECT COUNT(*) FROM public.user_progress WHERE user_id NOT IN (SELECT id FROM public.users)) AS orphaned_progress,
  (SELECT COUNT(*) FROM public.reports WHERE user_id NOT IN (SELECT id FROM public.users)) AS orphaned_reports;

-- ===================================
-- 고아 레코드 삭제 (⚠️ 신중하게!)
-- ===================================

-- 실행 전에 위의 Step 1-4로 어떤 데이터가 삭제될지 확인하세요!

-- 고아 레코드 삭제
DELETE FROM public.responses
WHERE user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.user_progress
WHERE user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.reports
WHERE user_id NOT IN (SELECT id FROM public.users);

-- 삭제 확인 (모두 0이어야 함)
SELECT 
  (SELECT COUNT(*) FROM public.responses WHERE user_id NOT IN (SELECT id FROM public.users)) AS remaining_orphaned_responses,
  (SELECT COUNT(*) FROM public.user_progress WHERE user_id NOT IN (SELECT id FROM public.users)) AS remaining_orphaned_progress,
  (SELECT COUNT(*) FROM public.reports WHERE user_id NOT IN (SELECT id FROM public.users)) AS remaining_orphaned_reports;

SELECT '✅ 고아 레코드가 모두 삭제되었습니다!' AS status;

