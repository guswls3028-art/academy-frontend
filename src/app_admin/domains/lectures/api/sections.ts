// PATH: src/app_admin/domains/lectures/api/sections.ts
import api from "@/shared/api/axios";

// ----------------------------------------
// TYPES
// ----------------------------------------
export interface Section {
  id: number;
  tenant: number;
  lecture: number;
  label: string;
  section_type: "CLASS" | "CLINIC";
  section_type_display: string;
  day_of_week: number;
  day_of_week_display: string;
  start_time: string;
  end_time: string | null;
  location: string;
  max_capacity: number | null;
  is_active: boolean;
  assignment_count: number;
  created_at: string;
  updated_at: string;
}

export interface SectionAssignment {
  id: number;
  tenant: number;
  enrollment: number;
  class_section: number;
  clinic_section: number | null;
  source: "SELF" | "AUTO" | "MANUAL";
  source_display: string;
  student_name: string;
  student_id: number;
  lecture_id: number;
  class_section_label: string;
  clinic_section_label: string | null;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------
// SECTION CRUD
// ----------------------------------------
export async function fetchSections(lectureId: number): Promise<Section[]> {
  const res = await api.get("/lectures/sections/", { params: { lecture: lectureId } });
  const data = res.data;
  return Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
}

/** 전체 반 목록 (section_type 필터 가능) — 클리닉 등 cross-lecture 페이지용 */
export async function fetchAllSections(params?: {
  section_type?: "CLASS" | "CLINIC";
}): Promise<Section[]> {
  const res = await api.get("/lectures/sections/", { params });
  const data = res.data;
  return Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
}

export async function createSection(payload: {
  lecture: number;
  label: string;
  section_type: "CLASS" | "CLINIC";
  day_of_week: number;
  start_time: string;
  end_time?: string | null;
  location?: string;
  max_capacity?: number | null;
}): Promise<Section> {
  const res = await api.post("/lectures/sections/", payload);
  return res.data;
}

export async function updateSection(
  sectionId: number,
  payload: Partial<Omit<Section, "id" | "tenant" | "created_at" | "updated_at">>,
): Promise<Section> {
  const res = await api.patch(`/lectures/sections/${sectionId}/`, payload);
  return res.data;
}

export async function deleteSection(sectionId: number): Promise<void> {
  await api.delete(`/lectures/sections/${sectionId}/`);
}

// ----------------------------------------
// SECTION ASSIGNMENT
// ----------------------------------------
export async function fetchSectionAssignments(lectureId: number): Promise<SectionAssignment[]> {
  const res = await api.get("/lectures/section-assignments/", {
    params: { enrollment__lecture: lectureId },
  });
  const data = res.data;
  return Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
}

export async function autoAssignSections(
  lectureId: number,
  sectionType: "CLASS" | "CLINIC" = "CLASS",
): Promise<{ message: string; assigned: number }> {
  const res = await api.post("/lectures/section-assignments/auto-assign/", {
    lecture_id: lectureId,
    section_type: sectionType,
  });
  return res.data;
}

// ----------------------------------------
// BULK SESSION CREATE
// ----------------------------------------
export async function bulkCreateSessions(payload: {
  lecture_id: number;
  title: string;
  dates: Record<string, string>;
}): Promise<unknown[]> {
  const res = await api.post("/lectures/sections/bulk-create-sessions/", payload);
  return res.data;
}
