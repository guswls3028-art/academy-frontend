# 보강·클리닉 등원 예정 운영 UI

## 목적과 진입점

교직원이 비정규 등원을 따로 적은 Excel을 다시 확인하지 않아도 오늘 몇 명이
언제 오는지, 곧 누구를 준비해야 하는지, 향후 7일에 무엇을 준비할지 한눈에
파악하게 한다.
새 예약 메뉴를 먼저 학습시키지 않고 기존 업무 위치를 자연스럽게 확장한다.

- 입력: **강의 → 보강 차시 → 출결**의 학생별 `등원 예정` 열
- 전체 확인: **대시보드 → 오늘·향후 7일 등원 예정**
- 선제 노출: 우상단 알림의 `예정 시간 지난 등원`, `1시간 내 등원 예정`,
  `내일 등원 준비`, `시간 미정 등원`

백엔드 데이터·집계 계약은
[`arrival-operations.md`](https://github.com/guswls3028-art/academy-backend/blob/main/docs/domain/arrival-operations.md)가 소유한다.

## 보강 입력 흐름

1. `SUPPLEMENT` 차시의 출결표에만 `등원 예정` 열을 표시한다. 정규 차시의
   열 구성과 기존 상태 조작은 바꾸지 않는다.
2. 학생 행의 `예정 입력`을 누르면 출결표 위에 작은 편집 창을 띄운다.
3. 차시 날짜를 기본 날짜로 제안하되, 저장 전까지 서버 값으로 간주하지 않는다.
4. 날짜, 선택적인 시간, 최대 300자의 준비 메모를 명시적 `저장`으로 전송한다.
   시간이 있으면 날짜가 필수다.
5. 성공하면 해당 출결 목록, 대시보드 현황, 우상단 알림을 다시 읽는다. 실패하면
   편집값을 유지하고 서버 오류를 표시한다.
6. `입력 지우기` 후 저장하면 예정 값과 메모를 비운다. 출결 행·상태는 유지한다.

셀과 팝오버는 행의 학생 상세 이동 및 상태 버튼과 별도 클릭 영역이다. 바깥 클릭과
`Escape`로 닫고, 닫은 뒤 키보드 포커스를 원래 셀로 돌려준다.

## 대시보드와 알림

대시보드 상단은 기존 장식성 숫자 카드 대신 운영 시간 레일을 사용한다.

- 상단: 오늘 날짜, 7일 범위에서 가장 가까운 다음 등원
- 요약: 값이 있는 1시간 내·내일·시간 미정과 오늘·7일 전체, 필요한 경우
  예정 시간 지남
- 시간 레일: 시간 순 학생, 보강/클리닉 출처, 강의·장소·메모, 처리 여부
- 오른쪽: 오늘 이후 학생을 날짜별로 최대 8명까지 보여 주고 초과 인원을 표시

보강은 따뜻한 주황, 클리닉은 기존 계열의 파랑·청록 라벨로 구분한다. 화면 전체
팔레트와 글꼴은 기존 관리자 디자인 시스템을 유지한다. 항목을 누르면 보강은 해당
차시 출결표, 클리닉은 해당 운영 세션 또는 예약 화면으로 이동한다.

우상단 알림은 같은 현황 API를 사용하며 실제 준비가 필요한 미처리 항목만 센다.
예정 시간 지남은 오류 톤, 1시간 내와 내일 준비는 경고 톤, 시간 미정은 정보
톤이다. 교사용 모바일 알림 센터에서도 항목 타입을 안전하게 표시하고 PC
대시보드 현황으로 연결한다.

## 빈 상태와 실패 경계

- 7일 일정이 모두 없으면 큰 빈 카드와 0명 요약을 반복하지 않고 한 줄 높이로
  압축해 `강의에서 보강 입력`, `클리닉 예약 보기` 동선을 제공한다.
- 오늘 일정만 없고 이후 일정이 있으면 오늘 완료 상태와 날짜별 준비 목록을 함께
  표시한다.
- 통합 조회가 실패하면 0명으로 보이지 않게 오류와 `다시 불러오기`를 표시한다.
- 오늘 이후 항목이 없으면 별도 카드를 렌더링하지 않는다.
- 저장 중에는 중복 저장을 막고, 날짜 없는 시간은 클라이언트와 서버에서 모두
  거부한다.
- 최소 검수 폭은 1366px와 390px다. 좁은 화면에서는 시간대별 학생 카드와
  내일 준비 카드가 한 열로 쌓인다.

## 소유 구현과 검증

- API 계약: `src/shared/api/contracts/arrivalOverview.ts`, `attendance.ts`
- 보강 입력: `src/app_admin/domains/lectures/pages/attendance/ArrivalPlanCell.tsx`
- 대시보드: `src/app_admin/domains/dashboard/components/ArrivalOperationsBoard.tsx`
- 알림: `src/shared/api/contracts/notifications.ts`, `src/app_admin/layout/Header.tsx`
- 회귀 테스트: `e2e/admin/arrival-operations.mock.spec.ts`

```powershell
pnpm typecheck
pnpm exec eslint src/shared/api/contracts/arrivalOverview.ts `
  src/shared/api/contracts/notifications.ts `
  src/app_admin/domains/lectures/pages/attendance/ArrivalPlanCell.tsx `
  src/app_admin/domains/dashboard/components/ArrivalOperationsBoard.tsx
pnpm exec playwright test e2e/admin/arrival-operations.mock.spec.ts --project=chromium --reporter=list
pnpm build
```

핵심 회귀는 보강 전용 열, 저장 payload와 재조회, 두 출처 시간순 표시, 7일 날짜별
준비, 빈 상태 직접 동선, 네 종류 알림, 상세 이동 경계, 1366/390px overflow와
콘솔 오류 0건이다.
