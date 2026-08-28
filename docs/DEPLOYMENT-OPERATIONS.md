# 프론트엔드 배포·E2E 운영 계약

**상태:** 현재 실행 계약
**정본:** `.github/workflows/quality-gate.yml`, `.github/workflows/e2e.yml`,
`package.json`, `scripts/guard-e2e-safety.mjs`

## 1. 배포 순서

1. PR에서 Hangul companion, typecheck, API/E2E safety guard, 변경 파일 strict
   lint, route/PWA contract, build를 통과한다.
2. 같은 build artifact를 `preview` GitHub Environment와
   `CLOUDFLARE_PREVIEW_API_TOKEN`으로 Cloudflare Pages preview에 direct
   upload한다. preview revision, Functions bundle, 핵심 route와 lazy asset을
   검증한다.
3. `main` push에서는 기존 운영 deployment id/version과 Pages production
   ownership을 읽고 rollback baseline으로 고정한다.
4. `production` GitHub Environment의 승인 뒤 같은 artifact를
   `CLOUDFLARE_PRODUCTION_API_TOKEN`으로 direct upload한다.
5. 운영 `version.json`, 배포 `index.html`이 직접 참조하는 진입 JS/CSS, 그리고
   route-critical lazy asset이 연속 3회 일치한 뒤 login, tenant availability,
   notice/QnA/clinic/session-assessment canary를 실행한다. 진입 자산을 빼면 새
   HTML만 먼저 전파되어 `index-*.js`가 404인 순간을 안정화 완료로 오인할 수 있다.
6. deploy job 내부 검증 실패는 같은 승인 job에서 즉시 baseline으로 rollback한다.
   후속 E2E 실패는 별도 `production-rollback` environment가 승인 대기 없이
   baseline으로 보상하고 실제 version 복귀를 확인한다.

배포 교체 중 이전 앱 셸이 새 lazy JavaScript 또는 CSS asset을 가리키지 못하면
`vite:preloadError`, window error/rejection, React ErrorBoundary가 같은
`isChunkLoadError` 분류를 사용해 제한된 cache-bust reload를 수행한다.
`Unable to preload CSS`도 배포 자산 경합으로 분류하며, 반복 상한 뒤에는 사용자에게
일반화된 새로고침 안내만 남긴다. route-critical CSS는 외부 Google Fonts 같은
CSP 차단 의존성을 두지 않는다.

운영 build에서는 `ErrorBoundary`가 이 복구를 직접 소유한다. 개발자용
`DevErrorBoundary`는 `import.meta.env.DEV`에서만 감싸며, 운영 오류를 먼저 잡아
일반 reload 화면으로 바꾸면 안 된다. 그래야 배포 직후 stale shell의 chunk 오류가
cache-bust 재요청과 최신 자산 전파 확인 경로까지 도달한다.

Cloudflare Git production auto-deploy는 direct-upload workflow와 경쟁하면 안
된다. workflow는 project source 설정과 reserved production branch 부재를
readback하며, drift이면 upload 전에 실패한다.

## 2. 권한과 secret

전역 Cloudflare API key와 `CLOUDFLARE_EMAIL`은 사용하지 않는다.

| Environment | secret | 최소 범위 |
|-------------|--------|-----------|
| `preview` | `CLOUDFLARE_PREVIEW_API_TOKEN` | 대상 account Pages Edit |
| `production` | `CLOUDFLARE_PRODUCTION_API_TOKEN` | 대상 account Pages Edit |
| `production` | `CLOUDFLARE_INFRA_API_TOKEN` | 대상 account Pages Edit + `hakwonplus.com` Zone Read/DNS Edit |
| `production-rollback` | `CLOUDFLARE_PRODUCTION_API_TOKEN` | production과 같은 Pages 전용 token |

`CLOUDFLARE_ACCOUNT_ID`와 `CLOUDFLARE_PROJECT_NAME`은 기존 account/project
binding을 사용한다. production token과 infra token을 한 token으로 합치지
않는다. `production-rollback`은 main/protected branch 실패 보상 전용이며
일반 deploy job에서 사용하지 않는다.

GitHub ruleset, environment reviewer, Actions commit pin, Dependabot 제어면은
backend `docs/operations/github-governance.md`와
`scripts/v1/converge-github-governance.ps1`이 두 저장소를 함께 소유한다.

## 3. PR E2E와 운영 쓰기 경계

`pnpm test:e2e:gate`는 아래처럼 검토된 login, read-only, route-mock만 소유한다.

- production safety policy
- 관리자/학생 login dashboard
- smoke
- mock account recovery와 first-login guide
- 모든 활성 `*.mock.spec.ts`: 직접 채점, 출결 일괄 안전성, 직원 운영,
  학생 맞춤 컬럼·상세 진입점, 오답노트, 제품 사용 분석, 영상 오류·썸네일,
  선생님 모바일 답변
