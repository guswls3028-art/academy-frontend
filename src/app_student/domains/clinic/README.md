# 학생 앱 클리닉

학생이 자신의 미통과 항목을 확인하고, 맞는 클리닉 세션을 예약하며,
승인 상태와 일정을 확인하는 도메인입니다.

## 사용자 흐름

1. `GET /clinic/idcard/`에서 활성 수강 전체의 `current_targets`를 조회합니다.
2. 예약 화면은 미통과 강의·차시·사유를 먼저 보여줍니다.
3. `GET /clinic/sessions/`의 `target_lecture_names`와 대상 강의를 비교해
   맞는 세션에 **내 보강 일정**을 표시합니다. 대상 강의를 제한하지 않은
   공용 세션도 추천할 수 있습니다.
4. 학생이 `POST /clinic/participants/`로 신청하면 학원 설정에 따라
   `pending` 또는 `booked`가 됩니다.
5. `pending` 예약은 학생이 취소하거나 다른 세션으로 변경할 수 있습니다.
   `booked` 예약의 변경·취소는 관리자에게 요청합니다.

## 수강 연결 규칙

- `enrollment_id`와 `student_id`는 같은 ID가 아니며 섞어 보내지 않습니다.
- 학생에게 활성 수강이 여러 개 있으면 백엔드가 세션의 대상 강의와
  미해결 `ClinicLink`를 함께 확인해 예약 소유 수강을 정합니다.
- 특정 강의 대상 세션과 맞는 활성 수강이 없으면 다른 최신 수강으로
  임의 연결하지 않고 예약을 거절합니다.

## 상태의 단일 진실

- 예약 상태: `pending → booked → attended/no_show`, 또는
  `pending → cancelled/rejected`.
- 예약과 출석은 일정·출결 상태이며 `ClinicLink`를 해소하지 않습니다.
- 시험 통과, 과제 통과, 관리자 수동 통과/면제만 미통과 대상을 해소합니다.
- 예약 변경은 새 예약 생성과 기존 예약 취소를 하나의 백엔드 트랜잭션으로
  처리해 실패 시 기존 예약을 보존합니다.

## 주요 화면과 계약

- 학생 예약: `/student/clinic`
- 클리닉 인증 패스: `/student/clinic-idcard`
- 관리자 예약 일정: `/admin/clinic/schedule`
- 관리자 승인·미통과 관리: `/admin/clinic/bookings`
- 관리자 당일 운영: `/admin/clinic/operations`

학생 이름은 공통 `StudentNameWithLectureChip` 규칙을 따릅니다.
