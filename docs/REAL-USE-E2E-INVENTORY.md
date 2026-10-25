# 실사용 E2E 인벤토리

**상태:** 현재 실행 계약

이 문서는 반복해서 유지하는 실사용 검증의 목적과 소유 경계를 기록한다. 전체
spec 목록과 과거 pass count는 보관하지 않는다. 실행 목록은
`e2e/suites.mjs`, 배포 연결은 `.github/workflows/e2e.yml`과
`.github/workflows/quality-gate.yml`이 정본이다.

## 1. 실행 계층

| 계층 | 진입점 | 보장 | 제외 |
|------|--------|------|------|
| PR read-only | `test:e2e:gate:readonly` | safety policy, 관리자/학생 login, 최소 smoke를 운영 계정 하나로 직렬 검증 | 생성·수정·발송 |
| PR route mock | `test:e2e:gate:mock` | 모든 활성 `*.mock.spec.ts`, tenant/API payload, 저장·reload·오류 상태, 390px 핵심 surface | 실제 API fallback |
| 수동 전체 gate | `.github/workflows/e2e.yml` | 운영 read-only와 폐쇄 proxy route mock을 병렬 재사용 | 환경이 다른 spec의 혼합 실행 |
| 통제 쓰기 | `test:e2e:controlled-writes` | 가입·복구·공지·QnA·클리닉·평가·OMR·과제 실제 왕복 | 자동 PR 실행, 재시도 |
| 배포 전 개발 canary | `quality-gate.yml` `development-canary` | 동일 deploy-bundle로 격리 development 실제 쓰기와 tenant/user cleanup zero | 운영 business mutation·외부 메시지 |
| 배포 후 canary | `quality-gate.yml` `e2e-roundtrip` | exact production revision의 login·tenant availability·조회-only 검증, 실패 시 baseline rollback | 운영 business mutation·독립 수동 실행 |
| 전 메뉴 감사 | `all-menu-button-click-audit.spec.ts` | 역할별 메뉴·조회·닫기·필터의 사람형 클릭, fatal/빈 화면 수집 | 저장·삭제·결제·발송 |
| 주간 시각 감사 | `design-system-route-audit.spec.ts` | 9개 desktop/390px/public surface, overflow·font·escaped HTML·fatal 상태 | 제품 데이터 mutation |

## 2. 실행 구조

격리 수동 PPT 실사용(`ppt-generation-realuse.spec.ts`)은 합성 7쪽 혼합 PDF의
실제 문항 18개와 이미지 전용 4쪽을 합친 22장, 직접 자른 2장의 실제 PPTX를
검증한다. 상단 쪽번호는 문항이 아니며, 일부 쪽 보존 안내를 전체 페이지
fallback 안내로 오인하지 않는다. 잘못된 PDF의 재시도, PC/390px 자르기·순서,
두 작업의 reload 후 다운로드와 exact job 정리까지 소유한다.
공식 29건 개발 canary에는 포함되지 않으므로 별도 실행 결과가 필요하다.
제품 보존 정책은 backend의 `docs/domain/ppt-question-generator.md`를 따른다.

공개 자료 실사용은 게시물당 최대 5개 첨부 계약을 유지하면서 두 시나리오로
PDF/HWP/HWPX/XLSX/ZIP과 DOCX/PPTX/TXT/PNG를 검증한다. 별도 QA 원본의 실제
변환·페이지/텍스트/이미지 디코딩, 무로그인 PC/390px 읽기·reload와 다운로드한
파일명·바이트 일치, 삭제 후 접근 거절 및 exact tenant 정리 0을 확인한다.

홈페이지 영상 실사용은 두 지정 게시자의 YouTube 링크 등록·임시저장·reload·공개,
대표 변경·익명 상세·다른 게시자 수정 시 공개 스냅샷 보존·비공개를 PC/390px에서 확인한다.
생성한 QA 영상은 비공개로 회수한 뒤 소유 scenario의 tenant cascade로 정리한다.

