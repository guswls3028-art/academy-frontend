# 실사용 운영 리뷰 매뉴얼

**상태:** Active
**최초 작성:** 2026-06-05
**목적:** Academy SaaS를 실제 학원 운영 흐름으로 점검하기 위한 반복 검수 매뉴얼. 단순 라우트 진입, 스모크, "페이지가 뜬다" 검증이 아니라, 처음 쓰는 사용자와 숙련 운영자가 실제로 겪는 생성, 이동, 저장, 반영, 복구, 시각 품질을 함께 본다.

## 1. 원칙

이 매뉴얼은 사용자 가이드가 아니라 검수자의 작업 지침이다. 검수자는 기능이 "돌아간다"보다 다음 질문에 답해야 한다.

- 처음 쓰는 사람이 다음 행동을 찾을 수 있는가.
- CTA, 버튼 라벨, 빈 상태, 도움말, 오류 메시지가 현재 상황을 설명하는가.
- 모달, 입력창, placeholder, 테이블, 드로어, 모바일 bottom sheet가 실제 내용 길이를 견디는가.
- 저장, 새로고침, 역할 전환 후에도 데이터가 같은 의미로 보이는가.
- 관리자, 교사, 학생, 학부모 중 누가 다음 액션을 해야 하는지 명확한가.
- 잘못 누르기, 중복 클릭, 뒤로가기, 미입력 제출, 잘못된 파일 업로드 같은 비의도 사용을 흡수하는가.
- 클리닉, 성적, 영상, 알림톡처럼 backend 상태와 worker/provider가 엮인 흐름은 API/로그/상대 역할 화면까지 반영되는가.

## 2. 현재 근거

2026-07-30 재실측 기준.

| 구분 | 현재 사실 |
|------|-----------|
| 앱 라우트 | 통합 업무 `/workspace`, 모바일 업무 `/workspace/mobile`, 학생/학부모 `/student` |
| E2E 파일 | 안전 가드 기준 활성 spec 229개 (tracked spec 230개 중 `_local` 1개 제외) |
| E2E 테스트 라인 | 전체 TypeScript 기준 `test(` 1,026개, `test.skip(` 124개 |
| 기존 한계 | skip/annotation/early return/API-assisted 흐름이 많아 실사용 완주 증거로 약함 |
| 기존 강점 | `e2e/student/score-report-realuse.spec.ts`는 강의->차시->학생->시험->학생 제출->성적 노출까지 깊게 검증 |
| 배포 후 gate | 격리 Cloudflare preview 검증 후 production baseline을 잡고, 배포 SHA·필수 lazy asset을 3회 연속 확인한 뒤 notice/qna/clinic/password/session-assessment를 실행 |
| 사용자 가이드 | `frontend/docs/USER-GUIDE-ADMIN.md`, `frontend/docs/USER-GUIDE-STUDENT.md` |
| 도메인 SSOT | 학생 생성/생명주기: `backend/docs/domain/student-creation.md`, `backend/docs/domain/student-lifecycle.md`; OMR: `backend/docs/domain/omr.md`; 메시징: `backend/docs/domain/messaging.md` |

## 3. 점검 환경

기본은 운영 유사 테스트 테넌트인 Tenant 1 `hakwonplus`를 사용한다.

