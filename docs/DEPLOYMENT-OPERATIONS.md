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
5. 운영 `version.json`과 route-critical asset이 연속 3회 일치한 뒤 login,
   tenant availability, notice/QnA/clinic/session-assessment canary를 실행한다.
6. deploy job 내부 검증 실패는 같은 승인 job에서 즉시 baseline으로 rollback한다.
   후속 E2E 실패는 별도 `production-rollback` environment가 승인 대기 없이
   baseline으로 보상하고 실제 version 복귀를 확인한다.

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
`scripts/guard-e2e-safety.mjs`가 `test:e2e:gate`의 exact allowlist를 검사하므로
package script에 production-backed 쓰기 spec을 추가하면 CI가 먼저 실패한다.
`pnpm guard:test-coverage`는 새 활성 `*.mock.spec.ts`가 PR gate에서 빠지거나
API route interception 없이 등록되면 실패한다.
PR workflow는 `E2E_ALLOW_PRODUCTION_WRITES=0`을 증거로 남긴다.

Dependabot PR은 GitHub 보안 경계상 repository/environment secret을 받지
않는다. 따라서 해당 PR에서는 Cloudflare preview와 credential 기반 login
spec을 실행하지 않고, 모든 활성 `*.mock.spec.ts`를 localhost UI에서 실행한다.
Vite API proxy는 `http://127.0.0.1:9`로 고정해 누락된 mock 요청이 운영 API로
나가지 않고 즉시 실패하게 한다. typecheck, lint, build, Hangul companion,
E2E safety guard는 일반 PR과 동일하게 유지한다. Dependabot 변경이 main에
들어가면 main workflow의 secret-backed preview와 운영 승인·rollback 경계는
그대로 적용된다.

운영 쓰기는 두 경로만 허용한다.

- `workflow_dispatch`에서 `controlled_write_canaries=true`를 명시한 수동 실행:
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
  만든다. lockfile 변경은 secretless route-mock을 포함한 dependency 검증을
  통과해야 merge하며, Dependabot에 deployment나 E2E credential을 제공하지
  않는다.
- `pnpm audit --prod`는 현재
  [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)를
  High로 보고한다. 취약 경로는 React Router의 실험적 RSC server action이며,
  현재 SPA에는 RSC entry, server action, `@react-router/dev`, RSC router API가
  없다. 수정판 `react-router` 8.3.0은 React/React DOM 19.2.7 이상과
  `react-router-dom` 제거를 포함하는 별도 메이저 전환이므로 이번 dependency
  묶음에는 포함하지 않는다. 이 advisory는 audit 설정에서 숨기지 않으며 RSC
  도입, React/Router 메이저 전환, advisory 범위 변경 중 하나가 생기면 즉시
  재평가한다.
- workflow 기본 token은 `contents:read`다. 프론트 배포는 GitHub contents
  write 권한을 사용하지 않는다.
- Cloudflare token 교체는 새 token을 해당 environment에 저장하고 preview,
  production deploy, 강제 실패 rollback을 모두 확인한 뒤 이전 global key를
  폐기한다.

## 5. 검증

```powershell
pnpm guard:e2e-safety
pnpm guard:runtime-recovery
pnpm typecheck
pnpm build
```

workflow 변경은 YAML parse, 모든 `uses:`의 40자 SHA, secret 이름과 environment
binding, PR safe allowlist, production rollback 경로를 함께 검토한다. 로컬
`pnpm test:e2e:gate`가 production API를 가리키면 인증 외 mutation이 없어야
한다.
