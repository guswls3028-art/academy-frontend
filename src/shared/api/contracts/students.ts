// PATH: src/shared/api/contracts/students.ts
import api, { type ApiRequestConfig } from "@/shared/api/axios";

/* ===============================
 * Types
 * =============================== */

export interface ClientStudentTag {
  id: number;
  name: string;
  color: string;
}

export interface ClientEnrollmentLite {
  id: number;
  lectureId: number | null;
  lectureName: string | null;
  lectureColor: string | null;
  lectureChipLabel: string | null;
  status: "ACTIVE" | "INACTIVE" | "PENDING" | null;
  enrolledAt: string | null;
}

export interface ClientStudent {
  id: number;
  name: string;
  /** 동명이인 구분용 표시명 (박철1, 박철2 등). 동명이인 아니면 name과 동일 */
  displayName: string;
  /** 학생앱에서 업로드한 프로필 사진 URL (없으면 null) */
  profilePhotoUrl?: string | null;

  psNumber: string;
  omrCode: string;

  studentPhone: string | null;
  parentPhone: string | null;
  /** True면 식별자로 가입, 표시 시 "식별자 XXXX-XXXX" */
  usesIdentifier?: boolean;

  school: string | null;
  schoolClass: string | null;
  major: string | null;
  originMiddleSchool?: string | null;

  grade: number | null;
  gender: string | null;

  registeredAt: string | null;
  active: boolean;
  memo?: string | null;
  address?: string | null;

  schoolType: "MIDDLE" | "HIGH" | "ELEMENTARY" | null;

  tags: ClientStudentTag[];
  enrollments: ClientEnrollmentLite[];
  deletedAt?: string | null;
  /** 클리닉 대상(미수강) 하이라이트 — 백엔드 computed */
  nameHighlightClinicTarget?: boolean;
}

export type AccountNotificationType =
  | "registration_approved_student"
  | "registration_approved_parent"
  | "password_find_otp"
  | "password_reset_student"
  | "password_reset_parent"
  | string;

export interface ClientAccountNotificationLog {
  id: number;
  sentAt: string | null;
  success: boolean;
  status: string;
  notificationType: AccountNotificationType;
  recipientSummary: string;
  failureReason: string;
  targetId: string;
  targetName: string;
}

export interface StudentTag {
  id: number;
  name: string;
  color: string;
}

export type StudentSchoolType = NonNullable<ClientStudent["schoolType"]>;
export type StudentFilters = Record<string, unknown>;

export type StudentFormInput = {
  name?: string;
  psNumber?: string;
  gender?: string | null;
  initialPassword?: string;
  studentPhone?: string;
  omrCode?: string;
  parentPhone?: string;
  schoolType?: StudentSchoolType | string | null;
  school?: string | null;
  grade?: string | number | null;
  schoolClass?: string | null;
  major?: string | null;
  originMiddleSchool?: string | null;
  address?: string | null;
  memo?: string | null;
  active?: boolean;
  noPhone?: boolean;
};

export interface BulkRestoreSkippedStudent {
  id: number;
  code?: string;
  reason: string;
}

export interface BulkRestoreStudentsResult {
  restored: number;
  skipped?: BulkRestoreSkippedStudent[];
}

type RawRecord = Record<string, unknown>;
type ListEnvelope = {
  results?: unknown;
  count?: unknown;
  page_size?: unknown;
};

const SCHOOL_TYPES = new Set<StudentSchoolType>(["MIDDLE", "HIGH", "ELEMENTARY"]);
const ENROLLMENT_STATUSES = new Set<NonNullable<ClientEnrollmentLite["status"]>>([
  "ACTIVE",
  "INACTIVE",
  "PENDING",
]);
const SKIP_AUTH_CONFIG: ApiRequestConfig = { skipAuth: true };

/* ===============================
 * Mapper
 * =============================== */

function asRecord(value: unknown): RawRecord {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as RawRecord
    : {};
}

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value) as ListEnvelope;
  return Array.isArray(record.results) ? record.results : [];
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function numberOrZero(value: unknown): number {
  return numberOrNull(value) ?? 0;
}

