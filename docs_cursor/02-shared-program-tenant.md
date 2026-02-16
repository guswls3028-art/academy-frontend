# Program · Tenant 공통 (실제 코드 기준)

**기준**: `src/shared/program/index.tsx`, `src/shared/tenant/config.ts`, `src/shared/hooks/useDocumentTitle.tsx`, `src/shared/ui/layout/Header.tsx`.

---

## 1. Program 타입 (shared/program)

**파일**: `src/shared/program/index.tsx`

```ts
Program = {
  tenantCode: string;
  display_name: string;
  ui_config: {
    logo_url?: string;
    primary_color?: string;
    login_title?: string;
    login_subtitle?: string;
    window_title?: string;
  };
  feature_flags: Record<string, boolean>;
  is_active: boolean;
}
```

- **소스**: `GET /core/program/` (api.get). ProgramProvider 하위에서만 사용.
- **useProgram()**: Program | null, isLoading, refetch. ProgramProvider 내부에서만 호출 가능.

---

## 2. 브라우저 타이틀 (document.title)

**파일**: `src/shared/hooks/useDocumentTitle.tsx`

- `program?.ui_config?.window_title` 우선, 없으면 `program?.display_name`, 그 다음 폴백(예: "HakwonPlus").
- Header·로그인 등에서 호출해 창 제목 설정.

---

## 3. Header (관리자 앱)

**파일**: `src/shared/ui/layout/Header.tsx`

- 학원 이름: `program?.display_name || "HakwonPlus"`.
- 로고: `program?.ui_config?.logo_url`.
- useDocumentTitle() 사용.

---

## 4. 테넌트 ID · 브랜딩 (tenant/config.ts)

**파일**: `src/shared/tenant/config.ts`

- **TenantId**: `1 | 2 | 3 | 4`.
- **HOST_TO_ID**: hakwonplus.com(1), www 동일, tchul.com(2), limglish.kr(3), ymath.co.kr(4), www 포함.
- **CODE_TO_ID**: hakwonplus→1, tchul→2, limglish→3, ymath→4.
- **getTenantIdFromCode(code)**: host 또는 tenant code → TenantId | null.
- **getTenantBranding(id)**: TenantId → { loginTitle, loginSubtitle?, logoUrl? } (API 없을 때 폴백용 정적 값).

---

## 5. API base

- **파일**: `src/shared/api/axios.ts`
- **baseURL**: `${VITE_API_BASE_URL}/api/v1` (예: `https://api.hakwonplus.com/api/v1`).
- 요청 경로 `/core/program/` → 실제 URL `{baseURL}/core/program/` = `https://api.hakwonplus.com/api/v1/core/program/`.
