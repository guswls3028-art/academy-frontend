# 계정 자격증명 화면 계약

이 문서는 프론트엔드에서 비밀번호 변경·초기화·계정복구 화면이 선택해야 하는
API와 성공 후 세션 처리를 소유한다. 비밀번호 원문, 토큰, 실제 사용자 식별자는
로그·문서·테스트 산출물에 남기지 않는다.

## 역할별 경로

| 대상 | 사용자 흐름 | 요청 | 성공 후 상태 |
|---|---|---|---|
| 학생·학부모 | 학생 앱 `내 정보 → 비밀번호 변경` | `POST /core/change-password/` + `old_password`, `new_password` | 기존 access·refresh 토큰 폐기 후 새 비밀번호로 재로그인 |
| 대표·관리자·강사·직원 | 관리자 앱 `설정 → 프로필 → 보안` 또는 강사 모바일 `설정 → 비밀번호 변경` | `POST /core/change-password/` + 동일 본문 | 기존 토큰 폐기 후 재로그인 |
| 초기·임시 비밀번호 owner·student·parent | 로그인 직후 변경 권장 모달; 위험 고지 후 `나중에` 가능 | `POST /core/change-password/` + 동일 본문 | 변경하면 `must_change_password` 해제와 기존 토큰 폐기 후 재로그인; 미루면 현재 화면 계속 이용 |
| 직원 비밀번호 설정 | 직원관리에서 한 명 선택 또는 직원 상세 → 비밀번호 변경 | `POST /staffs/{id}/change-password/` + `password` | 대상 기존 토큰 폐기, 설정값으로 즉시 로그인 가능, 변경 강제·권장 없음 |
| 학생·학부모 계정복구 | 로그인 화면 `아이디 찾기` 또는 `비밀번호 찾기` | `POST /auth/account-recovery/dispatch/` | 존재 여부를 노출하지 않는 공통 응답. 임시 비밀번호는 수신 후 로그인할 때 활성화 |
| 관리자·선생님 아이디 재안내 | 학생 상세에서 `아이디 안내` | `POST /students/{id}/account-notifications/` + `target: student \| parent` | 선택 계정에 알림톡만 발송. 비밀번호·세션·강제 변경 여부 유지 |
| 관리자·선생님 비밀번호 초기화 | 학생 상세에서 `비밀번호 초기화` | 기존 staff 학생/학부모 초기화 API | 선택 계정만 초기화하고 승인된 알림톡 발송 |

본인 변경은 역할별 프로필 수정 API에 비밀번호 필드를 섞지 않는다. 프로필
이름·전화번호 저장과 비밀번호 변경을 하나의 제출에 순차 실행하면 후행 요청
실패 시 개인정보만 부분 반영될 수 있으므로, 두 작업은 화면과 요청을 분리한다.
백엔드 호환 경로가 남아 있더라도 신규 화면은 전 역할 공통 본인 변경 API만
사용한다.

## 공개 로그인 화면

- 로그인 화면은 테넌트 host를 기준으로 브랜드와 인증 대상을 함께 확정하며,
  아이디·학부모 휴대폰 번호, 비밀번호, 보기/숨기기, Caps Lock 안내, 가입·복구
  진입점을 공통으로 유지한다. 시각 테마 변경은 이 인증·테넌트 계약을 바꾸지 않는다.
- `010`으로 시작하는 11자리 휴대폰형 아이디는 iPhone·Galaxy에서 전각 숫자,
  앞뒤 공백, 하이픈·점·괄호를 제거한 숫자로 제출한다. 정확히 휴대폰형인 경우에만
  정규화하며 `student-010-1234-5678` 같은 사용자 지정 아이디의 구두점은 바꾸지
  않는다. 비밀번호는 어떤 경우에도 정규화하지 않는다.
- Godmin은 흑연 워드마크와 민트 궤도를 사용하는 분할형 로그인 화면을 제공한다.
  데스크톱은 브랜드와 입력 영역을 나란히, 840px 이하는 위아래로 배치하며 390px
  화면에서도 입력·보조 링크·법적 링크가 겹치거나 가로로 넘치지 않아야 한다.