function normalizeSchoolType(value: unknown, item?: RawRecord): StudentSchoolType | null {
  if (typeof value === "string" && SCHOOL_TYPES.has(value as StudentSchoolType)) {
    return value as StudentSchoolType;
  }
  if (item?.elementary_school) return "ELEMENTARY";
  if (item?.middle_school) return "MIDDLE";
  if (item?.high_school) return "HIGH";
  return null;
}

function normalizeEnrollmentStatus(value: unknown): ClientEnrollmentLite["status"] {
  return typeof value === "string" && ENROLLMENT_STATUSES.has(value as NonNullable<ClientEnrollmentLite["status"]>)
    ? value as ClientEnrollmentLite["status"]
    : null;
}

function mapTag(item: unknown): StudentTag {
  const record = asRecord(item);
  return {
    id: numberOrZero(record.id),
    name: safeStr(record.name),
    color: safeStr(record.color),
  };
}

/**
 * 동명이인 번호 부여: 같은 이름이 2명 이상이면 id 순으로 1,2,3... 붙임
 * 1명만 있으면 번호 없이 원래 이름 유지
 */
export function applyDisplayNames(students: ClientStudent[]): ClientStudent[] {
  const nameGroups = new Map<string, ClientStudent[]>();
  for (const s of students) {
    const group = nameGroups.get(s.name) ?? [];
    group.push(s);
    nameGroups.set(s.name, group);
  }
  for (const [, group] of nameGroups) {
    if (group.length < 2) continue;
    // id 오름차순 정렬 → 먼저 등록된 학생이 1번
    group.sort((a, b) => a.id - b.id);
    for (let i = 0; i < group.length; i++) {
      group[i].displayName = `${group[i].name}${i + 1}`;
    }
  }
  return students;
}

export function mapStudent(raw: unknown): ClientStudent {
  const item = asRecord(raw);
  const phone = nullableStr(item.phone);
  const omrCode = item.omr_code ?? "";

  // 🔧 변경: UI에는 항상 phone만 전달
  const displayPhone = phone ?? null;

  const schoolType = normalizeSchoolType(item.school_type, item);

  return {
    id: numberOrZero(item.id),
    name: safeStr(item.name),
    displayName: safeStr(item.name),
    profilePhotoUrl: nullableStr(item.profile_photo_url),

    psNumber: safeStr(item.ps_number),
    omrCode: safeStr(omrCode),

    studentPhone: displayPhone ?? null,
    parentPhone: nullableStr(item.parent_phone),
    usesIdentifier: item.uses_identifier === true,

    school: nullableStr(item.high_school) ?? nullableStr(item.middle_school) ?? nullableStr(item.elementary_school),
    schoolClass: nullableStr(item.high_school_class),
    major: nullableStr(item.major),
    originMiddleSchool: nullableStr(item.origin_middle_school),

    grade: numberOrNull(item.grade),
    gender: nullableStr(item.gender),

    registeredAt: nullableStr(item.created_at),
    active: item.is_managed === true,
    memo: nullableStr(item.memo),
    address: nullableStr(item.address),

    schoolType,

    tags: asList(item.tags).map(mapTag),

    enrollments: asList(item.enrollments).map((entry) => {
      const enrollment = asRecord(entry);
      return {
        id: numberOrZero(enrollment.id),
        lectureId: numberOrNull(enrollment.lecture ?? enrollment.lecture_id),
        lectureName: nullableStr(enrollment.lecture_name),
        lectureColor: nullableStr(enrollment.lecture_color) ?? "#3b82f6",
        lectureChipLabel: nullableStr(enrollment.lecture_chip_label),
        status: normalizeEnrollmentStatus(enrollment.status),
        enrolledAt: nullableStr(enrollment.enrolled_at),
      };
    }),
    deletedAt: nullableStr(item.deleted_at),
    nameHighlightClinicTarget: item.name_highlight_clinic_target === true,
  };
}

/* ===============================
 * Ordering (server-side friendly)
 * =============================== */

const ORDERING_MAP: Record<string, string> = {
  name: "name",
  registeredAt: "created_at",
  deletedAt: "deleted_at",
  active: "is_managed",
  psNumber: "ps_number",
  studentPhone: "phone",
  parentPhone: "parent_phone",
  school: "high_school",
  schoolClass: "high_school_class",
  grade: "grade",
  gender: "gender",
};

