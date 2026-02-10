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
}

export interface ClientStudent {
  id: number;
  name: string;

  psNumber: string;
  omrCode: string;

  studentPhone: string | null;
  parentPhone: string | null;

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

    psNumber: safeStr(item?.ps_number),
    omrCode: safeStr(omrCode),

    studentPhone: displayPhone ?? null,
    parentPhone: item?.parent_phone ?? null,

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
        }))
      : [],
  };
}

/* ===============================
 * Ordering (server-side friendly)
 * =============================== */

const ORDERING_MAP: Record<string, string> = {
  name: "name",
  registeredAt: "created_at",
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
  sort: string = ""
) {
  const ordering = buildOrdering(sort);

  const params: any = {
    search: search || undefined,
    ...filters,
    ordering: ordering || undefined,
  };

  const res = await api.get("/students/", { params });

  const items = Array.isArray(res.data?.results)
    ? res.data.results
    : Array.isArray(res.data)
    ? res.data
    : [];

  return items.map(mapStudent);
}

export async function getStudentDetail(id: number) {
  const res = await api.get(`/students/${id}/`);
  return mapStudent(res.data);
}

/* ===============================
 * CREATE
 * =============================== */

export async function createStudent(form: any) {
  const name = safeStr(form?.name).trim();
  const psNumber = safeStr(form?.psNumber).trim();
  const initialPassword = safeStr(form?.initialPassword).trim();

  const omrCodeInput = safeStr(form?.omrCode).trim();
  const studentPhoneInput = safeStr(form?.studentPhone).trim();
  const parentPhoneInput = safeStr(form?.parentPhone).trim();

  const phone = form?.noPhone === true ? `010${omrCodeInput}` : studentPhoneInput;

  const payload = {
    name,
    ps_number: psNumber,
    phone,
    omr_code: safeStr(phone).slice(-8),
    initial_password: initialPassword,

    parent_phone: parentPhoneInput,

    school_type: form?.schoolType,
    high_school: form?.schoolType === "HIGH" ? form?.school || null : null,
    middle_school: form?.schoolType === "MIDDLE" ? form?.school || null : null,

    high_school_class: form?.schoolType === "HIGH" ? form?.schoolClass || null : null,

    major: form?.schoolType === "HIGH" ? form?.major || null : null,

    grade: form?.grade ? Number(form.grade) : null,
    gender: form?.gender || null,
    memo: form?.memo || null,

    is_managed: !!form?.active,
  };

  const res = await api.post("/students/", payload);
  return mapStudent(res.data);
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