- 배경 장식은 큰 궤도와 빛의 이동만 허용하고, 고립된 점 형태의 입자는 표시하지
  않는다. 첫 진입과 포커스·호버 피드백은 짧은 opacity/transform 전환으로 제공하며
  `prefers-reduced-motion: reduce`에서는 장식과 진입 애니메이션을 정지한다.
- 프로그램 정보 로딩 중에는 잘못된 기본 테넌트가 잠깐 보이지 않도록 기존 빈 상태를
  유지한다. 로그인 실패는 입력과 제출 사이에 서버 오류를 표시하고, 중복 제출은
  진행 중 버튼 비활성화로 막는다.

## 학생 셀프 회원가입 진입 정책

- 테넌트 registry의 `studentSelfRegistrationEnabled=false`는 로그인 화면의
  회원가입 버튼과 모달 진입을 숨긴다. 현재 적용 테넌트는 `godmin`, `tchul`이다.
- 프론트엔드 숨김은 안내 경계이고, 직접 API 요청은 백엔드의 동일 테넌트 정책이
  403으로 최종 차단한다. 별도 회원가입 route는 제공하지 않는다.
- 정책 비활성화는 기존 아이디·비밀번호 로그인과 아이디/비밀번호 찾기 버튼 및
  세션 처리에는 영향을 주지 않는다. 다른 테넌트는 기존 회원가입 흐름을 유지한다.
- 회원가입 비밀번호는 `비밀번호`와 `비밀번호 확인` 두 입력을 사용한다. 확인값은
  입력 즉시 일치 여부를 접근 가능한 상태 문구로 알리고, 불일치 제출은 확인 입력에
  포커스를 옮긴 뒤 API 요청 0건으로 막는다. 일치 시 두 값을 가공하지 않고
  `initial_password`, `password_confirmation`으로 함께 보낸다. 제출 latch와 진행
  버튼 비활성화가 같은 tick의 중복 제출을 한 건으로 제한하며, 390px와 모바일
  키보드에서도 입력·상태 문구가 가로로 넘치지 않아야 한다.
- 이미 가입된 계정 안내는 승인된 카카오 알림톡 경로를 유지한다. 카카오톡을 사용할
  수 없는 학생에게 SMS 같은 새 fallback을 만들지 않고, 선생님에게
  `학생 상세 → 비밀번호 초기화`를 요청하라고 같은 패널에서 안내한다.

## 삭제 가입 이력의 교사 복구

- 개별 가입 승인에서 백엔드가 `deleted_student_conflict`와 same-tenant 후보를
  반환하면, 가입신청 화면은 자동 복원하지 않고 후보의 등록일·삭제일·수강 이력
  건수를 표시한다. 내부 학생 ID는 선택/요청에만 사용하고 사용자 문구로 노출하지
  않는다.
- 선생님이 radio로 정확히 한 후보를 선택한 뒤에만
  `POST /students/registration_requests/{requestId}/resolve_deleted/`와
  `{ student_id }`를 보낸다. 진행 중에는 후보·확인·닫기·ESC를 잠그고 same-tick
  제출 latch로 복원 요청을 한 건만 허용한다.
- 실패하면 목록을 추측해 바꾸거나 다른 후보를 자동 시도하지 않는다. 모달을 유지해
  운영자가 새로 확인할 수 있게 하고, 성공한 경우에만 가입신청·학생·알림 카운트
  query를 무효화한다. 이 화면은 알림톡 발송 API를 호출하지 않는다.

## 입력 편의와 직원 비밀번호 유틸

- 모든 본인 변경·권장 변경·단일 직원 비밀번호 입력은 개별 보기·숨기기 버튼,
  Caps Lock 경고, `4자 이상`·`현재 값과 다름`·`확인 입력과 일치` 체크리스트를
  제공한다. 조건이 충족되기 전에는 제출할 수 없다. 520px 이하 설정 화면은
  편집 행을 1열로 쌓아 390px에서도 입력 폭과 라벨을 온전히 유지한다.
- 직원 등록과 단일 직원 비밀번호 설정은 Web Crypto로 12자 비밀번호를 로컬에서
  만들 수 있다. 대·소문자와 숫자를 포함하고 혼동하기 쉬운 `0`, `O`, `1`, `I`,
  `l`은 제외한다. 생성값은 확인 입력에도 채워져 오타를 줄인다.
