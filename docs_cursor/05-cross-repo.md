# 백엔드(academy)와의 계약 (Cross-Repo)

프론트(academyfront)가 백엔드(academy)와 맞춰야 할 사항. **실제 코드·설정 기준**만 기술.

---

## 1. API Base URL

- 프론트: `VITE_API_BASE_URL` (예: `https://api.hakwonplus.com`).
- 백엔드: 동일 호스트가 ALLOWED_HOSTS, CORS, CSRF에 포함되어 있어야 함.

---

## 2. CORS · CSRF (백엔드)

- **academy** `apps/api/config/settings/base.py`, `prod.py`:
  - CORS_ALLOWED_ORIGINS에 프론트 오리진 포함: hakwonplus.com, www, academy-frontend.pages.dev, limglish.kr, tchul.com, ymath.co.kr (https + www), localhost 5173/5174, dev-web 등.
  - CSRF_TRUSTED_ORIGINS에도 동일 오리진 (prod는 localhost/trycloudflare 제외 가능).
- 새 도메인에서 프론트 서빙 시 백엔드 CORS/CSRF에 해당 오리진 추가 필요.

---

## 3. 테넌트 코드 · 도메인 매핑

- **프론트** `src/shared/tenant/config.ts`:
  - hakwonplus.com / hakwonplus → 1  
  - tchul.com / tchul → 2  
  - limglish.kr / limglish → 3  
  - ymath.co.kr / ymath → 4  
- **백엔드**: Tenant.code, TenantDomain.host 로 동일 도메인 사용. 테넌트 생성/도메인 추가 시 이 매핑과 일치시킬 것.

---

## 4. Core API 경로 (백엔드)

- Prefix: `/api/v1/core/` (ROOT_URLCONF 기준).
- 프론트 axios base가 `https://api.hakwonplus.com/api/v1` 이면 요청 경로는 `/core/me/`, `/core/program/`, `/core/tenant-branding/<id>/` 등.

---

## 5. 권한 · role

- 프론트 권한 SSOT: `GET /api/v1/core/me/` 응답의 `tenantRole`.
- admin_app 전용 API(tenant-branding, tenants, owner): 백엔드 **TenantResolvedAndOwner**. 해당 테넌트 owner만 호출 가능.
- RootRedirect: tenantCode hakwonplus/9999 이고 role owner → `/dev/home`. 그 외 owner → `/admin`.

---

## 6. Program · 브랜딩 필드

- **GET /core/program/**: 응답에 display_name, ui_config(logo_url, login_title, login_subtitle, window_title 등), feature_flags, is_active.
- **tenant-branding PATCH**: loginTitle, loginSubtitle, logoUrl, windowTitle, displayName (백엔드는 snake_case로 저장).
- 프론트 Program 타입·Header·useDocumentTitle은 위 필드와 일치 (02-shared-program-tenant.md 참고).
