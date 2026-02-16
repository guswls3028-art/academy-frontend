# docs_cursor — Cursor 작업용 SSOT

이 폴더는 **Cursor(AI)가 이 저장소에서 작업할 때** 문서만 읽어도 필요한 정보를 얻을 수 있도록 정리한 문서 모음입니다.  
추측·가정 없이 **실제 코드·설정 기준**으로만 기술합니다.

## 문서 목록 (읽는 순서 권장)

| 문서 | 내용 | 작업 시 참고 |
|------|------|--------------|
| [01-apps-routing.md](01-apps-routing.md) | 앱 구분, 라우팅, /dev/*, tenant 1/9999 owner 리다이렉트 | 라우트·앱 추가·수정 시 |
| [02-shared-program-tenant.md](02-shared-program-tenant.md) | Program 타입, useProgram, tenant config, Header·document title | 공통 UI·브랜딩·테넌트 ID |
| [03-admin-api.md](03-admin-api.md) | admin_app이 쓰는 API 엔드포인트·DTO·권한(owner) | admin_app 기능·API 연동 |
| [04-deployment.md](04-deployment.md) | 빌드, copy-404, env, Cloudflare Pages | 배포·환경 변수 |
| [05-cross-repo.md](05-cross-repo.md) | 백엔드와의 계약(CORS, tenant 코드, API base) | 도메인·CORS·테넌트 매핑 이슈 |
| [06-implemented-features.md](06-implemented-features.md) | 멀티테넌트 로그인 URL, X-Tenant-Code, www 리다이렉트, SPA 폴백, 학생 엑셀 파싱 (구현 사실만) | 로그인/URL/엑셀/배포 이슈 시 참조 |

## 날짜별 스냅샷

- **docs/SSOT_0217/**: 2025-02-17 현시점 문서 스냅샷.
- **SSOT_0218 이후**: `docs/SSOT_MMDD/` 안에 **cursor_only/** (AI 전용) + **admin97/** (사람용) 필수. 사람이 보는 문서는 admin97에만. 규칙: `.cursor/rules/ssot-folder-structure.mdc`

## 원본 문서 위치

- **프론트 최상위**: 저장소 루트 `README.md`
- **배포**: `DEPLOY.md`
- **백엔드 core**: `academy/apps/core/CORE_SEAL.md`, `academy/docs_cursor/` 또는 `academy/docs/SSOT_***/`

## 규칙

- **문서만으로 판단**: 이 폴더 + 원본만 보고도 구현/수정이 가능해야 함.
- **코드가 진실**: 문서와 코드 불일치 시 코드 우선. 문서를 코드에 맞게 수정할 것.
- **추측 금지**: 문서에 없는 동작은 코드/설정을 직접 확인한 뒤 반영할 것.
