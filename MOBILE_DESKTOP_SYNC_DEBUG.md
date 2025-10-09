# 모바일/데스크톱 상태 동기화 디버깅 가이드

## 🐛 문제 증상

**증상**: 
- 데스크톱에서는 `completed` 표시
- 모바일에서는 `not_started` 표시
- 같은 계정으로 로그인했음에도 상태가 다름

---

## 🔍 디버깅 단계

### **1단계: 브라우저 콘솔 확인**

#### **데스크톱에서 확인**
1. Chrome DevTools 열기 (F12)
2. Console 탭 확인
3. 다음 로그 찾기:

```
[useSurveyStatus] fetchStatus called for pre, userId: <UUID>
[useSurveyStatus] Current Supabase user: <UUID>
[useSurveyStatus] Provided userId: <UUID>
[useSurveyStatus] Querying responses table for userId=<UUID>, surveyType=pre
[useSurveyStatus] Responses query result: { responseData: {...}, responseError: null }
[useSurveyStatus] ✅ Loaded pre status from responses: completed
```

#### **모바일에서 확인**
1. 모바일 브라우저에서 개발자 도구 활성화
   - **iOS Safari**: 설정 → Safari → 고급 → 웹 검사기
   - **Android Chrome**: chrome://inspect
2. 동일한 로그 패턴 확인
3. **userId가 다른지 확인** ⚠️

---

### **2단계: userId 불일치 확인**

#### **예상되는 문제**
```
[useSurveyStatus] ⚠️ userId mismatch! currentUser: abc-123 vs provided: def-456
```

#### **원인**:
- 데스크톱과 모바일에서 **다른 계정**으로 로그인
- 로그인 세션이 제대로 동기화되지 않음
- 쿠키/세션 스토리지 문제

#### **해결 방법**:
1. 모바일에서 로그아웃
2. 브라우저 캐시 및 쿠키 삭제
3. 데스크톱과 **동일한 이메일**로 다시 로그인
4. userId가 일치하는지 확인

---

### **3단계: Supabase DB 직접 확인**