- 과제별 만점과 저장 payload를 검증하는 로컬 성적 입력 계약

notice/QnA/clinic/password/session-assessment처럼 행을 생성·수정하는 spec은 PR
gate와 기본 `test:e2e:release`에서 제외한다.
`scripts/guard-e2e-safety.mjs`가 `e2e/suites.mjs`의 분류와 package script
진입점을 검사하므로 production-backed 쓰기 spec을 추가하면 CI가 먼저 실패한다.
`pnpm guard:test-coverage`는 새 활성 `*.mock.spec.ts`가 PR gate에서 빠지거나
API route interception 없이 등록되면 실패한다.
같은 guard는 `criticalInteractionSpecs`의 390px 화면이 공통
`assertInteractiveSurface` 계약을 실행하는지, `criticalStateTransitionSpecs`의
평가·성적·학생 답안 흐름이 PR gate에 남아 있는지도 차단한다. 공통 interaction
계약은 문서/표면 가로 overflow, 화면 밖 컨트롤, primary action 표시와 키보드
focus를 실제 렌더에서 검증한다. 상태 전이 묶음은 저장 후 재조회, 오류 입력 보존,
stale 충돌, 동일 계정 복구와 유효한 0을 소유한다.
PR workflow는 `E2E_ALLOW_PRODUCTION_WRITES=0`을 증거로 남긴다.

PR workflow는 production-backed safety/login/health 네 파일을 한 job의 dependency
chain으로 직렬 실행한다. 별도 job은 API proxy를 `http://127.0.0.1:9`로 닫고 각
browser context에 API interception을 설치하는 route-mock 파일만 CI 최대 4 worker로
병렬 실행한다. 두 job은 서로 기다리지 않으므로 운영 계정 직렬성은 보존하면서
route-mock wall time을 줄인다. `e2e/suites.mjs`가 PR, 유지보수 release, 통제 쓰기
목록을 한 곳에서 소유하며 safety guard가 production allowlist, route interception,
중복·누락과 package script 진입점을 함께 차단한다.

Dependabot PR은 GitHub 보안 경계상 repository/environment secret을 받지
않는다. 따라서 해당 PR에서는 Cloudflare preview와 credential 기반 login
spec을 실행하지 않고, 일반 PR과 같은 closed-proxy route-mock job만 실행한다.
Vite API proxy는 `http://127.0.0.1:9`로 고정해 누락된 mock 요청이 운영 API로
나가지 않고 즉시 실패하게 한다. 이 job은 같은 PR gate config의
`pr-route-mocks` project만 dependency 없이 실행하며, typecheck, lint, build,
Hangul companion, E2E safety guard는 일반 PR과 동일하게 유지한다. Dependabot 변경이 main에
들어가면 main workflow의 secret-backed preview와 운영 승인·rollback 경계는
그대로 적용된다.

격리된 인증 시각 QA는 운영 데이터 복제가 아니라 production-shaped development
API와 일회용 `qa-*` 테넌트를 사용한다. 프론트엔드는 검증할 정확한 revision을
실행하고 `VITE_TENANT_CODE`를 그 일회용 테넌트로 명시한다. preview hostname에서는
`/login/{tenantCode}` 경로를 가장 먼저 사용하고, 로그인 뒤 일반 route의 API 요청은
명시한 `VITE_TENANT_CODE`로 이어간다. 이전 sessionStorage의 tenant 값은 preview
fallback으로 사용하지 않는다. 데스크톱과 390px 검증이 끝나면 계정·테넌트와 임시
proxy/tunnel을 삭제하고 backend destroy readback으로 잔여 tenant/user가 0인지
확인한다.

운영 쓰기는 두 경로만 허용한다.

- `workflow_dispatch`에서 `controlled_write_canaries=true`를 명시한 수동 실행.
  `playwright.controlled-write.config.ts`는 `e2e/suites.mjs`의 통제 목록과
  `retries=0`을 소유한다:
  `E2E_ALLOW_PRODUCTION_WRITES=1`, 통제 번호, spec별 provider opt-in, 소유
  fixture cleanup을 함께 설정한다.
- main 배포 뒤 `e2e-roundtrip`: 배포된 revision의 자동 rollback과 연결된
  bounded canary이며 `E2E_ALLOW_PRODUCTION_WRITES=1`을 명시한다.

성공 여부와 무관하게 생성된 `[E2E-*]` residue는 backend exact-token cleanup과
postdeploy canary의 residue 0 증거까지 닫아야 한다.

## 4. 공급망과 변경 관리

- `.github/workflows/`의 외부 action은 모두 이동 가능한 major tag가 아니라
  검증한 40자 commit SHA로 고정한다. 주석의 major version은 업데이트 맥락일
  뿐 실행 입력이 아니다.
