# 에니어그램 성향 분석 어플

간단한 에니어그램 성향 분석 설문 애플리케이션입니다.

## 🎯 주요 기능

### 일반 사용자
- 회원가입 및 로그인
- 사전 설문 (가변 선택지)
- 본 설문 (90문항, 6점 Likert 척도, 30문항씩 3페이지)
- 자동 저장 및 이어하기
- 결과 리포트 확인

### 관리자
- 설문 문항 관리 (CSV 업로드, 버전 관리, 인라인 편집)
- 사용자 관리
- 방문자 응답 관리 (개별 확인, 일괄 다운로드, 삭제)
- AI 설정 (프롬프트 관리, API Key 설정)

## 🛠️ 기술 스택

- **Frontend**: Next.js 14 (App Router) + React + TypeScript
- **Styling**: TailwindCSS
- **Storage**: localStorage (프로토타입)
- **Authentication**: 로컬 스토리지 기반 이메일/비밀번호
- **CSV Parsing**: PapaParse
- **Excel Export**: xlsx

## 🚀 로컬 개발

### 설치

```bash
npm install
```

### 환경 변수 설정

`.env.local` 파일 생성:
```
NEXT_PUBLIC_ADMIN_EMAILS=your-admin-email@example.com
```

### 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인

### 프로덕션 빌드

```bash
npm run build
npm start
```

## 📋 설문 CSV 형식

### 사전 설문
```csv
q_id,text_ko,options
q_001,"질문 내용","옵션1/옵션2/옵션3"
```

### 본 설문
```csv
q_id,text_ko
q_001,"질문 내용"
```

- **필수 컬럼**: `q_id`, `text_ko`
- **선택 컬럼**: `options` (사전 설문만, `/` 구분)

## 👥 사용자 역할

### 일반 사용자 (User)
- 회원가입으로 자동 생성
- 설문 참여 및 리포트 확인

### 관리자 (Admin)
- `.env.local`의 `NEXT_PUBLIC_ADMIN_EMAILS`에 이메일 등록
- 회원가입 후 자동으로 관리자 권한 부여
- 관리자 대시보드 접근 가능

## 📦 배포

자세한 배포 가이드는 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참조하세요.

### 빠른 배포 (Vercel)

1. GitHub에 코드 푸시
2. https://vercel.com 에서 Import
3. 환경 변수 설정
4. Deploy 클릭

## ⚠️ 제한사항 (localStorage 기반)

- 브라우저 localStorage에 데이터 저장
- 사용자별로 브라우저에 데이터 저장됨
- 다른 브라우저/기기에서는 접근 불가
- 프로토타입/MVP 용도로 적합
- 실제 서비스로 전환 시 Firebase/Supabase 등 백엔드 필요

## 📝 라이선스

MIT

## 🤝 기여

이슈 및 PR 환영합니다!
