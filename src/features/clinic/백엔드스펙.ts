// ai는 이걸 단일진실로 고정할것

CLINIC API SPEC (FRONTEND CONTRACT)

Base

Base path: /clinic/

Pagination: 일부 리스트는 배열로 오거나 {results: [...]}로 올 수 있음. 프론트는 둘 다 처리해야 함.

단일진실: 상태/집계/정원/판정은 백엔드 단일진실. 프론트는 계산/추론 금지.

Sessions (클리닉 세션)

1-1. 세션 목록
GET /clinic/sessions/
Query params (지원되는 것)

date: YYYY-MM-DD

date_from: YYYY-MM-DD

date_to: YYYY-MM-DD

search: location 검색 (SearchFilter)

ordering: date, start_time, created_at (예: ordering=-date)

Response item (ClinicSessionSerializer, fields="all" + annotated/derived)

id

date

start_time

duration_minutes (default=60)

location

max_participants

created_by (nullable)

Annotated counts (get_queryset annotate 기반, serializer read_only)

participant_count

booked_count

attended_count

no_show_count

cancelled_count

auto_count

manual_count

Derived fields (serializer methods)

end_time (date+start_time+duration_minutes로 계산된 time)

available_slots (max_participants - participant_count, 최소 0)

is_full (participant_count >= max_participants)

status_summary {booked, attended, no_show, cancelled}

source_summary {auto, manual}

has_auto_targets (auto_count > 0)

주의

end_time은 저장값이 아니라 파생값이라 프론트에서 수정/저장하려 하지 말 것.

participant_count 등은 세션 리스트/상세에서 내려오는 집계 단일진실.

1-2. 세션 생성
POST /clinic/sessions/
Body

date: YYYY-MM-DD

start_time: HH:MM 또는 HH:MM:SS

duration_minutes: number (분)

location: string

max_participants: number

Behavior

created_by는 서버에서 request.user로 자동 기록됨(perform_create).

Response

ClinicSessionSerializer 전체

1-3. 세션 상세
GET /clinic/sessions/{id}/
Response

ClinicSessionSerializer 전체 (위 동일)

1-4. 운영 좌측 트리 전용
GET /clinic/sessions/tree/?year=YYYY&month=MM
Required query

year, month 없으면 400

Response (serializer 우회, 배열)
각 원소:

id

date

start_time

location

participant_count

booked_count

no_show_count

주의

이 응답은 “트리 UI 최적화 전용”이라 필드가 제한됨.

1-5. 리마인더 발송
POST /clinic/sessions/{id}/send_reminder/
Response

{ ok: true }

Participants (세션 참가자)

2-1. 참가자 목록
GET /clinic/participants/
Filter params (ParticipantFilter)

session: number (session_id)

student: number (student_id)

status: booked | attended | no_show | cancelled

source: auto | manual

enrollment_id: number

clinic_reason: exam | homework | both

session_date: YYYY-MM-DD

session_date_from: YYYY-MM-DD (session__date gte)

session_date_to: YYYY-MM-DD (session__date lte)
Search params

search: student name, session location
Ordering

ordering: created_at, updated_at, session__date

Response item (ClinicSessionParticipantSerializer, fields="all" + derived)
기본 필드 (모델)

id

session (id)

student (id)

status

source

enrollment_id (nullable)

clinic_reason (nullable)

participant_role (target/manual)

status_changed_at (nullable)

status_changed_by (nullable user id)

checked_in_at (nullable)

is_late (boolean)

memo (nullable)

created_at

updated_at

추가 노출 필드 (serializer)

student_name

session_date

session_start_time

session_location

session_duration_minutes

session_end_time (파생)

status_changed_by_name (username)

주의

status_changed_*는 set_status 액션에서만 갱신됨.

session_end_time은 파생.

2-2. 참가자 생성(예약 추가)
POST /clinic/participants/
Serializer (Create 전용)
Body 가능 필드

session: session id (required)

student: student id (required)

status (보통 booked 사용)

memo (optional)

source: auto | manual (optional, default auto)

enrollment_id (optional)

clinic_reason (optional)

participant_role (optional이지만 서버가 덮어쓸 수 있음)

Server behavior

동일 session+student 이미 있으면 409, detail="이미 해당 세션에 예약된 학생입니다."

participant_role은 서버가 source 기반으로 자동 판정
source=manual -> participant_role=manual
그 외 -> participant_role=target

enrollment_id가 있으면 progress.ClinicLink 중 해당 조건(is_auto=True, resolved_at is null)을 resolved_at=now로 업데이트(자동 대상자 링크 해제)

Response

생성 후 출력은 ClinicSessionParticipantSerializer로 반환(생성 응답도 상세 형태로 내려옴)

프론트 권장

수동 추가시 source는 "manual"로 보내는 게 운영/감사 정합성에 맞음.

enrollment_id가 없는 “전체 학생 수동 추가”도 허용됨.

2-3. 참가자 상태 변경(운영 핵심)
PATCH /clinic/participants/{id}/set_status/
Body

status: booked | attended | no_show | cancelled (required)

memo: string|null (optional, 전달되면 갱신)

Server behavior

status가 유효하지 않으면 400

status_changed_at=now, status_changed_by=request.user 기록

no_show 또는 cancelled로 바뀌고 enrollment_id가 있으면, progress.ClinicLink(is_auto=True) resolved_at=None으로 복구(다시 대상자로 남게 하는 의미)

Response

ClinicSessionParticipantSerializer

2-4. 세션 기준 참가자 조회(편의 API)
GET /clinic/participants/by_session/?session_id=12
Required

session_id 없으면 400

Response

ClinicSessionParticipantSerializer 배열

Tests (클리닉 시험)

3-1. 테스트 CRUD
GET /clinic/tests/
GET /clinic/tests/{id}/
POST /clinic/tests/
PATCH/PUT /clinic/tests/{id}/
DELETE /clinic/tests/{id}/
Search

search: title
Ordering

ordering: date, created_at

Response item

Test 모델 fields="all"
id, session, title, round, date, created_at, updated_at

Submissions (클리닉 제출)

4-1. 제출 CRUD
GET /clinic/submissions/
GET /clinic/submissions/{id}/
POST /clinic/submissions/
PATCH/PUT /clinic/submissions/{id}/
DELETE /clinic/submissions/{id}/
Filter (SubmissionFilter)

session: number (method filter_session -> test__session_id=value)

test: number (test_id)

student: number (student_id)

status: pending|passed|failed

need_file: boolean (file is null)

need_score: boolean (score is null)

need_grade: boolean (status="pending")
Search

search: student name, test title
Ordering

ordering: created_at

Response item

Submission 모델 fields="all"
id, test, student, file, score, status, remark, graded_at, created_at, updated_at

프론트 구현 시 주의사항(중요)

participants 리스트는 date range 기반 필터가 가능하므로 “홈/리포트/운영”에서 그대로 조회 가능.

sessions/tree는 month 단위 트리 UI 전용이며, 상세 집계는 sessions/ 또는 participants/에서 가져오면 됨.

session 종료시간은 서버가 end_time(세션) / session_end_time(참가자)로 내려주며 프론트에서 계산하지 않는 게 원칙.

“대상자/판정”은 results가 단일진실이고 clinic은 운영상태(status)와 기록만 관리한다.