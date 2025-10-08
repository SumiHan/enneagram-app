# 환경 변수 설정 가이드

## 📋 필요한 환경 변수

### 로컬 개발 (.env.local)

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```env
# Admin Emails (comma-separated)
NEXT_PUBLIC_ADMIN_EMAILS=your-admin-email@example.com

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## 🔑 Supabase 키 찾는 방법

### Step 1: Supabase Dashboard 접속
1. https://supabase.com/dashboard 접속
2. 프로젝트 선택

### Step 2: API 설정 페이지
1. 왼쪽 메뉴 → 설정 아이콘 (⚙️)
2. **"Project Settings"** 클릭
3. 왼쪽 사이드바 → **"API"** 클릭

### Step 3: 키 복사
다음 정보를 복사하세요:

#### **Project URL**
```
https://abcdefghijklmnop.supabase.co
```
→ `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`에 입력

#### **anon public key**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY...
```
→ `.env.local`의 `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 입력

---

## 📝 .env.local 파일 생성 예시

```env
# Admin Emails
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com,manager@example.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY...
```

---

## 🚀 Vercel 환경 변수 설정

### Step 1: Vercel Dashboard 접속
1. https://vercel.com 접속
2. 프로젝트 선택

### Step 2: 환경 변수 추가
1. **Settings** 탭 클릭
2. 왼쪽 사이드바 → **"Environment Variables"** 클릭
3. 다음 변수들을 하나씩 추가:

#### **NEXT_PUBLIC_ADMIN_EMAILS**
- Name: `NEXT_PUBLIC_ADMIN_EMAILS`
- Value: `your-admin-email@example.com`
- Environment: Production, Preview, Development 모두 체크
- **Add** 클릭

#### **NEXT_PUBLIC_SUPABASE_URL**
- Name: `NEXT_PUBLIC_SUPABASE_URL`
- Value: `https://your-project-id.supabase.co`
- Environment: Production, Preview, Development 모두 체크
- **Add** 클릭

#### **NEXT_PUBLIC_SUPABASE_ANON_KEY**
- Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Value: `eyJhbGci...` (긴 키 전체)
- Environment: Production, Preview, Development 모두 체크
- **Add** 클릭

### Step 3: 재배포
환경 변수 추가 후:
1. **Deployments** 탭으로 이동
2. 최신 배포 옆 **"..."** 메뉴 클릭
3. **"Redeploy"** 선택
4. 또는 GitHub에 새로 푸시하면 자동 재배포

---

## ✅ 확인 방법

### 로컬 개발 서버
```bash
npm run dev
```

브라우저 콘솔에서 확인:
```javascript
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);
// 출력: https://your-project-id.supabase.co
```

### Vercel 배포
배포 후 브라우저 콘솔에서 동일하게 확인

---

## ⚠️ 주의사항

### 보안
- ✅ `.env.local`은 Git에 커밋하지 마세요 (`.gitignore`에 포함됨)
- ✅ `anon key`는 공개 가능 (클라이언트에서 사용)
- ❌ `service_role key`는 절대 클라이언트에 노출하지 마세요

### 환경 변수 이름
- `NEXT_PUBLIC_` 접두사 필수 (클라이언트에서 접근하려면)
- 대소문자 정확히 입력
- 공백 없이 입력

### 변경 사항 반영
- 로컬: 개발 서버 재시작 필요
- Vercel: 재배포 필요 (환경 변수 변경 후)

---

## 🔧 문제 해결

### "Supabase credentials not found" 경고
→ `.env.local` 파일 생성 및 환경 변수 입력 확인

### 환경 변수가 undefined
→ `NEXT_PUBLIC_` 접두사 확인
→ 개발 서버 재시작

### Vercel에서 환경 변수 인식 안됨
→ Environment 체크박스 확인 (Production 체크 필수)
→ 재배포 실행

---

## 📚 다음 단계

1. ✅ `.env.local` 파일 생성
2. ✅ Supabase 키 입력
3. ✅ 개발 서버 재시작
4. ✅ 회원가입 테스트
5. ✅ Supabase Dashboard에서 users 테이블 확인
6. ✅ Vercel 환경 변수 설정
7. ✅ 재배포
