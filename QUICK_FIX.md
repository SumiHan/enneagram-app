# 🚨 Foreign Key 에러 빠른 해결 가이드

## 에러 메시지
```
ERROR: insert or update on table "responses" violates foreign key constraint
Key (user_id)=(049b440a-7280-4f12-b9af-3a603960bb2b) is not present in table "users"
```

## ⚡ 빠른 해결 (3단계)

### Step 1: 고아 레코드 삭제 (필수!)

Supabase SQL Editor에서 실행:

```sql
-- responses에서 users에 없는 데이터 삭제
DELETE FROM public.responses
WHERE user_id NOT IN (SELECT id FROM public.users);

-- user_progress에서 users에 없는 데이터 삭제
DELETE FROM public.user_progress
WHERE user_id NOT IN (SELECT id FROM public.users);

-- reports에서 users에 없는 데이터 삭제
DELETE FROM public.reports
WHERE user_id NOT IN (SELECT id FROM public.users);
```

### Step 2: Foreign Key 추가

```sql
-- 기존 제약조건 삭제
ALTER TABLE public.responses DROP CONSTRAINT IF EXISTS responses_user_id_fkey;
ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_user_id_fkey;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_user_id_fkey;

-- CASCADE DELETE와 함께 재생성
ALTER TABLE public.responses
ADD CONSTRAINT responses_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_progress
ADD CONSTRAINT user_progress_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.reports
ADD CONSTRAINT reports_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
```

### Step 3: 확인

```sql
-- CASCADE 설정 확인
SELECT 
  conrelid::regclass AS table_name,
  CASE confdeltype WHEN 'c' THEN 'CASCADE' ELSE 'OTHER' END AS delete_action
FROM pg_constraint
WHERE confrelid = 'public.users'::regclass AND contype = 'f';
```

---

## 📧 이메일 기반 삭제 방법

### 특정 사용자 삭제:

```sql
-- 1. 확인
SELECT id, email, name FROM users WHERE email = 'test@example.com';

-- 2. 삭제 (CASCADE로 자동 정리됨)
DELETE FROM users WHERE email = 'test@example.com';
```

### 여러 사용자 삭제:

```sql
DELETE FROM users WHERE email IN (
  'user1@example.com',
  'user2@example.com',
  'user3@example.com'
);
```

### 도메인 기반 삭제:

```sql
-- 예: @test.com 도메인의 모든 사용자
DELETE FROM users WHERE email LIKE '%@test.com';
```

---

## 🛡️ 안전한 삭제 (트랜잭션)

```sql
BEGIN;

-- 삭제 실행
DELETE FROM users WHERE email = 'user@example.com';

-- 결과 확인 후:
-- COMMIT;   -- 확정
-- 또는
-- ROLLBACK; -- 취소
```

---

## ✅ 요약

1. **먼저** `supabase-cleanup-and-cascade.sql` 실행 → 고아 레코드 정리 + CASCADE 설정
2. **이후** 이메일로 사용자 삭제 가능
3. 삭제하면 관련 데이터(`responses`, `user_progress`, `reports`)도 자동 삭제됨

