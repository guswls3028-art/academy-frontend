# 강사 도구함과 AI 풀이·해설

## 목적과 진입점

강사 도구함은 수업 준비·진행 도구를 한곳에서 검색하고 분류해 여는
확장 가능한 허브다.

- 정식 경로: `/workspace/mobile/tools`
- AI 풀이·해설: `/workspace/mobile/tools/problem-solver`
- 타이머: `/workspace/mobile/tools/stopwatch`
- 진입: 강사 앱 drawer의 `도구`
- 기존 `/teacher/tools...` 경로: 같은 하위 경로를 유지한 채
  `/workspace/mobile/tools...`로 redirect

현재 AI 풀이·해설은 강사 앱 전용 Beta다. 학생 앱에는 노출하지 않는다.
백엔드 권한·API·작업자·데이터 보존 계약은
[강사 AI 문제 풀이 백엔드 문서](https://github.com/guswls3028-art/academy-backend/blob/main/docs/domain/teacher-problem-solver.md)가
소유한다.

## PC PPT 문제 생성기

관리자·교사가 이미지 묶음 또는 PDF 시험지를 수업용 PPTX로 바꾸는 정식
경로는 `/workspace/tools/ppt`다. 이미지 모드는 파일 순서와 슬라이드별 반전
설정을 확인한 뒤 한 장씩 슬라이드로 만든다. `맞춤`은 이미지 전체와 여백,
`채움`은 비율을 유지한 중앙 잘림, `늘림`은 슬라이드 크기 변형으로 미리보기와
생성 PPTX가 같은 의미를 가져야 한다. PDF 모드는 문항 단위 자동 분할을
요청한다. 업로드와 생성 중에는 입력·중복 제출을 잠그고 파일 다운로드, 문항
분리, 파일 저장 진행 상태를 표시한다. 완료된 경우에만 PPTX 다운로드를
시작한다.

PDF에서 문항 영역을 확정할 수 없으면 백엔드가 페이지 단위 결과를 반환하고,
화면은 표지·목차가 포함될 수 있음을 안내한다. 생성 실패는 선택한 원본을
임의로 바꾸거나 다른 테넌트의 결과를 찾지 않고 현재 작업 오류로 표시한다.
문항 번호·공통 자료·표·보기의 크롭 규칙, Tools worker와 R2 경계는
[PPT 문제 생성기 백엔드 문서](https://github.com/guswls3028-art/academy-backend/blob/main/docs/domain/ppt-question-generator.md)가
소유한다.

## 통합 업무 문항 스튜디오

관리자·교사가 원본 시험지를 정답·해설 PDF와 편집 가능한 HWPX 검수
자료로 옮기는 문항 스튜디오는 `/workspace/tools/problem-studio`에서 연다.
사용자는 원본을 올리고 글로벌 AI 처리 범위를 확인한 뒤 작업을 시작한다.
완료 전에는 다운로드가 자동으로 시작되지 않으며, 정답·해설 PDF와 편집용
HWPX는 서로 다른 명시적 버튼으로 만든다.

전체 문제집 정답·해설 경로는 `Beta`다. 화면은 테넌트가 공동으로 사용하는
무료 완료 3회 중 남은 횟수를 실행 전에 표시한다. 진행 중인 요청도 자리를
예약하며, 시스템 실패는 반환되고 완료된 문제집만 차감된다. 잔여 횟수가
0이면 실행 버튼을 비활성화하고 유료 결제를 암시하지 않는다. Beta 결과에는
항상 교사 검수 필요 안내를 유지한다.

`정답·해설 PDF 만들기`는 PDF 한 파일만 받는다. 화면은 `문항과 정답표
분석`, `정답·해설 생성`, `빈 정답 독립 검산`, `정답·해설 PDF 조립`의
4단계와 전체 퍼센트, 완료 문항 수, 독립 검산 수, 검수 표시 수를
`aria-live` 카드에 표시한다. 긴 작업의 `run_id`만 브라우저 저장소에
보관하므로 화면을 닫았다가 다시 열어도 서버 상태를 재조회한다. 문제지 초안과
`run_id`는 테넌트 코드와 로그인 사용자 ID로 분리해 같은 PC의 다른 계정이
자동 복원하지 않는다. 계정 분리 전 형식의 초안은 내용을 자동으로 열지 않고,
사용자가 공용 PC 여부와 작성 계정, 현재 초안 덮어쓰기를 확인한 뒤 명시적으로
현재 계정에 가져온다. 인증 정보가 늦게 준비되거나 계정 스코프가 바뀌면 해당
스코프의 초안을 먼저 다시 읽은 뒤 저장해 초기 빈 화면이 기존 초안을 덮어쓰지 않는다.
브라우저 정책·용량 때문에 저장소 접근이 실패해도 이미 시작된 서버 작업을
실패로 표시하거나 다시 제출하지 않고 현재 화면에서 계속 조회한다. 시스템
계정에서 조회되지 않은 이전 형식의 작업 ID는 지우지 않고, 서버가 현재 계정의
작업임을 확인한 경우에만 계정별 키로 이관해 원래 작성자의 재개 포인터를 보존한다.
실패가 체크포인트를 보존한 경우 `중단 지점에서 다시 시작`을 표시한다.
완료 후 사용자가 `정답·해설 PDF 내려받기`를 눌렀을 때만 새 15분
다운로드 URL을 받아 저장한다.

편집용 HWPX 생성은 무료 정답·해설 3회와 별도다. 이 동작은 원문 전사와
레이아웃 대조 자료를 만들며 자동 해설을 요청하지 않는다. 따라서 무료
횟수가 0이어도 기존 원본 이관 기능은 막히지 않는다.

문서 스타일 API 응답은 배포 순서나 기존 저장값에 따라 새 선택 필드가
일시적으로 없을 수 있다. 화면은 누락 필드를 안전한 기본값으로 보완해 모든
글꼴·크기·자평·자간 입력을 계속 제어 상태로 유지한다. 설정 조회가 완전히
실패하면 기존 초안과 출력 기능은 유지하고 경고만 표시한다. 테넌트 권한,
원본 보존, 작업자와 다운로드 계약의 정본은
[Problem Studio 백엔드 문서](https://github.com/guswls3028-art/academy-backend/blob/main/docs/domain/problem-studio.md)다.

집중 회귀는 `e2e/problem-studio-ai-typing.spec.ts`에서 데스크톱과 390px
화면, Beta·무료 잔여 횟수, 동의 전 실행 차단, 무료 소진 실행 차단,
4단계 진행·완료·재개 상태, 계정별 초안 복구, 브라우저 저장 실패 중 서버 작업
지속, PDF와 HWPX의 명시적 다운로드, 문체 학습, 선택 필드 누락 응답,
브라우저 console 오류 0건을 확인한다.

## PC 버전 매치업의 모바일 작업 계약

강사 모바일 저장소의 `매치업 작업 열기`는 별도 모바일 복제 화면을 만들지 않고
정식 PC 버전 경로 `/workspace/storage/matchup`을 연다. 문서·문항 조회와 직접
자르기 저장은 기존 매치업 API와 테넌트·역할 권한을 그대로 사용하며, 모바일
화면을 이유로 권한을 넓히거나 별도 business state를 만들지 않는다.

390px에서는 저장된 데스크톱 문서 트리 폭을 적용하지 않고 현재 화면 폭을
사용한다. 직접 자르기 모달은 `페이지 선택 → 영역 선택 → 번호 확인·저장` 순서로
세로 배치하며 기존 Pointer Events를 사용해 손가락·펜·마우스를 같은 좌표 계약으로
처리한다. 1366px에서는 기존 `110px 페이지 rail + 유동 캔버스 + 280px
인스펙터` 3열 배치를 유지한다.

저장하지 않은 영역이나 붙여넣은 이미지가 있을 때 닫기·바깥 영역 클릭은 손실
확인을 거친다. `Esc`는 붙여넣기 미리보기, 선택 영역, 모달 순서로 한 단계씩
취소하고, 모달을 닫으면 진입 버튼으로 focus를 복구한다. 페이지 조회 실패는
명시적인 `페이지 다시 불러오기`를 제공하며 이 재시도는 GET만 수행한다.
`prefers-reduced-motion` 환경에서도 새 전환 애니메이션을 추가하지 않는다.

집중 회귀 `e2e/admin/matchup-mobile-touch-parity.mock.spec.ts`는 390px의
persisted tree width 차단, touch pointer 자르기·번호·저장, 손실 확인, 조회
재시도와 product mutation 범위를 확인한다. 같은 route mock의 1366px 검증은
기존 3열 폭과 document/body 가로 overflow 0을 고정한다.

### 배포 호환 경계

위 `/workspace/mobile` 경로는 현재 소스 정본이다. 이 route 전환
revision이 아직 운영 승격되지 않았거나 배포 gate에서 차단된 환경은
직전 안전 revision의 `/teacher/tools...`를 실제 진입점으로 계속
사용할 수 있다. `version.json`의 배포 SHA와 해당 revision의
`toolCatalog.ts`, `TeacherRouter.tsx`가 실행 중인 경로의 최종 증거다.

SPA shell의 HTTP 200만으로 route 전환 완료를 판단하지 않는다. 실제
강사 인증 상태에서 도구 drawer, URL, 화면 DOM을 함께 검증해야 한다.
새 revision의 배포 gate가 실패하면 기존 운영 revision을 유지하며,
문서 변경만으로 route 전환을 강제하거나 배포를 우회하지 않는다.

## 도구 등록 계약

`src/app_teacher/domains/tools/toolCatalog.ts`의 `TEACHER_TOOLS`가 도구
카드의 단일 목록이다. 각 도구는 ID, 제목, 설명, 정식 경로, 분류,
상태, 아이콘, 검색 키워드를 등록한다. 페이지 route는
`src/app_teacher/app/TeacherRouter.tsx`에 명시한다.

초기 제공 도구는 `status: "beta"`로 등록하고 카드와 기능 화면에
`Beta`를 표시한다. 명시적인 제품 결정과 회귀·운영 검증 없이
`stable`로 승격하지 않는다. AI처럼 검수가 필요한 결과는 결과
화면에도 `강사 검수 필요`를 함께 표시한다.

허브는 다음 상태를 제공한다.

- 제목·설명·분류·키워드 통합 검색
- `전체`, `수업 준비`, `수업 진행` 분류 필터
- 필터 결과 개수
- 결과 없음 안내와 검색 초기화
- 720px 미만 1열, 720px 이상 2열 카드 배치

도구를 추가할 때 허브 컴포넌트에 별도 조건문을 추가하지 않는다.
catalog와 route, 실제 페이지를 함께 추가해 목록 증가가 기존 도구
동작에 영향을 주지 않게 한다.

## 타이머 표시와 실패 복구

타이머는 관리자 `/workspace/tools/stopwatch`와 강사
`/workspace/mobile/tools/stopwatch`에서 숫자 폭이 흔들리지 않아야 한다.
관리자 PC 타이머의 시간·랩 숫자는 운영체제 내장 고정폭 글꼴을 사용하고,
강사 모바일 스톱워치는 tabular 숫자 폭을 사용한다. 두 화면 모두 외부 웹 글꼴을
요청하지 않으므로 테넌트 CSP나 네트워크 상태가 시간 표시를 바꾸면 안 된다.
관리자 PC 타이머는 수업 화면에서 멀리서도 읽을 수 있도록 시간 숫자를 크게
표시한다. 1분 미만 경고에서는 상태 점으로 빨강 의미를 유지하되, 밝은 기본
화면은 진한 경고색, 검은 프로젝터 화면은 흰색 숫자를 사용해 대비를 보장한다.
390px 화면에서는 전체 숫자가 잘리지 않도록 전용 크기와 구분자 무여백을 적용한다.

### Windows 설치와 Smart App Control

정식 PC 경로는 별도 EXE가 아니라 현재 HTTPS 화면과 PWA다. 관리자 화면의
`안전한 PC 타이머`에서 Edge·Chrome 설치 프롬프트를 사용할 수 있고, 강사
화면은 같은 방식의 앱 설치 또는 브라우저 메뉴 경로를 안내한다. 설치할 수
없는 브라우저에서도 타이머 본체는 그대로 동작해야 하며 설치 안내만 보조
상태로 남는다. 같은 이름의 파일을 반복 다운로드하지 않으므로 `(1)` 중복본도
생기지 않는다.

과거 `English_Timer.exe`, `English_Timer (1).exe`, `Timer.exe`와 ZIP 배포는
서명된 새 버전이 아니다. 화면은 Smart App Control이나 SmartScreen을 끄거나
`추가 정보 → 실행`으로 우회하라고 안내하지 않는다. 기존 파일은 실행하지
않고 삭제하도록 안내하며, 백엔드의 과거 download endpoint는 R2 URL 대신
HTTP 410으로 fail-closed한다. 코드서명·publisher·version·SHA-256·timestamp와
Smart App Control enforcement 장치 검증을 모두 갖춘 release 전에는 EXE/MSIX
다운로드를 다시 노출하지 않는다. 배포 정본은
[타이머 Windows 배포와 신뢰 경계](https://github.com/guswls3028-art/academy-backend/blob/main/docs/domain/timer-distribution.md)다.

배포 교체 중 lazy JavaScript 또는 CSS 자산을 받지 못하면 현재 입력을 서버에
전송하지 않은 채 cache-bust 새로고침으로 최신 앱 셸을 다시 받는다. 짧은 시간에
반복되면 무한 새로고침을 막고 복구 중 안내, 수동 새로고침, 일반화된 오류만
표시한다. 내부 asset 경로나 provider 오류는 정상 사용자 흐름에 노출하지 않는다.
브라우저 검증은 두 정식 경로에서 CSP 오류 0건, 타이머 숫자 고정폭, 모드 전환,
390px와 1366px 가로 overflow 없음까지 확인한다.
로컬 회귀는 `e2e/admin/stopwatch-visual-runtime.mock.spec.ts`에서 관리자 PWA
설치 프롬프트와 강사 안전 안내까지 확인한다. 전체 정적 화면 감사는
`e2e/visual/design-system-route-audit.spec.ts`가 소유한다.

## AI 풀이·해설 사용자 흐름

1. 사용자가 JPG, PNG, WEBP 문제 사진 한 장을 촬영하거나 선택한다.
   클라이언트는 12MB 초과와 지원하지 않는 MIME type을 먼저
   거부하고 미리보기를 표시한다.
2. 과목은 선택 입력이다. 학생 이름·연락처 등 개인정보가 없고
   외부 AI의 일시 처리를 이해했다는 확인 전에는 생성 버튼이
   비활성화된다.
3. 생성 요청이 성공하면 받은 `job_id` 하나를 약 1.4초 간격으로
   조회한다. 처리 중에는 입력과 중복 제출을 잠근다.
4. 상태 조회가 일시 실패하면 기존 작업 ID를 유지하고 안내를 표시한
   뒤 약 4초 후 다시 조회한다. 이 경로에서 생성 API를 다시 호출하지
   않는다.
5. 완료되면 정답 초안, 확신도, 단계별 해설, 정답 확인 근거를
   표시한다. `Beta`, `강사 검수 필요`와 원문 대조 안내는 항상
   유지한다.
6. `새 문제 풀기`는 선택 파일, 과목, 개인정보 확인, 작업 상태와
   결과를 초기화한다.

## 상태와 오류

- 작업 상태: `PENDING`, `VALIDATING`, `RUNNING`, `RETRYING`, `DONE`,
  `FAILED`, `REJECTED_BAD_INPUT`, `FALLBACK_TO_GPU`, `REVIEW_REQUIRED`
- 처리 중: `role=status` 진행 안내와 비활성화된 입력
- 사용자 수정 가능 오류: 파일 형식·용량, 개인정보 미확인
- 생성 오류: 백엔드 `detail`이 있으면 사용자용 문구로 표시하고,
  없으면 일반 재시도 문구를 표시
- 조회 오류: 기존 작업 자동 재확인 안내
- 종단 실패: 백엔드의 일반화된 오류를 표시

클라이언트는 내부 작업자 이름, R2 키, provider 오류나 디버깅
지시를 사용자에게 노출하지 않는다. 권한과 테넌트 격리는 백엔드가
최종 강제하며, 프론트엔드는 결과를 학생 또는 canonical 데이터로
저장하는 동작을 제공하지 않는다.

## 반응형·접근성 기준

- AI 화면은 820px 미만 단일 열, 820px 이상 업로드/설정 2열이다.
- 390px 모바일과 1100/1366px 데스크톱에서 가로 overflow와 긴 한국어
  결과를 확인한다.
- 파일 입력, 개인정보 checkbox, 검색과 필터는 keyboard로 조작
  가능해야 한다.
- 처리 상태는 `aria-live`, 오류는 `role=alert`로 전달한다.
- `prefers-reduced-motion`에서는 도구 카드와 spinner 애니메이션을
  줄인다.

## 구현과 검증

주요 소유 코드:

- `src/app_teacher/domains/tools/toolCatalog.ts`
- `src/app_teacher/domains/tools/pages/ToolsHubPage.tsx`
- `src/app_teacher/domains/tools/pages/ProblemSolverPage.tsx`
- `src/app_teacher/domains/tools/api/problemSolver.api.ts`
- `src/app_teacher/app/TeacherRouter.tsx`
- `src/core/router/workspaceRoutes.ts`

집중 정적 검증:

```powershell
pnpm typecheck
pnpm guard:legacy-api
pnpm lint
pnpm build
```

브라우저 검증은 로그인된 강사로 정식 경로와 기존 redirect 경로를
모두 확인하고, 합성 비개인정보 문제 이미지로 업로드→처리→결과를
검증한다. DOM에서 Beta/검수 표시와 결과 필드를 확인하며 console
오류가 없어야 한다. 조회 연결 실패 시 같은 작업을 재조회하고 생성
요청이 중복되지 않는지도 확인한다.
