// PATH: src/features/clinic/api/clinicStudents.api.ts
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

function normalizeOne(s: any): ClinicStudent {
  const enrollments: any[] = Array.isArray(s.enrollments) ? s.enrollments : [];
  const lectures: ClinicStudentLecture[] = enrollments
    .filter((e: any) => e.status === "ACTIVE")
    .map((e: any) => ({
      lectureName: e.lecture_name || "",
      color: e.lecture_color ?? null,
      chipLabel: e.lecture_chip_label ?? null,
    }));

  const schoolType = s.school_type || "HIGH";
  const school = schoolType === "HIGH"
    ? (s.high_school || "")
    : schoolType === "ELEMENTARY"
    ? (s.elementary_school || "")
    : (s.middle_school || "");

  return {
    id: s.id,
    name: s.name || "",
    parent_phone: s.parent_phone || "",
    student_phone: s.phone || "",
    school,
    grade: s.grade ?? null,
    school_type: schoolType,
    profile_photo_url: s.profile_photo_url ?? null,
    lectures,
  };
}

function normalize(resData: any): ClinicStudent[] {
  const arr = Array.isArray(resData)
    ? resData
    : Array.isArray(resData?.results)
    ? resData.results
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
  const resData = res.data;
  // DRF paginated: { count, results }
  if (resData?.results && typeof resData.count === "number") {
    return { data: resData.results.map(normalizeOne), count: resData.count };
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
