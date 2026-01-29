이거보고 판단하셈. 

0. 공통 규칙 (🔥 절대 규칙)
- 모든 계산(합계, 급여, 시간, 상태 판정)은 BACKEND 단일진실
- 프론트는 계산/추론/집계 금지
- 마감된 월 데이터는 불변 (수정/삭제/추가 불가)
- PayrollSnapshot은 생성 이후 절대 수정 불가
- 승인/반려는 관리자만 가능

1. 권한 / 역할 판별
GET /api/v1/staffs/me/

용도

프론트 UX 분기 (관리자 / 일반 스태프)

버튼 노출 / 승인 가능 여부 판단

Response

{
  is_authenticated: boolean
  is_superuser: boolean
  is_staff: boolean
  is_payroll_manager: boolean
}


규칙

- 승인/월마감/급여 확정 = is_payroll_manager === true 만 가능

2. Staff (직원)
GET /api/v1/staffs/

Response Item

{
  id
  name
  phone
  is_active
  is_manager
  pay_type: "HOURLY" | "MONTHLY"
  staff_work_types: [
    {
      id
      work_type
      hourly_wage
      effective_hourly_wage
    }
  ]
  created_at
  updated_at
}

GET /api/v1/staffs/{id}/

Response

{
  id
  user
  user_username
  user_is_staff
  name
  phone
  is_active
  is_manager
  pay_type
  staff_work_types: [...]
  created_at
  updated_at
}


UX 규칙

- user_username 없으면 "계정 없음" 표시
- user_is_staff === true → STAFF 배지 표시

POST /api/v1/staffs/

Request

{
  username
  password
  name
  phone
  role: "TEACHER" | "ASSISTANT"
}


동작

- User 생성
- Staff 생성
- role == TEACHER → Teacher 자동 생성
- Teacher는 is_staff 권한 부여

DELETE /api/v1/staffs/{id}/

동작

- Staff 삭제
- 연결된 Teacher 삭제
- 연결된 User 삭제

3. 근무 유형 (WorkType)
GET /api/v1/staffs/work-types/
POST /api/v1/staffs/work-types/

Response

{
  id
  name
  base_hourly_wage
  color
  description
  is_active
}

4. 직원별 근무유형/시급 (StaffWorkType)
GET /api/v1/staffs/{staff_id}/work-types/
POST /api/v1/staffs/{staff_id}/work-types/

Request

{
  work_type_id
  hourly_wage (optional)
}


Response

{
  id
  work_type
  hourly_wage
  effective_hourly_wage
}

5. 근무 기록 (WorkRecord)
GET /api/v1/staffs/work-records/

Filter

staff
work_type
date_from
date_to


Response

{
  id
  staff
  staff_name
  work_type
  work_type_name
  date
  start_time
  end_time
  break_minutes
  work_hours
  amount
  memo
}

POST / PATCH / DELETE /api/v1/staffs/work-records/

제약

- 해당 date가 월 마감이면 → 400 ERROR
- work_hours / amount는 서버에서 자동 계산

6. 비용 기록 (ExpenseRecord)
GET /api/v1/staffs/expense-records/

Filter

staff
status
date_from
date_to


Response

{
  id
  staff
  staff_name
  date
  title
  amount
  memo
  status: "PENDING" | "APPROVED" | "REJECTED"
  approved_at
  approved_by
  approved_by_name
}

PATCH /api/v1/staffs/expense-records/{id}/

규칙

- APPROVED 이후 수정 불가
- 상태 변경은 관리자만 가능
- PENDING → APPROVED | REJECTED 만 허용

7. 월 마감 (WorkMonthLock)
GET /api/v1/staffs/work-month-locks/

Response

{
  id
  staff
  staff_name
  year
  month
  is_locked
  locked_by
  locked_by_name
  created_at
}

POST /api/v1/staffs/work-month-locks/

Request

{
  staff
  year
  month
}


동작

- 월 마감 처리
- PayrollSnapshot 자동 생성

8. 급여 스냅샷 (PayrollSnapshot) 🔒 불변
GET /api/v1/staffs/payroll-snapshots/

Filter

staff
year
month


Response

{
  id
  staff
  staff_name
  year
  month
  work_hours
  work_amount
  approved_expense_amount
  total_amount
  generated_by
  generated_by_name
  created_at
}


규칙

- 생성 이후 절대 수정 불가
- 프론트 계산 금지

GET /api/v1/staffs/payroll-snapshots/export-excel/?year=&month=

월 전체 급여 엑셀 다운로드

GET /api/v1/staffs/payroll-snapshots/export-pdf/?staff=&year=&month=

직원 1명 급여 명세서 PDF

9. Staff 요약 (집계 전용)
GET /api/v1/staffs/{id}/summary/?date_from=&date_to=

Response

{
  staff_id
  work_hours
  work_amount
  expense_amount
  total_amount
}


규칙

- 프론트에서 합계 계산 절대 금지
- KPI / 카드 수치는 이 API만 사용

10. 프론트 UX 필수 반영 규칙
- 마감된 월:
  - 근무/비용 생성/수정/삭제 버튼 DISABLED
  - 사유 tooltip: "마감된 월입니다"

- 승인 완료 비용:
  - 수정/삭제 불가
  - 승인자/승인시각 표시

- 급여:
  - "마감 = 급여 확정" 설명 문구 항상 노출
  - PayrollSnapshot 기준으로만 표시