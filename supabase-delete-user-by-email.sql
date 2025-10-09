-- ===================================
-- 이메일 주소 기반으로 사용자 및 관련 데이터 삭제
-- ===================================

-- 사용 방법:
-- 1. 아래 SQL에서 'user@example.com' 부분을 삭제할 이메일로 변경
-- 2. 실행

-- ⚠️ 주의: CASCADE DELETE 설정이 되어있어야 합니다!
-- supabase-cleanup-and-cascade.sql을 먼저 실행하세요.

-- Step 1: 삭제할 사용자 확인 (먼저 확인!)
SELECT 
  id,
  email,
  name,
  role,
  created_at
FROM public.users
WHERE email = 'user@example.com';  -- ← 여기에 삭제할 이메일 입력

-- Step 2: 해당 사용자의 관련 데이터 확인
-- responses 테이블
SELECT 
  'responses' AS table_name,
  COUNT(*) AS record_count
FROM public.responses
WHERE user_id = (SELECT id FROM public.users WHERE email = 'user@example.com');

-- user_progress 테이블
SELECT 
  'user_progress' AS table_name,
  COUNT(*) AS record_count
FROM public.user_progress
WHERE user_id = (SELECT id FROM public.users WHERE email = 'user@example.com');

-- reports 테이블
SELECT 
  'reports' AS table_name,
  COUNT(*) AS record_count
FROM public.reports
WHERE user_id = (SELECT id FROM public.users WHERE email = 'user@example.com');

-- Step 3: 사용자 삭제 (CASCADE로 관련 데이터도 자동 삭제)
-- ⚠️ 주의: 이 명령은 되돌릴 수 없습니다!
-- 실행 전 위의 Step 1, 2로 확인한 후 실행하세요.

DELETE FROM public.users
WHERE email = 'user@example.com';  -- ← 여기에 삭제할 이메일 입력

-- Step 4: 삭제 확인
-- 해당 사용자가 삭제되었는지 확인 (0개여야 함)
SELECT COUNT(*) AS remaining_user_count
FROM public.users
WHERE email = 'user@example.com';

-- 관련 데이터도 삭제되었는지 확인 (모두 0개여야 함)
SELECT 
  (SELECT COUNT(*) FROM public.responses WHERE user_id = '049b440a-7280-4f12-b9af-3a603960bb2b') AS responses_count,
  (SELECT COUNT(*) FROM public.user_progress WHERE user_id = '049b440a-7280-4f12-b9af-3a603960bb2b') AS progress_count,
  (SELECT COUNT(*) FROM public.reports WHERE user_id = '049b440a-7280-4f12-b9af-3a603960bb2b') AS reports_count;

-- ===================================
-- 여러 사용자 일괄 삭제 (선택사항)
-- ===================================

-- 예시: 특정 도메인의 모든 사용자 삭제
-- DELETE FROM public.users
-- WHERE email LIKE '%@test.com';

-- 예시: 여러 이메일 삭제
-- DELETE FROM public.users
-- WHERE email IN (
--   'user1@example.com',
--   'user2@example.com',
--   'user3@example.com'
-- );

-- ===================================
-- 안전한 삭제를 위한 트랜잭션 사용 (권장)
-- ===================================

-- BEGIN;
-- 
-- -- 삭제 실행
-- DELETE FROM public.users
-- WHERE email = 'user@example.com';
-- 
-- -- 확인 후 커밋 또는 롤백
-- -- COMMIT;   -- 삭제를 확정하려면 주석 해제
-- ROLLBACK;  -- 취소하려면 이것 실행

