# 학생 앱 클리닉 예약 기능

## 구조

1. **학생이 예약 신청**: 학생이 예약 가능한 클리닉 세션을 선택하고 신청 (status: "pending")
2. **선생이 승인**: 선생이 예약 신청을 확인하고 승인 (status: "pending" → "booked")

## 백엔드 API 확장 필요 사항

### 1. 클리닉 세션 조회 API 확장

**기존 API**: `GET /clinic/sessions/`
- 현재: 선생만 조회 가능
- **확장 필요**: 학생도 조회 가능하도록 권한 추가

**파라미터**:
- `date_from`: 시작 날짜 (YYYY-MM-DD)
- `date_to`: 종료 날짜 (YYYY-MM-DD)
- `available`: true일 경우 예약 가능한 세션만 (정원이 남은 세션)

**응답**: 기존과 동일
```json
{
  "id": 1,
  "date": "2026-02-20",
  "start_time": "14:00:00",
  "end_time": "15:00:00",
  "location": "101호",
  "participant_count": 5,
  "booked_count": 3,
  "max_participants": 10
}
```

### 2. 클리닉 참가자 생성 API 확장

**기존 API**: `POST /clinic/participants/`
- 현재: 선생이 직접 추가 (source: "manual", status: "booked")
- **확장 필요**: 학생이 신청 가능하도록 확장

**요청 본문**:
```json
{
  "session": 1,
  "source": "student_request",  // 신규 필드: 학생 신청 구분
  "status": "pending",          // 신규: 승인 대기 상태
  "memo": "참고사항"            // 선택
}
```

**주의사항**:
- `enrollment_id`는 현재 로그인한 학생의 enrollment_id로 자동 설정
- `source: "student_request"`인 경우 `status`는 반드시 `"pending"`이어야 함
- 선생이 직접 추가할 때는 `source: "manual"`, `status: "booked"` 사용

### 3. 학생의 예약 신청 조회 API

**기존 API**: `GET /clinic/participants/`
- 현재: 선생이 모든 참가자 조회
- **확장 필요**: 학생이 자신의 예약 신청만 조회 가능

**파라미터**:
- `student: "me"`: 현재 로그인한 학생의 예약 신청만 조회

**응답**: 기존과 동일하지만, 학생은 자신의 예약 신청만 조회 가능

### 4. 예약 신청 취소 API

**기존 API**: `PATCH /clinic/participants/{id}/set_status/`
- 현재: 선생이 상태 변경
- **확장 필요**: 학생이 자신의 예약 신청(status: "pending")만 취소 가능

**요청 본문**:
```json
{
  "status": "cancelled"
}
```

**권한 체크**:
- 학생은 자신의 예약 신청만 취소 가능
- `status`가 `"pending"`인 경우에만 취소 가능
- 이미 `"booked"`로 승인된 경우 취소 불가 (선생에게 문의 필요)

### 5. 선생의 예약 신청 승인/거부 API

**기존 API**: `PATCH /clinic/participants/{id}/set_status/`
- 현재: 선생이 상태 변경 가능
- **확장 필요**: `status: "pending"`인 예약 신청을 `"booked"`로 승인하거나 `"rejected"`로 거부

**요청 본문**:
```json
{
  "status": "booked"  // 또는 "rejected"
}
```

**권한 체크**:
- 선생만 승인/거부 가능
- `status`가 `"pending"`인 경우에만 승인/거부 가능

## 선생앱에서 승인하는 방법

선생앱의 클리닉 관리 페이지(`/admin/clinic/bookings`)에서:
1. 예약 신청자 목록 확인 (status: "pending")
2. 각 신청에 대해 승인/거부 버튼 클릭
3. 승인 시 `PATCH /clinic/participants/{id}/set_status/` 호출하여 `status: "booked"`로 변경

## 데이터베이스 스키마 확인 사항

1. `clinic_participants` 테이블에 `source` 필드 추가 필요 (또는 확인)
   - 값: `"manual"` (선생 직접 추가), `"student_request"` (학생 신청)

2. `clinic_participants` 테이블의 `status` 필드에 `"pending"` 상태 추가 필요 (또는 확인)
   - 기존: `"booked"`, `"attended"`, `"no_show"`, `"cancelled"`
   - 추가: `"pending"` (승인 대기), `"rejected"` (거부)

3. 권한 체크 로직 추가 필요
   - 학생: 자신의 예약 신청만 조회/취소 가능
   - 선생: 모든 참가자 조회 및 상태 변경 가능
