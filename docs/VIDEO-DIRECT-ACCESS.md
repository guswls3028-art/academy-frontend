# 수강 등록 없는 개별 영상 권한

## 목적과 진입점

일반 영상 이용은 학생을 강의와 차시에 수강 등록한 뒤 제공한다. 예외적으로
학생을 강의 명단에 넣지 않고 영상 하나만 보여 줘야 할 때, 관리자 영상 상세의
**시청 권한 관리 → 수강 등록 없이 영상만** 탭을 사용한다.

이 화면은 기존 **권한 설정** 탭을 대체하지 않는다. 수강 이력이 있거나 앞으로
강의의 여러 영상을 볼 학생은 기존 수강 등록을 사용한다. 서버 정책의 정본은
[backend direct-video-access.md](https://github.com/guswls3028-art/academy-backend/blob/3bcfd3abc22491d63b386dd495731aabc9eb161a/docs/domain/direct-video-access.md)다.

## 관리자 흐름

1. 이름을 두 글자 이상 입력해 현재 학원 학생을 검색한다.
2. 로그인 가능한 학생 계정을 하나 선택하고, 수강 없이 열어야 하는 사유를
   입력한다.
3. 최종 확인표에서 학생, 영상 1개 범위, 수강 미생성, 사유를 다시 확인한다.
4. 승인 후 같은 영상의 현재 권한과 감사 이력을 확인한다.
5. 회수할 때는 별도 사유를 입력하고 위험 확인창을 거친다.

대량 승인 기능은 없다. 이전에 회수한 같은 권한을 다시 열 때는 기존 이력을
되살리지 않고 새 승인 확인과 새 감사 이력을 만든다. 로딩, 빈 결과, 실패,
재시도 상태는 학생 검색과 권한 이력에서 각각 독립적으로 표시한다.

## 표시·권한·실패 경계

- 화면은 인증된 동일 학원 교직원만 사용하며 학생 검색과 권한 이력도 현재
  테넌트 API만 호출한다.
- 공개 영상, YouTube 영상, 준비되지 않은 영상, 비활성 계정, 다른 학원 대상,
  같은 강의의 수강 이력은 서버가 거부한다. 클라이언트는 서버 오류 코드를
  운영자가 이해할 수 있는 문장으로만 표시하고 우회하지 않는다.
- 1366px에서는 학생 선택과 승인을 나란히, 390px에서는 세로로 배치한다. 탭은
  가로 스크롤을 허용하고 모달 자체가 화면 너비를 넘지 않는다.
- 확인창은 검토표가 있으므로 취소에 초기 포커스를 두고, 연속 Enter 입력이
  곧바로 승인으로 이어지지 않는다.

## 학생 재생

서버 재생 응답에 현재 재생 토큰이 있고 `enrollment_id`가 `null`이면 개별 영상
모드다. 이 모드에서는 세션 목록도 서버가 허용한 영상만 사용하고 다음 형제
영상으로 범위를 넓히지 않는다.

- 서버 진도 저장, 좋아요, 댓글, 조회수·활동·모니터링 쓰기를 요청하지 않는다.
- 이어보기 위치는 현재 테넌트·사용자의 브라우저에만 최대 7일 보관한다.
- `playback_expires_at` 45초 전에 재생 bootstrap을 다시 받아 짧은 서명 만료를
  갱신한다. 30초 access check가 403을 받거나 갱신에 실패하면 즉시 재생을
  닫고 다시 시도 경로를 제공한다.
- 일반 수강, 공개, 비활성 수강 권한 재생은 기존 `enrollment_id` 경로와 서버
  진도·소셜 동작을 그대로 유지한다.
- 학생 재생 화면 활동 감사는 canonical bootstrap에서 `enrollment_id`가 확인된
  일반 수강 재생만 화면 로드당 한 번 기록한다. 개별 권한, bootstrap 실패·취소,
  회수 후 재생에는 활동 이력을 만들지 않는다.

## API와 검증

OpenAPI 원본은 `scripts/openapi-backend-source.json`의 immutable backend SHA로
고정하고 `src/shared/api/generated/schema.d.ts`를 생성한다. 관리자 API 래퍼는
생성된 `DirectVideoEntitlement*` 타입을 직접 사용한다.

집중 검증은 다음을 소유한다.

- `e2e/admin/direct-video-access.mock.spec.ts`: 검색 최소 길이, 명시 확인,
  exact grant/revoke payload, 이력 재조회, 390px overflow
- `e2e/student/direct-video-access.mock.spec.ts`: exact-only 목록, 서버 진도·소셜·
  활동 쓰기 0, 로컬 이어보기, 만료 전 bootstrap 갱신, 회수 403, 기존 수강 활동
  정확히 1회, bootstrap 실패·취소 활동 0
- `pnpm api-types:check`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, PR Quality/E2E
