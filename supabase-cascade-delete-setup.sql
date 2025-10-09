-- ===================================
-- Cascade Delete Setup for User Data
-- ===================================
-- When a user is deleted from 'users' table, 
-- automatically delete all related data from other tables

-- Step 1: Check existing Foreign Keys
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE confrelid = 'public.users'::regclass
  AND contype = 'f';

-- Step 2: Remove existing Foreign Keys (if any)
ALTER TABLE public.responses
DROP CONSTRAINT IF EXISTS responses_user_id_fkey;

ALTER TABLE public.user_progress
DROP CONSTRAINT IF EXISTS user_progress_user_id_fkey;

ALTER TABLE public.reports
DROP CONSTRAINT IF EXISTS reports_user_id_fkey;

-- Step 3: Add Foreign Keys with CASCADE DELETE

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

-- Step 4: Verify constraints are set correctly
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
SELECT '✅ CASCADE DELETE가 성공적으로 설정되었습니다!' AS status;
SELECT '이제 users 테이블에서 사용자를 삭제하면 responses, user_progress, reports에서도 자동으로 삭제됩니다.' AS info;

