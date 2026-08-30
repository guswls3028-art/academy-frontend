# 관리자 클리닉 일정

관리자가 `/workspace/clinic`에서 클리닉 세션을 생성·복사·수정하고 학생 예약을
운영하는 도메인입니다. 같은 날짜의 여러 시간대 예약 가능 여부는 서버의 세션별
정책을 그대로 편집하며, 프론트가 tenant나 학생별 예외를 추정하지 않습니다.

## 같은 날 여러 시간대 예약

- 새 세션은 `GET /clinic/settings/`의 `multi_slot_booking_default`를 체크박스
  초기값으로 사용합니다.
- 생성·수정 요청은 `allow_multi_slot_booking`을 명시해 서버에 저장합니다.
- 확인 화면은 **여러 시간대 허용** 또는 **한 타임만 허용**을 일정·정원·공개
  대상과 함께 보여 줍니다.
- 기존 세션 복사와 이전 주 불러오기는 원본 세션의 정책을 그대로 복사합니다.
- ON에서 OFF로 바꿔도 기존 예약은 화면에서 제거하지 않습니다. 서버가 이후 같은
  날짜의 충돌하는 새 예약만 `409`로 거부합니다.

## 소유 구현과 검증

- 세션 타입·조회·수정: `api/clinicSessions.api.ts`
- tenant 기본값 조회: `api/clinicSettings.api.ts`
- 생성·복사·수정 UI: `components/ClinicCreatePanel.tsx`
- 저장 전 검토 문구: `components/clinicScheduleConfirmation.ts`
- 이전 주 복사: `components/PreviousWeekImportModal.tsx`
- 서버 정책·원자성·동시성: backend `docs/domain/clinic-booking.md`

관리자 mock E2E는 기존 clinic weekly spec의 선행 owner merge 뒤 같은 파일에서
다중 예약 정책을 추가 검증합니다. 현재 기능의 직접 focused 검증은 teacher/student
mock spec과 실제 API real-use spec이 담당합니다.
