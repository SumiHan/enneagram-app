# DB 기반 상태 관리 가이드

## 📋 개요

설문 진행 상태(`not_started`, `in_progress`, `completed`)의 **단일 진실 원천(Single Source of Truth)**을 Supabase DB로 확립하여, 페이지 새로고침이나 다중 기기에서도 안정적인 상태 관리를 보장합니다.

---

## 🔄 상태 관리 아키텍처

### **Before (불안정)**

```
localStorage (클라이언트) ←→ Supabase (서버)
      ↓ 불일치 가능
새로고침 시 상태 불안정
```

### **After (안정적)**

```
Supabase DB (단일 진실 원천)
      ↓
   Client State (읽기 전용 복사본)
      ↓
새로고침 → 항상 DB에서 최신 상태 로드
```

---

## 🎯 핵심 원칙

### **1️⃣ Supabase가 상태의 유일한 주인**
- 클라이언트 상태는 DB의 **읽기 전용 복사본**
- 상태 변경은 항상 **DB 먼저**, 그 다음 클라이언트 업데이트

### **2️⃣ Optimistic Update 금지**
- 클라이언트에서 먼저 상태 변경 ❌
- DB 업데이트 완료 후 `await`으로 확인 → 그 다음 클라이언트 업데이트 ✅

### **3️⃣ 페이지 로딩 시 항상 DB에서 Fetch**
- `useEffect`에서 `useSurveyStatus` 훅 사용
- DB 상태를 불러온 후 로컬 상태 설정
- 로딩 중에는 스켈레톤 UI 표시

### **4️⃣ Race Condition 방지**
- 모든 DB 작업은 `async/await`으로 순차 처리
- 상태 변경 중 중복 호출 방지 (`hasSetInProgressRef`)

---

## 🛠️ 구현 상세

### **1. useSurveyStatus 훅**

#### **파일**: `src/hooks/useSurveyStatus.ts`

#### **주요 기능**:
- **fetchStatus**: DB에서 상태 불러오기 (마운트 시 자동 실행)
- **updateStatus**: 상태 변경 (DB 먼저 → 로컬 동기화)
- **refetch**: 수동 재로드

#### **사용 예시**:
```typescript
const surveyStatus = useSurveyStatus(userId, 'pre');

// Status: 'not_started' | 'in_progress' | 'completed' | null
console.log(surveyStatus.status);

// Loading state
if (surveyStatus.loading) {
  return <div>로딩 중...</div>;
}

// Update status (DB first)
await surveyStatus.updateStatus('in_progress');
```

#### **상태 흐름**:
```typescript
1. useEffect → fetchStatus()
2. Supabase.from('responses').select(...)
3. DB에서 상태 가져오기
4. setStatus(dbStatus) → 로컬 상태 업데이트
5. 컴포넌트 리렌더링
```

---

### **2. 홈 페이지 (src/app/page.tsx)**

#### **변경사항**:
```typescript
// Before
const [preResponseStatus, setPreResponseStatus] = useState(...);
apiGetPreResponse(userId).then(...); // 비동기 fetch

// After
const preStatus = useSurveyStatus(userId, 'pre');
const mainStatus = useSurveyStatus(userId, 'main');

// 자동으로 DB에서 로드, 로딩 상태 관리
```

#### **로딩 처리**:
```typescript
if (authLoading || preStatus.loading || mainStatus.loading) {
  return <div>설문 상태를 불러오는 중...</div>;
}
```

#### **버튼 텍스트**:
```typescript
actionLabel={
  preStatus.status === 'in_progress' ? "이어하기" :
  preStatus.status === 'completed' ? "수정하기" :
  "시작하기"
}
```

---

### **3. 사전 설문 페이지 (src/app/surveys/pre/page.tsx)**

#### **핵심 로직**:

##### **① 첫 응답 시 'in_progress' 설정**
```typescript
const hasSetInProgressRef = useRef(false);
const surveyStatus = useSurveyStatus(userId, 'pre');

const onSelect = (qId: string, value: string | null) => {
  setAnswers(prev => {
    const next = { ...prev, [qId]: value };
    
    // 첫 응답 시 DB에 'in_progress' 저장
    const validAnswers = Object.keys(next).filter(k => next[k] !== null).length;
    if (validAnswers > 0 && !hasSetInProgressRef.current) {
      hasSetInProgressRef.current = true;
      surveyStatus.updateStatus('in_progress').catch(err => {
        console.error('Failed to set in_progress:', err);
        hasSetInProgressRef.current = false; // 실패 시 재시도 가능
      });
    }
    
    // ... 자동 저장 로직
    return next;
  });
};
```

