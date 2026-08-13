# Browser persistence boundaries

브라우저 저장소는 서버 정본을 대체하지 않는다. 화면 복구와 반복 작업 편의를
위한 보조 상태만 보관하며, 저장소를 읽을 수 없거나 소유 범위를 확정할 수 없으면
해당 상태를 복원하지 않고 화면의 안전한 기본값으로 시작한다.

## Scope rules

| 상태 | 범위 | 예시 |
|---|---|---|
| 인증 세션 | 브라우저 | access/refresh token; 인증 모듈만 소유 |
| 제품과 무관한 표시 취향 | 브라우저 또는 계정 | 테마, 사이드바 접힘, 표 배율 |
| 학원별 공용 취향 | tenant | 공지 24시간 닫기, 강의 과목·클리닉 위치 제안 |
| 사용자 작성·복구 데이터 | tenant + user | 커뮤니티 글 초안, 영상 이어보기 |
| 실행 결과를 바꾸는 운영 취향 | tenant + user | 매치업 분할 방식, 자동 재분석 동의, 공개 게시 확인 생략 |

tenant 또는 user를 확인할 수 없는 상태에서 tenant+user 키를 만들거나 읽지
않는다. 소유 정보가 없던 기존 전역 초안은 다른 사용자에게 자동 귀속하지 않으며,
읽거나 삭제하지 않는다. 서버에 저장된 답안, 성적, 영상 진도, 보고서, 공개 상태가
항상 정본이다.

## Implementation ownership

`src/shared/utils/safeLocalStorage.ts`가 저장소 접근과 tenant/tenant+user 키 생성을
소유한다. 제품 화면은 원시 `localStorage.getItem/setItem/removeItem` 호출 대신
이 경계를 사용한다. 학생 영상의 현재 재생 항목과 7일 이어보기 보조값은
`src/app_student/domains/video/utils/videoPlaybackStorage.ts`가 추가로 소유하며
tenant, 로그인 사용자, 선택 enrollment 범위를 함께 넣는다.

원시 `localStorage` 호출은 tenant bootstrap, 인증 토큰, 개발자 대리 로그인
경계에만 허용한다. `scripts/tests/scoped-browser-storage.test.mjs`가 `src/` 전체를
재귀 검사해 그 명시 목록 밖의 직접 접근을 차단하므로 새 제품 화면은 단순한
reference-count 예산 안에서 우회할 수 없다. 일반 브라우저 취향도 안전 wrapper를
사용하고, 답안·정책·성적 복구 상태는 tenant+user key가 없으면 읽거나 쓰지 않는다.

기존 시험 답안과 평가 정책 초안은 현재 tenant와 현재 user가 모두 확인될 때만
이전의 이미 scope된 key에서 새 공통 key로 옮긴다. 새 key의 readback이 성공한
뒤에만 이전 key를 지운다. 과거 성적 timestamp/session 초안처럼 user scope가
없던 값은 다른 계정에 귀속하지 않고 복구 대상에서 제외한다.

저장소가 비활성, 가득 참, 손상된 경우에도 API 조회·입력·제출은 계속 동작한다.
만료되거나 파싱할 수 없는 보조값은 무시한다. 확인 생략이나 자동 실행 선호를 읽지
못하면 확인을 다시 표시하는 쪽으로 실패한다.

## Verification

```powershell
pnpm guard:test-coverage
pnpm refactor:budget
pnpm typecheck
pnpm exec playwright test e2e/refactor/landing-router.spec.ts --project=chromium
pnpm exec playwright test e2e/admin/assessment-operations-workspace.mock.spec.ts e2e/admin/score-entry-autosave.spec.ts e2e/student/numeric-short-answer.spec.ts --config=playwright.pr-gate.config.ts --project=pr-route-mocks
```

정적 계약은 모든 제품 화면이 원시 저장소 접근으로 되돌아가지 않는지 검사한다.
랜딩 E2E는 현재 tenant+user 초안만 복원하고
기존 전역 키, 다른 tenant 키, 다른 user 키를 읽거나 변경하지 않는지 검증한다.
평가·성적·학생 시험 PR gate는 저장/재조회, 유효한 0, 필드 오류 입력 보존,
stale 충돌, 동일 계정 초안 복구와 숫자 정규화를 유지한다.
