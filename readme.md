# Academy Frontend

학원 관리 시스템 프론트엔드 (React + TypeScript + Vite)

**문서 SSOT**: 이 README가 최상위 문서입니다. 상세 배포·인프라는 백엔드 저장소 `academy/docs/DEPLOYMENT_MASTER_GUIDE.md` 참고.

---

## 앱 구분 (SSOT)

| 구분 | 경로 | 설명 |
|------|------|------|
| **학생 앱** | `src/student/**` | 학생 전용 — 완전히 분리된 라우터·도메인·스타일 |
| **관리자 앱** | 그 외 전부 | `src/app/`, `src/features/`, `src/shared/` 등 모든 관리자 기능 |

- 학생 앱: `src/student/` 아래만 사용 (라우터·페이지·도메인·테마).
- 관리자 앱: `src/app/`, `src/features/`, `src/shared/`, `src/context/`, `src/styles/` 등.

---

## 프로젝트 구조

```
src/
├── app/                    # 관리자 앱 라우터·진입
├── student/                # 학생 앱 (완전 분리)
│   ├── app/                # 학생 앱 라우터
│   └── domains/            # 학생 도메인 (예: media 재생)
├── features/               # 관리자 기능 모듈 (학생·강의·시험·비디오 등)
├── shared/                 # 공통 UI·유틸 (관리자 앱 기준)
├── styles/                 # 디자인 시스템 (design-system) — 모든 디자인 파일 SSOT
└── index.css               # 전역 스타일 진입
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
