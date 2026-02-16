# admin_app 이 사용하는 API (실제 코드 기준)

**기준**: `src/admin_app/api/branding.ts`, `src/admin_app/api/tenants.ts`.  
백엔드 권한: **TenantResolvedAndOwner** (owner만). Base path는 axios 설정 기준 (예: `/api/v1`).

---

## 1. Tenant Branding

**파일**: `src/admin_app/api/branding.ts`

| 함수 | Method | 경로 | 요청/응답 |
|------|--------|------|-----------|
| getTenantBranding(tenantId) | GET | `/core/tenant-branding/${tenantId}/` | → TenantBrandingDto |
| patchTenantBranding(tenantId, payload) | PATCH | `/core/tenant-branding/${tenantId}/` | Partial<TenantBrandingDto> → TenantBrandingDto |
| uploadTenantLogo(tenantId, file) | POST | `/core/tenant-branding/${tenantId}/upload-logo/` | FormData file → { logoUrl } |

**TenantBrandingDto**: tenantId, loginTitle?, loginSubtitle?, logoUrl?, windowTitle?, displayName?  
(백엔드: login_title, login_subtitle, logo_url, window_title, display_name)

---

## 2. Tenants

**파일**: `src/admin_app/api/tenants.ts`

| 함수 | Method | 경로 | 비고 |
|------|--------|------|------|
| getTenants() | GET | `/core/tenants/` | TenantDto[] |
| getTenant(tenantId) | GET | `/core/tenants/${tenantId}/` | TenantDetailDto |
| createTenant(payload) | POST | `/core/tenants/create/` | CreateTenantDto → TenantDto |
| updateTenant(tenantId, payload) | PATCH | `/core/tenants/${tenantId}/` | name, isActive 등 → TenantDetailDto |
| registerTenantOwner(tenantId, payload) | POST | `/core/tenants/${tenantId}/owner/` | username 필수, password/name/phone 선택 → TenantOwnerDto |

**CreateTenantDto**: code, name, domain?  
**TenantOwnerDto**: tenantId, tenantCode, userId, username, name, role  
**registerTenantOwner payload**: username, password?, name?, phone? (신규 User 생성 시 password 필수)

---

## 3. 권한

- 위 모든 API는 백엔드에서 **TenantResolvedAndOwner** 사용.
- 로그인 사용자가 **해당 테넌트 owner** 여야 함. admin_app은 테넌트 1·9999 owner로 접속 시 `/dev/*` 로 진입.

---

## 4. 페이지와 API 매핑

- **TenantBrandingPage** (`/dev/branding`): getTenantBranding, patchTenantBranding, uploadTenantLogo, getTenants, getTenant, registerTenantOwner, createTenant 등 사용.
- **AdminAppHomePage** (`/dev/home`): 링크만 또는 간단 목록 등. 필요 시 getTenants 등 호출.
