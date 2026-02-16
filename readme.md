# Academy Frontend

학원 관리 시스템 프론트엔드 (React + TypeScript + Vite)

**문서 SSOT**: 이 README가 최상위 문서입니다. 배포·인프라는 백엔드 `academy/docs/README.md`, `academy/docs/배포.md` 참고.

---

## 앱 구분 (SSOT)

| 구분 | 경로 | URL prefix | 설명 |
|------|------|------------|------|
| **admin_app** | `src/admin_app/` | `/dev/*` | 개발자용 — 테넌트 1·9999 owner 전용. 브랜딩·테넌트·오너 설정 (AppRouter에서 tenant 1/9999 owner 시 리다이렉트) |
| **학생 앱** | `src/student/**` | (라우터 내부) | 별개 앱 — 자체 `shared/`, 테마·디자인 시스템. 관리자용 `shared/`·`styles/` 사용 금지 |
| **관리자 앱** | 그 외 전부 | `/` | `src/app/`, `src/features/`, `src/shared/`, `src/styles/` — 선생/운영자용 |

- **admin_app**: `src/admin_app/`, 라우트 `/dev/home`, `/dev/branding` 등. 테넌트·브랜딩·오너 API는 `TenantResolvedAndOwner` 권한 사용.
- **관리자 앱**: `src/shared/`, `src/styles/` 포함 루트 공통 코드는 관리자(선생)용. 학생 앱에서 참조하지 않음.
- **학생 앱**: `src/student/` 내부만 사용. `student/shared/`, `student/…/theme/`, `student/…/presets/` 등 자체 디자인·공용 코드. 별개 앱 취급.

---

## 프로젝트 구조

```
src/
├── app/                    # 라우터·진입 (AppRouter: /dev/* → admin_app, 그 외 관리자 앱)
├── admin_app/              # 개발자용 앱 (테넌트 1·9999 owner): Home, Branding, 테넌트·오너 설정
├── features/               # 관리자(선생) 기능 모듈 (학생·강의·시험·비디오 등)
├── shared/                 # 관리자 전용 — 공통 UI·유틸 (학생 앱에서 사용 금지)
├── styles/                 # 관리자 전용 — 디자인 시스템 (design-system) (학생 앱에서 사용 금지)
├── index.css               # 관리자 앱 전역 스타일 진입
│
└── student/                # 학생 앱 (별개 앱)
    ├── app/                # 학생 앱 라우터·진입
    ├── shared/             # 학생 앱 전용 shared (API, UI, theme, presets 등)
    │   └── ui/
    │       ├── theme/      # tokens, palette, typography, shadow
    │       ├── presets/    # 테마 프리셋 (dark-neon, light-blue 등)
    │       └── layout/     # StudentLayout, TabBar 등
    └── domains/            # 학생 도메인 (media, sessions, exams, dashboard 등)
```

---

## 빠른 시작

```bash
pnpm install
pnpm dev
```

- **필수**: Node.js 18+, pnpm 8+
- **배포**: `pnpm build` → `dist/`. 상세 절차는 [DEPLOY.md](DEPLOY.md) 및 백엔드 `academy/docs/배포.md` 참고.

---

## 기술 스택

- React 18, TypeScript, Vite  
- Tailwind CSS v4, CSS Variables, Ant Design  
- TanStack Query, React Router  

---

## 주요 기능

- **학생 앱** (`src/student/**`): 비디오 재생(FREE_REVIEW / PROCTORED_CLASS), 세션별 영상, 재생 이벤트(감독 모드).
- **관리자 앱**: 학생·강의·시험·비디오·권한·메시지 등 전체 운영 기능.

---

## 문서

- **프론트 최상위**: 이 README.
- **프론트 배포**: [DEPLOY.md](DEPLOY.md).
- **백엔드 배포·인프라**: 백엔드 저장소 `academy/docs/README.md`, `academy/docs/배포.md`.
