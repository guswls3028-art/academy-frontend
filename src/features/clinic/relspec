// 이건 클리닉에서 사용하는 api관련도메인 스펙이다

FRONTEND API CONTRACT – STUDENTS / RESULTS / PROGRESS

공통 원칙

계산 / 판정 / 집계는 전부 서버 단일진실

프론트는 값 표시 + 트리거만 담당

없는 API 추측 금지

status / 판정 / 대상자 여부는 항상 서버 응답 기준

STUDENTS DOMAIN
Base Path
/api/v1/students/

1-1. 학생 목록
GET /api/v1/students/

Query Params

name: string (icontains)

gender: "M" | "F"

grade: 1 | 2 | 3

high_school: string

major: string

is_managed: boolean

lecture: number (있을 경우 is_enrolled 계산용)

search: name, phone, high_school, major

ordering: id, created_at, updated_at (default: -id)

Response Item (StudentListSerializer)

id

user (nullable)

name

gender

grade

school_type ("MIDDLE" | "HIGH")

phone

parent

parent_phone

high_school

high_school_class

major

middle_school

memo

is_managed

created_at

updated_at

tags: [{id, name, color}]

is_enrolled (boolean, lecture query 있을 때만 의미 있음)

1-2. 학생 상세
GET /api/v1/students/{id}/

Response (StudentDetailSerializer)

Student 모든 필드

tags

enrollments (EnrollmentSerializer)

counselings

questions

1-3. 학생 생성
POST /api/v1/students/

Body

name

phone

initial_password (required)

기타 Student 필드들

Behavior

phone = User.username

User + Student 동시 생성

1-4. 학생 삭제
DELETE /api/v1/students/{id}/

Behavior

Student 삭제

연결된 User도 같이 삭제

1-5. 학생 태그
POST /api/v1/students/{id}/add_tag/
POST /api/v1/students/{id}/remove_tag/

Body

tag_id: number

1-6. 학생 본인 조회 (Anchor)
GET /api/v1/students/me/

Permission

학생 본인만 가능

Response

StudentDetailSerializer

================================================================================
2. RESULTS DOMAIN
Base Path
/api/v1/results/

2-1. 학생 시험 결과 (대표 Attempt)
GET /api/v1/results/me/exams/{exam_id}/

Response

exam_id

attempt_id

total_score

max_score

is_pass

submitted_at

meta

2-2. 학생 시험 Attempt 히스토리
GET /api/v1/results/me/exams/{exam_id}/attempts/

Response

Attempt 배열

2-3. 관리자 시험 요약
GET /api/v1/results/admin/exams/{exam_id}/summary/

Response

total_count

pass_count

fail_count

avg_score

max_score

min_score

2-4. 관리자 시험 결과 목록
GET /api/v1/results/admin/exams/{exam_id}/results/

Query

ordering

search

Response

enrollment_id

student_name

total_score

is_pass

attempt_id

2-5. 관리자 시험 문항 통계
GET /api/v1/results/admin/exams/{exam_id}/questions/

2-6. 세션 성적 요약
GET /api/v1/results/admin/sessions/{session_id}/score-summary/

2-7. 세션 성적 상세
GET /api/v1/results/admin/sessions/{session_id}/scores/

2-8. 클리닉 대상자 (Results 기준)
GET /api/v1/results/admin/clinic-targets/

Response

enrollment_id

session_id

reason

created_at

2-9. 클리닉 예약 (Results Alias)
GET /api/v1/results/admin/clinic-bookings/

NOTE

clinic 도메인의 ParticipantViewSet을 그대로 사용

예약 상태 / 변경은 clinic 규칙 따름

================================================================================
3. PROGRESS DOMAIN
Base Path
/api/v1/progress/

3-1. Progress Policy
GET /api/v1/progress/policies/

Query

lecture: lecture_id

Response

lecture

video_required_rate

exam_start_session_order

exam_end_session_order

exam_pass_score

exam_aggregate_strategy (MAX | AVG | LATEST)

exam_pass_source (POLICY | EXAM)

homework_start_session_order

homework_end_session_order

homework_pass_type

homework_cutline_percent

homework_round_unit

3-2. Session Progress
GET /api/v1/progress/session-progress/

Query

enrollment_id

session

lecture

completed

Response

enrollment_id

session

attendance_type

video_progress_rate

video_completed

exam_attempted

exam_aggregate_score

exam_passed

exam_meta

homework_submitted

homework_passed

completed

completed_at

calculated_at

NOTE

시험 점수는 Result 기반 집계

프론트에서 시험/과제 합불 계산 금지

3-3. Lecture Progress
GET /api/v1/progress/lecture-progress/

Response

enrollment_id

lecture

total_sessions

completed_sessions

failed_sessions

consecutive_failed_sessions

risk_level (NORMAL | WARNING | DANGER)

last_session

last_updated

3-4. Clinic Link (진행 기반 클리닉 대상)
GET /api/v1/progress/clinic-links/

Query

enrollment_id

session

lecture

reason

is_auto

approved

Response

enrollment_id

session

reason

is_auto

approved

resolved_at

memo

meta

NOTE

resolved_at != null → 이미 클리닉 처리된 대상

3-5. Risk Log
GET /api/v1/progress/risk-logs/

Response

enrollment_id

session

risk_level

rule

reason

created_at

================================================================================
핵심 UX 연결 포인트 (프론트 기준)

“학생 검색”
→ /students/?search=

“수강 여부 체크”
→ students list + lecture query + is_enrolled

“클리닉 대상자 판단”
→ progress/clinic-links + results/admin/clinic-targets

“수업 성취도 / 위험도”
→ lecture-progress + risk-logs

================================================================================