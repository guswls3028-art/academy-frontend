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

긴 글 초안의 공통 수명주기는 `src/shared/hooks/useDurableDraft.ts`가 소유한다.
Q&A·상담·랜딩 커뮤니티 글은 tenant+user+작성 종류가 모두 들어간 키를 사용하고,
입력 변경 800ms 뒤 저장하되 연속 입력 중에도 5초 안에는 한 번 저장한다. `pagehide`,
숨김 전환, SPA unmount에서는 대기 중 입력을 즉시 flush한다. 저장값은 schema
version과 저장 시각을 포함하며 30일을 초과했거나 형식·version이 맞지 않으면
복원하지 않고 해당 scope의 손상값만 제거한다. version 없는 raw legacy 값은 같은
scope의 키에 있어도 가져오지 않는다. 정상 제출은 unmount flush보다 먼저 정확한
초안을 제거한다.

공개 홈페이지가 게시되지 않았거나 공개 설정이 없는 tenant의 랜딩 글쓰기 직접
URL은 초안 화면을 합성하지 않고 로그인 화면으로 이동한다.

브라우저 저장소가 차단되거나 가득 차면 작성과 제출은 유지하되 저장 실패를 화면에
명시하고 **다시 저장** 동작을 제공한다. 같은 계정의 다른 탭에서 다른 최신 초안이
오면 예약된 자동 저장까지 멈춰 현재 입력이나 상대 초안을 덮어쓰지 않으며, **다른 탭
초안 불러오기**와 **현재 내용 유지** 중 하나를 고르게 한다. `File` 객체, bytes,
Blob/data URL, 로컬 경로, 인증 token이나 사용자 프로필은 localStorage에 넣지 않는다.
첨부는 최대 개수 안의 잘린 파일명·크기·MIME type만 보관해 어떤 파일이었는지와 다시
선택해야 함을 안내한다. 소유자를 알 수 없는 기존 전역 Q&A session key는 읽거나
삭제하거나 새 사용자에게 이관하지 않는다.

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
pnpm exec playwright test e2e/student/community-draft-autosave.mock.spec.ts --config=playwright.pr-gate.config.ts --project=pr-route-mocks
pnpm exec playwright test e2e/refactor/landing-router.spec.ts --project=chromium
pnpm exec playwright test e2e/admin/assessment-operations-workspace.mock.spec.ts e2e/admin/score-entry-autosave.spec.ts e2e/student/numeric-short-answer.spec.ts --config=playwright.pr-gate.config.ts --project=pr-route-mocks
```

정적 계약은 모든 제품 화면이 원시 저장소 접근으로 되돌아가지 않는지 검사한다.
랜딩 E2E는 현재 tenant+user 초안만 복원하고
기존 전역 키, 다른 tenant 키, 다른 user 키를 읽거나 변경하지 않는지 검증한다.
평가·성적·학생 시험 PR gate는 저장/재조회, 유효한 0, 필드 오류 입력 보존,
stale 충돌, 동일 계정 초안 복구와 숫자 정규화를 유지한다.