| 항목 | 기준 |
|------|------|
| 프론트 | `.env.e2e`의 `E2E_BASE_URL` |
| API | `.env.e2e`의 `E2E_API_URL` |
| 관리자 | `.env.e2e`의 `E2E_ADMIN_USER`, `E2E_ADMIN_PASS` |
| 학생 | `.env.e2e`의 `E2E_STUDENT_USER`, `E2E_STUDENT_PASS` |
| 테스트 데이터 태그 | `[E2E-{timestamp}]` |
| 스크린샷/보고서 | `C:\academy\_artifacts\realuse-review\{YYYYMMDD-HHMM}\` |
| repo 산출물 | 반복 지침은 `frontend/docs`, 일회성 증거는 `_artifacts` |

운영 알림톡 실발송이 필요한 경우 통제 수신번호 `01031217466`로만 1건 발송한다. 다른 운영 번호로 테스트 발송하지 않는다.

Tenant 1 밖의 고객 제보를 재현할 때는 플랫폼 대리 로그인 API/UI를 사용한다.
이 경로는 `impersonation.start` 감사 로그를 남기므로 명시적 opt-in 환경변수로만
실행하고, 기존 행·파일·시험을 읽는 검증을 우선한다. 테스트 helper가 원래 관리자
토큰을 `addInitScript`로 주입했다면 대상 토큰도 마지막 초기화 스크립트로 고정해
문서 이동 때 원래 토큰이 대리 로그인 토큰을 덮지 않도록 한다.
대리 로그인 토큰과 고객 화면이 실패 산출물에 남지 않도록 해당 학생 Excel 운영
spec 전체의 trace, video, screenshot 저장은 비활성화한다.

## 4. 실행 레벨

| 레벨 | 목적 | 사용 시점 | 완료 기준 |
|------|------|-----------|-----------|
| L0 빠른 회귀 | 배포 직후 핵심 라우트/roundtrip | 매 배포 | `pnpm test:e2e:gate` 또는 CI gate 통과 |
| L1 실사용 canary | 운영 핵심 한 바퀴 | 큰 UI/도메인 변경 전후 | 새 데이터 생성, 학생/관리자 반영, cleanup |
| L2 상품성 리뷰 | UI/UX, 초심자, 비의도 사용 | 출시 전/큰 화면 개편 후 | 스크린샷과 판정표, P0/P1/P2 이슈 분류 |
| L3 운영 통합 | worker/provider/실발송/장시간 영상 | 영상, 알림톡, worker, 배포 변경 후 | provider/worker 로그와 실제 수신/재생 증거 |

GitHub의 `.github/workflows/e2e.yml`을 수동 실행하면 먼저
`pnpm test:e2e:release`의 유지보수 대상 실사용 묶음을 실행한다. 요청자가
`controlled_write_canaries=true`를 명시한 실행만 가입·계정복구 실발송과
OMR·과제·클리닉 fixture를 통제 번호 및 소유 ID cleanup 경계 안에서 추가
실행한다. 그 뒤 admin/developer desktop, student mobile, teacher mobile 전
메뉴 감사를 역할별 독립 job으로 직렬 실행한다. 유지보수 묶음, 선택한 통제
쓰기 canary, 세 감사 job이 모두 성공해야 해당 수동 E2E를 통과로 기록한다.
OMR·클리닉 canary의 성적 이력은 제품의 삭제 보호 계약 때문에 프런트 API
cleanup이 시험을 archive할 수 있다. 따라서 통제 쓰기 실행 직후 backend 운영 절차의
`cleanup_e2e_residue --tenant-id 1` dry-run/exact-token execute를 수행하고,
`run-production-canary.ps1 -Mode PostDeploy`의
`production_e2e_residue_absent=0`까지 확인해야 최종 완료다. 이 후속 절차 없이
GitHub E2E 성공만으로 운영 정리를 완료했다고 판정하지 않는다.

활성 spec 전체는 릴리스 묶음이 아니다. 2026-07-30 실행 `30521523046`은
첫 shard가 120분에 도달했고 과거 일회성 감사·진단 자산에서 재시도 쌍 기준
85개 최종 실패를 남겼다. 이 자산은 필요 시 명시 실행해 현대화하거나
`_local`/archive로 정리하며, 파일 수를 제품 기능 합격 수로 보고하지 않는다.

유지보수 묶음 자체도 skip·flake를 허용하지 않는다. 첫 실행
`30530797327`의 운영 score lease 간섭, Tchul 전용 secret 부재, 중복 텍스트
selector, 운영 password-reset skip은 모두 실패 증거로 보존했다. 기본 묶음은
읽기 전용 실제 경로와 격리 route-mock만 소유하고, 알림을 발생시키는
password-reset을 포함한 쓰기 시나리오는 통제 옵션에서만 실행한다.

## 5. 공통 합격 기준

아래 중 하나라도 실패하면 "실사용 검수 통과"라고 보지 않는다.

- 화면 진입만 하고 실제 생성/저장/반영을 확인하지 않았다.
- API로 만든 데이터가 UI에서 보인다는 것만 확인하고, 사용자가 실제 CTA로 생성하는 흐름을 보지 않았다.
- 학생/교사/관리자 중 소비자 역할 화면 반영을 확인하지 않았다.
- 데이터가 없어서 skip된 흐름을 통과로 기록했다.
- 스크린샷은 있으나 사람이 무엇을 합격/불합격으로 봤는지 판정이 없다.
- cleanup 대상 데이터가 남았는데 위치와 이유가 기록되지 않았다.
- roundtrip spec의 `afterAll` cleanup이 실패했는데 경고만 남기고 테스트를 통과시켰다.
- 결과 이력 보호로 archive된 명시적 `[E2E-*]` 시험을 backend 공식 cleanup과
  postdeploy canary 없이 남겼다.
- 알림톡/영상/worker 관련 변경인데 provider/worker 상태를 확인하지 않았다.
- 점수·석차 검증처럼 알림 발송이 목적이 아닌 다중 학생 fixture를 운영에서
  생성해 필수 계정안내 메시지를 여러 건 발송했다.
- 전체 메뉴 감사에서 클라이언트 라우트 전환과 겹친 일시
  `net::ERR_ABORTED`를 제품 결함으로 오인하고 남은 화면을 검사하지 않았다.
- 전체 메뉴 감사에서 `복사`, `copy`, `duplicate` CTA를 조회 동작으로 분류해
  운영 템플릿이나 문서를 복제했다.
- 문의·게시글 같은 사용자 작성 본문의 오류 문자열을 실제 React 오류 화면으로
  오인했다. 화면 오류는 브라우저 `pageerror`와 오류 경계의 정확한 사용자 문구로
  판정한다.
- 배포 직후 자동 수집된 frontend exception을 코드 결함이나 전파 오류로 추측만
  했다. 배포 완료 시각과 초 단위로 대조하고, 현재 운영 SHA에서 동일 테넌트·역할·
  라우트의 lazy 화면과 후속 탭을 실제로 다시 연다.

## 6. 시각/상품성 판정표

각 화면은 데스크톱 1920x1080, 노트북 1366x768, 모바일 390x844 중 적용 가능한 viewport에서 본다.

| 항목 | 합격 기준 | 자주 실패하는 신호 |
|------|-----------|-------------------|
| 첫 CTA | 처음 온 사용자가 다음 행동을 5초 안에 찾을 수 있음 | 주요 버튼이 더보기 안에만 있음, 용어가 도메인 내부어 |
| 빈 상태 | 왜 비었는지, 무엇을 해야 하는지 설명 | "데이터 없음"만 표시, 생성 버튼 없음 |
| placeholder | 실제 입력 예시와 형식이 짧고 명확 | placeholder가 긴 문장, 라벨과 중복, 잘림 |
| 모달 크기 | 제목, 본문, footer CTA가 한눈에 들어옴 | footer가 화면 밖, mobile에서 닫기 불가 |
| 폼 오류 | 어떤 필드가 왜 틀렸는지 즉시 보임 | toast만 뜨고 필드 위치를 못 찾음 |
| 저장 피드백 | 저장 중/성공/실패/재시도 상태가 구분 | 버튼 재클릭 가능, 저장됐는지 모호 |
| 테이블 | 열 제목, sticky 영역, 긴 이름/강의명이 안정적 | 버튼/텍스트 겹침, 가로 스크롤 힌트 없음 |
| 드로어/시트 | 배경 맥락과 닫기/뒤로가기가 명확 | 뒤로가기 시 데이터 손실, 닫기 버튼 누락 |
| 모바일 터치 | 주요 버튼이 손가락으로 누르기 쉬움 | 작은 텍스트 버튼, 하단 탭과 CTA 겹침 |
| 색/배지 | 상태 의미가 텍스트와 함께 전달 | 색만으로 합격/불합격 구분 |

## 7. 초심자/비의도 사용 체크

각 핵심 흐름에서 최소 1회 이상 수행한다.

- 입력을 비운 채 제출한다.
- 필수값 일부만 넣고 제출한다.
- 같은 버튼을 빠르게 두 번 누른다.
- 저장 전 브라우저 뒤로가기를 누른다.
- 목록에서 직접 URL 새로고침을 한다.
- 검색어가 없는 상태, 결과가 0건인 상태를 본다.
- 모바일에서 키보드가 올라온 상태로 footer CTA를 누른다.
- 긴 학생 이름, 긴 강의명, 긴 시험명, 긴 공지 제목을 넣는다.
- 권한 없는 역할로 같은 URL에 접근한다.
- 이미 생성된 데이터와 중복되는 전화번호/아이디/예약을 시도한다.

## 8. 핵심 운영 시나리오

### S1. 가입/학생 생성

목표: 학생이 시스템에 들어오고, 관리자와 학생/학부모가 같은 계정 상태를 본다.

1. 비로그인 화면에서 회원가입 CTA를 찾는다.
2. 학생이 직접 가입 신청을 제출한다.
3. 관리자 `학생 -> 가입 신청`에서 신청을 확인한다.
4. 신청 상세를 열어 정보, 승인/거절 CTA, 자동승인 설정 안내를 본다.
5. 승인한다.
6. 학생이 승인된 아이디/비밀번호로 로그인한다.
7. 관리자 학생 목록에서 같은 학생을 찾고 상세를 연다.
8. 학생 프로필에서 이름, 전화번호, 학교 정보가 맞는지 본다.
9. 중복 전화번호로 다시 가입을 시도해 오류 안내를 본다.
10. 생성한 학생을 soft delete 후 가능하면 permanent cleanup까지 처리한다.

검증 포인트:

- 가입 신청이 pending->approved 또는 rejected로 전이된다.
- 비밀번호 원문이 화면/응답에 부적절하게 남지 않는다.
- 기존 학부모 계정 비밀번호가 변경되지 않는다는 안내가 명확하다.
- 알림톡 발송 옵션을 켠 경우 발송 로그/수신을 확인한다.

자동화 참고:

- 현재 학생 생성 도메인 검증은 backend unit 중심이다.
- [PROPOSED] 공개 회원가입 UI->관리자 승인->학생 로그인 E2E를 `frontend/e2e/realuse/signup-approval.spec.ts`로 신설한다.

### S2. 강의/수강생/차시/보강

목표: 운영자가 새 반을 만들고 수업 단위를 구성한다.

1. 관리자 `강의`에서 새 강의를 UI로 생성한다.
2. 강의 목록에서 새 강의를 찾고 상세로 진입한다.
3. 기존 학생을 수강생으로 등록한다.
4. 신규 학생 등록 모달을 강의 흐름 안에서 열고 등록 후 수강생에 추가되는지 본다.
5. 정규 차시를 생성한다.
6. 보강 차시를 생성한다.
7. 차시 바에서 정규/보강이 구분되는지 본다.
8. 차시 상세에서 출결, 성적, 시험, 과제, 영상 탭이 유지되는지 본다.
9. 모바일 업무 `/workspace/mobile/classes`에서 같은 강의/차시가 보이는지 확인한다.

검증 포인트:

- 강의 생성 후 다음 행동(수강생 추가/차시 추가)이 자연스럽다.
- 보강 차시가 정규 차시와 혼동되지 않는다.
- 차시 탭 이동 중 URL과 active tab이 일치한다.
- 새로고침 후 생성한 강의/차시가 유지된다.

자동화 참고:

- `e2e/admin/session-assessment-realuse.spec.ts`는 강의 목록->차시->성적/시험/과제 진입 read-only 검증으로 재사용 가능하다.
- [PROPOSED] UI 기반 강의 생성->수강생 등록->차시/보강 생성 canary를 신설한다.

### S3. 출결/성적 기본 운영

목표: 차시 운영 후 성적표가 실제 운영자가 쓰는 표로 작동한다.

1. 차시 출결 탭에서 학생별 출결을 입력한다.
2. 전체 출석과 개별 상태 변경을 각각 해본다.
3. 성적 탭으로 이동한다.
4. 시험/과제가 없는 빈 상태에서 안내와 CTA를 본다.
5. 시험과 과제를 추가한다.
6. 점수가 하나도 없으면 바로 입력 상태인지 확인한다. 기존 점수가 있으면 잠금 상태에서 `수정`을 누른다.
7. Tab, 화살표, Enter, Esc 이동과 `Ctrl+S` 저장, `Ctrl+Z` 실행 취소가 실제 동작과 맞는지 본다.
8. 셀 이동 후 자동 저장 상태가 `저장됨`으로 바뀌는지 확인한다.
9. `저장하고 잠금`을 눌러 셀이 다시 읽기 전용으로 바뀌는지 확인한다.
10. 기존 점수가 있는 성적표는 새로고침 후 잠금 상태와 점수가 유지되는지 확인한다.
11. 학생 상세 드로어를 열어 같은 성적이 보이는지 본다.
    드로어의 `현재 상태`가 미입력·검수 대기·실제 미달·클리닉 대상을 분리하고,
    `Esc`와 닫기 버튼이 모두 동작하는지 확인한다.
12. 셀 입력 직후 출결 탭으로 이동해도 점수가 저장되고, 성적 탭 재진입 시 기본 잠금인지 확인한다.
13. 복구 draft가 있으면 복원/버리기 전 발송·출력이 차단되고, 복원 시 수정 상태로 진입하는지 확인한다.
14. 같은 차시를 다른 탭에서 수정하려 하면 `다른 화면에서 수정 중`으로 차단되는지 확인한다.
15. 빈 성적표라도 복구 draft가 있거나 다른 화면이 수정 중이면 자동 입력하지 않는지 확인한다.
16. 성적표의 시험명을 눌러 OMR 자동채점 시험은 **OMR 검토**, 직접 채점
    시험은 학생별 문항 채점표가 열리는지 확인한다. 직접 채점표에서
    한/영 입력 상태와 무관한 O/X/오답노트 자동 이동, 기존 `0` 붙여넣기 호환, 방향키 이동,
    70~120% 배율·화면 맞춤, `Shift+?` 단축키 변경·기기 저장, 확인 후
    확정 흐름을 점검한다. OMR 검토 상단과 혼합 채점표의 **이 시험 작업**에서
    **OMR 답안 등록**을 열면 시험을 다시 선택하지 않고 현재 시험명이 표시되는지,
    닫은 뒤 원래 작업 화면으로 돌아오는지 확인한다. 확정하지 않은 직접 채점
    입력이나 저장하지 않은 OMR 보정이 있을 때는 등록 전환이 잠기는지도 확인한다.
17. **성적 도구 → 개인 성적표**에서 학생 전환, 다중 선택, 요약 1쪽/상세
    페이지 전환, 단일·다중 PDF 다운로드가 저장된 점수와 일치하는지
    확인한다.
18. **성적 도구 → 성적표 출력**에서 로고가 비율을 유지하고 긴 평가명이
    잘리지 않으며, 학생 수가 많을 때 A4 가로 여러 쪽으로 분리되는지 확인한다.
19. 점수가 있는 비만점 시험의 오답 확인과 점수 없는 종이 과제 검사를 각각
    완료→재조회→미완료로 되돌린다. 실패 응답에서는 서버 검증 사유가 보이고
    UI가 성공 상태로 오인되지 않는지 확인한다.

검증 포인트:

- 수정 중에는 알림톡 같은 소비자 노출 action이 차단되고, 저장 후 잠그면 다시 사용할 수 있다.
- 개인 성적표에는 내부 수강 ID가 노출되지 않고, 같은 강의의 누적 추이만
  포함되며, PDF 페이지 수가 선택한 학생 수와 분량의 합과 일치한다.
- 잠금 상태에서는 학생 상세의 재시험 점수·답안 보정도 수정할 수 없다.
- 저장 대기/자동 저장 중/저장됨/저장 실패 상태와 복구 안내가 명확하다.
- 긴 학생 이름/강의 chip이 테이블을 깨지 않는다.
- 빨간 `미달`은 실제 점수 기준 미달에만 쓰고, 미입력은 회색, 검수 대기는
  경고색, 클리닉은 실제 미해결 `ClinicLink`가 있을 때만 표시한다.
- 상단에는 OMR·수정·성적 도구만 우선 노출되고, 성적 도구 안의 평가
  구성/출력/클리닉 그룹은 아이콘과 설명으로 구분된다.

자동화 참고:

- `e2e/admin/score-entry-autosave.spec.ts`
- `e2e/admin/scores-tab-ux.spec.ts`
- `e2e/admin/assessment-inspection-notes.spec.ts`
- `e2e/student/score-report-realuse.spec.ts`

### S4. 시험 생성/응시/채점/결과

목표: 시험 하나가 관리자 생성부터 학생 결과까지 닫힌다.

1. 차시 `시험` 탭에서 시험을 생성한다.
2. 객관식/주관식/서술형 중 최소 객관식 문항을 만든다.
3. 정답지를 등록한다.
4. 학생 앱 `시험` 또는 차시 상세에서 시험을 찾는다.
5. 학생이 답안을 입력한다.
6. 미응답 상태로 제출을 시도해 경고를 본다.
7. 답안을 완성하고 제출한다.
8. 결과 페이지로 이동되는지 본다.
9. 관리자 성적 탭에서 점수/상태가 반영되는지 본다.
10. 정답 공개/비공개 설정에 따라 학생 화면 문구가 맞는지 본다.

검증 포인트:

- 시험 생성 모달은 총점, 합격점, 정답 공개 의미가 이해된다.
- 학생 제출은 한 번 제출 후 수정 제한/재시험 가능 여부가 명확하다.
- 결과의 점수, 오답 번호, 등수, 정답 비공개 문구가 API와 일치한다.

자동화 참고:

- `e2e/student/score-report-realuse.spec.ts`를 핵심 canary로 사용한다.
- OMR 변경 시 `backend/docs/domain/omr.md`의 "운영 UX SSOT"와 맞는지 별도 확인한다.

### S5. 과제 생성/제출/채점

목표: 과제가 시험과 다른 책임으로 운영되지만 성적 탭에서 함께 읽힌다.

1. 차시 `과제` 탭에서 과제를 생성한다.
2. 학생 앱 차시 상세 또는 제출 허브에서 과제를 찾는다.
3. 학생이 파일 없이 제출을 시도해 disabled/오류를 본다.
4. 허용 파일을 첨부하고 제출한다.
5. 관리자 제출함 또는 차시 과제 탭에서 제출물을 확인한다.
6. 점수를 입력한다.
7. 학생 성적 보드에서 과제 이력이 보이는지 확인한다.

검증 포인트:

- 과제 생성과 시험 생성 라벨이 혼동되지 않는다.
- 제출 상태, 채점 상태, 점수 상태가 같은 단어로 이어진다.
- 파일 업로드 실패/크기 초과 안내가 이해된다.

자동화 참고:

- `e2e/flows/homework-scores-inventory-data-flow.spec.ts`는 현재 렌더/구조 검증이 많다.
- [PROPOSED] UI 기반 과제 생성->학생 파일 제출->관리자 채점->학생 성적 반영 E2E를 신설한다.

### S6. 클리닉 대상 판별/예약/출석/해소

목표: 불합격 또는 미달 상태가 클리닉 대상자로 이어지고, 예약/출석 상태에 따라 해소된다.

1. 학생이 합격점 미만으로 시험을 제출한다.
2. 관리자 성적 탭에서 해당 학생이 클리닉 대상으로 표시되는지 본다.
3. `클리닉 대상 보기`를 연다.
4. 클리닉 세션을 UI로 생성한다.
5. 학생 앱 `클리닉`에서 예약 가능한 세션을 찾는다.
6. 학생이 예약 신청한다.
7. 관리자 클리닉 화면에서 pending/booked 상태를 확인한다.
8. 자동승인이 꺼진 경우 승인/거절을 각각 확인한다.
9. 출석 처리한다.
10. 학생 클리닉/성적/패스 화면에서 요건 해소가 반영되는지 본다.
11. 취소 또는 미출석 처리 후 다시 대상자로 돌아오는지 본다.

검증 포인트:

- 클리닉 대상자 판별 기준은 `ClinicLink`/성적 SSOT와 일치한다.
- 학생이 "왜 내가 클리닉 대상인지" 이해할 수 있다.
- 예약 완료, 대기, 거절, 취소, 미출석 상태가 다른 색/문구로 보인다.
- 정원 마감과 중복 예약은 조용히 실패하지 않는다.

자동화 참고:

- `e2e/flows/clinic-roundtrip.spec.ts`는 현재 세션 생성 API + 화면 로드 중심이다.
- `e2e/flows/clinic-ui-create.spec.ts`는 API-assisted라 UI 생성 검증으로는 부족하다.
- [PROPOSED] 클리닉 UI 생성과 학생 예약/관리자 승인/해소를 하나의 canary로 신설한다.

### S7. 영상 업로드/복습/시청률

목표: 영상으로 수강하는 학생과 복습하는 학생이 실제로 학습 흐름을 완주한다.

1. 관리자 `영상` 또는 차시 `영상` 탭에서 업로드 모달을 연다.
2. 파일 업로드와 YouTube 링크 추가를 각각 시도한다.
3. 파일 업로드 완료 후 처리 상태가 PENDING/PROCESSING/READY로 전이되는지 본다.
4. YouTube 링크 영상은 인코딩 없이 READY로 추가되고, 목록에서 YouTube 배지가 보이는지 본다.
5. READY 전 파일 영상이 학생에게 노출되지 않는지 확인한다.
6. READY 후 학생 앱 `영상`에서 강의->차시->영상을 찾는다.
7. 같은 제목의 `- 1`, `- 2`, `- 3` 영상이 학생 재생목록에서 번호 순으로 보이는지 확인한다.
8. 영상을 재생, 일시정지, seek, 이어보기한다.
9. 댓글/좋아요를 남긴다.
10. 관리자 영상 상세에서 시청률/댓글/학생별 로그가 반영되는지 본다.
11. 모바일 네트워크 지연 상태에서 플레이어가 빈 화면으로 멈추지 않는지 본다.

검증 포인트:

- 인코딩 실패 시 재시도/문의 경로가 보인다.
- YouTube 링크 영상은 재시도/Batch 인코딩 대상으로 보이지 않는다.
- 공개 영상과 강의 영상이 학생/관리자 목록에서 혼동되지 않는다.
- 시청률 기준이 클리닉/차시 완료 판별에 쓰이면 backend 상태까지 확인한다.

자동화 참고:

- `e2e/flows/video-session-data-flow.spec.ts`와 `e2e/student/03-public-video-refactor.spec.ts`는 렌더 중심이다.
- L3에서는 backend video Batch/R2/Cloudflare 경로와 worker 로그를 별도 확인한다.

### S8. 커뮤니티/공지/QnA/상담

목표: 운영자가 안내하고, 학생이 질문하고, 답변이 돌아온다.

1. 관리자 공지를 UI로 작성한다.
2. 학생 공지 목록/상세에서 확인한다.
3. 학생이 QnA 질문을 작성한다.
4. 관리자 QnA inbox에서 답변한다.
5. 학생이 답변과 알림을 확인한다.
6. 상담 신청도 같은 방식으로 왕복한다.

검증 포인트:

- 리치 텍스트 placeholder와 첨부 UI가 mobile에서 깨지지 않는다.
- 답변 대기/답변 완료 상태가 명확하다.
- 삭제된 학생, 권한 없는 사용자, 빈 제목/본문이 안전하게 처리된다.

자동화 참고:

- `e2e/flows/notice-roundtrip.spec.ts`
- `e2e/flows/qna-roundtrip.spec.ts`
- `e2e/flows/counsel-roundtrip.spec.ts`

### S9. 알림톡/메시징

목표: 실제 운영 이벤트가 preview, confirm, 발송 로그, 수신까지 닫힌다.

1. 메시지 설정에서 사용 가능한 템플릿과 발신 상태를 확인한다.
2. 학생 생성/가입 승인/성적/클리닉 중 하나의 context_source 발송을 preview한다.
3. preview 대상, 변수 치환, 제외 대상 사유를 확인한다.
4. 통제 수신번호로만 1건 confirm 발송한다.
5. NotificationLog와 provider 상태를 확인한다.
6. 실제 수신 내용을 확인한다.

검증 포인트:

- 프론트가 서버 계산 변수 `context_source`를 덮어쓰지 않는다.
- preview와 실제 발송 본문이 의미상 일치한다.
- 실패 시 fallback/재시도/로그 상태가 운영자가 이해할 수 있다.

자동화 참고:

- 실발송은 무제한 자동화하지 않는다. L3에서 수동 승인 없이 통제 번호만 사용한다.

## 9. 증거 기록 양식

각 리뷰는 `_artifacts` 아래에 폴더를 만들고 아래 파일을 남긴다.

```text
C:\academy\_artifacts\realuse-review\20260605-1530\
  summary.md
  screenshots\
    admin-desktop-*.png
    admin-narrow-*.png
    teacher-mobile-*.png
    student-mobile-*.png
  api\
    created-ids.json
    cleanup-result.json
  playwright\
    test-results\
    playwright-report\