- 생성한 비밀번호는 사용자가 명시적으로 누를 때만 클립보드에 복사한다.
  프론트엔드는 비밀번호를 저장하거나 별도 서버·로그·분석 도구로 전송하지
  않는다. 운영자는 안전한 별도 채널로 대상 직원에게 전달한다.
- 직원 프로필 저장과 비밀번호 설정은 서로 다른 버튼과 요청으로 분리한다. 직원
  상세의 `비밀번호 변경`은 현재 상세 대상 한 명을 그대로 사용해 목록 선택을 다시
  요구하지 않는다. 연결 계정이 없는 직원, 퇴사자, 대표 계정에는 표시하지 않고,
  관리자 계정은 대표에게만 표시한다.
  설정 성공 문구는 기존 로그인 만료와 설정값을 계속 사용할 수 있음을 안내한다.
  직원 역할(`admin`, `teacher`, `staff`)에는 과거 토큰이나 DB 상태에
  `must_change_password=true`가 남아 있어도 변경 권장 모달을 표시하지 않는다.
- 학생·학부모 일괄 초기화는 이 유틸을 재사용하지 않는다. 기존 백엔드의 대상별
  임시 비밀번호 자동 생성과 승인된 알림톡 발송 계약을 유지해, 여러 계정에 같은
  비밀번호를 적용하거나 화면에 원문을 노출하지 않는다.

## 학생 상세의 계정 안내/초기화 분리

- 관리자 데스크톱 학생 상세 오버레이와 선생님 모바일 학생 상세는 `아이디 안내`와 `비밀번호 초기화`를 서로 다른 버튼과 모달/시트로 표시한다.
- 아이디 안내는 학생, 학부모, 둘 다를 고를 수 있다. `둘 다`는 두 target 요청을 순차적으로 수행하고, 일부 실패를 성공처로 숨기지 않고 대상별로 안내한다.
- 발송 전 실제 마스킹 수신처와 `비밀번호는 변경되지 않음`을 표시한다. 성공 후는 최근 계정 알림 이력을 재조회한다.
- 390px에서 대상 선택, 수신처, 안전 안내, 발송 버튼이 가로 오버플로 없이 한 열로 읽혀야 한다.
- 비밀번호 초기화 화면은 기존처럼 대상별 파괴적 변경을 명시하고, 아이디 안내 성공 문구를 재사용하지 않는다.

## 실패와 입력 처리

- 로그인 ID와 비밀번호 입력은 iPhone Safari의 자동 대문자·자동수정·맞춤법
  변형을 끈다. 사용자가 입력한 대소문자와 기호를 그대로 `/token/`에 보내며,
  모바일에서도 역할별 홈으로 이동하기 전에 `/core/me/` 성공을 확인한다.
- access·refresh 토큰은 `activeGeneration` pointer와 generation별 단일 envelope로
  관리한다. login은 새 generation envelope를 먼저 쓴 뒤 pointer를 한 번 게시하고,
  refresh·logout·expiry는 자신이 시작한 generation만 변경하거나 제거한다. Web Lock
  미지원 환경에서도 오래된 A 요청이 새 B generation을 덮거나 지울 수 없다.
  pointer 게시 뒤 Safari가 검증 읽기만 막으면 pointer와 candidate envelope의
  self-consistency를 보존한 채 publication-unknown 저장 오류를 표시한다. 저장소
  getter/getItem/setItem/removeItem 오류는 아이디·비밀번호 오류와 구분되는 Safari
  개인정보 보호 설정 안내로 전달하며, logout 제거 실패는 성공 redirect하지 않는다.
- 현재 비밀번호, 4자 이상의 새 비밀번호, 새 비밀번호 확인을 모두 검사한다.
- 현재 비밀번호와 같은 값, 확인값 불일치, 중복 제출은 요청 전에 차단한다.
- 서버의 현재 비밀번호 불일치와 알림톡 전송 실패 문구를 화면에 표시한다.
- 알림톡 전송 실패로 서버가 변경을 롤백하면 현재 화면과 세션을 유지해 다시
  시도할 수 있게 한다.