function buildOrdering(sort: string): string | undefined {
  if (!sort) return undefined;

  const isDesc = sort.startsWith("-");
  const key = isDesc ? sort.slice(1) : sort;

  const mapped = ORDERING_MAP[key];
  if (!mapped) return undefined;

  return isDesc ? `-${mapped}` : mapped;
}

/* ===============================
 * List / Detail
 * =============================== */

export async function fetchStudents(
  search: string,
  filters: StudentFilters = {},
  sort: string = "",
  page: number = 1,
  deleted: boolean = false
): Promise<{ data: ClientStudent[]; count: number; pageSize: number }> {
  const ordering = buildOrdering(sort);

  const params: Record<string, unknown> = {
    search: search || undefined,
    ...filters,
    ordering: ordering || undefined,
    page,
    deleted: deleted ? "true" : undefined,
  };
  // 목록 필터: 백엔드에 반드시 전달 (school_type, grade)
  if (filters.school_type != null && String(filters.school_type).trim() !== "") {
    params.school_type = filters.school_type;
  }
  if (filters.grade != null && Number.isInteger(Number(filters.grade))) {
    params.grade = Number(filters.grade);
  }

  const res = await api.get("/students/", { params });

  const response = asRecord(res.data) as ListEnvelope;
  const items = asList(res.data);
  const count = typeof response.count === "number" ? response.count : items.length;
  const pageSize = typeof response.page_size === "number" ? response.page_size : 50;

  return {
    data: applyDisplayNames(items.map(mapStudent)),
    count,
    pageSize,
  };
}

export async function getStudentDetail(id: number) {
  const res = await api.get(`/students/${id}/`);
  return mapStudent(res.data);
}

function mapAccountNotificationLog(raw: unknown): ClientAccountNotificationLog {
  const item = asRecord(raw);
  return {
    id: numberOrZero(item.id),
    sentAt: nullableStr(item.sent_at),
    success: item.success === true,
    status: safeStr(item.status),
    notificationType: safeStr(item.notification_type),
    recipientSummary: safeStr(item.recipient_summary),
    failureReason: safeStr(item.failure_reason),
    targetId: safeStr(item.target_id),
    targetName: safeStr(item.target_name),
  };
}

export async function fetchStudentAccountNotifications(
  studentId: number,
  limit = 5,
): Promise<ClientAccountNotificationLog[]> {
  const res = await api.get(`/students/${studentId}/account-notifications/`, {
    params: { limit },
  });
  return asList(res.data).map(mapAccountNotificationLog);
}

/* ===============================
 * CREATE
 * =============================== */

/** 전화번호를 백엔드 스펙(정규화: 숫자만 11자리)으로 정규화 */
function normalizePhone(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "").slice(0, 11);
}

export async function createStudent(form: StudentFormInput) {
  const name = safeStr(form?.name).trim();
  const initialPassword = safeStr(form?.initialPassword).trim();

  const studentPhoneRaw = safeStr(form?.studentPhone).trim();
  const parentPhoneRaw = safeStr(form?.parentPhone).trim();
  const parentPhone = normalizePhone(parentPhoneRaw);
  const noPhone = !studentPhoneRaw;

  const phone = noPhone ? "" : normalizePhone(studentPhoneRaw);
  const schoolType = normalizeSchoolType(form?.schoolType) ?? "HIGH";

  const payload: Record<string, unknown> = {
    name,
    initial_password: initialPassword,
    parent_phone: parentPhone,
    school_type: schoolType,
    high_school: schoolType === "HIGH" ? (form?.school?.trim() || null) : null,
    middle_school: schoolType === "MIDDLE" ? (form?.school?.trim() || null) : null,
    elementary_school: schoolType === "ELEMENTARY" ? (form?.school?.trim() || null) : null,
    high_school_class: schoolType === "HIGH" ? (form?.schoolClass?.trim() || null) : null,
    major: schoolType === "HIGH" ? (form?.major?.trim() || null) : null,
    grade: form?.grade ? Number(form.grade) : null,
    gender: form?.gender || null,
    memo: form?.memo?.trim() || null,
    address: form?.address?.trim() || null,
    origin_middle_school: schoolType === "HIGH" ? (form?.originMiddleSchool?.trim() || null) : null,
    is_managed: !!form?.active,
    send_welcome_message: true,
    no_phone: noPhone,
  };

  if (phone) {
    payload.phone = phone;
  }

  const psNumber = safeStr(form?.psNumber).trim();
  if (psNumber) payload.ps_number = psNumber;

  const res = await api.post("/students/", payload);
  return mapStudent(res.data);
}

