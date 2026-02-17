# 구현된 기능·계약 (Cursor 참조용 — 추측 금지)

실제 코드·설정 기준만 기록. 사람 가독성보다 AI가 추론 없이 참조할 수 있도록 사실만 나열.

---

## 1. 멀티테넌트 도메인·코드 매핑

**파일**: `src/shared/tenant/config.ts`

- **HOST_TO_ID** (hostname → TenantId 1|2|3|4):  
  hakwonplus.com, www.hakwonplus.com → 1. tchul.com, www.tchul.com → 2. limglish.kr, www.limglish.kr → 3. ymath.co.kr, www.ymath.co.kr → 4.
- **CODE_TO_ID** (tenant code 문자열 → TenantId): hakwonplus→1, tchul→2, limglish→3, ymath→4.
- **HOSTNAME_TO_TENANT_CODE** (hostname → X-Tenant-Code 헤더값):  
  hakwonplus.com / www.hakwonplus.com → "hakwonplus". tchul.com / www → "tchul". limglish.kr / www → "limglish". ymath.co.kr / www → "ymath".
- **getTenantIdFromCode(code)**: HOST_TO_ID[normalized] ?? CODE_TO_ID[normalized] ?? null. code는 hostname 또는 tenant code 문자열.
- **getTenantBranding(id)**: ID_TO_BRANDING[id]. loginTitle, loginSubtitle?, logoUrl? (API ui_config 없을 때 폴백).

---

## 2. X-Tenant-Code 헤더 (API 요청)

**파일**: `src/shared/tenant/index.ts` — `getTenantCodeForApiRequest()`.  
**사용처**: `src/shared/api/axios.ts` request interceptor. 모든 API 요청에 헤더 설정.

**우선순위** (순서 고정):
1. **hostname**: `window.location.hostname` (소문자). `HOSTNAME_TO_TENANT_CODE[hostname]` 또는 `HOSTNAME_TO_TENANT_CODE[hostname.replace(/^www\./, "")]` 있으면 그 값 반환. 반환 전 sessionStorage "tenantCode"에 저장.
2. **path**: pathname에서 "login" 다음 세그먼트. `pathname.split("/").filter(Boolean)`, login 인덱스 다음 값이 있으면 그 값(예: limglish, tchul). 반환 전 sessionStorage "tenantCode"에 저장.
3. **sessionStorage**: `sessionStorage.getItem("tenantCode")`.

없으면 null. null이어도 헤더는 생략만 하고 요청은 진행.

---

## 3. 로그인 URL — 도메인/login 만 노출

**목표**: 테넌트 전용 도메인(tchul.com, limglish.kr, ymath.co.kr)에서는 주소창에 항상 `도메인/login` 만 보이게. `도메인/login/limglish` 등은 노출하지 않음.

### 3.1 getTenantCodeFromHostname (tenant/index.ts)

- **반환**: `TenantResolveResult`.  
  localhost, 127.0.0.1 → `{ ok: false, reason: "missing" }`.  
  `.pages.dev`, `.trycloudflare.com` 끝나는 host → `{ ok: false, reason: "missing" }`.  
  그 외 비어 있지 않은 host → `{ ok: true, code: host (normalized), source: "hostname" }`.
- **resolveTenantCode()** 우선순위: storage → env → getTenantCodeFromHostname(). 로그인 URL 결정 시에는 LoginEntry에서 hostname을 storage보다 우선 사용하기 위해 getTenantCodeFromHostname을 별도 호출.

### 3.2 LoginEntry (features/auth/pages/login/LoginEntry.tsx)

- **진입**: Route index of AuthRouter → `/login` 접근 시.
- **로직**:
  1. program 없으면 Navigate to `/error/tenant-required`.
  2. **먼저** `getTenantCodeFromHostname()`. `fromHost.ok === true` 이고 `getTenantIdFromCode(fromHost.code)` 가 2|3|4 이면 → **Navigate 없이** `<TenantLoginPage tenantId={hostTenantId} />` 렌더. URL은 `/login` 유지.
  3. 그 외: `resolveTenantCode()` + `getTenantIdFromCode(code)` 로 path 계산. `TENANT_ID_TO_PATH[tenantId]` (1→/login/hakwonplus, 2→/login/tchul, 3→/login/limglish, 4→/login/ymath). `<Navigate to={path} replace />`.