- 공개 아이디/비밀번호 찾기의 200 응답은 실제 계정 존재나 발송 성공을 뜻하지
  않는 접수 응답이다. 계정 미일치·다건 일치·예약 실패도 같은 문구를 표시해
  사용자 존재 여부를 노출하지 않는다. 네트워크 실패나 공개 계약 밖 5xx는 기존
  오류 상태와 재시도 동작을 유지한다.
- 성공 시 서버가 `token_version`을 올리므로 이전 토큰으로 사용자 정보를 다시
  조회하지 않고 즉시 로컬 토큰을 제거한다.
- access 401에서 refresh가 실패하면 토큰을 한 번만 정리하고 `/login`으로 이동한다.
  현재 pathname/query/hash는 `session_return_path`에 보관해 재로그인 성공 후
  원래 화면으로 복귀하며, 로그인 화면은 `session_expired` 안내를 표시한다.
- refresh가 200을 반환했더라도 재시도한 원 요청이 다시 401이면 stale 세션으로
  간주한다. 회전된 토큰을 남기거나 요청마다 refresh를 반복하지 않고 같은 세션
  종료 경계로 닫는다.
- 여러 요청이 동시에 401이 되어도 최초 종료만 토큰과 세션 메타데이터를
  변경한다. 후속 실패와 `AuthContext.clearAuth()`는 이미 저장한 만료 표시와
  복귀 경로를 지우지 않는다.
- 선제 갱신과 401 후행 갱신은 한 탭에서 같은 single-flight promise를 사용한다.
  같은 origin의 여러 탭은 Web Lock으로 refresh token 회전을 직렬화하고, 먼저
  회전한 탭의 새 access/refresh를 재사용한다. 오래된 refresh의 중복 제출 실패가
  다른 탭의 정상 회전 토큰을 지우면 안 된다. Web Lock 미지원 브라우저에서도
  저장 토큰이 이미 바뀌었다면 새 토큰 쌍은 보존하되, 오래된 세대에서 시작한 요청을
  새 세션의 access token으로 전송하지 않고 취소한다.
- 인증 요청은 제출 당시 session generation을 기록한다. A 계정의 지연된 200,
  401, 403, 404, network/timeout이 도착하기 전에 B 계정 로그인이 게시됐다면 모든
  응답은 consumer·query cache에 들어가기 전에 취소한다. 회전 토큰은 generation과
  제출 refresh가 모두 현재값과 정확히 같을 때만 같은 generation envelope에 게시한다.
  다른 탭은 active envelope 제거를 logout/password/session-expiry로 감지해 user/query를
  즉시 폐기하되, inactive generation의 늦은 삭제와 정상 same-account rotation은 무시한다.
- dev impersonation은 원래 token pair를 공용 backup envelope에 보존하고, 시작과 복귀
  모두 fresh generation으로 게시한다. 복귀 뒤 impersonation 이전 generation의 지연
  응답이나 replay는 다시 유효해지지 않는다.
- `must_change_password=true`는 owner·student·parent의 권장 UI 상태일 뿐이다.
  프론트는 허용된 원래 화면을 먼저 렌더링하고 모달에
  `위험을 이해했고 나중에` 선택을 제공한다. 직원 역할에는 이 모달을 표시하지
  않으며, 백엔드도 이 claim으로 일반 API를 403 차단하지 않는다.

## 검증

화면의 버튼 존재만 확인하지 않고 실제 method·path·body, 성공 후 토큰 제거,
refresh 후 재요청 401의 단일 세션 종료와 복귀 경로 보존을 검증한다.

```powershell
pnpm exec playwright test e2e/auth/account-password-flows.mock.spec.ts e2e/auth/account-recovery-modal.spec.ts e2e/auth/signup-tenant-policy.mock.spec.ts e2e/admin/staff-operations-contract.mock.spec.ts --project=chromium --reporter=list
pnpm exec playwright test e2e/auth/iphone-safari-login.mock.spec.ts --config=playwright.pr-gate.config.ts --project=pr-route-mocks --project=pr-iphone-webkit --no-deps --reporter=list
pnpm exec playwright test e2e/auth/godmin-login-visual.mock.spec.ts --project=chromium --reporter=list
pnpm exec playwright test e2e/student/student-content-resilience.mock.spec.ts --project=chromium --grep "학부모 내 비밀번호"
pnpm exec playwright test e2e/admin/student-detail-entrypoints.mock.spec.ts --project=chromium --reporter=list
pnpm typecheck
pnpm guard:legacy-api
pnpm build
```

