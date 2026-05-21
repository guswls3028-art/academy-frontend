# arch_guard (frontend) — app/레이어 import 경계 게이트

> ⚠️ 이 문서는 참고용. 동작의 진실은 `check-boundaries.mjs` 코드와 실제 실행 결과다.

`ARCHITECTURE.md`(워크스페이스 루트) §3.3 / `frontend/CONVENTIONS.md` 의 프론트 경계를 **빌드가 강제**.
의존성 0(Node 내장 only). Refactor 로드맵(`backend/docs/refactor/roadmap.md`) **Phase 0-C** 산출물.

## 무엇을 검사하나

| rule | 위반 | 목표 |
|------|------|------|
| `cross_app` | `app_<X>` 의 파일이 다른 app alias(`@admin`/`@student`/`@dev`/`@promo`)를 import | 공유 코드는 `@/shared` 로 끌어올림 |
| `shared_imports_app` | `src/shared/` 의 파일이 app alias 를 import (역방향 의존) | 의존 역전 — app→shared 만, shared 는 app 비의존 |

테스트(`*.test.*`, `*.spec.*`) · `e2e/` · `dist`/`build`/`node_modules` · `.d.ts` 제외.
`auth`/`landing`/`core`/`styles` 는 Phase 0 검사 제외 zone(공용/진입).

import/`export from`/dynamic `import()`/`require()` 의 module specifier 를 정규식으로 추출해
path alias 로 zone 을 판정한다(상대경로·`@/`·외부 패키지는 검사 대상 아님).

## baseline 방식 (backend arch_guard 와 동일)

1. **freeze** — `node tools/arch_guard/check-boundaries.mjs --update-baseline`
2. **block new** — 평시/CI 는 baseline 에 없는 위반만 실패(exit 1).
3. **burn-down** — 고쳐 사라지면 `stale` 보고 → `--update-baseline` 로 ledger 축소.
4. **promote** — 0 도달 시 strict 화 (향후).

key = `rule|relpath|target` (line 제외, 편집에 안전).

## 현재 동결 규모 (작성 시점, **반드시 재실측**)

cross_app 9 / shared_imports_app 6 (총 15). 대표 번다운 대상:
- `app_student/domains/{community,notices,video,inventory,submit}` 가 `@admin/domains/...` 직접 재사용
  → 공통 타입·api 를 `@/shared` 로 이전(이게 곧 Phase 1 의 타입 SSOT 작업과 합류).
- `shared/{contexts,hooks,ui}` 가 `@admin/...` 역의존(ThemeContext·ClinicHighlightContext·AsyncStatusBar 등)
  → 의존 역전 또는 해당 코드를 shared 로 이전.

## 사용법 / exit code

```bash
node tools/arch_guard/check-boundaries.mjs                 # 검사 (CI 기본)
node tools/arch_guard/check-boundaries.mjs --update-baseline
node tools/arch_guard/check-boundaries.mjs --json
```

`0` 신규 없음 / `1` 신규 있음 / `2` 설정 오류.

## CI

`.github/workflows/arch-guard.yml` 가 PR/푸시에서 실행(의존성 설치 불필요).
배포(quality-gate.yml → Cloudflare Pages)와 **독립된 게이트**.

## 한계 (정직)

정규식 기반 import 추출이라 주석 처리된 import·문자열 안 가짜 import 를 드물게 오검출할 수 있다.
app 격리·shared 순수성이라는 *명확한 신호*에 집중하며, 도메인 내부 cross-import 같은 노이즈 큰
규칙은 Phase 0 에서 다루지 않는다. 더 정밀한 검사는 추후 `eslint-plugin-boundaries` 로 보강.
