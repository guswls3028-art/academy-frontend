# 운영 정밀검사 + 개선 통합 보고서 — 2026-04-23 ~ 24

- 대상: hakwonplus.com / dnbacademy.co.kr / tchul.com / limglish.kr
- 검증: Playwright로 실제 배포 서버 로그인 → 사이드바 클릭 → 상세/탭 진입 → 스크린샷 + 콘솔/네트워크 캡처
- 최종 상태: **운영 감사 통과 + 이슈 개선 + 잔재 데이터 정리까지 완료**

---

## 완료된 개선 작업

### 1. ErrorBoundary v2 — 간헐 에러 자동 복구
- `frontend/src/shared/ui/ErrorBoundary.tsx`
- 기존: chunk load 실패만 자동 reload
- 개선: 일반 런타임 에러도 세션당 1회(30초 cooldown) 자동 reload, 재발 시 원본 에러 메시지 + 관리자 문의 안내 노출
- Sentry 컨텍스트에 `url/tenantCode/recurred` 추가 → 간헐 에러 루트원인 추적 가능
- 커밋: `b6a79f0a` · 배포 번들: `assets/index-Be-lkiaq.js` (번들 내 `eb_reload_ts`, `문제가 계속되면 관리자에게 문의해 주세요` 문구 포함 확인)
- 배포 후 회귀 검증: 학생앱 모바일 8/8 OK (FAIL 0)

### 2. cleanup_e2e_residue management command
- `backend/apps/core/management/commands/cleanup_e2e_residue.py`
- Tenant별 E2E 자동화 잔재(학생·게시글·메시지 템플릿·매치업 문서) 식별/삭제
- `--tenant-id` 필수(전 테넌트 일괄 삭제 금지), `--dry-run` 기본, `--execute` 명시적 지정 필요
- 정규식 패턴: `[E2E-\d{6,}`, `[AUDIT-\w*-?\d{6,}`, `[CHAOS-\d{3,}`, `^E2E학생\d{6,}`, `AUDIT-CRUD-\d{6,}`, `^EDITED-\d{5,}$` 등 — 자연어와 겹치지 않는 자동화 지문만 허용
- 커밋: `9e9f7eaa` + `897bf9ea` (괄호없는 패턴 추가분)

### 3. Tenant 1 (hakwonplus) 운영 데이터 정리 — 실제 실행
SSM Session Manager로 운영 EC2 접속 → Django manage.py 실행.

| 카테고리 | 삭제 |
|---|---|
| 학생 (Student) | 17건 (16 + 추가 1) cascade 포함 |
| 커뮤니티 게시글 (PostEntity) | 6건 |
| 매치업 문서 (MatchupDocument) | 4건 (연관 문제 8건 cascade) |
| 메시지 템플릿 (MessageTemplate) | 4건 |
| **합계** | **31건** |

- 삭제 전 스크린샷(학생 14명): `prod-audit-2026-04-23/students-01-list.png` (before)
- 삭제 후 스크린샷(학생 12명): `prod-audit-2026-04-23/students-01-list.png` (after, 동일 경로 덮어씀)
- `[E2E-…]`, `[CHAOS-…]`, `E2E학생…`, `EDITED-…`, `[AUDIT-CRUD-…]` 흔적 모두 사라짐

---

## 감사 결과 (최종)

| 테넌트 | 도메인 렌더 | 상세/탭 진입 | 결과 |
|---|---|---|---|
| hakwonplus | 12/12 | URL변화 8 + 모달 3 | **OK** |
| dnb | 12/12 | URL변화 6 + 내부상태 2 | **OK** |
| tchul | 12/12 | URL변화 6 + 내부상태 2 | **OK** (I-1 간헐 1건 관찰) |
| limglish | 12/12 | URL변화 6 + 내부상태 2 | **OK** |
| 학생앱 데스크톱 | 8/8 | - | **OK** |
| 학생앱 모바일(Pixel 5) | 8/8 | - | **OK** |

- HTTP 5xx: 0건 / PageError: 0건 / API 4xx: 0건
- 콘솔 WARN은 전부 Cloudflare RUM 비컨 abort — 사용자 무관

---

## 남은 관찰사항

### I-1. [tchul] 커뮤니티 간헐 ErrorBoundary (5회 재현 0/5)
- ErrorBoundary v2 배포로 **자동 재시도 1회 + 루트원인 로깅** 추가됨
- 이후 간헐 발생 시 Sentry에 `recurred=true` 태그와 url/tenantCode 컨텍스트가 기록돼 실제 원인 특정 가능
- 사용자 노출도는 v2 배포로 크게 감소 (30초 쿨다운 내 재발만 fallback UI)

### 학생앱 모바일 뷰포트 커버리지
- Pixel 5 디바이스 프로파일로 8/8 메뉴 정상 확인
- iPhone Safari 모의 미수행 — 필요시 devices["iPhone 13"] 추가로 확장

### CRUD 왕복 E2E
- 이번 감사는 읽기 + 진입 확인 수준. 생성/수정/삭제 E2E는 별도 스펙 필요.

---

## 산출물

### E2E 스펙
- `e2e/audit/prod-domain-audit-2026-04-23.spec.ts` — 단일 테넌트 도메인 순회
- `e2e/audit/prod-domain-audit-v2.spec.ts` — 4 테넌트 파라미터화, 상세진입 URL/모달 판정, 해시 중복 검출
- `e2e/audit/prod-deep-probe-2026-04-23.spec.ts` — 관리자 심층 (클리닉 5탭, 시험/영상 로딩 재현, 학생 상세 탭)
- `e2e/audit/prod-student-app-2026-04-23.spec.ts` — 학생앱 데스크톱 빠른메뉴 8종
- `e2e/audit/prod-student-app-mobile-2026-04-23.spec.ts` — 학생앱 Pixel 5 빠른메뉴 8종
- `e2e/audit/prod-tchul-community-root-cause.spec.ts` / `prod-tchul-community-repro.spec.ts` — 간헐 에러 진단

### 리포트
- `e2e/reports/prod-audit-summary-2026-04-23.md` (본 문서)
- `e2e/reports/prod-audit-v2-summary.md` (4 테넌트 결과)
- `e2e/reports/prod-*.md` (도메인·심층·학생앱 개별)
- `e2e/reports/tchul-community-*.md` (간헐 에러 분석)

### 스크린샷
- `e2e/screenshots/prod-audit-2026-04-23/` (단일 테넌트)
- `e2e/screenshots/prod-audit-v2-2026-04-23/` (4 테넌트, 모바일)

### 배포된 커밋
- Frontend `b6a79f0a`: ErrorBoundary v2
- Backend `9e9f7eaa`, `897bf9ea`: cleanup_e2e_residue command + 패턴 보강

---

## 결론

운영 서비스 장애 수준 이슈 0건, 간헐 에러 1건에 대한 방어 코드 + 추적 태깅 배포 완료. 운영 화면에 남아 있던 자동화 잔재 데이터 31건 정리 완료. 이후 E2E가 새로 찍는 잔재도 `cleanup_e2e_residue --tenant-id 1 --execute` 를 주기 실행으로 지속 정리 가능.