학생 Excel 형식 호환 spec은 폐쇄 proxy PR 작업의 첫 shard에서 UI 묶음과 별도
단계로 실행한다. 실제 XLSX의 OOXML 안전 경계와 내보내기 학년·성별 재입력,
행 오류·수정 복구를 네트워크 없이 검사하며, UI 묶음의 API mock 필수 가드는 유지한다.
학생 등록 화면 spec은 PC/390px에서 Enter/Space 선택, 읽기 중 비활성, 같은 파일
재선택과 등록 요청을 검증한다. 계정 실사용 spec은 격리 개발 worker를 거친 학생
학년·성별 저장 값과 로그인·기존 학부모/형제 연결·reload·정리 0까지 확인한다.

학생·학부모 보관함 검증은 선택 자녀의 합성 HWP/HWPX를 업로드한 뒤 reload와 원본
다운로드를 수행하여 한글 원본 파일명·바이트 일치·형제 자녀 격리를 확인한다.
다운로드는 `download: true` presign 계약을 사용하고 일반 미리보기는 기존 열람 계약을
유지한다. 개발 브라우저 경계는 실제 인증된 업로드 응답의 exact QA 원본 metadata와
presign 응답을 연결한다. 개발 tenant/bucket/key·MIME·파일명·서명·크기가 모두 일치하는
원본만 허용하며 다른 R2 URL, 앱 자격 증명 전달, redirect, 변경된 본문은 차단한다.
업로드한 exact 파일 ID는 기존 finally 정리에 포함되며 tenant/user cleanup zero도 유지한다.