#### **Supabase Dashboard에서 확인**
1. [Supabase Dashboard](https://supabase.com) 로그인
2. 프로젝트 선택
3. **Table Editor** → `responses` 테이블

#### **SQL Editor에서 확인**
```sql
-- 특정 사용자의 설문 상태 확인
SELECT 
  user_id, 
  survey_type, 
  status, 
  updated_at,
  answers
FROM responses
WHERE user_id = 'YOUR_USER_ID'
ORDER BY updated_at DESC;
```

#### **예상 결과**:
```json
{
  "user_id": "abc-123-def-456",
  "survey_type": "pre",
  "status": "completed",
  "updated_at": "2025-10-09T12:34:56Z",
  "answers": {"q1": 1, "q2": 3, ...}
}
```

#### **문제 확인**:
- 데이터가 **없음**: 설문이 제대로 저장되지 않음
- `status`가 `in_progress`: 완료 처리가 안 됨
- `user_id`가 **다름**: 다른 계정으로 저장됨

---

### **4단계: RLS 정책 확인**

#### **문제 가능성**:
Row Level Security(RLS) 정책이 잘못 설정되어 모바일에서 데이터 조회 실패

#### **확인 방법**:
```sql
-- RLS 정책 확인
SELECT * FROM pg_policies 
WHERE tablename = 'responses';
```

#### **예상 정책**:
```sql
CREATE POLICY "Users can view their own responses"
  ON public.responses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

#### **테스트**:
```sql
-- 현재 로그인한 사용자 확인
SELECT auth.uid();

-- 해당 사용자의 responses 조회
SELECT * FROM responses 
WHERE user_id = auth.uid();
```

---

### **5단계: 네트워크 요청 확인**

#### **Chrome DevTools Network 탭**
1. Network 탭 열기
2. `responses` 검색
3. Supabase API 호출 확인:
   - **Status**: 200 OK (성공)
   - **Response**: 데이터 반환 여부

#### **실패 시 확인 사항**:
- **401 Unauthorized**: 인증 실패
- **403 Forbidden**: RLS 정책 문제
- **404 Not Found**: 데이터 없음 (정상일 수 있음)

---

## 🛠️ 문제별 해결 방법

### **문제 1: userId가 다름**

#### **증상**:
```
Desktop userId: abc-123
Mobile userId:  def-456
```

#### **원인**: 
- 다른 계정으로 로그인
- 세션 불일치

#### **해결**:
1. 모바일에서 로그아웃
2. 브라우저 데이터 삭제:
   - **iOS Safari**: 설정 → Safari → 방문 기록 및 웹사이트 데이터 지우기
   - **Android Chrome**: 설정 → 개인정보 → 인터넷 사용 기록 삭제
3. 동일한 이메일로 재로그인
4. 콘솔에서 userId 일치 확인

---

### **문제 2: DB에 데이터가 없음**

#### **증상**:
```
[useSurveyStatus] No response data found, checking user_progress table
[useSurveyStatus] ⚠️ No data found in either table, defaulting to not_started
```

#### **원인**: 
- 설문을 완료했지만 DB에 저장 안 됨
- 네트워크 오류
- RLS 정책 문제

#### **해결**:
1. **데스크톱에서 설문 다시 완료**:
   - 콘솔에서 upsert 성공 확인:
   ```
   [useSurveyStatus] Upsert result: { upsertedData: [{...}], responseError: null }
   ```

2. **Supabase에서 데이터 확인**:
   ```sql
   SELECT * FROM responses 
   WHERE user_id = 'YOUR_USER_ID' AND survey_type = 'pre';
   ```

3. **수동으로 데이터 삽입** (임시 해결):
   ```sql
   INSERT INTO responses (user_id, survey_type, status, answers)
   VALUES (
     'YOUR_USER_ID',
     'pre',
     'completed',
     '{}'::jsonb
   );
   ```

---

### **문제 3: RLS 정책 문제**

#### **증상**:
```
Error: new row violates row-level security policy
```

#### **해결**:
1. **RLS 정책 재생성**:
   ```sql
   -- 기존 정책 삭제
   DROP POLICY IF EXISTS "Users can view their own responses" ON responses;
   DROP POLICY IF EXISTS "Users can create their own responses" ON responses;
   DROP POLICY IF EXISTS "Users can update their own responses" ON responses;
   
   -- 새 정책 생성
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
   ```

---

### **문제 4: 캐시 문제**

#### **증상**:
- 데스크톱에서는 최신 상태
- 모바일에서는 이전 상태

#### **원인**: 브라우저 캐시

#### **해결**:
1. **강력 새로고침**:
   - **iOS Safari**: 주소창 새로고침 버튼 길게 누르기
   - **Android Chrome**: 설정 → 사이트 설정 → 모든 사이트 → 데이터 삭제

2. **Supabase 클라이언트 재인증**:
   - 로그아웃 후 재로그인

---

## 📊 로그 분석 예시

### **정상 동작 (데스크톱)**
```
[useSurveyStatus] fetchStatus called for pre, userId: abc-123-def
[useSurveyStatus] Current Supabase user: abc-123-def
[useSurveyStatus] Provided userId: abc-123-def
[useSurveyStatus] Querying responses table for userId=abc-123-def, surveyType=pre
[useSurveyStatus] Responses query result: {
  responseData: {
    status: "completed",
    user_id: "abc-123-def",
    survey_type: "pre",
    updated_at: "2025-10-09T10:30:00Z"
  },
  responseError: null
}
[useSurveyStatus] ✅ Loaded pre status from responses: completed
```

### **문제 발생 (모바일)**
```
[useSurveyStatus] fetchStatus called for pre, userId: abc-123-def
[useSurveyStatus] Current Supabase user: abc-123-def
[useSurveyStatus] Provided userId: abc-123-def
[useSurveyStatus] Querying responses table for userId=abc-123-def, surveyType=pre
[useSurveyStatus] Responses query result: {
  responseData: null,  // ⚠️ 데이터 없음!
  responseError: null
}
[useSurveyStatus] No response data found, checking user_progress table
[useSurveyStatus] User_progress query result: {
  progressData: { pre_survey_status: "NOT_STARTED" },
  progressError: null
}
[useSurveyStatus] ✅ Loaded pre status from user_progress: not_started
```

**분석**: 
- `userId`는 일치함
- `responses` 테이블에 데이터가 없음
- → 설문 완료 시 저장이 안 됨 또는 RLS 문제

---

## ✅ 체크리스트

### **기본 확인**
- [ ] 데스크톱과 모바일에서 **동일한 이메일**로 로그인했는지?
- [ ] 콘솔에서 `userId`가 **일치**하는지?
- [ ] Supabase `responses` 테이블에 **데이터가 있는지**?
- [ ] RLS 정책이 **제대로 설정**되었는지?

### **고급 확인**
- [ ] 네트워크 요청이 **200 OK**를 반환하는지?
- [ ] `auth.uid()`가 예상한 값인지?
- [ ] 설문 완료 시 upsert가 **성공**했는지?
- [ ] 모바일 브라우저 **캐시를 삭제**했는지?

---

## 🎯 예상 원인 순위

### **1순위: 다른 계정으로 로그인** (80%)
- 데스크톱: user1@example.com
- 모바일: user2@example.com

### **2순위: RLS 정책 문제** (15%)
- 모바일에서 데이터 조회 권한 없음

### **3순위: 캐시 문제** (5%)
- 모바일 브라우저가 이전 상태 캐싱

---

## 🚀 다음 단계

### **배포 후 확인 사항**:
1. 모바일과 데스크톱에서 콘솔 로그 확인
2. `userId` 일치 여부 확인
3. Supabase DB에서 데이터 확인
4. 필요 시 RLS 정책 수정

### **문제 지속 시**:
- 콘솔 로그 전체 캡처
- Supabase SQL 쿼리 결과 캡처
- 네트워크 요청 캡처
- → 이슈 리포트 작성

---

## 📞 추가 도움

문제가 해결되지 않으면:
1. 브라우저 콘솔 로그 전체 복사
2. Supabase `responses` 테이블 스크린샷
3. 사용한 이메일 주소 확인

이 정보로 정확한 원인을 파악할 수 있습니다! 🎉

