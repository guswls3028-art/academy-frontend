# 앱 구분 · 라우팅 (실제 코드 기준)

**기준**: `src/app/router/AppRouter.tsx`, `src/admin_app/router/AdminAppRouter.tsx`, `src/admin_app/layout/AdminAppLayout.tsx`.

---

## 1. 앱 구분

| 구분 | 소스 경로 | URL prefix | 접근 조건 |
|------|-----------|------------|-----------|
| **admin_app** | `src/admin_app/` | `/dev/*` | 테넌트 1(hakwonplus) 또는 9999(로컬) **owner** 일 때만. 그 외 owner는 관리자 앱. |
| **관리자 앱** | `src/app/`, `src/features/`, `src/shared/`, `src/styles/` | `/`, `/admin/*`, `/login/*` 등 | role in (owner, admin, teacher, staff). |
| **학생 앱** | `src/student/` | `/student/*` | role in (student, parent). |

- **admin_app**: 개발자용. 테넌트·브랜딩·오너 설정. 백엔드 `TenantResolvedAndOwner` API 사용.
- **관리자 앱**: 선생/운영자용. `shared/`, `styles/` 는 관리자 전용. 학생 앱에서 사용 금지.
- **학생 앱**: `student/shared/`, `student/…/theme/`, `student/…/presets/` 등 자체 디자인. 별개 앱.

---

## 2. 라우트 정의 (AppRouter)

- `/login/*` → AuthRouter  
- `/error/tenant-required` → TenantRequiredPage  
- `/` → RootRedirect (아래 로직)  
- `/student/*` → StudentRouter (ProtectedRoute allow student, parent)  
- `/admin/*` → AdminRouter (ProtectedRoute allow owner, admin, teacher, staff)  
- `/dev/*` → AdminAppRouter (ProtectedRoute allow owner)  
- `*` → Navigate to `/`

---

## 3. RootRedirect 동작 (진입 시)

1. `program` 로딩 중이면 대기.  
2. `program` 없으면 → `/error/tenant-required`.  
3. 비로그인 → `/login`.  
4. **tenantCode === "hakwonplus" 또는 "9999" 이고 role === "owner"** → `/dev/home` (admin_app).  
5. role in (owner, admin, teacher, staff) → `/admin`.  
6. role in (student, parent) → `/student`.  
7. 그 외 → `/login`.

---

## 4. admin_app 내부 라우트

**파일**: `src/admin_app/router/AdminAppRouter.tsx`, `AdminAppLayout.tsx` 네비 링크.

- `/dev/home` → AdminAppHomePage  
- `/dev/branding` → TenantBrandingPage  
- (추가 페이지는 AdminAppRouter에 Route, AdminAppLayout에 링크 추가)

---

## 5. 프로젝트 구조 (앱 관점)

```
src/
├── app/                    # 라우터·진입 (AppRouter: /dev/* → admin_app, 그 외 관리자 앱)
├── admin_app/              # 개발자용: Home, Branding, 테넌트·오너 설정
├── features/               # 관리자(선생) 기능
├── shared/                 # 관리자 전용 공통 (학생 앱 사용 금지)
├── styles/                 # 디자인 시스템
└── student/                # 학생 앱 (별도 shared/theme/presets)
```
