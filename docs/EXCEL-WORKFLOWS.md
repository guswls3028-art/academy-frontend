# Excel 입력·결과·복구와 경로 인벤토리

현재 프론트엔드 동작의 소유 문서다. 서버의 학생 생성·복원·중복 판정과 수강 매칭,
채점 저장은 [backend Excel 운영 계약](https://github.com/guswls3028-art/academy-backend/blob/main/docs/operations/excel-operations.md)이 소유한다.
프론트엔드 미리보기는 저장 성공을 의미하지 않으며 서버 결과가 정본이다.

## 학생 명부와 수강 등록

- 관리자 학생 등록, 교사 학생 목록의 가져오기는 `studentExcel.ts`로 미리보기 후 원본 파일을 업로드한다.
  이름·전화 입력 오류의 실제 Excel 행 번호와 정상/확인 필요 인원을 표시한다. 모든 행이 잘못된 경우에도
  상세 사유와 파일 재선택 경로를 유지한다. 학생 계정·비밀번호 선택과 권한은 기존 API 계약을 따른다.
- 강의 및 차시의 Excel 수강 등록은 기존 활성 학생을 이름·학부모 번호로 매칭한다. 학생을 새로 만들지 않는다.
  미리보기의 정상 인원은 매칭 요청 인원이며, 명부 없음·중복 등 최종 제외 여부는 서버에서 결정한다.
  차시 요청은 `session_id`를 유지하고 강의만 선택한 요청은 기존 첫 차시 처리 계약을 따른다.
- 파일 변경·모달 종료·대상 변경 후 늦은 파싱/확인 응답으로 이전 파일을 제출하지 않는다.
  확인 및 제출에는 동기 잠금을 적용한다. 접수된 `job_id`는 작업박스로 넘긴다.
- 전화는 전각 ASCII와 지정된 유니코드 대시를 접고, 부/모/아버지/어머니/아빠/엄마/부친/모친/부모/
  학부모/보호자/학생/본인/father/mother/parent/guardian 중 한 개의 접두 또는 접미 관계표시만 허용한다.
  관계표시는 괄호·대괄호 또는 단독 표기, 접두의 선택적 콜론을 지원한다. `010-0000-0000(부)`와
  `(010)1234-5678`을 허용한다. 관계표시 괄호 안 공백, `0101234-5678`처럼 일부 그룹만 구분한 번호도
  지원한다. 각 번호 그룹 경계에 선택적 공백과 최대 한 개의 하이픈/점을 허용하며 일반 문자, 여러 번호,
  소수·과학 표기 문자열을 숫자만 남기는 방식으로 오인하지 않는다. 선두 0이 빠진 10자리와 학생용
  기존 8자리 식별번호는 유지한다. 원본 파일의 서버 정규화는 backend가 담당한다.
- 오류 목록은 50행씩 이전/다음으로 전부 확인할 수 있다. 긴 한국어/파일명은 줄바꿈하고 목록을
  스크롤한다. 기존 모달·버튼의 상태 전환/모션을 재사용한다. 390px 및 1366px 검증 대상이다.

## 작업박스와 중단 복구

Excel 조회는 동일 작업의 요청 중첩을 막고 현재 tenant, 인증 세대, 작업 상태와 요청 수명을 확인한다.
다른 tenant/로그아웃 후 늦은 응답은 적용하지 않는다. 일시적 조회 실패·UNKNOWN·결과 미도착은
대기 작업을 보존하며 재조회 중임을 표시한다. 403/404는 조회 불가로 표시한다. 파일을 자동 재전송하지 않는다.
완료 또는 작업 실패 시 학생·강의·차시 수강 목록을 갱신하여 이미 저장된 행이 화면에 반영되도록 한다.

학생 결과는 신규/복원/기존/실패 전체 건수와 유형별 최대 500행 표본을 유지한다. 수강 결과는
`enrolled_count`(기존 수강 포함), `excluded_count`, `total`, `enrolled_rows`, `excluded_rows`를 표시한다.
구버전 count-only 수강 응답도 처리하며, 건수가 있지만 상세 목록이 없는 경우 “없음”으로 표시하지 않는다.
수강 제외 사유 코드는 invalid_row/not_found/ambiguous/duplicate_in_file을 지원한다.
실패한 행을 수정해 재요청하는 동안 완료된 학생/수강 데이터는 유지되며, 수강 진입 작업은 원래 강의로 연결한다.

기존 tenant별 작업 저장은 생성 후 1시간 범위에서 새로고침 복구를 지원한다. 결과 확인/다시 열기를
유지하며 평문 비밀번호는 브라우저 저장에 쓰지 않는다. 랜덤 비밀번호 복구 기간은 기존 서버 계약을 따른다.
파일 POST가 서버에 도달한 뒤 응답 자체를 잃는 경우(작업 번호를 받지 못함), 여러 탭에서 동시 제출,
브라우저 저장소 차단 또는 보존 기간 만료의 전역 복구는 이 UI 잠금만으로 보장하지 않는다.

## 시험 결과 가져오기

시험 결과 패널의 파일은 서버가 미리보기/반영을 처리한다. 시험 ID가 바뀌면 선택 파일·미리보기·요청 상태를
새로 만들며 이전 시험의 늦은 응답으로 현재 시험의 제출 버튼을 표시하지 않는다. 파일 확인·결과 반영은
동기 잠금을 공유한다. 미리보기 실패는 선택 파일을 보존하고 재시도 버튼을 제공한다. 반영 실패는 기존
미리보기와 오류를 유지한다. 0명·입력 오류가 있는 미리보기는 반영하지 않는다. 모든 오류를 50개씩 열람한다.
수정 반영은 해당 시험 결과/요약/문항 통계를 무효화하여 다시 읽는다. 기존 결과 갱신 여부는 서버가 결정한다.

## 전체 경로 인벤토리와 변경 범위

아래는 소스 검색·호출 경로 확인 범위이며 실행/배포 검증 완료 선언이 아니다.

| 경로 | 소유 파일/동작 | 이번 범위 |
|---|---|---|
| 관리자 학생 명부 가져오기·양식·내보내기·초기 비밀번호 | `StudentCreateModal`, `StudentsHomePage`, `shared/product/students/studentExcel.ts` | 입력/미리보기/중복 제출 수정; 내보내기 생성 형식 유지 |
| 교사 학생 가져오기·전체 명부 내보내기 | `app_teacher/domains/students/pages/StudentListPage.tsx`, `api.ts` | 동일 파서, 모든 오류 표시·제출 잠금; 내보내기 유지 |
| 강의·차시 기존 학생 Excel 수강 | `LectureEnrollExcelModal`, `SessionEnrollModal`, `contracts/enrollments.ts` | 입력 오류·중단 복구·결과 저장 수정; API 대상/권한 유지 |
| 기존 차시 JSON 파서 | `parseSessionEnrollExcel` | 현재 호출자 없음; 공용 전화 정규화 사용, 진입점 추가 없음 |
| 시험 채점 결과 가져오기·양식 | `ExamResultExcelImport`, `results/api/examResultExcel.ts` | 시험별 상태 격리·오류/재시도·중복 제출 수정 |
| 시험 학생별 오답·수업 분석 Excel | `ExamResultsViewerPanel`, `results/api/examResultExcel.ts` | 서버 Blob 다운로드, 오류 본문 처리 확인; 변경 없음 |
| 차시 성적 CSV | `SessionScoresEntryPage`, `scores/utils/scoreCsvGenerator.ts` | 선택 데이터·미입력/미제출 구분과 수식 문자열 차단 확인; 변경 없음 |
| 직원 명부 | `staff/excel/staffExcel.ts`, `staff/pages/HomePage` | 공용 Workbook 내보내기 확인; 변경 없음 |
| 급여 월별 명세 Excel | `staff/api/payrollSnapshots.api.ts`, `PayrollHistoryTable` | 새 export job → 공용 jobExport 폴링 → 다운로드; 변경 없음. 3분/네트워크 실패 복구는 기존 경계 |
| 개인 경비 Excel | `profile/excel/expenseExcel.ts`, `excelUtils.ts`, `ExpenseHeader` | 값 타입을 보존하는 공용 Workbook 내보내기; 변경 없음 |
| 강의 출결·개인 근태 Excel | 관리자/교사 강의·출결 화면, `contracts/attendance.ts`, `profile/excel/attendanceExcel.ts` | 다른 attendance-export-qa-1030 작업 소유, 편집/실행 제외 |
| 교사 시험 첨부의 .xlsx/.csv 허용 | `ExamManageSheet` → 시험 assets API | 자료 첨부이며 명단/채점 파서 아님; 변경 없음 |
| 관리자/학생 보관함·자료게시판의 Excel 첨부/표시 | storage/inventory 업로드·파일 썸네일·공개 자료 파일 선택 | 일반 파일 저장/다운로드이며 셀 파서 아님; 변경 없음 |
| 클리닉 일정 가져오기 | `ClinicScheduleImportModal` | 기존 일정 복사이며 Excel 입력 아님; 변경 없음 |
| Excel형 성적 키보드·홍보/가이드 문구 | 성적 그리드·안내 콘텐츠 | 파일 처리 경로가 아니므로 변경 없음 |

공용 읽기는 `.xlsx`/10MiB, 50시트, 선택 시트 10,000행/256열, 첫 100행 내 헤더를 확인한다.
시트 후보는 앞 150행(헤더 후보 100행 + 헤더 뒤 점수용 50행)만 행 배열로 바꾸고 선택 시트만 전체 변환한다.
워커와 동일하게 헤더 뒤 최대 50행으로 점수를 계산하고 동점은 활성 시트로 판정한다. ExcelJS의 빈 `getCell` 생성을
피해 희소 데이터의 행/열 위치를 유지한다. OOXML은 파일별/합계 XML 크기와 위험 선언을 검사하며,
과대 XML은 스트림을 멈춰 전체 문자열을 먼저 할당하지 않는다. 브라우저 방어 한도(512 ZIP 항목,
개별 XML 최대 16MiB 문자·합계 32MiB 문자)는 서버의 확대된 ZIP 한도와 같지 않다. ExcelJS 자체의
전체 통합문서 로딩은 여전히 브라우저에서 실행되므로 대형 파일의 실기기 시간/메모리는 별도 측정 대상이다.

## 검증과 남은 게이트

- `e2e/admin/excel-import-compatibility.spec.ts`: 관계표시/전각/소수·복수 거부, 실제 오류 행 번호,
  희소 행 불변, 시트 선택 표본 일치, 호환 OOXML, 위험 XML/과대 파일 거부. 로컬 기존 의존성으로 15개 통과.
- `enrollment-excel-existing-only.mock.spec.ts`: 390/1366px 오류 수정, UNKNOWN 조회 복구,
  유효/오류 혼합 명단의 단일 POST, 수강 결과와 새로고침 보존 회귀 추가.
- `excel-result-import-recovery.mock.spec.ts`: 390/1366px 시험 전환 중 늦은 미리보기와 단일 반영 회귀 추가.
- 두 mock suite는 성공한 DOM 검증 뒤 `testInfo.outputPath`의 `synthetic-*.png`에 오류/미리보기/
  결과/새로고침 화면을 저장한다. PR test-results 산출물에서 실제 390/1366px 시각 검토를 해야 하며,
  로컬에서는 브라우저를 실행하지 않았으므로 아직 생성/검토 완료 증거가 아니다.
- `scripts/tests/ai-job-lifecycle.test.mjs`: 공용 폴링 경계를 직접 실행해 Excel의 단일 진행 조회,
  테넌트/계정 전환·종료 뒤 늦은 응답 무시, 403/404 종료 뒤 재시도 문구 방지, UNKNOWN/결과 미도착/
  503 복구, 혼합 행 결과·구형 건수 응답, 부분 저장 후 실패 시 목록 갱신을 검증한다. 기존 AI 회귀 포함 85개 통과.
  Excel 결과 해석은 `excelJobPolling.ts`, 인증/테넌트/진행 조회 중복 방지는 `useWorkerJobPoller.ts`가 담당한다.
  이 모듈 분리 뒤 기존 refactor budget은 large_frontend_file 41로 통과하며 기준값을 올리지 않았다.
- 기존 `student-import-review.mock.spec.ts`는 결과 건수/500행 표본/새로고침·모바일 계약을 검증한다.
- phone/archive 유틸 targeted TypeScript 통과. 전체 typecheck는 불완전한 로컬 의존성 트리의
  광범위한 진단으로 통과하지 않았으며 CI에서 재확인해야 한다. 브라우저/전체 lint/build,
  isolated development의 실저장 → reload → 다른 역할 화면, 390px 실제 렌더/모션과 cleanup-zero는
  부모 통합·배포 작업의 필수 후속 검증이다. 운영 데이터를 이용한 UI 검증은 하지 않았다.
