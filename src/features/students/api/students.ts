// src/features/students/api/students.ts

import api from "@/shared/api/axios";

/* ===============================
 * Types
 * =============================== */

export interface ClientStudent {
  id: number;
  name: string;

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

  tags: {
    id: number;
    name: string;
    color: string;
  }[];

  enrollments: {
    id: number;
    lectureName: string | null;
  }[];
}

/* ===============================
 * Mapper
 * =============================== */

function mapStudent(item: any): ClientStudent {
  const schoolType: "MIDDLE" | "HIGH" | null =
    item.school_type ??
    (item.middle_school ? "MIDDLE" : item.high_school ? "HIGH" : null);

  return {
    id: item.id,
    name: item.name,

    studentPhone: item.phone ?? null,
    parentPhone: item.parent_phone ?? null,

    school: item.high_school ?? item.middle_school ?? null,
    schoolClass: item.high_school_class ?? null,
    major: item.major ?? null,

    grade: item.grade ?? null,
    gender: item.gender ?? null,

    registeredAt: item.created_at ?? null,
    active: item.is_managed ?? false,
    memo: item.memo ?? null,

    schoolType,

    tags: (item.tags ?? []).map((t: any) => ({
      id: t.id,
      name: t.name,
      color: t.color,
    })),

    enrollments: (item.enrollments ?? []).map((en: any) => ({
      id: en.id,
      lectureName: en.lecture_name ?? null,
    })),
  };
}

/* ===============================
 * List / Detail
 * =============================== */

export async function fetchStudents(search: string, filters: any = {}) {
  const params = {
    search: search || undefined,
    ...filters,
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
  const schoolType =
    form.schoolType === "MIDDLE" || form.schoolType === "HIGH"
      ? form.schoolType
      : "HIGH";

  const payload = {
    name: form.name,
    phone: form.studentPhone,
    initial_password: form.initialPassword,

    parent_phone: form.parentPhone || null,

    school_type: schoolType,
    high_school: schoolType === "HIGH" ? form.school || null : null,
    middle_school: schoolType === "MIDDLE" ? form.school || null : null,

    high_school_class:
      schoolType === "HIGH" ? form.schoolClass || null : null,

    major: schoolType === "HIGH" ? form.major || null : null,

    grade: form.grade ? Number(form.grade) : null,
    gender: form.gender || null,
    memo: form.memo || null,

    is_managed: !!form.active,
  };

  const res = await api.post("/students/", payload);
  return mapStudent(res.data);
}

/* ===============================
 * UPDATE
 * =============================== */

export async function updateStudent(id: number, form: any) {
  const payload = {
    ...form,
    grade: form.grade ? Number(form.grade) : null,
    is_managed: !!form.active,
  };

  const res = await api.patch(`/students/${id}/`, payload);
  return mapStudent(res.data);
}

/* ===============================
 * 🔥 TOGGLE ACTIVE (문제의 핵심)
 * =============================== */

export async function toggleStudentActive(
  id: number,
  nextActive: boolean
) {
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

export async function getTags() {
  const res = await api.get(`/students/tags/`);
  return res.data;
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
  await api.patch(`/students/${studentId}/`, { memo: content });
}
