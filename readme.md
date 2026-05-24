# Academy Frontend

학원 관리 시스템 프론트엔드 (React + TypeScript + Vite)

> **⚠️ 패키지 매니저: pnpm 전용**  
> `npm install` / `npm run build` 사용 금지. 설치·빌드: `pnpm install`, `pnpm run build`, 개발: `pnpm dev`

**문서**: 이 README가 **최상위 진입 문서**입니다. 상세 문서는 [docs/README.md](docs/README.md), E2E는 [e2e/README.md](e2e/README.md), 배포 정책은 백엔드 저장소 `backend/docs/operations/deployment-modes.md`를 기준으로 봅니다.

---

## 앱 구분

| 구분 | 경로 | URL | 설명 |
|------|------|-----|------|
| **개발자 앱** | `src/app_dev/` | `/dev/*` | 개발자용 — 테넌트·브랜딩·운영 설정 |
| **관리자 앱** | `src/app_admin/`, `src/shared/`, `src/styles/` | `/`, `/admin/*` 등 | 학원 관리자·운영자용 |
| **선생님 앱** | `src/app_teacher/` | `/teacher/*` | 모바일 중심 선생님 업무용 |
| **학생 앱** | `src/app_student/` | `/student/*` | 학생용 — 자체 도메인 구조 |
| **공개/프로모션** | `src/landing/`, `src/app_promo/` | 공개 도메인 | 랜딩·공개 리포트·프로모션 |

---

## 프로젝트 구조

```
src/
├── app_admin/     # 관리자 도메인
├── app_dev/       # 개발자·운영 설정
├── app_teacher/   # 선생님 모바일 앱
├── app_student/   # 학생 앱
├── landing/       # 공개 랜딩·공개 리포트
├── app_promo/     # 프로모션 앱
├── auth/          # 인증 공통
├── core/          # 앱 공통 코어
├── shared/        # 프론트 공통 API·UI·유틸
└── styles/        # 디자인 시스템
```

---

## 빠른 시작

```bash
pnpm install --frozen-lockfile
pnpm dev
```

- Node.js 18+, pnpm 8+
- **배포**: frontend 레포 `main` push → Cloudflare Pages 자동 배포. 로컬 확인은 `pnpm run build` → `dist/`.

---

## 기술 스택

React 18, TypeScript, Vite · Tailwind CSS v4, Ant Design · TanStack Query, React Router

---

## 문서 구조 (정리 후)

| 문서 | 용도 |
|------|------|
| **README.md** (이 파일) | 최상위 진입 — 앱 구분, 구조, 빠른시작 |
| **docs/README.md** | 프론트 문서 목차·사용자 가이드·스크립트 구조 |
| **e2e/README.md** | Playwright E2E 구조·환경변수·strict 모드 |

백엔드 배포·인프라는 백엔드 저장소 `backend/docs/operations/deployment-modes.md`, `backend/docs/README.md` 참고.
