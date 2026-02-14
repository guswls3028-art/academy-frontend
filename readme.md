# Academy Frontend

학원 관리 시스템 프론트엔드 (React + TypeScript + Vite)

**문서 SSOT**: 이 README가 최상위 문서입니다. 상세 배포·인프라는 백엔드 저장소 `academy/docs/DEPLOYMENT_MASTER_GUIDE.md` 참고.

---

## 앱 구분 (SSOT)

| 구분 | 경로 | 설명 |
|------|------|------|
| **학생 앱** | `src/student/**` | 별개 앱 — 자체 `shared/`, 테마·디자인 시스템 보유. 관리자용 `shared/`·`styles/` 사용 금지 |
| **관리자 앱** | 그 외 전부 | `src/app/`, `src/features/`, `src/shared/`, `src/styles/` 등 전부 관리자 전용 |

- **관리자 앱**: `src/shared/`, `src/styles/`(design-system) 포함해 루트의 공통 코드 전부 관리자용. 학생 앱에서 참조하지 않음.
- **학생 앱**: `src/student/` 안에서만 동작. 학생 전용 `student/shared/`, `student/…/theme/`, `student/…/presets/` 등 자체 디자인·공용 코드 사용. 별개 앱 취급.

---

## 프로젝트 구조

```
src/
├── app/                    # 관리자 앱 라우터·진입
├── features/               # 관리자 기능 모듈 (학생·강의·시험·비디오 등)
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
- **배포**: `pnpm build` → `dist/`. 상세 절차는 백엔드 `docs/DEPLOYMENT_MASTER_GUIDE.md` 참고.

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
- **배포·인프라·ENV**: 백엔드 저장소 `academy/docs/DEPLOYMENT_MASTER_GUIDE.md`.