/** 엑셀 일괄 등록 (600명+ 대량 업로드) */
export async function bulkCreateStudents(
  initialPassword: string,
  students: Array<{
    name: string;
    phone: string;
    parentPhone: string;
    usesIdentifier?: boolean;
    gender?: string | null;
    schoolType?: "HIGH" | "MIDDLE" | "ELEMENTARY";
    school?: string | null;
    grade?: number | null;
    schoolClass?: string | null;
    major?: string | null;
    memo?: string | null;
  }>,
  sendWelcomeMessage = true
) {
  const payload = {
    initial_password: initialPassword,
    send_welcome_message: sendWelcomeMessage,
    students: students.map((s) => ({
      name: s.name.trim(),
      phone: String(s.phone || "").replace(/\D/g, ""),
      parent_phone: String(s.parentPhone || "").replace(/\D/g, ""),
      uses_identifier: !!s.usesIdentifier,
      gender: s.gender || "",
      school_type: s.schoolType || "HIGH",
      school: s.school || "",
      high_school_class: s.schoolClass || "",
      major: s.major || "",
      grade: s.grade ?? null,
      memo: s.memo || "",
      is_managed: true,
    })),
  };
  const res = await api.post("/students/bulk_create/", payload, { timeout: 120_000 });
  return res.data as { created: number; failed: Array<{ row: number; name: string; error: string }>; total: number };
}

/** 학생 엑셀 일괄 등록 — 워커 전담. 파일 업로드 → excel_parsing job → 폴링으로 완료 대기 */
export async function uploadStudentBulkFromExcel(
  file: File,
  initialPassword: string,
  sendWelcomeMessage = true
): Promise<{ job_id: string; status: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("initial_password", initialPassword);
  form.append("send_welcome_message", String(sendWelcomeMessage));
  const res = await api.post("/students/bulk_create_from_excel/", form);
  return res.data as { job_id: string; status: string };
}

/* ===============================
 * UPDATE
 * =============================== */

export async function updateStudent(id: number, form: StudentFormInput) {
  const payload: Record<string, unknown> = {
    grade: form?.grade ? Number(form.grade) : null,
    gender: form?.gender ?? null,
    memo: form?.memo ?? null,
    address: form?.address?.trim() || null,
    is_managed: !!form?.active,
  };

  if (form?.name !== undefined) {
    payload.name = safeStr(form.name).trim();
  }

  if (form?.parentPhone !== undefined) {
    payload.parent_phone = normalizePhone(String(form.parentPhone));
  }
  if (form?.studentPhone !== undefined || form?.noPhone === true) {
    const p = form?.noPhone === true
      ? null
      : form?.studentPhone
        ? normalizePhone(String(form.studentPhone))
        : null;
    payload.phone = p || null;
    payload.uses_identifier = !p;
  }

  if (form?.psNumber !== undefined) {
    payload.ps_number = safeStr(form?.psNumber).trim();
  }

  if (form?.schoolType) {
    const schoolType = normalizeSchoolType(form.schoolType) ?? "HIGH";
    payload.school_type = schoolType;
    payload.high_school = schoolType === "HIGH" ? (form?.school?.trim() || null) : null;
    payload.middle_school = schoolType === "MIDDLE" ? (form?.school?.trim() || null) : null;
    payload.elementary_school = schoolType === "ELEMENTARY" ? (form?.school?.trim() || null) : null;
    payload.high_school_class =
      schoolType === "HIGH" ? (form?.schoolClass?.trim() || null) : null;
    payload.major = schoolType === "HIGH" ? (form?.major?.trim() || null) : null;
    payload.origin_middle_school =
      schoolType === "HIGH" ? (form?.originMiddleSchool?.trim() || null) : null;
  }

  const res = await api.patch(`/students/${id}/`, payload);
  return mapStudent(res.data);
}

