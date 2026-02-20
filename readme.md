# Academy Frontend

학원 관리 시스템 프론트엔드 (React + TypeScript + Vite)

> **⚠️ 패키지 매니저: pnpm 전용**  
> `npm install` / `npm run build` 사용 금지. 설치·빌드: `pnpm install`, `pnpm run build`, 개발: `pnpm dev`

**문서**: 이 README가 **최상위 유일 진입 문서**입니다. 상세·라우팅·API·배포·백엔드 계약은 **[docs/REFERENCE.md](docs/REFERENCE.md)** 한 파일만 참조하면 됩니다.

---

## 앱 구분

| 구분 | 경로 | URL | 설명 |
|------|------|-----|------|
| **dev_app** | `src/dev_app/` | `/dev/*` | 개발자용 — 테넌트 1·9999 owner 전용. 브랜딩·테넌트·오너 설정 |
| **관리자 앱** | `src/app/`, `src/features/`, `src/shared/`, `src/styles/` | `/`, `/admin/*` 등 | 선생/운영자용 |
| **학생 앱** | `src/student/` | `/student/*` | 별개 앱 — 자체 shared/테마, 관리자 shared/styles 사용 금지 |

---

## 프로젝트 구조

```
src/
├── app/          # 라우터·진입 (/dev/* → dev_app, 그 외 관리자 앱)
├── dev_app/       # 개발자용: Home, Branding, 테넌트·오너
├── features/      # 관리자 기능 (학생·강의·시험·비디오 등)
├── shared/        # 관리자 전용 공통 (학생 앱 사용 금지)
├── styles/        # 디자인 시스템
└── student/       # 학생 앱 (별도 shared/theme/presets)
```

---

## 빠른 시작

```bash
pnpm install
pnpm dev
```

- Node.js 18+, pnpm 8+
- **배포**: `pnpm run build` → `dist/`. Cloudflare Pages 단일 호스팅. 상세는 [docs/REFERENCE.md §배포](docs/REFERENCE.md#4-배포-cloudflare-pages).

---

## 기술 스택

React 18, TypeScript, Vite · Tailwind CSS v4, Ant Design · TanStack Query, React Router

---

## 문서 구조 (정리 후)

| 문서 | 용도 |
|------|------|
| **README.md** (이 파일) | 최상위 진입 — 앱 구분, 구조, 빠른시작 |
| **docs/REFERENCE.md** | 라우팅·Program·dev_app API·배포·백엔드 계약·구현 사실 (Cursor·개발 참조) |

백엔드 배포·인프라는 백엔드 저장소 `academy/docs/배포.md`, `academy/docs/README.md` 참고.
