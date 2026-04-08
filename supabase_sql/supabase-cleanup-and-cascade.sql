-- ===================================
-- Clean up orphaned records and setup CASCADE DELETE
-- ===================================

-- Step 1: Find orphaned records (데이터 확인용)
-- responses 테이블의 고아 레코드 확인
SELECT 
  'responses' AS table_name,
  COUNT(*) AS orphaned_count
FROM public.responses r
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = r.user_id
);

-- user_progress 테이블의 고아 레코드 확인
SELECT 
  'user_progress' AS table_name,
  COUNT(*) AS orphaned_count
FROM public.user_progress up
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = up.user_id
);

-- reports 테이블의 고아 레코드 확인
SELECT 
  'reports' AS table_name,
  COUNT(*) AS orphaned_count
FROM public.reports rep
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = rep.user_id
);

-- Step 2: Delete orphaned records
-- ⚠️ 주의: 이 단계는 되돌릴 수 없습니다!

-- responses에서 고아 레코드 삭제
DELETE FROM public.responses
WHERE user_id NOT IN (SELECT id FROM public.users);

-- user_progress에서 고아 레코드 삭제
DELETE FROM public.user_progress
WHERE user_id NOT IN (SELECT id FROM public.users);

-- reports에서 고아 레코드 삭제
DELETE FROM public.reports
WHERE user_id NOT IN (SELECT id FROM public.users);

-- Step 3: Remove existing Foreign Keys (if any)
ALTER TABLE public.responses
DROP CONSTRAINT IF EXISTS responses_user_id_fkey;

ALTER TABLE public.user_progress
DROP CONSTRAINT IF EXISTS user_progress_user_id_fkey;

ALTER TABLE public.reports
DROP CONSTRAINT IF EXISTS reports_user_id_fkey;

-- Step 4: Add Foreign Keys with CASCADE DELETE

-- responses 테이블
ALTER TABLE public.responses
ADD CONSTRAINT responses_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE CASCADE;

-- user_progress 테이블
ALTER TABLE public.user_progress
ADD CONSTRAINT user_progress_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE CASCADE;

-- reports 테이블
ALTER TABLE public.reports
ADD CONSTRAINT reports_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE CASCADE;

-- Step 5: Verify constraints are set correctly
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  CASE confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS delete_action
FROM pg_constraint
WHERE confrelid = 'public.users'::regclass
  AND contype = 'f'
ORDER BY conrelid::regclass::text;

-- Success message
SELECT '✅ 고아 레코드가 정리되고 CASCADE DELETE가 성공적으로 설정되었습니다!' AS status;