```

`summary.md` 최소 항목:

```markdown
# Real-use review YYYY-MM-DD

## Scope
- Tenant:
- Reviewer:
- Build/commit:
- Viewports:

## Result
- Overall: PASS / FAIL / BLOCKED
- Blocking issues:
- Cleanup:

## Scenario Results
| Scenario | Result | Evidence | Notes |
|----------|--------|----------|-------|
| S1 Signup/student | PASS | screenshots/... | |

## Issues
| Severity | Area | Finding | Evidence | Proposed fix |
|----------|------|---------|----------|--------------|

## Manual Validations
| Item | Result | Evidence |
|------|--------|----------|
```

## 10. 이슈 심각도

| 등급 | 의미 | 예시 |
|------|------|------|
| P0 | 운영 중단/데이터 무결성/tenant 격리/잘못된 발송 | 다른 학원 학생 노출, 점수 오계산, 엉뚱한 번호 발송 |
| P1 | 핵심 운영 흐름 불가 | 강의 생성 불가, 학생 제출 불가, 클리닉 예약 불가 |
| P2 | 상품성/초심자/반복 운영 저해 | CTA 모호, 모달 잘림, 저장 피드백 없음 |
| P3 | 작은 polish | 문구 어색함, spacing 경미 |

P0/P1은 리뷰 종료 전에 재현 경로와 데이터 ID를 남긴다. P2/P3는 스크린샷 기준으로 묶어 후속 처리한다.

## 11. 실행 명령

기본 확인:

```powershell
cd C:\academy\frontend
pnpm typecheck
pnpm guard:legacy-api
pnpm lint
pnpm build
pnpm test:e2e:gate
```

기존 실사용 관련 spec 단독 실행:

```powershell
cd C:\academy\frontend
pnpm exec playwright test e2e/admin/session-assessment-realuse.spec.ts --reporter=list
pnpm exec playwright test e2e/student/score-report-realuse.spec.ts --reporter=list
pnpm exec playwright test e2e/flows/notice-roundtrip.spec.ts e2e/flows/qna-roundtrip.spec.ts e2e/flows/clinic-roundtrip.spec.ts --reporter=list
```

시각검수용 headed 실행:

```powershell
cd C:\academy\frontend
pnpm test:e2e:headed
```

## 12. 자동화 보강 백로그

아래 항목은 현재 매뉴얼 기준의 [PROPOSED] 자동화 보강이다. 구현 전에는 이 문서의 수동 절차를 우선한다.

| 우선순위 | 제안 spec | 목적 |
|----------|-----------|------|
| P1 | `e2e/realuse/signup-approval.spec.ts` | 공개 가입 신청->관리자 승인->학생 로그인 |
| P1 | `e2e/realuse/lecture-session-supplement.spec.ts` | UI 기반 강의/수강생/정규 차시/보강 차시 생성 |
| P1 | `e2e/realuse/assessment-clinic-chain.spec.ts` | 불합격->클리닉 대상->학생 예약->관리자 승인/출석->해소 |
| P1 | `e2e/realuse/homework-submission-chain.spec.ts` | 과제 생성->학생 제출->관리자 채점->학생 성적 |
| P2 | `e2e/realuse/video-playback-chain.spec.ts` | READY 영상 노출, 재생, 이어보기, 시청률 반영 |
| P2 | `e2e/realuse/beginner-misuse.spec.ts` | 빈 입력, 중복 클릭, 뒤로가기, 모바일 키보드 등 |
| P2 | `e2e/realuse/visual-product-audit.spec.ts` | 주요 화면 viewport별 screenshot + overflow/overlap DOM checks |

## 13. 완료 체크리스트

리뷰를 닫기 전에 확인한다.

- [ ] S1~S9 중 이번 범위에 해당하는 시나리오가 PASS/FAIL/BLOCKED로 기록됐다.
- [ ] FAIL/BLOCKED는 재현 URL, 데이터 ID, 스크린샷, API 응답 중 최소 2개 증거가 있다.
- [ ] 관리자/교사/학생/학부모 중 관련 소비자 역할 반영을 확인했다.
- [ ] 처음 쓰는 사용자 관점의 CTA/빈 상태/오류/되돌아가기 검수를 했다.
- [ ] desktop/narrow/mobile 중 필요한 viewport 스크린샷을 남겼다.
- [ ] 생성한 `[E2E-{timestamp}]` 데이터 cleanup 결과를 기록했다.
- [ ] 운영 roundtrip cleanup은 HTTP 성공을 assertion하며 best-effort/예외 무시 경로가 없다.
- [ ] 알림톡 실발송이 있었다면 통제 번호, provider/log, 수신 여부를 기록했다.
- [ ] 알림 발송이 목적이 아닌 다중 학생 fixture는 운영에서 실행하지 않고
      전용 메시징 경계를 가진 development/preproduction에서 실행했다.
- [ ] 영상 worker가 있었다면 Batch/R2/READY/학생 재생 증거를 기록했다.
- [ ] 자동 E2E skip은 통과로 계산하지 않았다.
- [ ] 후속 이슈는 P0/P1/P2/P3로 분류했다.
