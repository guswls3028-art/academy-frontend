# Frontend Conventions

이 문서는 프론트엔드 코드베이스의 파일/폴더 네이밍 및 배치 규칙을 정의한다.
새 파일을 만들 때 이 규칙을 따른다.

## 앱 구조

모든 앱은 동일한 폴더 모델을 따른다:

```
src/
├── app_admin/       # 선생(관리자)앱
├── app_student/     # 학생앱
├── app_dev/         # 개발자앱
├── app_promo/       # 프로모/마케팅앱
├── auth/            # 로그인/인증 (공용)
├── landing/         # 랜딩 페이지 (공용)
├── shared/          # 전역 공유 (api, ui, hooks, tenant 등)
├── core/            # 라우터, 프로바이더, 스토어
└── styles/          # 디자인 시스템 CSS
```

### 앱 내부 통일 구조

```
app_{name}/
├── app/             # 라우터 (필수)
│   └── {Name}Router.tsx
├── layout/          # 레이아웃 컴포넌트 (필수)
│   └── {Name}Layout.tsx
├── domains/         # 도메인 (기능 단위)
│   └── {domain-name}/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       └── ...
└── shared/          # 앱 전용 공유 (선택)
```

## 파일 네이밍

| 파일 유형 | 네이밍 규칙 | 예시 |
|-----------|-----------|------|
| 컴포넌트 | `PascalCase.tsx` | `ClinicTargetTable.tsx` |
| 페이지 | `PascalCase` + `Page` 접미사 | `DashboardPage.tsx` |
| 모달 | `PascalCase` + `Modal` 접미사 | `VideoUploadModal.tsx` |
| 패널 | `PascalCase` + `Panel` 접미사 | `ExamResultsPanel.tsx` |
| 레이아웃 | `{Domain}Layout.tsx` | `ClinicLayout.tsx` |
| 라우트 | `{Domain}Routes.tsx` | `ClinicRoutes.tsx` |
| 훅 | `use*.ts` (JSX 없으면 `.ts`) | `useClinicTargets.ts` |
| API | `{resource}.api.ts` (`api/` 폴더 안) | `clinicLinks.api.ts` |
| 유틸리티 | `camelCase.ts` | `formatPhone.ts` |
| 타입 | `types.ts` (도메인 루트) | `exams/types.ts` |
| 상수 | `camelCase.ts` 또는 `constants.ts` | `statusMaps.ts` |

## 디렉토리 네이밍

- **lowercase** 또는 **kebab-case**: `clinic`, `admin-notifications`
- 앱 디렉토리: **`app_` 접두사 + snake_case**: `app_admin`, `app_student`
- PascalCase 디렉토리는 멀티파일 페이지에만 허용: `pages/HomePage/`

## 도메인 폴더 구조

```
app_{name}/domains/{domain-name}/
├── {Domain}Layout.tsx      # 레이아웃 (도메인 루트)
├── {Domain}Routes.tsx      # 라우트 (도메인 루트)
├── types.ts                # 타입 정의 (도메인 루트)
├── api/                    # API 호출
│   ├── {resource}.api.ts
│   └── index.ts            # barrel export (선택)
├── components/             # 재사용 컴포넌트
├── hooks/                  # 커스텀 훅
├── pages/                  # 페이지 컴포넌트
├── utils/                  # 유틸리티 (선택)
├── constants/              # 상수 (선택)
└── context/                # React Context (선택)
```

## 기존 코드 참고

- `api/` 폴더 안에 `.api.ts` 접미사 없는 파일이 일부 남아 있음 (예: `attendance.ts`)
  - `api/` 경로가 충분한 맥락을 제공하므로 일괄 리네임하지 않음
  - **새 파일은 반드시 `.api.ts` 접미사** 사용
- `shared/appConfig/`은 camelCase 디렉토리 예외

## Import 규칙

- **같은 도메인 내**: 상대 경로 (`../hooks/useClinicTargets`)
- **다른 앱/공유**: path alias 사용
- **사용 가능한 alias**:
  - `@/` = `src/` — 공용 모듈: `@/shared/...`, `@/auth/...`, `@/landing/...`, `@/core/...`
  - `@admin/` = `src/app_admin/` — 선생앱: `@admin/domains/clinic/...`
  - `@student/` = `src/app_student/` — 학생앱: `@student/domains/video/...`
  - `@dev/` = `src/app_dev/` — 개발자앱: `@dev/domains/agent/...`
  - `@promo/` = `src/app_promo/` — 프로모앱: `@promo/domains/landing/...`

## 확장자

- `.tsx` — JSX를 포함하는 파일 (컴포넌트, 페이지)
- `.ts` — JSX가 없는 파일 (훅, API, 유틸, 타입)
- `.module.css` — 컴포넌트 스코프 CSS
- `.css` — 글로벌/디자인시스템 CSS