##### **② 완료 시 'completed' 설정**
```typescript
const onComplete = async () => {
  try {
    // DB 먼저 업데이트
    await surveyStatus.updateStatus('completed');
    
    // 그 다음 다른 테이블 업데이트
    await apiCompletePre(userId);
    await reload();
    
    router.push("/");
  } catch (error) {
    console.error('Failed to complete:', error);
    alert('설문 완료 중 오류가 발생했습니다.');
  }
};
```

##### **③ 로딩 상태 처리**
```typescript
if (!preList || surveyStatus.loading) {
  return (
    <div className="flex flex-col gap-6">
      <h2>사전 설문</h2>
      <div className="text-slate-600">
        {!preList ? '질문을 불러오는 중...' : '설문 상태를 불러오는 중...'}
      </div>
    </div>
  );
}
```

---

### **4. 본 설문 페이지 (src/app/surveys/main/page.tsx)**

본 설문도 **동일한 패턴** 적용:
- `useSurveyStatus(userId, 'main')` 사용
- 첫 응답 시 `in_progress` 설정
- 완료 시 `completed` 설정
- 로딩 상태 표시

---

## 📊 데이터 흐름

### **시나리오 1: 처음 설문 시작**

```
1. 홈 페이지 로드
   ↓
2. useSurveyStatus → DB 조회 (responses 테이블)
   ↓ (데이터 없음)
3. status = 'not_started'
   ↓
4. "시작하기" 버튼 표시
   ↓
5. 사용자 클릭 → 설문 페이지 진입
   ↓
6. 첫 응답 선택
   ↓
7. surveyStatus.updateStatus('in_progress')
   ↓ (DB 업데이트)
8. responses 테이블에 { status: 'in_progress', answers: {...} } 저장
   ↓
9. 로컬 status = 'in_progress'
```

### **시나리오 2: 새로고침 (상태 복원)**

```
1. 페이지 새로고침 (F5 또는 Ctrl+Shift+R)
   ↓
2. useSurveyStatus → DB 조회
   ↓
3. DB에서 status = 'in_progress' 발견
   ↓
4. 로컬 status = 'in_progress' 설정
   ↓
5. "이어하기" 버튼 표시 ✅ (안정적)
```

### **시나리오 3: 완료 후**

```
1. 마지막 문항 응답 → "완료" 버튼 클릭
   ↓
2. surveyStatus.updateStatus('completed')
   ↓ (DB 업데이트)
3. responses 테이블 { status: 'completed' } 저장
   ↓
4. apiCompletePre/Main → user_progress 업데이트
   ↓
5. 홈으로 이동
   ↓
6. 새로고침 시 → "수정하기" 버튼 표시 ✅
```

---

## 🔍 디버깅 가이드

### **1. 상태가 'not_started'로 계속 표시될 때**

#### **확인 사항**:
```sql
-- Supabase SQL Editor에서 확인
SELECT * FROM responses 
WHERE user_id = 'YOUR_USER_ID' AND survey_type = 'pre';
```

#### **예상 결과**:
```json
{
  "user_id": "uuid",
  "survey_type": "pre",
  "status": "in_progress", // 또는 "completed"
  "answers": {...},
  "updated_at": "2025-10-09T..."
}
```

#### **문제 해결**:
- 데이터가 없으면: 첫 응답 시 `updateStatus('in_progress')` 호출 확인
- 데이터가 있는데 로드 안 됨: RLS 정책 확인

---

### **2. 새로고침 시 상태가 바뀔 때**

#### **원인**:
- `useSurveyStatus`가 제대로 호출되지 않음
- DB 쿼리가 실패함

#### **확인**:
```typescript
// 브라우저 콘솔에서 확인
[useSurveyStatus] Loaded pre status from responses: in_progress
```

