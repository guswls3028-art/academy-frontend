# 선생님 앱 클리닉

선생님이 모바일 워크스페이스에서 클리닉 세션을 만들고 학생의 예약·등원·결석·
하원·완료를 관리하는 도메인입니다.

## 세션별 같은 날 예약 정책

**클리닉 만들기** 시트는 `GET /clinic/settings/`의
`multi_slot_booking_default`를 새 세션의 초기값으로 사용합니다. 선생님은
**같은 날 여러 시간대 예약**을 켜거나 끈 뒤 명시적인
`allow_multi_slot_booking` 값으로 세션을 생성합니다. 기존 세션의 값이나 이미
생성된 참가자는 tenant 기본값 변경으로 다시 쓰지 않습니다.

## 다중 시간대 학생 추가

1. `/workspace/mobile/clinic`에서 기준 세션을 열고 **학생 추가**를 누릅니다.
2. 추가 화면은 기준 세션을 항상 선택한 상태로 두고 같은 날짜의 다른 세션을
   시간순으로 보여 줍니다. 마감된 시간대는 선택할 수 없습니다. 기준 세션과
   추가 세션이 모두 **여러 시간대**로 열린 경우에만 함께 선택할 수 있고,
   **한 타임** 세션은 다른 시간대 선택을 비활성화합니다.
3. 17:00–18:00과 18:00–19:00을 함께 고르면 선택 영역은
   **17:00–19:00 · 2개 시간대**로 요약합니다. 떨어진 시간대를 누르면 기존
   선택을 유지하고 이유를 알려 주며, 중간 시간대를 생략한 요청은 만들지 않습니다.
4. 학생을 여러 명 선택해 한 번 제출하면
   `POST /clinic/participants/bulk-create/`에 `session_ids`와 `student_ids`를
   보냅니다. 서버가 학생 × 시간대 전체를 하나의 트랜잭션으로 처리하므로 일부
   성공 상태를 만들지 않습니다.
5. 성공하면 선택한 모든 세션의 참가자와 세션 목록을 무효화하고 시트가 닫힙니다.
   실패하면 시트를 유지해 선택을 확인하고 다시 시도할 수 있습니다.

기존 참가자 일정 변경은 한 예약을 한 새 세션으로 옮기는 별도 흐름이며 다중
시간대 추가로 의미가 바뀌지 않습니다. 패스카드·ID 카드와 출석 상태도 각
`SessionParticipant` 행을 기존 방식으로 읽습니다.

## 참가자 상태 운영

- `pending`은 **승인 대기**로 표시하고 선생님이 **예약 승인**(`booked`) 또는
  **예약 거절**(`rejected`)할 수 있습니다. 서버가 tenant·역할·허용 전이를 다시
  검증하며 프론트에서 다른 전이를 추정하지 않습니다.
- `booked` 학생의 등원 기록을 현장에서 놓친 경우에도 **하원**을 선택할 수 있습니다.
  이때 현재 참가자의 `session`과 `student`를 확인값으로 보내고
  `confirm_without_arrival=true`를 명시합니다. 서버는 등원이나 출석 상태를 만들지
  않고 하원 시각만 기록합니다.
- `attended` 참가자의 자율학습 완료와 **완료 취소**는 별도 상태입니다. 완료 취소는
  출석·등원·하원 이력을 유지하고 `completed_at`만 서버 계약에 따라 되돌립니다.
- 학생명 노란 하이라이트는 참가자 응답의
  `name_highlight_clinic_target`을 그대로 사용합니다. 예약·출석·완료로 과락을
  해결했다고 클라이언트에서 재판정하지 않으며, 학생 패스카드와 같은 서버 SSOT를
  따릅니다. `cancelled`·`rejected`·`no_show`는 예약확정에서 제외되므로, 과락이
  남아 있으면 다시 `CLINIC_REQUIRED`와 노란 대상 하이라이트가 표시됩니다.

모든 성공 동작은 참가자 목록을 다시 읽어 서버 상태를 표시하고, 실패하면 현재 행을
임의로 바꾸지 않은 채 오류를 안내합니다. 상태와 하이라이트는 새로고침 후에도 서버
응답과 동일해야 합니다.

## 학생 희망 시간

세션 생성 시 **학생 희망 시간 받기**를 켜면 `allow_time_preference=true`를
보냅니다. 학생이 보낸 희망 시작·종료와 요청 메모는 참가자 행에서 함께 보여
교직원이 별도 화면 없이 확인할 수 있습니다. 결석 후 다른 세션으로 옮길 때 새
세션도 희망 시간을 받는 경우에만 시작·종료를 함께 전송하며, 서버가 새 세션 범위
안인지 다시 검증합니다.

## 소유 구현과 검증

- API와 타입: `src/app_teacher/domains/clinic/api.ts`
- 다중 시간·학생 선택: `components/AddParticipantSheet.tsx`
- 세션 생성 정책·참가자 화면: `pages/ClinicPage.tsx`
- 원자 요청·상태 전이 payload·하이라이트·새로고침·390px/데스크톱 가로 넘침 회귀:
  `e2e/teacher/clinic-multi-slot-booking.mock.spec.ts`
- 격리된 `qa-ymath-realuse-*` 개발 테넌트의 실제 교사·조교 권한, 학생 예약,
  `CLINIC_REQUIRED → BOOKING_CONFIRMED → CLINIC_REQUIRED → PASSED`, 재접속,
  390px/데스크톱 및 light/dark 회귀:
  `e2e/student/clinic-remediation-realuse.spec.ts`

개발 실사용 모드는 API와 UI가 모두 loopback이어야 하고
`E2E_CLINIC_REMEDIATION_DEVELOPMENT=1` 및 exact disposable tenant/password를
명시해야 합니다. 이 모드에서는 실알림 opt-in을 거부하며, 생성한 조교·학생·강의·
시험·클리닉 행을 스펙에서 지운 뒤 외부 시나리오 정리가 tenant/users 0을 다시
검증합니다.

학생 신청 화면 계약은 `src/app_student/domains/clinic/README.md`, 서버 원자성·
권한·실패 계약은 백엔드 `docs/domain/clinic-booking.md`가 소유합니다.