- `.github/dependabot.yml`은 pnpm/npm과 GitHub Actions 업데이트 PR을 매주
  만든다. React/React DOM과 타입, Tiptap 확장군은 각 런타임 묶음으로 함께
  갱신하고, 나머지 런타임·개발 의존성과 Actions의 minor/patch는 각각 묶어서 CI 중복을
  줄인다. lockfile 변경은 secretless route-mock을 포함한 dependency 검증을
  통과해야 merge하며, Dependabot에 deployment나 E2E credential을 제공하지
  않는다.
- Vite 8부터 운영 build는 Lightning CSS의 엄격한 문법 검증을 통과해야 한다.
  다중 `background-image`의 `!important`는 선언 끝에 한 번만 두며, 각 레이어
  사이에 넣지 않는다. 이 규칙은 모든 학생 테넌트 테마에 동일하게 적용한다.
  Rolldown 청크 경계는 `build.rolldownOptions.output.codeSplitting`이 소유한다.
  React core·아이콘·HEIC·Excel 경계만 우선 고정하고, Ant Design과 rc 계열은
  Rolldown의 기본 공유 모듈 그래프에 맡긴다. Ant Design에 별도 `maxSize` group을
  강제하면 내부 순환 의존이 여러 청크로 갈라져 초기 로드가 실패할 수 있다.
  PR의 closed-proxy gate는 route mock 뒤 실제 production bundle을 다시 빌드하고
  preview에서 `/promo`를 strict browser로 부팅해 pageerror와 빈 root를 차단한다.
- [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)는
  `react-router >=7.12.0 <8.3.0`의 실험적 RSC server action 경로에 영향을
  주며 공식 수정 버전은 8.3.0이다. 앱은 `BrowserRouter`/`Routes` 기반 SPA로
  RSC entry, server action, `@react-router/dev`, RSC router API를 사용하지
  않지만 audit 경고를 숨기지 않고 React/React DOM 19.2.7 및 `react-router`
  8.3.0으로 전환했다. v8은 Node 22.22 이상과 ESM을 요구하며 DOM 라우팅 API도
  `react-router-dom`이 아닌 `react-router`에서 가져온다. RSC 또는 framework
  mode 도입은 이 SPA 계약의 변경이므로 별도 보안·배포 검토가 필요하다.
- `quality-check`는 lockfile 설치 직후 `pnpm audit --prod`를 차단 게이트로
  실행한다. production dependency advisory가 생기면 preview와 운영 배포로
  진행하지 않으며 audit ignore나 취약 버전 override로 통과시키지 않는다.
- workflow 기본 token은 `contents:read`다. 프론트 배포는 GitHub contents
  write 권한을 사용하지 않는다.
- Cloudflare token 교체는 새 token을 해당 environment에 저장하고 preview,
  production deploy, 강제 실패 rollback을 모두 확인한 뒤 이전 global key를
  폐기한다.

## 5. 검증

```powershell
pnpm guard:e2e-safety
pnpm guard:runtime-recovery
pnpm audit --prod
pnpm typecheck
pnpm build
pnpm test:e2e:visual-audit
```

`.github/workflows/visual-audit.yml`은 매주 토요일 04:00 KST와 수동 dispatch에
실제 운영 route surface를 읽기 전용으로 렌더한다. 관리자 desktop/390px,
학생 desktop/390px, 선생님 390px, promo, system, tenant landing, developer의
9개 scope를 한 job에서 완전 직렬 실행해 checkout·의존성·Chromium 설치를 한 번만
수행한다. 운영 쓰기 플래그와 재시도는 항상 0이며 각 route의 screenshot, trace와
HTML report를 하나의 run artifact로 14일 보존한다.
실패는 빈 화면·오류 문구·design token/font 누락·control 잘림/겹침·가로
overflow·escaped HTML 중 어느 route에서 발생했는지 artifact로 추적한다.

workflow 변경은 YAML parse, 모든 `uses:`의 40자 SHA, secret 이름과 environment
binding, PR safe allowlist, production rollback 경로를 함께 검토한다. 로컬
`pnpm test:e2e:gate`가 production API를 가리키면 인증 외 mutation이 없어야
한다.

## 6. backend와 함께 배포되는 사용자 여정

backend와 frontend를 함께 바꾼 제품 작업은 두 저장소를 하나의 Git
transaction처럼 취급하지 않는다. 각 저장소의 exact SHA와 공식 release run이
독립적으로 성공한 뒤 backend 소유
[`change-risk-and-release-bundle.md`](https://github.com/guswls3028-art/academy-backend/blob/main/docs/operations/change-risk-and-release-bundle.md)의
fail-closed readback으로 pending approval, backend manifest·Dynamo lock,
frontend 운영 `version.json`을 함께 검증한다. 검증 결과를 별도 mutable queue나
릴리스 SSOT로 저장하지 않는다.