학생/학부모 계정 실사용 spec은 같은 일회용 tenant의 별도 owner 계정으로 학원 정보를
PC/390px에서 수정·저장·reload한 뒤 학생 홈 학원문의 반영까지 확인한다. 기존 admin
계정 역할은 유지하며 원래 학원 정보는 finally에서 복원·재조회한다. 최종 사용자·token
정리는 기존 exact tenant cleanup-zero가 소유한다. 외부 메시지·운영 데이터 변경은
허용하지 않는다. owner fixture는 backend의
[격리 개발 런타임 계약](https://github.com/guswls3028-art/academy-backend/blob/main/docs/operations/persistent-development-runtime.md)을 따른다.

교사 앱 성적 입력은 `teacher-score-parent-realuse.spec.ts`의 필수 1개 케이스로
UI 저장 → 새로고침 → 학생·학부모 결과와 자녀 선택을 확인한다. 직원 급여 케이스는
직원 본인의 UI 출퇴근 및 390px 월별 급여 조회·새로고침도 포함한다.

계정 등록 후보 검증 `student-parent-registration-realuse.spec.ts`는 격리 개발에서
역할별 설정 저장, 직접 입력, 각자의 전화 뒤 4자리, 랜덤 6자리, 번호 없는 학생의
오류 복구, 기존 학부모 계정 보존, 공개 가입 신청 선택의 관리자 승인 후 유지와 자동 승인 직후 로그인을 8건으로 검증한다.
직접 입력/전화 방식은 두 역할의 실제 UI 로그인·reload와 PC/390px를 확인한다.
랜덤 원문은 후보 컨테이너 밖으로 꺼내지 않고 내부 token/core/me/student/me 인증으로
확인한다. 기존 학부모 hash는 소유 QA 감사 행의 keyed commitment로 생성·삭제·복원
전후를 비교한다. 같은 artifact의 나머지 필수 검증과 tenant/user cleanup0도 모두 필요하다.

고정 localhost 제어 경로는 현재 run의 메모리 capability와 정확한 학생 ID만 받는다.
비밀번호·token·임의 명령을 입력받거나 출력하지 않으며, 한 번에 한 요청만 실행한다.
요청 읽기 중인 경우도 동시 요청을 거부한다. probe 없음·실패·다른 scope·알 수 없는
출력 필드·skip은 승격을 차단한다. 후보 이미지 및 고정 SSM 문서의 계약은
[backend 초기 계정 검증](https://github.com/guswls3028-art/academy-backend/blob/main/docs/operations/persistent-development-runtime.md#초기-계정-등록-개발-후보-검증)이 소유한다.

`e2e/suites.mjs`는 다음 세 집합을 한 곳에서 소유한다.

- `productionReadOnlySpecs`: 운영 자격증명을 쓰는 네 개의 직렬 PR spec
- `routeMockSpecs`: 폐쇄 proxy에서 병렬 실행할 격리 spec
- `controlledWriteSpecs`: 명시적 opt-in과 residue cleanup이 필요한 쓰기 묶음

`playwright.pr-gate.config.ts`는 운영 read-only를 dependency chain으로 만들고
route mock만 별도 job에서 CI 최대 3 worker로 실행한다. 한 코어는 Vite와 runner에
남겨 cross-file action starvation을 방지하고, `retries: 0`으로 흔들림을 성공으로
가리지 않는다. 운영 계정, shared tenant, PostgreSQL 상태를 공유하는 묶음은
병렬화하지 않는다.

수동 workflow도 위 PR read-only와 route-mock gate를 서로 다른 job으로 병렬
재사용한다. 운영 proxy가 열린 runner와 `127.0.0.1:9` 폐쇄 proxy runner를 섞지
않으므로 mock token이나 누락 요청이 운영 인증/API 경계로 나가지 않는다.
`playwright.controlled-write.config.ts`는 통제 쓰기 manifest를 직접 사용하고
`retries: 0`을 강제해 첫 실패를 재실행으로 숨기거나 같은 mutation을 반복하지
않는다.

운영 로그인은 공통 `e2e/helpers/auth.ts` 한 곳에서만 수행한다. 일반 4xx/5xx는
즉시 실패하고, 429의 서버 지정 대기와 토큰 요청의 일시적 transport 오류만 최대
5회 안에서 재시도한다. spec 전체 재실행으로 실제 결함을 숨기지 않으면서 socket
reset 같은 외부 네트워크 흔들림은 같은 read-only 로그인 경계 안에서 복구한다.

## 3. 최적화된 감사

전 메뉴 감사는 관리자/개발자 desktop, 학생 mobile, 선생님 mobile을 한 job에서
차례로 실행한다. 주간 시각 감사도 9개 route surface를 한 job에서 실행한다.
각 workflow는 checkout, pnpm 설치, Chromium 설치, 안전 guard, 서버/환경 준비를
한 번만 수행한다. 테스트 자체는 계속 직렬이며 실패 artifact에는 모든 scope의
screenshot, trace, HTML report가 함께 남는다.

전 메뉴 감사의 네트워크 결함 수집은 사용자 화면의 API 경계만 소유한다. 별도
운영 계약과 release canary가 소유하는
`/core/product-analytics/events/batch/` telemetry는 이 감사의 결함에 중복
산입하지 않는다. 모바일 drawer는 route 정착 뒤 메뉴 trigger가 마운트될 때까지
Playwright locator의 `waitFor(state=visible)`로 최대 20초 bounded wait한 다음
순회한다. 즉시 반환하는 visibility snapshot은 readiness 판정에 사용하지 않는다.

라우트 이동과 사람형 클릭은 각각 네트워크 정착을 한 번만 소유한다. 이어지는
fatal·빈 화면 검사는 이미 정착된 페이지를 읽으며 같은 `networkidle` 대기를 다시
반복하지 않는다. 실제 본문이 비어 있을 때의 조건부 복구 대기는 유지해 실패 판정
범위는 보존하면서 정상 전체 메뉴 순회의 누적 대기만 제거한다.

감사 목록에는 현재 canonical route만 둔다. 호환 alias와 외부 redirect는 각각
집중 회귀와 공개 route 감사에서 검증하며 중복 순회하지 않는다. 데이터에 따라
실제 상세 화면으로 이동하는 공개 영상 진입점처럼 의도된 동적 redirect만 spec의
`settlesAt` 패턴으로 명시해, 정상 이동을 stale route 결함으로 오인하지 않는다.
클리닉 구 예약 주소 `/workspace/clinic/bookings`는 `clinic-remediation-missing.mock`
검사의 운영 화면·미통과 패널 전환으로 확인한다. 전 메뉴·시각 감사는 통합된
`/workspace/clinic/operations`를 순회하며 구 주소가 그대로 유지된다고 단정하지 않는다.

이 구조는 shared tenant 직렬성은 유지하면서 순차 matrix가 반복하던 runner 준비
비용을 제거한다. 새로운 shard는 독립 tenant·계정·데이터와 실행 시간 증거가
있을 때만 추가한다.

수동 workflow의 `all_menu_scope`와 `all_menu_route_filter`는 실패 원인을 짧게
재현하는 focused 진단 입력이다. scope는 고정된 `all/admin/student/teacher` 선택만
허용하고 route filter는 테스트 환경값으로만 전달한다. 두 입력의 기본값은 각각
`all`과 빈 값이며, 배포 완료 증거는 반드시 이 기본값으로 세 역할 전체를 통과한
실행만 인정한다.

## 4. 핵심 사용자 흐름

| 영역 | 반복 증거 |
|------|-----------|
| 인증·첫 사용 | 관리자/학생 login, account recovery modal, first-login guide |
| 관리자 운영 | 수동 채점, 성적 autosave/reload, 직원 운영, 학생 맞춤 컬럼 |
| 학생·학부모 | 성적 조회/제출, 모바일 영상 제어와 CDN 오류, 보호 route |
| 공개·라우팅 | promo/landing router, 단일 요금 CTA, production bundle boot |
| 역할 간 데이터 | 과제 성적/보관함, 영상 차시 흐름 |
| 통제 쓰기 | 가입승인, 계정복구, 공지/QnA/클리닉, 차시평가, OMR, 과제 제출 |

제품 기능을 추가할 때 기존 핵심 흐름과 같은 경계라면 가장 가까운 spec을
확장한다. 별도 제품 규칙이나 fixture 수명주기가 생길 때만 새 spec을 만든다.

## 5. 합격 조건

- 모든 활성 spec은 `strictTest` 또는 명시적 좁은 예외를 사용한다.
- mock spec은 `page.route`로 `/api/v1/` 경계를 가로채며 폐쇄 proxy에서
  누락 요청이 즉시 실패한다.
- 저장 흐름은 요청 payload와 reload 후 상태를 모두 검증한다.
- 모바일 핵심 흐름은 390px에서 가로 overflow, 화면 밖 control, primary action,
  keyboard focus를 검증한다.
- production write는 exact controlled phone/fixture, 명시적 allow flag,
  `retries=0`, 종료 cleanup, backend residue 0을 모두 요구한다.
- 운영 read-only와 shared tenant 감사는 worker 1을 유지한다.
- 배포 전 development canary는 같은 artifact의 정상 성공과 cleanup zero를
  생략 없이 증명한다. IAM/SSM 실제 검증의 전환 HOLD는
  [배포 운영 계약](DEPLOYMENT-OPERATIONS.md)을 따른다.
- 배포 후 canary 실패는 성공으로 완화하지 않고 저장된 baseline으로 rollback한다.
- 배포 후 read-only login canary의 자동 product analytics batch와 Cloudflare Insights
  script는 exact schema/host/path/header를 확인한 뒤 로컬에서만 중화한다. 운영 분석
  행과 외부 RUM 요청은 0이며, 중화 횟수는 PII-free 숫자로 남기고 다른 요청은 실패한다.

## 6. 유지보수와 제거 기준

live tree에는 반복 실행 가능한 회귀 계약만 둔다.

- 날짜성 screenshot/진단/일회성 실사용 spec은 결함을 닫은 뒤 일반화하거나
  삭제한다.
- 실행 결과 보고서와 screenshot dump는 Actions artifact 또는
  `_artifacts/`에 보관하며 `e2e/reports/`를 만들지 않는다.
- 일회성 변환·lint 완화 스크립트는 작업이 끝나면 삭제한다.
- 삭제된 자산은 Git 이력으로 복구할 수 있다. 현재 문서에 과거 run id, 고정
  pass count, 당시 운영 row id를 누적하지 않는다.

## 7. 검증

```powershell
pnpm guard:test-coverage
pnpm guard:e2e-safety
pnpm guard:deployment-governance
pnpm guard:runtime-recovery
pnpm typecheck
pnpm build
pnpm test:e2e:gate
```

로컬 Playwright는 검증할 checkout의 고유 Vite 포트와 `E2E_BASE_URL`을
명시한다. 운영 배포 판정은 같은 artifact의 development 성공/cleanup zero,
exact `version.json` SHA, 공식 workflow 결과, post-deploy 조회 canary와
rollback 상태를 함께 읽는다. 기존 계정 로그인과 검토된 dashboard observation의
쓰기는 업무 데이터 mutation과 별도로 보고하며 전체 DB 쓰기 0으로 표현하지 않는다.

### 평가 합산·학부모 코멘트 실사용

기존 학생·학부모 시험 시나리오는 수기채점 뒤 같은 차시의 두 시험을 PC drag와
390px 이동 버튼으로 재정렬하고, 실제 total-config와 scores meta, reload 뒤 열 순서를
대조한 후 원래 순서·합산 선택을 복원한다. 과제 시나리오는 기존 SCORE 92/100에
별도 소유 COMPLETION 과제를 배정하고 두 폭에서 통과/미통과를 실제 입력·저장한다.
점수형 셀은 `97` 입력을 Escape로 취소한 뒤 저장해 기존 92점을 확인하고,
`92.5%` 입력의 실제 92.5점 저장·reload를 확인한 뒤 92점으로 복원한다.
모두 제외한 영역에서 통과형의 순서를 바꿔 reload한 뒤 점수형만 합산으로 복원해,
통과형 위치의 영속화와 학부모 92/100 표시를 확인한다. 이후 원래 순서로 복원하고
기존 시험·과제 코멘트 공개/reload/학부모 읽기·학생 미노출 검증을 유지한다.
시험 합산 선택을 편집한 채 최소화하고 학생 검색 결과를 0명으로 바꾼 뒤 복원해도
선택이 유지되어야 한다. 검색 해제 후 출결 탭에 갔다 돌아와 같은 초안을 복원하고,
실제 저장·서버 읽기·reload를 확인한다. 이 흐름도 PC와 390px에서 실행한다.
추가 과제는 기존 finally의 삭제·404 확인 및 tenant/user cleanup-zero에 포함한다.
격리 YMath 학원의 기본 성적표는 과제 통계를 숨기므로, 과제 통계 검증 전에 소유
관리자 API로 현재 구성을 읽고 `homework_summary`만 표시한다. 다른 항목의 순서·표시·
비교 지표는 유지하며, 종료 시 실패 여부와 관계없이 원래 전체 구성을 복원하고
GET으로 일치 여부를 확인한다. 운영 학원 설정이나 제품 기본값은 변경하지 않는다.
시나리오 개수, 제한 시간, 재시도와 격리 경계는 늘리지 않으며 외부 메시지는 발송하지 않는다.
이는 실행될 실사용 검증 범위이며, mock 통과를 실사용 성공으로 대신하지 않는다.

같은 합성 성적 문구의 편집 시나리오는 다른 요청이 먼저 본문을 저장한 뒤
발송창의 오래된 초안 저장이 409로 거절되고 양쪽 문구가 보존되는지도 검증한다.
최신 내용을 반영한 초안을 명시적으로 저장하고 DB 재조회·기본 지정·reload 뒤
발송 미리보기까지 확인한다. 기존 소유 문구만 사용하고 finally 삭제/404 및 전체
cleanup0에 포함하며, 외부 발송은 하지 않는다. 조건부 갱신 서버가 포함된 후보에서
실행해야 하며 기존 서버의 성공 증거를 이 신규 경계의 성공으로 재사용하지 않는다.
발송창 진입 경합도 같은 시나리오에서 확인한다. 호출 화면이 받은 실제 v1 응답을
전달하기 전에 별도 API 요청으로 v2를 저장하고, 모달은 최신 v2를 읽도록 한다.
v1 본문으로 시작한 초안은 v1 버전으로 저장을 시도해 409가 나야 하며, 초안과
서버 v2를 모두 보존한 뒤 명시적 재저장으로 복구한다. 응답 본문은 바꾸지 않고
요청 순서만 제어하며, 성공·실패 모두 해당 route를 해제하고 기존 문구 정리를 따른다.
발송창의 새 문구 생성은 UI 요청을 같은 격리 API 경계로 전달해 실제 저장한 뒤
첫 응답만 끊는다. 원래 요청 ID로 UI 재시도한 결과가 200·같은 문구 ID인지,
동일 이름의 생성 행이 하나인지, 기본 지정과 reload가 유지되는지 확인한다.
실제 서버 응답을 그대로 전달하며 응답 본문을 만들어 대체하지 않는다. 응답에서
관찰한 모든 생성 ID를 정리 목록에 먼저 기록하므로 실패 시 중복 행도 빠짐없이
삭제·404를 확인한다. 생성 영수증은 최종 QA tenant 삭제에 함께 정리된다.

### 외부 요청 차단 원인 관찰

등록된 공개 영상 정책에 맞지 않는 외부 요청이 route-handler에서 최종 실패하면,
기존 개수 제한이 있는 관찰 이벤트에 `externalOrigin` 분류를 기록한다. 요청 방식과
리소스 종류, 기존 제공자 분류(`other` 포함), 프레임 등록·정확한 embed 일치·상위
프레임 신뢰·분리 여부, 프로토콜과 port/hash/인증정보 존재 여부만 담는다.
원본 host·URL·query·영상 ID·header·body·token·stack은 기록하지 않으며, 증거
파서는 미등록 필드와 분류값을 거부한다. 기존 이벤트 한도와 누락 집계도 적용한다.
이는 원인 확인용 진단이며 제품 수정이나 추가 요청 허용이 아니다. 제공자 허용,
테넌트 격리, 재시도 정책과 배포 기준을 유지한다. native keepalive의 직접 거부는
이 route-handler 분류를 생성하지 않는다.

외부 스크립트의 `console.error`에는 선택적인 `vendorDiagnostic`을 추가한다.
오류 원문의 고정 패턴과 source URL에서 정해진 제공자·오류 계열만 분류하고,
알 수 없는 값은 `other`로 남긴다. source URL은 발신 프레임을 증명하지 않는다.
원문 메시지·URL·host·stack은 증거에 포함하지 않으며 기존 v1 증거도 읽는다.
파서는 정확한 필드와 분류값만 허용한다. 분류 결과와 관계없이 기존 strict
실패 기준을 유지하며 외부 오류를 API 전송 복구 개수로 제외하지 않는다.

학생 질문의 실제 UI 등록 → 관리자 답변 UI 저장 → 학생·선택 자녀 학부모의 답변 조회와 reload도 같은 격리 개발 커뮤니티 검증에 포함한다. 다른 자녀에서는 질문·답변이 보이지 않아야 하며, fixture 정리와 전체 cleanup0을 확인한다.
