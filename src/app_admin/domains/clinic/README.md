# 관리자 클리닉 일정

관리자가 `/workspace/clinic`에서 클리닉 세션을 생성·복사·수정하고 학생 예약을
운영하는 도메인입니다. 같은 날짜의 여러 시간대 예약 가능 여부는 서버의 세션별
정책을 그대로 편집하며, 프론트가 tenant나 학생별 예외를 추정하지 않습니다.

## 새 일정의 개설 방식 선택

새 일정 만들기는 상세 폼보다 먼저 두 카드만 보여 줍니다.

- **한 타임 예약 · 시간지정 클리닉**: 17:00–18:00처럼 정해진 타임 전체를
  예약하는 기존 방식입니다.
- **등원·하원 선택 · 자유지정 클리닉**: 15:00–22:00 운영 범위를 열고 학생이
  그 안에서 16:00–19:00처럼 실제 시간을 고르는 독서실형 방식입니다.

`GET /clinic/settings/`의 tenant 기본은 **학원 기본** 배지로 추천할 뿐이고,
사용자가 카드를 직접 골라야 다음 입력으로 이동합니다. 선택 뒤에는 현재 방식을
짧게 요약하고 **방식 다시 선택**을 제공하므로 실수로 세부 일정을 작성하기 전에
돌아갈 수 있습니다. 수정·복사는 저장된 방식 snapshot을 그대로 열고 이 단계를
건너뜁니다. 자유지정은 긴 세션 하나를 예약하므로 여러 고정 시간대 허용과 학생
희망 시간 옵션을 자동으로 끄고 숨깁니다.

## 같은 날 여러 시간대 예약

- 새 세션은 `GET /clinic/settings/`의 `multi_slot_booking_default`를 체크박스
  초기값으로 사용합니다.
- 생성·수정 요청은 `allow_multi_slot_booking`을 명시해 서버에 저장합니다.
- 확인 화면은 **여러 시간대 허용** 또는 **한 타임만 허용**을 일정·정원·공개
  대상과 함께 보여 줍니다.
- 기존 세션 복사와 이전 주 불러오기는 원본 세션의 정책을 그대로 복사합니다.
- ON에서 OFF로 바꿔도 기존 예약은 화면에서 제거하지 않습니다. 서버가 이후 같은
  날짜의 충돌하는 새 예약만 `409`로 거부합니다.

## 시간 범위 정원 표시

`time_range` 수업은 누적 예약 인원과 동시 정원을 구분해 `예약 N명`·`동시 정원 M명`으로
표시한다. 하루 총 예약을 동시 정원으로 나눈 비율이나 예약률 막대는 표시하지 않는다.
월간 달력·운영 날짜 선택은 서버의 `is_full`을 사용하며 열린 구간이 하나라도 있으면
전체 마감으로 표시하지 않는다. 구체적인 잔여 정원은 선택 구간의 availability가 소유한다.
`fixed_slot` 수업의 기존 인원/정원 표시는 유지한다.

회귀 검증: `e2e/admin/clinic-weekly-multisession.mock.spec.ts`의 시간 범위 정원 사례.

## 빈 세션 운영

운영 화면의 `session` 선택은 참가자 목록이 아니라 세션 tree를 기준으로 유지합니다.
따라서 아직 참가자가 0명인 유효한 세션도 desktop과 390px에서 세션 제목·수정·삭제·
`학생 추가` 동선을 그대로 보여 주며, 첫 학생을 추가하기 전에 일간 합계 화면으로
자동 복귀하지 않습니다. 선택한 세션이 tree에서 실제로 사라졌을 때만 선택을 해제합니다.

## 학생 추가 실패와 재시도

운영 화면의 **학생 추가**는 전체 학생 선택이면 `student_ids`, 미통과 대상자
선택이면 정확한 `enrollment_ids`를 `POST /clinic/participants/bulk-create/`에
보냅니다. 서버가 선택 전체를 원자적으로 저장하므로 일부만 추가한 뒤
`0명 추가, 1명 실패`처럼 원인을 잃는 상태를 만들지 않습니다.

기존 예약, 같은 날 시간대 정책, 정원 등으로 실패하면 서버의 구체적인 사유를
표시하고 모달과 체크 선택을 그대로 유지합니다. 사용자는 선택을 조정하거나 같은
자리에서 다시 시도할 수 있습니다. 성공한 뒤에는 참가자와 세션 tree를 다시 읽은
후 모달을 닫아 저장된 명단을 즉시 보여 줍니다. 세션 생성 뒤 초기 학생 추가만
실패한 경우에도 이미 만들어진 세션을 다시 만들도록 유도하지 않고, 실패 사유와
운영 화면의 **학생 추가** 복구 경로를 안내합니다.

`time_range` 세션에서는 대상자 확정 뒤 학생 앱과 같은 실제 시간 선택기를 한 단계
더 보여 줍니다. 세션의 운영 시작·종료는 바꾸지 않고 availability 안의 연속 구간만
`booking_start_time`·`booking_end_time`으로 보냅니다. 여러 명을 한 번에 고르면 모두
같은 구간을 사용하며 다른 구간은 추가 작업을 나눠야 합니다. 저장된 실제 구간은
운영 명단에 표시되고 새로고침 뒤에도 서버 응답으로 복원됩니다.
`time_range` 운영 창은 같은 날 끝나거나 정확히 익일 `00:00`에 끝나야 합니다.
`23:00–01:00`처럼 자정 이후까지 이어지는 범위는 생성·수정 전에 설명과 함께 차단합니다.

## 소유 구현과 검증

- 세션 타입·조회·수정: `api/clinicSessions.api.ts`
- tenant 기본값 조회: `api/clinicSettings.api.ts`
- 생성·복사·수정 UI: `components/ClinicCreatePanel.tsx`
- 공용 개설 방식 카드: `src/shared/ui/clinic/ClinicBookingModeChoice.tsx`
- 저장 전 검토 문구: `components/clinicScheduleConfirmation.ts`
- 이전 주 복사: `components/PreviousWeekImportModal.tsx`
- 서버 정책·원자성·동시성: backend `docs/domain/clinic-booking.md`
- 빈 세션 운영 회귀: `e2e/admin/clinic-weekly-multisession.mock.spec.ts`
- 학생 추가 충돌 사유·선택 보존·재시도 회귀:
  `e2e/admin/clinic-weekly-multisession.mock.spec.ts`
- 시간 범위 공통 구간 payload·명단·reload·desktop/390 회귀:
  `e2e/admin/clinic-weekly-multisession.mock.spec.ts`
- 개설 방식 선택·desktop/390px 경계·자유지정 생성 회귀:
  `e2e/clinic/clinic-booking-modes-visual.mock.spec.ts`

관리자 mock E2E는 기존 clinic weekly spec의 선행 owner merge 뒤 같은 파일에서
다중 예약 정책을 추가 검증합니다. 현재 기능의 직접 focused 검증은 teacher/student
mock spec과 실제 API real-use spec이 담당합니다.