#### **해결**:
- 네트워크 탭에서 Supabase API 호출 확인
- RLS 정책 확인 (authenticated 유저가 자신의 데이터 조회 가능한지)

---

### **3. Race Condition (동시성 문제)**

#### **증상**:
- 상태가 예상과 다르게 변경됨
- `in_progress`가 설정되지 않음

#### **원인**:
- `updateStatus`가 여러 번 호출됨
- `await` 없이 비동기 호출

#### **해결**:
```typescript
// Bad ❌
surveyStatus.updateStatus('in_progress'); // await 없음

// Good ✅
await surveyStatus.updateStatus('in_progress');

// Better ✅✅ (중복 호출 방지)
if (!hasSetInProgressRef.current) {
  hasSetInProgressRef.current = true;
  await surveyStatus.updateStatus('in_progress');
}
```

---

## ✅ 테스트 체크리스트

### **기본 기능**

- [ ] 처음 방문 → "시작하기" 버튼
- [ ] 첫 응답 선택 → DB에 `in_progress` 저장 확인
- [ ] 페이지 새로고침 (F5) → "이어하기" 버튼 유지
- [ ] 강력 새로고침 (Ctrl+Shift+R) → "이어하기" 버튼 유지
- [ ] 설문 완료 → DB에 `completed` 저장 확인
- [ ] 완료 후 새로고침 → "수정하기" 버튼 표시

### **로딩 상태**

- [ ] 홈 페이지 로딩 시 → "설문 상태를 불러오는 중..." 표시
- [ ] 설문 페이지 로딩 시 → "설문 상태를 불러오는 중..." 표시
- [ ] 로딩 완료 후 → 올바른 버튼 표시

### **다중 기기**

- [ ] PC에서 설문 시작 → 모바일에서 "이어하기" 표시
- [ ] 모바일에서 완료 → PC에서 새로고침 → "수정하기" 표시
- [ ] 두 기기 동시 접속 → 상태 일관성 유지

### **에러 처리**

- [ ] 네트워크 오류 시 → 에러 메시지 표시
- [ ] DB 업데이트 실패 시 → alert 표시
- [ ] 로딩 실패 시 → 기본값(`not_started`)으로 폴백

---

## 🚀 배포 후 확인 사항

### **1. Supabase 테이블 확인**

```sql
-- responses 테이블에 데이터가 쌓이는지 확인
SELECT * FROM responses 
WHERE survey_type IN ('pre', 'main')
ORDER BY updated_at DESC
LIMIT 10;
```

### **2. RLS 정책 확인**

```sql
-- 사용자가 자신의 응답을 읽을 수 있는지 확인
SELECT * FROM responses 
WHERE user_id = auth.uid();
```

### **3. 브라우저 콘솔 확인**

```
[useSurveyStatus] Loaded pre status from responses: in_progress
[useSurveyStatus] Updating pre status to: completed
[useSurveyStatus] Successfully updated pre status to: completed
```

---

## 📝 주요 변경 파일

| 파일 | 역할 |
|------|------|
| `src/hooks/useSurveyStatus.ts` | **핵심** DB 기반 상태 관리 훅 |
| `src/app/page.tsx` | 홈 페이지, useSurveyStatus 사용 |
| `src/app/surveys/pre/page.tsx` | 사전 설문, 상태 변경 로직 |
| `src/app/surveys/main/page.tsx` | 본 설문, 상태 변경 로직 |
| `src/lib/api.ts` | API 함수 (responses 테이블 연동) |

---

## 💡 핵심 포인트

### **Do ✅**
- 항상 DB에서 상태 로드 후 로컬 설정
- 상태 변경은 `await`으로 DB 업데이트 보장
- 로딩 중에는 스켈레톤 UI 표시
- 에러 처리 명확하게

### **Don't ❌**
- Optimistic update (클라이언트 먼저 업데이트)
- `await` 없이 비동기 호출
- 로컬 상태만 믿고 DB 무시
- Race condition 무시

---

## 🎉 결과

이제 설문 상태는:
- ✅ **새로고침해도 안정적**
- ✅ **다중 기기에서 동기화**
- ✅ **DB가 단일 진실 원천**
- ✅ **Race condition 방지**
- ✅ **명확한 로딩 상태**

Vercel에 배포되면 자동으로 적용됩니다! 🚀