/* ===============================
 * TOGGLE ACTIVE
 * =============================== */

export async function toggleStudentActive(id: number, nextActive: boolean) {
  const res = await api.patch(`/students/${id}/`, {
    is_managed: nextActive,
  });
  return mapStudent(res.data);
}

/* ===============================
 * DELETE
 * =============================== */

export async function deleteStudent(id: number) {
  await api.delete(`/students/${id}/`);
  return true;
}

/** 선택 학생 일괄 소프트 삭제 (30일 보관) */
export async function bulkDeleteStudents(studentIds: number[]) {
  const res = await api.post("/students/bulk_delete/", { ids: studentIds });
  return res.data as { deleted: number };
}

/** 삭제된 학생 일괄 복원 */
export async function bulkRestoreStudents(studentIds: number[]) {
  const res = await api.post("/students/bulk_restore/", { ids: studentIds });
  return res.data as BulkRestoreStudentsResult;
}

/** 삭제된 학생 즉시 영구 삭제 */
export async function bulkPermanentDeleteStudents(studentIds: number[]) {
  const res = await api.post("/students/bulk_permanent_delete/", { ids: studentIds });
  return res.data as { deleted: number };
}

/** 삭제된 학생 중 (이름+학부모전화) 중복 검사 — 고객 셀프 복구용 */
export async function checkDeletedStudentDuplicates() {
  const res = await api.get("/students/deleted_duplicates_check/");
  return res.data as { duplicate_groups: number; records_to_remove: number };
}

/** 삭제된 학생 중복 정리 — 그룹당 1명만 유지, 나머지 영구 삭제 */
export async function fixDeletedStudentDuplicates() {
  const res = await api.post("/students/deleted_duplicates_fix/");
  return res.data as { removed: number };
}

/** 충돌 해결 후 재등록 (삭제된 학생과 번호 충돌 시 복원 또는 즉시 삭제 후 재등록) */
export async function bulkResolveConflicts(
  password: string,
  resolutions: Array<{
    row: number;
    student_id: number;
    action: "restore" | "delete";
    student_data: Record<string, unknown>;
  }>,
  sendWelcomeMessage = true
) {
  const res = await api.post("/students/bulk_resolve_conflicts/", {
    initial_password: password,
    send_welcome_message: sendWelcomeMessage,
    resolutions: resolutions.map((r) => ({
      row: r.row,
      student_id: r.student_id,
      action: r.action,
      student_data: r.student_data,
    })),
  });
  return res.data as { created: number; restored: number; failed: Array<{ row: number; name: string; error: string }> };
}

/* ===============================
 * 가입 신청 (학생 셀프 등록 → 선생 승인)
 * =============================== */

export interface ClientRegistrationRequest {
  id: number;
  status: "pending" | "approved" | "rejected";
  name: string;
  parentPhone: string;
  phone: string | null;
  schoolType: string;
  elementarySchool: string | null;
  highSchool: string | null;
  middleSchool: string | null;
  highSchoolClass: string | null;
  major: string | null;
  grade: number | null;
  gender: string | null;
  memo: string | null;
  address: string | null;
  originMiddleSchool?: string | null;
  createdAt: string;
  studentId?: number | null;
}

function normalizeRegistrationStatus(value: unknown): ClientRegistrationRequest["status"] {
  return value === "approved" || value === "rejected" ? value : "pending";
}

function mapRegistrationRequest(raw: unknown): ClientRegistrationRequest {
  const item = asRecord(raw);
  return {
    id: numberOrZero(item.id),
    status: normalizeRegistrationStatus(item.status),
    name: safeStr(item.name),
    parentPhone: safeStr(item.parent_phone),
    phone: nullableStr(item.phone),
    schoolType: nullableStr(item.school_type) ?? "HIGH",
    elementarySchool: nullableStr(item.elementary_school),
    highSchool: nullableStr(item.high_school),
    middleSchool: nullableStr(item.middle_school),
    highSchoolClass: nullableStr(item.high_school_class),
    major: nullableStr(item.major),
    grade: numberOrNull(item.grade),
    gender: nullableStr(item.gender),
    memo: nullableStr(item.memo),
    address: nullableStr(item.address),
    originMiddleSchool: nullableStr(item.origin_middle_school),
    createdAt: nullableStr(item.created_at) ?? "",
    studentId: numberOrNull(item.student),
  };
}

