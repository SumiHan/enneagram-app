# 배포 가이드

## 🚀 Vercel을 사용한 배포 (권장)

### 1단계: GitHub 저장소 생성

```bash
# Git 초기화 (아직 안했다면)
git init
git add .
git commit -m "Initial commit"

# GitHub에서 새 저장소 생성 후
git remote add origin https://github.com/your-username/enneagram-app.git
git branch -M main
git push -u origin main
```

### 2단계: Vercel 배포

1. **Vercel 계정 생성**
   - https://vercel.com 접속
   - GitHub 계정으로 로그인

2. **프로젝트 Import**
   - "Add New" → "Project" 클릭
   - GitHub 저장소 선택
   - "Import" 클릭

3. **환경 변수 설정**
   - "Environment Variables" 섹션에서 추가:
   ```
   NEXT_PUBLIC_ADMIN_EMAILS=your-admin-email@example.com
   ```
   - 여러 관리자: `email1@example.com,email2@example.com`

4. **Deploy 클릭**
   - 자동으로 빌드 및 배포 시작
   - 몇 분 후 배포 완료
   - 제공된 URL로 접속 가능 (예: `https://your-app.vercel.app`)

### 3단계: 커스텀 도메인 (선택사항)

1. Vercel 프로젝트 → "Settings" → "Domains"
2. 도메인 추가 (예: `enneagram.yourdomain.com`)
3. DNS 설정 (Vercel이 안내)

---

## 📦 다른 배포 옵션

### Option 2: Netlify

1. https://netlify.com 접속
2. "Add new site" → "Import an existing project"
3. GitHub 저장소 연결
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
5. 환경 변수 설정
6. Deploy

### Option 3: 자체 서버 (Node.js)

```bash
# 프로덕션 빌드
npm run build

# 서버 시작
npm start
```

서버 설정:
- Port: 3000 (기본값)
- PM2로 프로세스 관리 권장
- Nginx 리버스 프록시 설정

---

## ⚙️ 환경 변수 설정

### 필수 환경 변수

`.env.local` (로컬 개발용):
```
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com
```

Vercel/배포 환경:
```
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com
```

### 환경 변수 추가 방법

**Vercel:**
1. 프로젝트 → Settings → Environment Variables
2. Name: `NEXT_PUBLIC_ADMIN_EMAILS`
3. Value: 관리자 이메일 (쉼표로 구분)
4. Environment: Production, Preview, Development 모두 체크
5. Save

**Netlify:**
1. Site settings → Environment variables
2. Add a variable
3. Key: `NEXT_PUBLIC_ADMIN_EMAILS`
4. Value: 관리자 이메일

---

## 🔒 배포 전 체크리스트

### 필수 확인 사항

- [ ] `.env.local`에 관리자 이메일 설정
- [ ] `npm run build` 성공 확인
- [ ] 로컬에서 `npm start`로 프로덕션 모드 테스트
- [ ] 로그인/회원가입 테스트
- [ ] 관리자 로그인 테스트
- [ ] 설문 완료 플로우 테스트

### 보안 체크

- [ ] 관리자 이메일 환경 변수로 관리
- [ ] 민감한 정보가 코드에 하드코딩되지 않았는지 확인
- [ ] `.env.local`이 `.gitignore`에 포함되어 있는지 확인

### 성능 최적화

- [ ] 이미지 최적화 (필요시)
- [ ] 불필요한 console.log 제거 (선택사항)
- [ ] 프로덕션 빌드 크기 확인

---

## 📱 배포 후 테스트

### 1. 일반 사용자 플로우
1. 회원가입
2. 로그인
3. 사전 설문 완료
4. 본 설문 완료
5. 리포트 확인

### 2. 관리자 플로우
1. 관리자 이메일로 로그인
2. 관리자 대시보드 접속 확인
3. 설문 문항 CSV 업로드
4. 방문자 응답 확인
5. AI 설정 확인

---

## 🔧 문제 해결

### 빌드 에러

**"Module not found" 에러:**
```bash
npm install
npm run build
```

**타입 에러:**
- TypeScript strict mode 문제일 수 있음
- `tsconfig.json`에서 `strict: false` 설정 (임시)

### 배포 후 에러

**환경 변수 인식 안됨:**
- Vercel/Netlify에서 환경 변수 재확인
- `NEXT_PUBLIC_` 접두사 확인
- 재배포 필요

**페이지 404 에러:**
- Next.js App Router 사용 확인
- 빌드 로그에서 페이지 생성 확인

---

## 📊 현재 제한사항 (localStorage 기반)

### 알아두어야 할 점

1. **데이터 저장**: 브라우저 localStorage 사용
   - 사용자별로 브라우저에 데이터 저장
   - 다른 브라우저/기기에서는 접근 불가
   - 브라우저 캐시 삭제 시 데이터 손실

2. **관리자 기능**: 같은 브라우저에서만 확인 가능
   - 관리자가 사용자 응답을 보려면 같은 브라우저 필요
   - 실제 서비스에서는 백엔드 DB 필요

3. **확장성**: 프로토타입/MVP 용도
   - 실제 서비스로 전환 시 Firebase/Supabase 등 백엔드 필요

### 향후 개선 방향

- Firebase Firestore 또는 Supabase 연동
- 실제 백엔드 API 구축
- 사용자 인증 강화
- 데이터 백업 시스템

---

## 🎉 배포 완료 후

배포가 완료되면:
1. 제공된 URL을 팀원들과 공유
2. 테스트 사용자로 전체 플로우 테스트
3. 피드백 수집 및 개선

**Vercel URL 예시:**
- `https://your-app-name.vercel.app`
- 커스텀 도메인 설정 가능

**주의사항:**
- 현재는 localStorage 기반이므로 프로토타입/데모 용도로 적합
- 실제 서비스로 사용하려면 백엔드 DB 연동 필요