즉 테넌트 전용 도메인에서는 storage/경로와 무관하게 hostname만 보고 `/login` 에서 폼 표시.

### 3.3 TenantLoginOrRedirect (app/router/AuthRouter.tsx)

- **적용 경로**: `/login/tchul`, `/login/limglish`, `/login/ymath` (Route path "tchul"|"limglish"|"ymath").
- **로직**: `getTenantCodeFromHostname()` 으로 현재 host의 tenantId 계산 (fromHostId). 렌더되는 TenantLoginPage의 tenantId와 같으면 → `<Navigate to="/login" replace />`. 다르면(공용 도메인에서 특정 테넌트 선택) children 렌더.

결과: limglish.kr 에서 `/login/limglish` 로 들어와도 즉시 `/login` 으로 301 리다이렉트.

---

## 4. www → 루트 리다이렉트

**담당**: Cloudflare. 프론트 코드 아님.

- 각 zone (limglish.kr, tchul.com, ymath.co.kr, hakwonplus.com 등) 에서 **Rules → Redirect Rules**.
- "Redirect from WWW to root" 템플릿 또는 동일 동작: `https://www.<domain>/*` → `https://<domain>/$1` 301.

---

## 5. SPA (Cloudflare Pages)

**파일**: `scripts/ensure-spa-mode.js` — 빌드 후 `dist/404.html` 제거. Cloudflare Pages는 루트에 404.html이 없으면 모든 경로를 index.html로 서빙(SPA 모드).

**배포**: Cloudflare Pages. Build output `dist`. 빌드 명령 `pnpm run build`. 상세는 `DEPLOY.md`.

---

## 5.1 선생앱(관리자) 모바일 UI

**대상**: `src/app/`, `src/features/`, `src/shared/` (선생/관리자 앱). 개발앱(admin_app)·학생앱(student) 제외.

- **뷰포트**: `useIsMobile()` (1024px 이하 = 모바일). `src/shared/hooks/useIsMobile.ts`.
- **PC**: 기존과 동일. `AppLayout` → Header + Sidebar + Main.
- **모바일**: `AppLayout`에서 `isMobile`이면 `AdminLayoutProvider` + `AppLayoutMobile`.
  - 상단 Header(로고·메뉴 버튼·알림·테마·계정). 브레드크럼·중앙 검색·만들기 버튼은 모바일에서 숨김.
  - 메뉴 버튼/하단 "메뉴" 탭 → 좌측 Drawer(전체 사이드바 메뉴). `AdminNavDrawer`, `adminNavConfig.tsx`의 `ADMIN_NAV_GROUPS` 사용.
  - 하단 탭바 `TeacherBottomBar`: 홈(대시보드)·학생·강의·커뮤니티·메뉴(드로어 열기). `ADMIN_MOBILE_TABS`.
- **네비 공통**: `src/shared/ui/layout/adminNavConfig.tsx`에 `ADMIN_NAV_BASE`, `ADMIN_NAV_GROUPS`, `ADMIN_MOBILE_TABS`, `NavIcon`. Sidebar와 모바일 Drawer/탭바에서 공유.

---

## 6. 학생 일괄 등록 — 엑셀 파싱

**파일**: `src/features/students/excel/studentExcel.ts`

### 6.1 parseStudentExcel(file) — 반환 { rows, lectureNameFromExcel? }

