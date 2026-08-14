# 데이터 목록 정렬·필터 UI 계약

## 목적

테이블, 성적 그리드, 드로어 안 목록, 대상자 선택 모달에서 사용자가 보는 값과
정렬 기준을 일치시키고, 검색·필터·페이지 이동 뒤에도 행 순서를 예측 가능하게
유지한다. 백엔드의 tenant·권한·페이지 경계는
[backend data-list-ordering.md](https://github.com/guswls3028-art/academy-backend/blob/main/docs/domain/data-list-ordering.md)가 소유한다.

## 공통 동작

- 서버 페이지 목록은 `ordering`을 API 요청과 React Query 키에 함께 넣는다.
  현재 페이지만 클라이언트에서 정렬하지 않는다.
- 전체 배열을 받는 표와 모달은 `compareKoreanText`와 명시적 ID 보조키를 쓴다.
  null 점수는 오름·내림차순 모두 유효 점수 뒤에 둔다.
- 검색과 상태 필터를 먼저 적용한 같은 행 집합을 정렬·선택·빈 상태가 사용한다.
- 필터 결과가 0명이면 원본 0명과 구분해 검색·필터 변경 안내를 표시한다.
- 정렬·필터는 저장 데이터를 바꾸거나 현재 사용자·tenant·선택 자녀 범위를
  넓히지 않는다.
- 390px에서는 컨트롤을 여러 행으로 배치하고 테이블만 내부 가로 스크롤을
  사용한다. 페이지 자체에 가로 넘침을 만들지 않는다.

## 현재 운영 표면

| 화면 | 기본 순서 | 제공 제어 |
|------|-----------|-----------|
| 시험 학생별 결과 | 1차점수 등수순 | 이름 검색, 완료·미제출·진행·실패 필터, 등수·1차·최종·이름 정렬 |
| 과제 학생별 결과 | 이름 가나다순 | 이름 검색, 입력 상태 필터, 이름·점수·상태 정렬 |
| 차시 성적 그리드 | 서버 학생명+enrollment ID | 이름 검색과 성적 운영 상태 필터 |
| 시험·과제 대상자 모달 | 이름 가나다순 | 이름·전화·학교·학년 검색, 이름 정·역순 |
| 클리닉 대상자 모달 | 이름 가나다순 | 대상/전체 탭, 검색, 이름 정·역순, 서버 전체 페이지 정렬 |
| 출결 명단 | 이름 가나다순 | 이름·상태·전화 정렬과 계정별 브라우저 복원 |
| 학생·강의·차시·직원 표 | 각 화면의 표시 헤더 기본값 | 검색·상태 필터와 헤더 정렬 |
| 클리닉·청구·제출 표 | 날짜·시각 또는 업무 상태순 | 도메인 필터와 안정적 ID 동률 처리 |

법률 고지처럼 데이터 행이 아닌 정적 HTML 표는 검색·정렬 대상이 아니다. 입력
미리보기 표는 원본 파일 행 순서가 검수 근거이므로 임의로 재정렬하지 않는다.

## 시험 점수 표시

등수는 `ranking_score`인 1차 점수 기준이다. 현재 `final_score`가 다르면 같은
셀 아래에 `최종 N`을 표시한다. Submission이 없는 수동·엑셀 점수도 백엔드
`result_status=DONE`을 따라 `완료`로 표시하며, 점수가 있다는 이유만으로
미제출 상태를 프론트에서 추측하지 않는다. 구버전 API와 순차 배포 중에는
`meta_status`, 확정 점수, `is_provisional` 순으로만 호환 판정한다.

백엔드 `rank`는 동점 다음 등수를 동점 인원만큼 건너뛰는 표준 공동 순위다.
예를 들어 1차 점수가 `19, 14, 14, 12`이면 모든 관리자·교사·학생·학부모 화면은
`1, 2, 2, 4등`을 표시한다. 프론트엔드는 최종점수나 행 인덱스로 순위를 다시
계산하지 않고 이 값을 정렬·표시에 그대로 사용한다. 홈페이지 익명 석차와 익명
순위표 PDF도 같은 공동 순위 계약을 따른다.

시험 학생별 결과의 390px 목록은 등수를 왼쪽 축에 두고 학생명·강의 딱지에 한 줄
전체 폭을 배정한다. 1차·최종점수와 상태·성취는 아래 메타 행에서 줄바꿈해 모든
정보를 유지하며, 모바일 레이아웃 때문에 점수·상태·순위를 다시 계산하지 않는다.

## 구현과 검증

- 공통 비교기: `src/shared/utils/dataOrdering.ts`
- 시험 결과: `src/app_admin/domains/results/components/AdminExamResultsTable.tsx`
- 과제 결과: `src/app_admin/domains/homework/panels/HomeworkResultsPanel.tsx`
- 공용 대상자: `src/shared/ui/enrollment/EnrollmentManageModal.tsx`
- 클리닉 대상자: `src/app_admin/domains/clinic/components/ClinicTargetSelectModal.tsx`

```powershell
pnpm typecheck
pnpm lint
$env:E2E_BASE_URL='http://127.0.0.1:5187'
pnpm exec playwright test e2e/admin/manual-exam-grading.mock.spec.ts `
  --project=chromium --grep "학생별 결과가"
```
