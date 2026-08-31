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
   **17:00–19:00 · 2개 시간대**로 요약합니다. 개별 시간 버튼은 계속 보여
   주므로 비연속 선택도 정확히 확인할 수 있습니다.
4. 학생을 여러 명 선택해 한 번 제출하면
   `POST /clinic/participants/bulk-create/`에 `session_ids`와 `student_ids`를
   보냅니다. 서버가 학생 × 시간대 전체를 하나의 트랜잭션으로 처리하므로 일부
   성공 상태를 만들지 않습니다.
5. 성공하면 선택한 모든 세션의 참가자와 세션 목록을 무효화하고 시트가 닫힙니다.
   실패하면 시트를 유지해 선택을 확인하고 다시 시도할 수 있습니다.

기존 참가자 일정 변경은 한 예약을 한 새 세션으로 옮기는 별도 흐름이며 다중
시간대 추가로 의미가 바뀌지 않습니다. 패스카드·ID 카드와 출석 상태도 각
`SessionParticipant` 행을 기존 방식으로 읽습니다.

## 소유 구현과 검증

- API와 타입: `src/app_teacher/domains/clinic/api.ts`
- 다중 시간·학생 선택: `components/AddParticipantSheet.tsx`
- 세션 생성 정책·참가자 화면: `pages/ClinicPage.tsx`
- 원자 요청·새로고침·390px 가로 넘침 회귀:
  `e2e/teacher/clinic-multi-slot-booking.mock.spec.ts`

학생 신청 화면 계약은 `src/app_student/domains/clinic/README.md`, 서버 원자성·
권한·실패 계약은 백엔드 `docs/domain/clinic-booking.md`가 소유합니다.
