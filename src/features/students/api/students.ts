// PATH: src/features/students/api/students.ts
import api from "@/shared/api/axios";

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
  lectureName: string | null;
  lectureColor: string | null;
}

export interface ClientStudent {
  id: number;
  name: string;
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

  grade: number | null;
  gender: string | null;

  registeredAt: string | null;
  active: boolean;
  memo?: string | null;

  schoolType: "MIDDLE" | "HIGH" | null;

  tags: ClientStudentTag[];
  enrollments: ClientEnrollmentLite[];
  deletedAt?: string | null;
}

export interface StudentTag {
  id: number;
  name: string;
  color: string;
}

/* ===============================
 * Mapper
 * =============================== */

function safeStr(v: any): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function mapStudent(item: any): ClientStudent {
  const phone = item?.phone ?? null;
  const omrCode = item?.omr_code ?? "";

  // 🔧 변경: UI에는 항상 phone만 전달
  const displayPhone = phone ?? null;

  const schoolType: "MIDDLE" | "HIGH" | null =
    item?.school_type ??
    (item?.middle_school ? "MIDDLE" : item?.high_school ? "HIGH" : null);

  return {
    id: Number(item?.id),
    name: safeStr(item?.name),
    profilePhotoUrl: item?.profile_photo_url ?? null,

    psNumber: safeStr(item?.ps_number),
    omrCode: safeStr(omrCode),

    studentPhone: displayPhone ?? null,
    parentPhone: item?.parent_phone ?? null,
    usesIdentifier: !!item?.uses_identifier,

    school: item?.high_school ?? item?.middle_school ?? null,
    schoolClass: item?.high_school_class ?? null,
    major: item?.major ?? null,

    grade: item?.grade ?? null,
    gender: item?.gender ?? null,

    registeredAt: item?.created_at ?? null,
    active: item?.is_managed ?? false,
    memo: item?.memo ?? null,

    schoolType,

    tags: Array.isArray(item?.tags)
      ? item.tags.map((t: any) => ({
          id: Number(t?.id),
          name: safeStr(t?.name),
          color: safeStr(t?.color),
        }))
      : [],

    enrollments: Array.isArray(item?.enrollments)
      ? item.enrollments.map((en: any) => ({
          id: Number(en?.id),
          lectureName: en?.lecture_name ?? null,
          lectureColor: en?.lecture_color ?? "#3b82f6",
          lectureChipLabel: en?.lecture_chip_label ?? null,
        }))
      : [],
    deletedAt: item?.deleted_at ?? null,
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
  filters: any = {},
  sort: string = "",
  page: number = 1,
  deleted: boolean = false
): Promise<{ data: ReturnType<typeof mapStudent>[]; count: number }> {
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

  const res = await api.get("/students/", { params: params as any });

  const items = Array.isArray(res.data?.results)
    ? res.data.results
    : Array.isArray(res.data)
    ? res.data
    : [];
  const count = typeof res.data?.count === "number" ? res.data.count : items.length;
  const pageSize = typeof res.data?.page_size === "number" ? res.data.page_size : 50;

  return {
    data: items.map(mapStudent),
    count,
    pageSize,
  };
}

export async function getStudentDetail(id: number) {
  const res = await api.get(`/students/${id}/`);
  return mapStudent(res.data);
}

/* ===============================
 * CREATE
 * =============================== */

/** 전화번호를 백엔드 스펙(정규화: 숫자만 11자리)으로 정규화 */
function normalizePhone(v: string): string {
  return String(v ?? "").replace(/\D/g, "").slice(0, 11);
}

export async function createStudent(form: any) {
  const name = safeStr(form?.name).trim();
  const initialPassword = safeStr(form?.initialPassword).trim();

  const studentPhoneRaw = safeStr(form?.studentPhone).trim();
  const parentPhoneRaw = safeStr(form?.parentPhone).trim();
  const parentPhone = normalizePhone(parentPhoneRaw);
  const noPhone = !studentPhoneRaw;

  const phone = noPhone
    ? (parentPhone.length >= 8 ? `010${parentPhone.slice(-8)}` : "")
    : normalizePhone(studentPhoneRaw);

  const payload: Record<string, unknown> = {
    name,
    initial_password: initialPassword,
    parent_phone: parentPhone,
    school_type: form?.schoolType ?? "HIGH",
    high_school: form?.schoolType === "HIGH" ? (form?.school?.trim() || null) : null,
    middle_school: form?.schoolType === "MIDDLE" ? (form?.school?.trim() || null) : null,
    high_school_class: form?.schoolType === "HIGH" ? (form?.schoolClass?.trim() || null) : null,
    major: form?.schoolType === "HIGH" ? (form?.major?.trim() || null) : null,
    grade: form?.grade ? Number(form.grade) : null,
    gender: form?.gender || null,
    memo: form?.memo?.trim() || null,
    is_managed: !!form?.active,
    send_welcome_message: !!form?.sendWelcomeMessage,
    no_phone: noPhone,
  };

  if (phone) {
    (payload as any).phone = phone;
    (payload as any).omr_code = phone.slice(-8);
  }

  const psNumber = safeStr(form?.psNumber).trim();
  if (psNumber) (payload as any).ps_number = psNumber;

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
    schoolType?: "HIGH" | "MIDDLE";
    school?: string | null;
    grade?: number | null;
    schoolClass?: string | null;
    major?: string | null;
    memo?: string | null;
  }>,
  sendWelcomeMessage = false
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
  initialPassword: string
): Promise<{ job_id: string; status: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("initial_password", initialPassword);
  const res = await api.post("/students/bulk_create_from_excel/", form, {
    headers: { "Content-Type": undefined } as Record<string, unknown>,
  });
  return res.data as { job_id: string; status: string };
}