/** 스태프: 가입 신청 목록 (페이지네이션) */
export async function fetchRegistrationRequests(params?: {
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<{ data: ClientRegistrationRequest[]; count: number; pageSize: number }> {
  const res = await api.get("/students/registration_requests/", {
    params: {
      status: params?.status,
      page: params?.page ?? 1,
      page_size: params?.page_size ?? 50,
    },
  });
  const response = asRecord(res.data) as ListEnvelope;
  const items = asList(response.results);
  const count = typeof response.count === "number" ? response.count : items.length;
  const pageSize = typeof response.page_size === "number" ? response.page_size : 50;
  return {
    data: items.map(mapRegistrationRequest),
    count,
    pageSize,
  };
}

/** 스태프: 가입 신청 승인 */
export async function approveRegistrationRequest(id: number): Promise<ClientStudent> {
  const res = await api.post(`/students/registration_requests/${id}/approve/`);
  return mapStudent(res.data);
}

/** 스태프: 가입 신청 일괄 승인 */
export async function bulkApproveRegistrationRequests(
  requestIds: number[]
): Promise<{ approved: number; failed: Array<{ id: number; detail: string }> }> {
  const res = await api.post("/students/registration_requests/bulk_approve/", { ids: requestIds });
  return res.data as { approved: number; failed: Array<{ id: number; detail: string }> };
}

/** 스태프: 가입 신청 거절 */
export async function rejectRegistrationRequest(id: number): Promise<{ status: string; id: number }> {
  const res = await api.post(`/students/registration_requests/${id}/reject/`);
  return res.data as { status: string; id: number };
}

/** 스태프: 가입 신청 일괄 거절 */
export async function bulkRejectRegistrationRequests(
  requestIds: number[]
): Promise<{ rejected: number }> {
  const res = await api.post("/students/registration_requests/bulk_reject/", { ids: requestIds });
  return res.data as { rejected: number };
}

export type RegistrationRequestSettings = { auto_approve: boolean };

/** 스태프: 가입 신청 설정 조회 (자동 승인 여부) */
export async function fetchRegistrationRequestSettings(): Promise<RegistrationRequestSettings> {
  const res = await api.get("/students/registration_requests/settings/");
  const data = asRecord(res.data);
  return {
    auto_approve: data.auto_approve === true,
  };
}

/** 스태프: 가입 신청 설정 수정 (자동 승인) */
export async function updateRegistrationRequestSettings(
  payload: { auto_approve: boolean }
): Promise<RegistrationRequestSettings> {
  const res = await api.patch("/students/registration_requests/settings/", payload);
  const data = asRecord(res.data);
  return {
    auto_approve: data.auto_approve === true,
  };
}

/** 로그인 전: 학생 가입 신청 제출 (AllowAny, TenantResolved) */
export async function submitRegistrationRequest(form: {
  name: string;
  username?: string;
  initialPassword: string;
  parentPhone: string;
  phone?: string;
  schoolType?: "HIGH" | "MIDDLE" | "ELEMENTARY";
  highSchool?: string;
  middleSchool?: string;
  elementarySchool?: string;
  highSchoolClass?: string;
  major?: string;
  grade?: number | null;
  gender?: string;
  memo?: string;
  address?: string;
  originMiddleSchool?: string;
}): Promise<ClientRegistrationRequest> {
  const payload: Record<string, unknown> = {
    name: String(form.name ?? "").trim(),
    username: String(form.username ?? "").trim() || "",
    initial_password: String(form.initialPassword ?? "").trim(),
    parent_phone: normalizePhone(String(form.parentPhone)),
    school_type: form.schoolType ?? "HIGH",
    high_school: form.highSchool?.trim() || null,
    middle_school: form.middleSchool?.trim() || null,
    elementary_school: form.elementarySchool?.trim() || null,
    high_school_class: form.highSchoolClass?.trim() || null,
    major: form.major?.trim() || null,
    grade: form.grade ?? null,
    gender: form.gender?.trim() || null,
    memo: form.memo?.trim() || null,
    address: form.address?.trim() || null,
    origin_middle_school: form.originMiddleSchool?.trim() || null,
  };
  if (form.phone && normalizePhone(String(form.phone)).length === 11) {
    payload.phone = normalizePhone(String(form.phone));
  }
  const res = await api.post("/students/registration_requests/", payload, SKIP_AUTH_CONFIG);
  return mapRegistrationRequest(res.data);
}

/* ===============================
 * 기존 학생 아이디/비밀번호 알림톡 발송
 * =============================== */

/** 회원가입 실시간 중복검사 (아이디 / 전화번호) */
export type DuplicateCheckResult = {
  username?: { available: boolean; reason?: string };
  phone?: { available: boolean; reason?: string };
};

export async function checkSignupDuplicate(params: {
  username?: string;
  phone?: string;
}): Promise<DuplicateCheckResult> {
  const body: Record<string, string> = {};
  if (params.username?.trim()) body.username = params.username.trim();
  if (params.phone?.trim()) body.phone = normalizePhone(params.phone);
  if (Object.keys(body).length === 0) return {};
  const res = await api.post<DuplicateCheckResult>(
    "/students/registration_requests/check_duplicate/",
    body,
    SKIP_AUTH_CONFIG,
  );
  return res.data;
}

/** 이미 등록된 학생에게 아이디 + 임시 비밀번호를 알림톡으로 발송 */
export async function sendExistingCredentials(params: {
  phone: string;
  name?: string;
}): Promise<{ message: string }> {
  const body: Record<string, string> = {
    phone: normalizePhone(params.phone),
  };
  if (params.name?.trim()) {
    body.name = params.name.trim();
  }
  const res = await api.post<{ message: string }>("/students/send_existing_credentials/", body, SKIP_AUTH_CONFIG);
  return res.data;
}

/** 비밀번호 재설정 발송 (학생: 이름+전화번호, 학부모: 이름+학부모번호 → 임시 비밀번호 알림톡 발송) */
export async function sendPasswordReset(params: {
  target: "student" | "parent";
  student_name: string;
  student_phone?: string;
  student_ps_number?: string;
  parent_phone?: string;
  temp_password?: string;
}): Promise<{ message: string }> {
  const { target, student_name, student_phone, student_ps_number, parent_phone, temp_password } = params;
  const body: Record<string, string | boolean> = {
    target,
    student_name: student_name.trim(),
  };
  if (target === "student" && student_phone != null) {
    body.student_phone = normalizePhone(String(student_phone));
  }
  if (target === "student" && student_ps_number != null) {
    body.student_ps_number = String(student_ps_number).trim();
  }
  if (target === "parent" && parent_phone != null) {
    body.parent_phone = normalizePhone(String(parent_phone));
  }
  if (temp_password?.trim()) {
    body.temp_password = temp_password.trim();
  }
  const res = await api.post<{ message: string }>("/students/password_reset_send/", body);
  return res.data;
}

/* ===============================
 * TAG
 * =============================== */

export async function getTags(): Promise<StudentTag[]> {
  const res = await api.get(`/students/tags/`);
  return asList(res.data).map(mapTag);
}

export async function createTag(name: string, color: string): Promise<StudentTag> {
  const res = await api.post(`/students/tags/`, { name: name.trim(), color });
  return mapTag(res.data);
}

export async function attachStudentTag(studentId: number, tagId: number) {
  await api.post(`/students/${studentId}/add_tag/`, { tag_id: tagId });
}

export async function detachStudentTag(studentId: number, tagId: number) {
  await api.post(`/students/${studentId}/remove_tag/`, { tag_id: tagId });
}

/* ===============================
 * MEMO
 * =============================== */

export async function createMemo(studentId: number, content: string) {
  await api.patch(`/students/${studentId}/`, { memo: String(content ?? "") });
}
