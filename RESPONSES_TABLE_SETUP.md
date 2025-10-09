# Responses 테이블 설정 가이드

## 📋 개요

사전 설문의 응답 상태(`in_progress`, `completed`)를 서버 기반으로 관리하기 위한 `responses` 테이블 설정 방법입니다.

---

## 🚀 Supabase에 테이블 생성하기

### **1단계: Supabase 대시보드 접속**

1. [https://supabase.com](https://supabase.com)에 로그인
2. 프로젝트 선택
3. 좌측 메뉴에서 **SQL Editor** 클릭

---

### **2단계: SQL 스크립트 실행**

**SQL Editor**에서 다음 파일의 내용을 복사하여 실행:

📄 **파일**: `supabase-responses-table.sql`

또는 아래 SQL을 직접 복사하여 실행:

```sql
-- responses 테이블 생성
CREATE TABLE IF NOT EXISTS public.responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    survey_type TEXT NOT NULL CHECK (survey_type IN ('pre', 'main')),
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
    answers JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, survey_type)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_responses_user_id ON public.responses(user_id);
CREATE INDEX IF NOT EXISTS idx_responses_survey_type ON public.responses(survey_type);
CREATE INDEX IF NOT EXISTS idx_responses_status ON public.responses(status);
CREATE INDEX IF NOT EXISTS idx_responses_user_survey ON public.responses(user_id, survey_type);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_responses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS responses_updated_at_trigger ON public.responses;
CREATE TRIGGER responses_updated_at_trigger
  BEFORE UPDATE ON public.responses
  FOR EACH ROW
  EXECUTE FUNCTION update_responses_updated_at();

-- RLS 정책
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own responses"
  ON public.responses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own responses"
  ON public.responses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses"
  ON public.responses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all responses"
  ON public.responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete any responses"
  ON public.responses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
```

**실행**: 우측 하단의 **Run** 버튼 클릭

---

### **3단계: 테이블 생성 확인**

1. 좌측 메뉴에서 **Table Editor** 클릭
2. `responses` 테이블이 생성되었는지 확인
3. 다음 컬럼들이 있는지 확인:
   - `id` (uuid, primary key)
   - `user_id` (uuid, foreign key → auth.users)
   - `survey_type` (text, 'pre' | 'main')
   - `status` (text, 'in_progress' | 'completed')
   - `answers` (jsonb)
   - `created_at` (timestamp)
   - `updated_at` (timestamp)

---

## 📊 데이터 구조

### **answers 컬럼 (JSONB 형식)**

```json
{
  "q1": 1,
  "q2": 3,
  "q3": 2,
  "q4": 1,
  ...
}
```

- **Key**: 질문 ID (예: `"q1"`, `"q2"`)
- **Value**: 선택한 옵션의 인덱스 (1-based, 예: `1`, `2`, `3`)

---

## 🔄 상태별 동작

### **사전 설문 & 본 설문 공통**

### **1️⃣ status = null (응답 없음)**
- **버튼**: "시작하기"
- **동작**: 빈 설문 페이지로 진입

### **2️⃣ status = 'in_progress'**
- **버튼**: "이어하기"
- **동작**: 기존 응답이 선택된 상태로 설문 페이지 진입
- **자동 저장**: 응답 변경 시 500ms 후 자동 저장
- **본 설문 특징**: 3개 페이지(각 30문항) 중 마지막 작업 페이지로 자동 복원

### **3️⃣ status = 'completed'**
- **버튼**: "수정하기"
- **동작**: 완료된 응답이 선택된 상태로 설문 페이지 진입
- **수정 가능**: 응답 변경 후 다시 완료하면 `status = 'completed'` 유지

---

## 🌐 다중 기기 동기화

### **동작 방식**

1. **PC에서 설문 진행**
   - 자동 저장 → Supabase `responses` 테이블에 저장

2. **모바일에서 로그인**
   - Supabase에서 마지막 저장 상태 불러옴
   - 동일한 응답 상태 표시 (`in_progress` 또는 `completed`)

3. **실시간 동기화**
   - 모든 변경사항은 Supabase에 저장
   - 어느 기기에서든 최신 상태 확인 가능

---

## 🛠️ 문제 해결

### **1. 테이블이 생성되지 않을 때**

```sql
-- 기존 테이블 삭제 후 재생성
DROP TABLE IF EXISTS public.responses CASCADE;
```

그 후 위의 SQL 스크립트 다시 실행

---

### **2. RLS 정책 오류**

```sql
-- 모든 RLS 정책 삭제
DROP POLICY IF EXISTS "Users can view their own responses" ON public.responses;
DROP POLICY IF EXISTS "Users can create their own responses" ON public.responses;
DROP POLICY IF EXISTS "Users can update their own responses" ON public.responses;
DROP POLICY IF EXISTS "Admins can view all responses" ON public.responses;
DROP POLICY IF EXISTS "Admins can delete any responses" ON public.responses;
```

그 후 정책 재생성

---

### **3. 응답이 저장되지 않을 때**

1. **브라우저 콘솔 확인**
   - F12 → Console 탭
   - 에러 메시지 확인

2. **Supabase 로그 확인**
   - Supabase Dashboard → Logs
   - API 요청 실패 여부 확인

3. **RLS 정책 확인**
   - Table Editor → responses 테이블
   - RLS 정책이 제대로 설정되었는지 확인

---

## ✅ 테스트 체크리스트

### **기본 기능 테스트 (사전 설문)**

- [ ] 처음 설문 시작 → "시작하기" 버튼 표시
- [ ] 설문 중간에 나가기 → 다시 들어오면 "이어하기" 버튼 + 기존 응답 유지
- [ ] 설문 완료 → "수정하기" 버튼 표시
- [ ] 완료 후 수정 → 기존 응답 모두 표시
- [ ] 응답 변경 → 500ms 후 자동 저장 확인 (Supabase Table Editor에서 확인)

### **본 설문 테스트**

- [ ] 처음 설문 시작 → "시작하기" 버튼 표시
- [ ] 1페이지 진행 후 나가기 → "이어하기" 버튼 + 1페이지 응답 유지
- [ ] 2페이지 진행 후 나가기 → "이어하기" 버튼 + 2페이지로 복원 + 1~2페이지 응답 유지
- [ ] 3페이지 완료 → "수정하기" 버튼 표시
- [ ] 완료 후 수정 → 모든 페이지 응답 표시 (90문항 전체)
- [ ] 응답 변경 → 500ms 후 자동 저장 확인 (전체 90문항 저장 확인)

### **다중 기기 테스트**

- [ ] PC에서 설문 진행 → 모바일에서 동일한 상태 확인
- [ ] 모바일에서 응답 변경 → PC에서 새로고침 후 변경사항 확인
- [ ] 한 기기에서 완료 → 다른 기기에서 "수정하기" 버튼 확인

---

## 📚 관련 파일

- **SQL 스크립트**: `supabase-responses-table.sql`
- **API 함수**: `src/lib/api.ts` → `apiGetPreResponse`, `apiPatchPreAnswers`, `apiCompletePre`
- **홈 페이지**: `src/app/page.tsx`
- **사전 설문 페이지**: `src/app/surveys/pre/page.tsx`

---

## 💡 참고사항

### **localStorage 대신 Supabase를 사용하는 이유**

1. ✅ **다중 기기 동기화**: 어느 기기에서든 동일한 응답 상태
2. ✅ **브라우저 독립성**: 브라우저를 바꿔도 응답 유지
3. ✅ **안정성**: localStorage는 사용자가 삭제하거나 브라우저 캐시 정리 시 데이터 손실
4. ✅ **관리 용이성**: 관리자가 Supabase에서 직접 응답 데이터 확인 가능

---

## 🎉 완료!

이제 **사전 설문**과 **본 설문** 모두 서버 기반으로 작동합니다:
- ✅ 상태별 버튼 표시 (시작하기/이어하기/수정하기)
- ✅ 기존 응답 자동 로드
- ✅ 디바운스 자동 저장 (500ms)
- ✅ 다중 기기 동기화
- ✅ 본 설문: 90문항 전체 응답 저장 (페이지별이 아닌 전체)
- ✅ 본 설문: 마지막 작업 페이지로 자동 복원

Vercel에 배포되면 자동으로 적용됩니다! 🚀