/* ===============================
 * UPDATE
 * =============================== */

export async function updateStudent(id: number, form: any) {
  const payload: any = {
    grade: form?.grade ? Number(form.grade) : null,
    gender: form?.gender ?? null,
    memo: form?.memo ?? null,
    is_managed: !!form?.active,
  };

  if (form?.parentPhone !== undefined) {
    payload.parent_phone = safeStr(form?.parentPhone).trim();
  }

  const phone =
    form?.noPhone === true
      ? `010${safeStr(form?.omrCode).trim()}`
      : form?.studentPhone
      ? safeStr(form?.studentPhone).trim()
      : undefined;

  if (phone) {
    payload.phone = phone;
    payload.omr_code = safeStr(phone).slice(-8);
  }

  if (form?.psNumber !== undefined) {
    payload.ps_number = safeStr(form?.psNumber).trim();
  }

  if (form?.schoolType) {
    payload.school_type = form.schoolType;
    payload.high_school = form.schoolType === "HIGH" ? form?.school || null : null;
    payload.middle_school = form.schoolType === "MIDDLE" ? form?.school || null : null;
    payload.high_school_class =
      form.schoolType === "HIGH" ? form?.schoolClass || null : null;
    payload.major = form.schoolType === "HIGH" ? form?.major || null : null;
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
export async function bulkDeleteStudents(ids: number[]) {
  const res = await api.post("/students/bulk_delete/", { ids });
  return res.data as { deleted: number };
}

/** 삭제된 학생 일괄 복원 */
export async function bulkRestoreStudents(ids: number[]) {
  const res = await api.post("/students/bulk_restore/", { ids });
  return res.data as { restored: number };
}

/** 삭제된 학생 즉시 영구 삭제 */
export async function bulkPermanentDeleteStudents(ids: number[]) {
  const res = await api.post("/students/bulk_permanent_delete/", { ids });
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

/** 충돌 해결 후 재등록 (삭제된 학생과 번호 충돌 시 복원 또는 영구 삭제 후 재등록) */
export async function bulkResolveConflicts(
  password: string,
  resolutions: Array<{
    row: number;
    student_id: number;
    action: "restore" | "delete";
    student_data: Record<string, unknown>;
  }>,
  sendWelcomeMessage = false
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
 * TAG
 * =============================== */

export async function getTags(): Promise<StudentTag[]> {
  const res = await api.get(`/students/tags/`);
  const items = Array.isArray(res.data?.results)
    ? res.data.results
    : Array.isArray(res.data)
    ? res.data
    : [];
  return items.map((t: any) => ({
    id: Number(t?.id),
    name: safeStr(t?.name),
    color: safeStr(t?.color),
  }));
}

export async function createTag(name: string, color: string): Promise<StudentTag> {
  const res = await api.post(`/students/tags/`, { name: name.trim(), color });
  const t = res.data;
  return {
    id: Number(t?.id),
    name: safeStr(t?.name),
    color: safeStr(t?.color),
  };
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
