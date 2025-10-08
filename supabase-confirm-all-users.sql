-- 모든 기존 사용자의 이메일을 확인된 것으로 처리

-- auth.users 테이블의 모든 사용자 이메일 확인 처리
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

-- 확인: 모든 사용자 조회
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- 이제 모든 사용자가 로그인 가능합니다!