- **헤더 행**: 시트 첫 행부터 순회, **이름** 컬럼과 **학생전화번호 또는 학부모전화번호** 컬럼이 모두 있는 첫 행을 헤더로 사용. `headerMatches(label, key)` 는 `HEADER_ALIASES` 사용.
- **HEADER_ALIASES** (일부): name → ["이름","성명","학생명"]. parentPhone → ["학부모전화번호","부모핸드폰","부모 전화",...]. studentPhone → ["학생전화번호","학생핸드폰",...]. school → ["학교","학교(학년)","학교명"]. remark → ["구분","체크"].
- **데이터 행**: 헤더 다음 행부터. `remark` 셀에 "예시" 포함 시 스킵. 이름·전화 유효성 통과한 행만 result에 push.
- **전화번호 유효성**: 숫자만 추출 후 11자리이며 010으로 시작해야 함. **toRawPhone(v)**: 숫자만 추출. **추가 규칙**: 길이 10이고 "10"으로 시작하면 앞에 "0" 붙임 (엑셀 숫자 셀 010 누락 대응). 8자리만 있으면 010+8자리로 해석(usesIdentifier). 학생 전화 없으면 학부모 전화 8자리로 OMR(usesIdentifier). 학부모도 11자리 010 아니면 해당 행 스킵.
- **결과**: rows.length === 0 이면 프론트에서 alert "등록할 학생 데이터가 없습니다." (StudentCreateModal.tsx handleExcelFileSelect). 백엔드 ExcelParsingService에서도 parse_student_excel_file 결과 비어 있으면 ValueError("등록할 학생 데이터가 없습니다.") (academy 쪽 excel_parsing_service.py).

### 6.2 사용처

- **StudentCreateModal.tsx**: `parseStudentExcel(file)` → rows 없으면 alert "등록할 학생 데이터가 없습니다.". 있으면 setExcelParsedRows(rows), 이후 "엑셀 파일 선택 후 등록" 시 청크 단위로 학생 생성 API 호출.
- **LectureEnrollExcelModal.tsx**: 동일 파서 사용. rows 없으면 feedback.error("등록할 학생 데이터가 없습니다.").

### 6.3 엑셀 양식 다운로드

- `downloadStudentExcelTemplate()` (studentExcel.ts): EXCEL_HEADERS 기준 시트 생성. 구분, 이름, 학부모전화번호, 학생전화번호, 성별, 학교유형, 학교, 학년, 반, 계열, 메모. 안내문 + 예시 2행 포함.

---

## 6.5 직원(Staff) 시급태그 API

**파일**: `src/features/staff/api/staffWorkType.api.ts`  
**백엔드 계약**: academy/docs_cursor/07-staffs-api.md.

- **createStaffWorkType(staffId, { work_type_id, hourly_wage? })**: `POST /staffs/staff-work-types/` body `{ staff: staffId, work_type_id, hourly_wage? }`. 응답 단일 객체(StaffWorkType). 테넌트·권한(IsPayrollManager)은 백엔드·axios 헤더에서 처리.
- **fetchWorkTypes(params?)**: `GET /staffs/work-types/` (is_active 등). WorkType[].
- **fetchStaffWorkTypes(staffId)**: `GET /staffs/staff-work-types/?staff=${staffId}`. StaffWorkType[].

---

## 7. 참조 경로 요약

| 항목 | 경로 |
|------|------|
| 테넌트 config | academyfront/src/shared/tenant/config.ts |
| tenant resolve, getTenantCodeForApiRequest | academyfront/src/shared/tenant/index.ts |
| axios X-Tenant-Code | academyfront/src/shared/api/axios.ts |
| LoginEntry | academyfront/src/features/auth/pages/login/LoginEntry.tsx |
| AuthRouter, TenantLoginOrRedirect | academyfront/src/app/router/AuthRouter.tsx |
| 학생 엑셀 파싱·양식 | academyfront/src/features/students/excel/studentExcel.ts |
| 학생 등록 모달(엑셀) | academyfront/src/features/students/components/StudentCreateModal.tsx |
| SPA 모드 | academyfront/scripts/ensure-spa-mode.js |
| 백엔드 엑셀 파싱(강의 수강 등록) | academy/src/application/services/excel_parsing_service.py |

---

## 8. CORS·도메인 (백엔드 계약)

- 백엔드 CORS_ALLOWED_ORIGINS / CSRF_TRUSTED_ORIGINS 에 프론트 오리진 포함 필요: hakwonplus.com, www, limglish.kr, tchul.com, ymath.co.kr (https), academy-frontend.pages.dev, localhost 5173/5174 등. 새 도메인 추가 시 백엔드 설정 추가 필수.
- Cloudflare Pages Custom domains: hakwonplus.com, limglish.kr, tchul.com, ymath.co.kr (루트; www는 Redirect Rules로 루트로 리다이렉트). DNS CNAME 루트·www → academy-frontend-26b.pages.dev (Proxied).
