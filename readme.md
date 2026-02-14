# Academy Frontend

학원 관리 시스템 프론트엔드 (React + TypeScript + Vite)

---

## 🚀 빠른 시작

### 배포 가이드

**⭐ 배포 전 필수 문서**: [`docs/DEPLOYMENT_MASTER_GUIDE.md`](docs/DEPLOYMENT_MASTER_GUIDE.md)

이 문서 하나만 보면 프론트엔드 배포가 가능합니다:
- 프로젝트 구조
- 비디오 스펙 동기화 (학생앱 + 관리자앱)
- 환경 변수 설정
- 빌드 및 배포 절차
- 백엔드 API 연동

---

## 📁 프로젝트 구조

```
academyfront/
├── src/
│   ├── app/                    # Admin 앱 라우터
│   ├── student/               # 학생 앱
│   │   ├── app/              # 학생 앱 라우터
│   │   └── domains/          # 학생 도메인
│   │       └── media/        # 비디오 재생
│   ├── features/              # Admin 기능 모듈
│   │   └── videos/           # 비디오 관리
│   └── shared/                # 공통 모듈
├── docs/                       # 문서
│   └── DEPLOYMENT_MASTER_GUIDE.md  ⭐ 메인 문서
├── package.json
└── vite.config.ts
```

---

## 🏗️ 기술 스택

- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Package Manager**: pnpm
- **Styling**: Tailwind CSS v4 + CSS Variables
- **UI Components**: Ant Design
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router

---

## 🔧 개발 환경 설정

### 필수 요구사항
- Node.js 18+
- pnpm 8+

### 로컬 개발 환경 실행

```bash
# 의존성 설치
pnpm install

# 개발 서버 시작
pnpm dev
```

---

## 📚 주요 문서

### 배포 및 운영
- **[DEPLOYMENT_MASTER_GUIDE.md](docs/DEPLOYMENT_MASTER_GUIDE.md)** ⭐ **메인 문서**
- [FRONT_BACKEND_SPEC_ANALYSIS.md](docs/FRONT_BACKEND_SPEC_ANALYSIS.md) - 프론트-백엔드 스펙 분석

### 디자인 시스템 (최신 문서만 유효)
- [DESIGN_SSOT.md](docs/DESIGN_SSOT.md) - 디자인 시스템 SSOT (모달 §5 포함)
- [TABS_PREMIUM_SPEC.md](docs/TABS_PREMIUM_SPEC.md) - 탭 컴포넌트 스펙
- [PREMIUM_SAAS_AUDIT.md](docs/PREMIUM_SAAS_AUDIT.md) - 프리미엄 SaaS 감사

### 도메인별 문서
- [STUDENTS_DOMAIN_UI_SSOT.md](docs/STUDENTS_DOMAIN_UI_SSOT.md) - 학생 도메인 UI SSOT (모달 SSOT 반영)
- [EXAMS_README.md](docs/EXAMS_README.md) - 시험 기능 문서

---

## 🎯 주요 기능

### 학생 앱
- 비디오 재생 (FREE_REVIEW / PROCTORED_CLASS 모드)
- 세션별 영상 목록
- 재생 이벤트 모니터링 (PROCTORED_CLASS만)

### 관리자 앱
- 비디오 업로드 및 관리
- 비디오 정책 설정
- 학생 시청 현황 및 로그
- 비디오 권한 관리

---

## 🔍 비디오 스펙 동기화

### Access Mode
- **FREE_REVIEW**: 복습 모드 (제한 없음, 이벤트 전송 안 함)
- **PROCTORED_CLASS**: 온라인 수업 대체 (제한 적용, 이벤트 전송함)
- **BLOCKED**: 접근 차단

### Playback API
- `POST /api/v1/videos/playback/start/` - 재생 시작
- `POST /api/v1/videos/playback/refresh/` - 토큰 갱신
- `POST /api/v1/videos/playback/heartbeat/` - 하트비트 (PROCTORED_CLASS만)
- `POST /api/v1/videos/playback/end/` - 재생 종료
- `POST /api/v1/videos/playback/events/` - 이벤트 배치 전송 (PROCTORED_CLASS만)

**상세 스펙**: [`docs/DEPLOYMENT_MASTER_GUIDE.md#2-비디오-스펙-동기화`](docs/DEPLOYMENT_MASTER_GUIDE.md#2-비디오-스펙-동기화)

---

## 🚀 배포 명령어 (요약)

### 프로덕션 빌드

```bash
# 빌드
pnpm build

# 빌드 결과물
dist/
├── index.html
└── assets/
```

**상세 배포 가이드**: [`docs/DEPLOYMENT_MASTER_GUIDE.md`](docs/DEPLOYMENT_MASTER_GUIDE.md)

---

## 📝 라이선스

프로젝트 라이선스 정보

---

## 📞 문의

프론트엔드 팀 또는 프로젝트 관리자에게 문의

---

**최종 업데이트**: 2026-02-12
