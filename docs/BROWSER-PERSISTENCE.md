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
| 임시 비밀번호 변경 권장 미루기 | tenant + user + auth generation | 현재 로그인 동안 경로 이동·새로고침에서 반복 차단 방지 |

tenant 또는 user를 확인할 수 없으면 tenant+user 키를 만들거나 읽지 않는다.
서버에 저장된 답안, 성적, 영상 진도, 보고서, 공개 상태가 항상 정본이다.

### 소유자를 알 수 없는 레거시 키

scope 정보 없이 저장된 과거 전역 값은 다른 계정의 작성물일 수 있다. 현재
사용자에게 귀속하지 않고, 읽지도 옮기지도 지우지도 않으며 복구 대상에서
제외한다. 지금까지 확인된 대상은 Q&A session key, 교사 모바일 성적 입력의
`score_entry_draft_<exam>`, user scope가 없던 성적 timestamp/session 초안,
version이 없는 raw 초안 값이다. 새 사례를 만나면 이 목록에 더한다.

이미 scope된 과거 키를 새 공통 키로 옮기는 이전만 허용한다. 현재 tenant와
현재 user가 모두 확인될 때 수행하고, 새 키의 readback이 성공한 뒤에만 이전
키를 지운다.

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

학생·학부모 Q&A·상담의 본문 저장과 첨부 저장은 별도 단계다. 본문 저장 후에는
그 글 ID, 첨부 멱등성 키, 원래 파일 순서·파일명·크기·MIME을 같은 tenant/user/자녀별
초안에 즉시 저장한다. 공통 `flush(snapshot)`은 React의 다음 렌더를 기다리지 않고
서버에서 확인한 상태를 저장하여 바로 뒤로가기·새로고침해도 재생성하지 않게 한다.
본문·분류는 그 시점부터 읽기 전용이고, 첨부 실패는 작성 화면의 오류와 **첨부 다시
시도**로 복구한다. 성공 응답의 파일 수가 맞지 않아도 초안과 같은 키를 유지한다.
새로고침 후에는 원래 파일을 같은 순서로 재선택하며, 원문 파일은 브라우저 저장소에
넣지 않는다. 파일 선택기의 최대 10개 모두 복구 메타데이터에 포함한다.
첨부 전체의 성공이 확인된 뒤에만 초안을 제거하고 성공을 알린다. 사용자가 **저장된
내용으로 마치기**를 선택하면 남은 첨부 재시도를 종료하고 이미 저장된 글·파일은
보존한다. 요청 중 연속 제출과 파일 변경은 막으며, 자녀가 바뀐 뒤 이전 글의 첨부를
새 자녀 헤더로 전송하지 않는다. `community-draft-autosave.mock.spec.ts`와 격리 개발
`student-parent-community-realuse.spec.ts`에서 중복 없는 복구·reload·소비 화면과
desktop/390px를 검증한다.

Q&A·상담 작성 화면은 처음 확인한 tenant/user와 진입 당시 선택 자녀의 저장 키를
화면 수명 동안 유지한다. 자녀 헤더 변경과 화면 종료 사이에 늦은 본문 응답이
도착해도 첨부 복구 상태와 unmount flush를 원래 자녀의 초안에만 기록한다.
다른 자녀의 초안은 생성·덮어쓰기·삭제하지 않으며, 원래 자녀로 돌아와 파일을
재선택하면 같은 게시글에서 첨부만 복구한다. 기존 저장 형식과 사용자 초안은 유지한다.

Q&A·상담의 서식 있는 본문은 HTML 문자열을 초안과 게시글 API에 그대로 전달하고,
다시 열 때 같은 편집기로 읽는다. 편집기 의존성 갱신은 기존 초안이나 서버 본문을
일괄 재기록하지 않는다. 강조·목록·안전한 링크의 저장→새로고침→수정→게시글
재조회와 위험한 URL·data URL의 편집/제출 제거는
`e2e/student/community-draft-autosave.mock.spec.ts`에서 검증한다.
글머리·번호 목록 버튼을 마우스로 누른 뒤 바로 입력해도 실제 입력 위치는 목록
항목 안에 남아야 하며, 이어 선택한 텍스트의 링크가 같은 항목에 적용되어야 한다.
키보드와 터치 입력도 같은 본문 HTML을 저장·복구한다.

학생 커뮤니티에서 현재 Q&A·상담 탭을 다시 누르면 주소를 재전환하지 않아,
곧바로 연 작성 화면과 복구한 초안이 늦은 탐색 처리로 닫히지 않는다. 다른 탭을
선택하면 주소와 탭이 함께 전환되며, 초안의 저장·제출·실패 복구 규칙은 동일하다.
같은 탐색 key는 한 번만 처리하여 router 재렌더의 늦은 처리로 방금 연 질문·상담
화면을 목록으로 되돌리지 않는다. 실제 다른 탐색은 계속 처리한다. 학부모의 선택 자녀,
작성 화면에서 뒤로→목록 및 제출 후 reload는 1366px/390px mock 흐름으로 검증한다.

