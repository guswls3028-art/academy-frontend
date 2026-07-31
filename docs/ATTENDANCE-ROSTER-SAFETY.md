# 차시 수강생 배정·출결 일괄 작업 안전 계약

## 목적과 진입

이 문서는 관리자 앱의 **강의 → 차시 → 출결**에서 수강생을 일괄 배정하고
출결을 확정하는 현재 사용자 흐름을 설명한다. 학생을 빠르게 넣되, 등록과
현장 출석을 같은 동작으로 오인하거나 일괄 변경을 실수로 확정하지 않게 하는
것이 목적이다.

소유 구현:

- 수강생 선택·등록: `src/app_admin/domains/lectures/components/SessionEnrollModal.tsx`
- 출결 목록·전체 현장·되돌리기:
  `src/app_admin/domains/lectures/pages/attendance/SessionAttendancePage.tsx`
- API 계약: `src/shared/api/contracts/attendance.ts`
- 백엔드 상태·복구 불변조건:
  [`state-transitions.md`](https://github.com/guswls3028-art/academy-backend/blob/main/docs/domain/state-transitions.md#b19-attendance)

## 수강생 일괄배정

1. 관리자는 전체 학생, 직전 차시 또는 강의 활성 수강생에서 대상을 고른다.
2. 모든 불러오기는 서버 저장이 아니라 오른쪽 **선택 목록**만 바꾼다.
3. 선택·해제·전체 선택은 최근 20단계까지 `Ctrl+Z`와
   `Ctrl+Shift+Z` 또는 화면 버튼으로 되돌리고 다시 실행할 수 있다.
4. 일반 `Enter`는 등록을 실행하지 않는다. `Ctrl+Enter` 또는 하단
   **N명 검토 후 등록**은 최종 확인창을 연다.
5. 확인창은 대상 인원, 시작 상태 `미입력`, 기존 출결 무변경을 다시
   보여 준 뒤에만 `bulk_create`를 호출한다.
6. 선택 또는 읽어 둔 Excel이 남은 상태에서 닫으면 미저장 닫기 확인을 한다.

새 출결은 `UNSET`(미입력)으로 시작한다. 자동으로 `PRESENT`가 되지 않으며,
등원 또는 참여 방식 확인 후 현장·영상·결석 등을 기록한다. 이미 차시에 있는
학생은 목록과 등록 대상에서 제외하고, 퇴원·비활성 수강등록은 빠른 불러오기와
등록으로 되살리지 않는다.

## 전체 현장 출석과 되돌리기

**전체 현장 출석**은 확인창에서 변경 범위와 예외를 설명한 뒤 실행한다.
서버는 `PRESENT`, `SECESSION`, 비활성 수강등록을 제외한 실제 변경 행만
잠그고 `PRESENT`로 바꾼다. 성공하면 프론트는 화면 상단에 **최근 일괄 출결
작업**을 표시하고 10분 동안 되돌리기 버튼을 제공한다.

되돌리기는 클라이언트가 상태를 추측해 여러 PATCH를 보내지 않는다. 서버가
발급한 서명 토큰을 `bulk_undo_present`에 보내며, 서버가 같은 테넌트·차시의
대상 전체를 잠가 현재 상태가 모두 `PRESENT`인지 확인한 뒤 각 직전 상태를
한 트랜잭션으로 복원한다. 한 행이라도 삭제·퇴원되었거나 현재 상태가
`PRESENT`가 아니거나 토큰이
만료·변조되었으면 일부만 복원하지 않고 전체를 거부한다.

## API와 실패 처리

| 요청 | 성공 응답 | 실패 처리 |
|------|-----------|-----------|
| `POST /lectures/attendance/bulk_create/` | 새 출결 목록 (`UNSET`) | 선택 목록을 유지하고 서버 오류를 표시 |
| `POST /lectures/attendance/bulk_set_present/` | 변경 수, 서명 토큰, 유효시간 | 목록을 다시 읽을 수 있게 두고 오류 표시 |
| `POST /lectures/attendance/bulk_undo_present/` | 복원 수, 차시 ID | 400은 잘못된 토큰, 409는 만료 또는 현재 상태 충돌로 안내 |

모든 요청은 인증된 교직원과 현재 테넌트 경계 안에서만 동작한다. 다른
테넌트의 세션·토큰은 존재 여부를 드러내지 않고 거부한다. 일괄 등록 성공
후에는 차시 수강생, 출결 목록, 출결 매트릭스, 강의 수강생 캐시를 갱신한다.
전체 현장과 되돌리기 뒤에는 출결 목록·매트릭스·성적 집계 캐시를 갱신한다.

## UI와 접근성

- 오른쪽 검토 레일은 시작 상태 `미입력`, 선택 인원, 실행취소/다시실행을
  한 묶음으로 보여 준다.
- 최근 일괄 작업은 단순 토스트가 아니라 닫을 수 있는 인라인 기록으로 남긴다.
- 버튼은 로딩 중 중복 실행을 막고, 아이콘 버튼에는 접근 가능한 이름과
  툴팁을 제공한다.
- 최소 검수 폭은 1366px, 1100px, 390px다. 좁은 화면에서도 확인 문구,
  선택 목록, 등록·취소, 되돌리기가 잘리면 안 된다.

## 검증

```powershell
pnpm typecheck
pnpm exec eslint src/app_admin/domains/lectures/components/SessionEnrollModal.tsx `
  src/app_admin/domains/lectures/pages/attendance/SessionAttendancePage.tsx
pnpm exec playwright test e2e/admin/session-attendance-bulk-safety.mock.spec.ts --reporter=list
pnpm build
```

핵심 회귀는 선택 불러오기 무기록, 선택 undo/redo, 일반 Enter 무반응,
최종 확인 전 무기록, 신규 행 `미입력`, 전체 현장 성공 기록, 정확 복원,
충돌 시 전체 거부, 1366/1100/390px overflow와 콘솔 오류 0건이다.
