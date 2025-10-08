-- 이메일 확인 없이 로그인 가능하도록 설정

-- 방법 1: 기존 사용자들의 이메일을 확인된 것으로 처리
UPDATE auth.users 
SET email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- 이제 모든 사용자가 로그인 가능합니다.

-- 참고: Supabase Dashboard에서도 설정 가능
-- Authentication → Providers → Email → "Confirm email" OFF