공개 홈페이지가 게시되지 않았거나 공개 설정이 없는 tenant의 랜딩 글쓰기 직접
URL은 초안 화면을 합성하지 않고 로그인 화면으로 이동한다.
랜딩과 학생 글쓰기는 제출 직전에 현재 입력을 동기 저장하여 자동 저장 대기 중의
빠른 성공 응답도 해당 제출 초안을 정확히 정리한다. 제출 중에는 초안 복구·새로 작성과
충돌 선택을 잠시 멈추고, 다른 탭 충돌은 해결한 뒤 제출한다.

브라우저 저장소가 차단되거나 가득 차면 작성과 제출은 유지하되 저장 실패를 화면에
명시하고 **다시 저장** 동작을 제공한다. 같은 계정의 다른 탭에서 다른 최신 초안이
오면 예약된 자동 저장까지 멈춰 현재 입력이나 상대 초안을 덮어쓰지 않으며, **다른 탭
초안 불러오기**와 **현재 내용 유지** 중 하나를 고르게 한다. 제출 중에는 충돌 해결을
잠시 멈추고, 응답이 늦게 도착해도 현재 저장된 revision과 내용이 제출 초안과 일치할
때만 제거한다. 다른 탭이 새로 저장한 초안은 완료 응답으로 삭제하지 않는다. `File` 객체, bytes,
Blob/data URL, 로컬 경로, 인증 token이나 사용자 프로필은 localStorage에 넣지 않는다.
첨부는 최대 개수 안의 잘린 파일명·크기·MIME type만 보관해 어떤 파일이었는지와 다시
선택해야 함을 안내한다.

원시 `localStorage` 호출은 tenant bootstrap, 인증 토큰, 개발자 대리 로그인
경계에만 허용한다. `scripts/tests/scoped-browser-storage.test.mjs`가 `src/` 전체를
재귀 검사해 그 명시 목록 밖의 직접 접근을 차단하므로 새 제품 화면은 단순한
reference-count 예산 안에서 우회할 수 없다. 일반 브라우저 취향도 안전 wrapper를
사용하고, 답안·정책·성적 복구 상태는 tenant+user key가 없으면 읽거나 쓰지 않는다.

시험 답안, 평가 정책 초안, 교사 모바일 성적 입력의 미저장 점수는 모두 위
[레거시 키 규칙](#소유자를-알-수-없는-레거시-키)을 따른다. 성적 입력은
`tenant+user+exam` 범위의 session key만 복구한다.

저장소가 비활성, 가득 참, 손상된 경우에도 API 조회·입력·제출은 계속 동작한다.
만료되거나 파싱할 수 없는 보조값은 무시한다. 확인 생략이나 자동 실행 선호를 읽지
못하면 확인을 다시 표시하는 쪽으로 실패한다.
임시 비밀번호 변경 권장 미루기 marker도 현재 active auth generation과 정확히
일치할 때만 적용한다. 로그아웃 뒤 새 generation, 다른 tenant 또는 다른 user의
marker를 이어받지 않으며, 저장소를 읽을 수 없으면 변경 권장을 다시 표시한다.

## Verification

```powershell
pnpm guard:test-coverage
pnpm refactor:budget
pnpm typecheck
pnpm exec playwright test e2e/student/community-draft-autosave.mock.spec.ts --config=playwright.pr-gate.config.ts --project=pr-route-mocks
pnpm exec playwright test e2e/refactor/landing-router.spec.ts --project=chromium
pnpm exec playwright test e2e/auth/account-password-flows.mock.spec.ts --project=chromium
pnpm exec playwright test e2e/admin/assessment-operations-workspace.mock.spec.ts e2e/admin/score-entry-autosave.spec.ts e2e/student/numeric-short-answer.spec.ts --config=playwright.pr-gate.config.ts --project=pr-route-mocks
```

정적 계약은 모든 제품 화면이 원시 저장소 접근으로 되돌아가지 않는지 검사한다.
랜딩 E2E는 현재 tenant+user 초안만 복원하고
기존 전역 키, 다른 tenant 키, 다른 user 키를 읽거나 변경하지 않는지 검증한다.
평가·성적·학생 시험 PR gate는 저장/재조회, 유효한 0, 필드 오류 입력 보존,
stale 충돌, 동일 계정 초안 복구와 숫자 정규화를 유지한다.
