# 학생·학부모 앱 제품 계약

## 목적과 화면 원칙

`/student/*`는 학생과 학부모가 함께 사용하는 모바일 우선 화면이다. 학부모는
선택한 자녀의 학습 현황을 확인하고, 학생은 학습·제출 작업을 수행한다. 두 역할
모두 같은 테넌트 로고와 색상 토큰을 사용한다. 현재의 상단 브랜드 리본, 해야 할
일 우선 카드, 하단 핵심 탐색 구조는 유지한다.

기준 뷰포트는 390px이며 320px에서도 문서 전체의 가로 스크롤이나 카드 잘림이
없어야 한다. 긴 한글 제목, 공백 없는 URL, 표와 코드 블록은 화면 또는 콘텐츠
영역 안에서 줄바꿈하거나 해당 콘텐츠만 가로 스크롤한다. 로딩·빈 결과·오류에는
각각 스켈레톤, 다음 행동을 설명하는 빈 상태, 재시도 동작을 제공한다.

## 콘텐츠 표시 경계

- 제목, 요약, 메모, 검토 사유처럼 일반 문장인 필드는
  `richHtmlToPlainText` 또는 `richHtmlToPreviewText`로 정규화한다. 예전 데이터에
  HTML 또는 여러 번 이스케이프된 엔티티가 있어도 태그 문자열을 사용자에게
  노출하지 않는다.
- 공지·질문·상담 본문처럼 서식이 의미 있는 필드는 `RichHtmlContent`로만
  렌더링한다. 이 컴포넌트는 허용 가능한 HTML을 정화하고, 편집기에서 붙은
  `style`, 고정 `width`·`height`, 외부 `class`·`id`, 글꼴 속성을 제거한다.
- 본문의 링크와 의미 있는 제목·목록·표 구조는 유지한다. 표와 `pre`는 자신의
  영역에서만 스크롤하며 앱 전체 폭을 늘리지 않는다.
- 리치 콘텐츠가 아닌 텍스트는 DOM 주입 없이 일반 텍스트와 줄바꿈으로 표시한다.

소유 구현은 `src/shared/utils/richHtml.ts`,
`src/shared/ui/content/RichHtmlContent.tsx`, 학생 공용
`StudentPageShell`과 `base.css`다. 새 사용자 입력 또는 API 문자열을 추가할 때는
화면의 의미에 따라 일반 텍스트와 리치 본문 중 하나를 명시적으로 선택한다.

## 역할과 데이터 계약

- 학생은 시험·과제·성적표 제출, 보관함 업로드와 프로필 수정을 수행할 수 있다.
- 학부모는 자녀의 대시보드·일정·성적·공지·보관함·프로필을 읽을 수 있으나,
  시험·과제·성적표 제출, 자녀 파일 변경, 자녀 프로필 변경, 질문·상담 작성은
  읽기 전용으로 막는다. 학부모 자신의 비밀번호 변경은 허용한다.
- 학부모가 고른 자녀 ID는 학생 API의 `X-Student-Id`에 전달한다. 선택하지 않은
  자녀, 연결되지 않은 자녀 또는 다른 테넌트 자녀를 임의로 추정하지 않으며 API가
  실패하면 오류 상태로 닫는다.
- 알림 읽음 상태는 서버의 학습 데이터가 아니라 30일 보존 로컬 UX 상태다.
  저장 키는 `{tenant}:{student profile}`로 분리한다. 학부모는 선택 자녀 ID,
  학생은 본인 프로필 ID를 사용하므로 같은 기기·같은 시험 ID여도 다른 학생의
  읽음 배지를 숨기지 않는다. 자녀 전환 시 쿼리 캐시도 새 선택 범위로 갱신한다.

서버의 학생·학부모 권한과 자녀 연결 계약은 academy-backend의
`docs/domain/student-core.md`, `docs/domain/parent-account.md`가 소유한다.
프론트엔드는 그 계약을 완화하거나 기본 자녀를 추정하지 않는다.

## 실패 동작과 검증

리치 콘텐츠 정화가 실패해도 원본 HTML을 실행해서는 안 된다. 로컬 저장소가
비활성·가득 참·손상 상태이면 알림 읽음 처리는 저장하지 못한 것으로 취급하되
학습 데이터 조회와 화면 사용은 계속 가능해야 한다.

```powershell
pnpm typecheck
pnpm exec playwright test e2e/student/student-content-resilience.mock.spec.ts --project=chromium
pnpm exec playwright test e2e/student/student-score-trend.spec.ts --project=chromium
pnpm exec playwright test e2e/visual/design-system-route-audit.spec.ts --grep "student mobile route surface" --project=chromium
```

첫 테스트는 다중 이스케이프 HTML, 붙여넣기 고정 폭, 긴 URL·표, 390/320px
레이아웃과 계정별 알림 격리를 검증한다. 운영 정적 경로 감사는 학생 화면마다
누출된 태그 문자열, 빈 화면, 오류 문구, 디자인 토큰·폰트 누락과 문서 전체의
가로 넘침을 실패로 처리한다.
