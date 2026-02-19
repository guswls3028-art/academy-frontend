# 클리닉 예약 기능 테스트 가이드

## 백엔드 마이그레이션 완료
- ✅ `SessionParticipant.Status`에 `PENDING`, `REJECTED` 추가
- ✅ `SessionParticipant.Source`에 `STUDENT_REQUEST` 추가
- ✅ 마이그레이션 적용 완료

## 테스트 시나리오

### 1. 학생이 예약 가능한 클리닉 세션 조회
**엔드포인트**: `GET /api/v1/clinic/sessions/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`
**권한**: 학생 로그인 필요
**예상 결과**: 
- 현재 날짜부터 2주 후까지의 클리닉 세션 목록 반환
- `booked_count`에 `pending` 상태도 포함됨

**테스트 방법**:
```bash
# 학생으로 로그인 후
curl -H "Authorization: Bearer {학생_토큰}" \
  "http://localhost:8000/api/v1/clinic/sessions/?date_from=2026-02-19&date_to=2026-03-05"
```

### 2. 학생이 클리닉 예약 신청
**엔드포인트**: `POST /api/v1/clinic/participants/`
**요청 본문**:
```json
{
  "session": 1,
  "source": "student_request",
  "status": "pending",
  "memo": "참고사항"
}
```
**예상 결과**:
- `student`는 자동으로 현재 로그인한 학생으로 설정됨
- `enrollment_id`는 자동으로 활성 enrollment로 설정됨
- `status`는 `pending`으로 설정됨
- `source`는 `student_request`로 설정됨

**테스트 방법**:
```bash
curl -X POST \
  -H "Authorization: Bearer {학생_토큰}" \
  -H "Content-Type: application/json" \
  -d '{"session": 1, "source": "student_request", "status": "pending", "memo": "테스트"}' \
  "http://localhost:8000/api/v1/clinic/participants/"
```

### 3. 학생이 자신의 예약 신청 목록 조회
**엔드포인트**: `GET /api/v1/clinic/participants/`
**권한**: 학생 로그인 필요
**예상 결과**: 
- 현재 로그인한 학생의 예약 신청만 반환
- `status`가 `pending`, `booked`, `rejected`인 것만 표시

**테스트 방법**:
```bash
curl -H "Authorization: Bearer {학생_토큰}" \
  "http://localhost:8000/api/v1/clinic/participants/"
```

### 4. 학생이 예약 신청 취소
**엔드포인트**: `PATCH /api/v1/clinic/participants/{id}/set_status/`
**요청 본문**:
```json
{
  "status": "cancelled"
}
```
**예상 결과**:
- `status`가 `pending`인 경우에만 취소 가능
- 자신의 예약 신청만 취소 가능

**테스트 방법**:
```bash
curl -X PATCH \
  -H "Authorization: Bearer {학생_토큰}" \
  -H "Content-Type: application/json" \
  -d '{"status": "cancelled"}' \
  "http://localhost:8000/api/v1/clinic/participants/1/set_status/"
```

### 5. 선생이 예약 신청 승인/거부
**엔드포인트**: `PATCH /api/v1/clinic/participants/{id}/set_status/`
**요청 본문** (승인):
```json
{
  "status": "booked"
}
```
**요청 본문** (거부):
```json
{
  "status": "rejected"
}
```
**예상 결과**:
- 선생만 승인/거부 가능
- `status`가 `pending`인 경우에만 승인/거부 가능

**테스트 방법**:
```bash
# 승인
curl -X PATCH \
  -H "Authorization: Bearer {선생_토큰}" \
  -H "Content-Type: application/json" \
  -d '{"status": "booked"}' \
  "http://localhost:8000/api/v1/clinic/participants/1/set_status/"

# 거부
curl -X PATCH \
  -H "Authorization: Bearer {선생_토큰}" \
  -H "Content-Type: application/json" \
  -d '{"status": "rejected"}' \
  "http://localhost:8000/api/v1/clinic/participants/1/set_status/"
```

## 프론트엔드 테스트 체크리스트

### 학생 앱 (`/student/clinic/booking`)
- [ ] 예약 가능한 클리닉 세션 목록이 표시되는가?
- [ ] 세션을 선택하고 예약 신청할 수 있는가?
- [ ] 예약 신청 후 "승인 대기" 상태로 표시되는가?
- [ ] 내 예약 신청 현황에 신청한 예약이 표시되는가?
- [ ] 승인 대기 중인 예약을 취소할 수 있는가?
- [ ] 이미 신청한 세션은 예약 가능 목록에서 제외되는가?
- [ ] 정원이 마감된 세션은 표시되지 않는가?

### 선생 앱 (`/admin/clinic/bookings`)
- [ ] 학생의 예약 신청(`status: "pending"`)이 표시되는가?
- [ ] 예약 신청을 승인(`status: "pending"` → `status: "booked"`)할 수 있는가?
- [ ] 예약 신청을 거부(`status: "pending"` → `status: "rejected"`)할 수 있는가?

## 주의사항

1. **권한 체크**: 학생은 자신의 예약만 조회/취소 가능
2. **상태 전이**: 
   - 학생 신청: `pending` → (선생 승인) → `booked`
   - 학생 신청: `pending` → (학생 취소) → `cancelled`
   - 학생 신청: `pending` → (선생 거부) → `rejected`
3. **정원 계산**: `booked_count`에 `pending` 상태도 포함되므로 정원 체크 시 주의