### persistent-development iPhone 로그인 UAT

backend의 `setup_ymath_realuse_scenario --login-uat` 마지막 JSON에서
`login_manifest`를 별도 artifact로 저장한다. artifact에는 합성 role·username·역할
landing만 있고 비밀번호나 토큰은 없어야 한다. exact frontend checkout을 SSM
loopback API에 연결한 뒤 같은 일회성 비밀번호를 환경 변수로만 전달한다.

```powershell
$env:E2E_LOGIN_UAT_FRONTEND_SHA = (git rev-parse HEAD)
$env:E2E_LOGIN_UAT_BACKEND_SHA = (git -C C:\academy\backend rev-parse HEAD)
$env:E2E_LOGIN_UAT_BACKEND_ROOT = "C:\academy\backend"
$env:E2E_LOGIN_UAT_API_DIGEST = "<candidate-sha256>"
$env:E2E_LOGIN_UAT_AWS_PROFILE = "<approved-operator-profile>"
$env:E2E_LOGIN_UAT_PASSWORD_PARAMETER = "/academy/.../development/..."
$env:E2E_ALLOW_PRODUCTION_WRITES = "0"
pnpm test:e2e:iphone-safari-uat
```

runner는 두 URL이 loopback이고 tenant가 `qa-ymath-realuse-*`, 계정이
student·parent·staff 각 10명일 때만 Chromium·WebKit 390px에서 30계정 전부의
로그인 → `/core/me/` 역할 landing → UI 로그아웃과 access·refresh 제거를 확인한다.
검수 대상 exact SHA의 untracked 포함 깨끗한 checkout만 허용한다. runner가 exact
persistent-development instance id·backend SHA·candidate digest와
`apps.api.config.settings.development`, `academy_api_development`,
`academy_api_development_app`, `academy-development-artifacts`,
`/academy/api/development/env`, `/academy/r2/development/credentials`를 정확 일치로
검증한다. prefix 일치는 허용하지 않으며 SSM parameter의 비밀값은 출력하지 않는다.
`127.0.0.1:18000`이 이미 점유돼 있으면 시작 전에 실패하고, health 응답의
listener PID가 새로 띄운 AWS SSM process tree에 속할 때만 tunnel 소유가 증명된다.
종료 시 Windows process tree 전체를 강제 종료하고 부모 exit를 기다린 뒤 18000 포트가
다시 bind 가능한지 읽어야 한다. API URL과 Vite
proxy를 동일하게 고정하며 `reuseExistingServer=false`인 전용 5174 서버를 소유한다. trace·video·screenshot은
항상 끄고 임시 결과와 표준출력에 일회성 비밀번호가 섞였는지도 검사한다. 필수 환경이
하나라도 없으면 skip이 아니라 nonzero로 종료한다.
실제 실행은 backend/frontend PR 병합과 persistent-development 후보 배포 뒤에만
허용한다. tenant code는 setup 전에 runner가 고정한다. runtime preflight가 실패하면
destructive cleanup을 실행하지 않는다. preflight 성공 뒤 setup SSM dispatch 직전에
cleanup 의무를 활성화하고, 그 뒤 SSM timeout·manifest 누락/손상·Playwright 실패를
포함한 모든 종료 경로에서 backend의
`scripts/v1/destroy-ymath-login-uat-development.ps1`을 같은 instance id로 실행해
`remaining.tenants=0`, `remaining.users=0`을 읽기 전에는 성공으로 기록하지 않는다.
운영 hostname·운영 API·실사용 계정에는 실행하지 않는다.

학생·학부모 권한 경계는 [STUDENT-PARENT-APP-CONTRACT.md](STUDENT-PARENT-APP-CONTRACT.md),
공용 계정복구의 서버 상태 전이는
`backend/docs/domain/account-recovery.md`를 함께 따른다.
