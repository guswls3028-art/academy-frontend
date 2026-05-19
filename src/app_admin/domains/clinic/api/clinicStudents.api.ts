// PATH: src/app_admin/domains/clinic/api/clinicStudents.api.ts
import api from "@/shared/api/axios";

export type ClinicStudentLecture = {
  lectureName: string;
  color?: string | null;
  chipLabel?: string | null;
};

export type ClinicStudent = {
  id: number;
  name: string;
  parent_phone: string;
  student_phone: string;
  school: string;
  grade: number | null;
  school_type: string;
  profile_photo_url: string | null;
  lectures: ClinicStudentLecture[];
};

export type ClinicStudentPage = {
  data: ClinicStudent[];
  count: number;
};

type ApiRecord = Record<string, unknown>;

function asRecord(value: unknown): ApiRecord {
  return value !== null && typeof value === "object" ? value as ApiRecord : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function asId(value: unknown): number {
  return typeof value === "number" ? value : Number(value) || 0;
}

function normalizeOne(raw: unknown): ClinicStudent {
  const s = asRecord(raw);
  const enrollments = Array.isArray(s.enrollments) ? s.enrollments.map(asRecord) : [];
  const lectures: ClinicStudentLecture[] = enrollments
    .filter((e) => e.status === "ACTIVE")
    .map((e) => ({
      lectureName: asString(e.lecture_name),
      color: asString(e.lecture_color, "") || null,
      chipLabel: asString(e.lecture_chip_label, "") || null,
    }));

  const schoolType = asString(s.school_type, "HIGH");
  const school = schoolType === "HIGH"
    ? asString(s.high_school)
    : schoolType === "ELEMENTARY"
    ? asString(s.elementary_school)
    : asString(s.middle_school);

  return {
    id: asId(s.id),
    name: asString(s.name),
    parent_phone: asString(s.parent_phone),
    student_phone: asString(s.phone),
    school,
    grade: asNumberOrNull(s.grade),
    school_type: schoolType,
    profile_photo_url: asString(s.profile_photo_url, "") || null,
    lectures,
  };
}

function normalize(resData: unknown): ClinicStudent[] {
  const response = asRecord(resData);
  const arr = Array.isArray(resData)
    ? resData
    : Array.isArray(response.results)
    ? response.results
    : [];
  return arr.map(normalizeOne);
}

/** 페이지네이션 대응 — { data, count } 반환 */
export async function fetchClinicStudentsPaginated(params: {
  page?: number;
  page_size?: number;
  search?: string;
}): Promise<ClinicStudentPage> {
  const res = await api.get("/students/", { params });
  const resData: unknown = res.data;
  const response = asRecord(resData);
  // DRF paginated: { count, results }
  if (Array.isArray(response.results) && typeof response.count === "number") {
    return { data: response.results.map(normalizeOne), count: response.count };
  }
  // non-paginated fallback
  const arr = Array.isArray(resData) ? resData : [];
  return { data: arr.map(normalizeOne), count: arr.length };
}

// ✅ 학생 검색 (2글자 이상일 때 사용) — 페이지네이션 대응
export async function searchClinicStudents(params: { q: string }) {
  const res = await api.get("/students/", {
    params: { search: params.q },
  });
  return normalize(res.data);
}

// ✅ 전체 학생 "초기 목록" (첫 페이지) — legacy (ClinicTargetSelectModal에서는 paginated 사용)
export async function fetchClinicStudentsDefault() {
  const res = await api.get("/students/");
  return normalize(res.data);
}
