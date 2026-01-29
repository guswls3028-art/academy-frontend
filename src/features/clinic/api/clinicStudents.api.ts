// PATH: src/features/clinic/api/clinicStudents.api.ts
import api from "@/shared/api/axios";

export type ClinicStudent = {
  id: number;
  name: string;
};

function normalize(resData: any): ClinicStudent[] {
  const arr = Array.isArray(resData)
    ? resData
    : Array.isArray(resData?.results)
    ? resData.results
    : [];
  return arr.map((s: any) => ({ id: s.id, name: s.name })) as ClinicStudent[];
}

// ✅ 학생 검색 (2글자 이상일 때 사용)
export async function searchClinicStudents(params: { q: string }) {
  const res = await api.get("/students/", {
    params: { search: params.q },
  });
  return normalize(res.data);
}

// ✅ 전체 학생 "초기 목록" (첫 페이지)
export async function fetchClinicStudentsDefault() {
  const res = await api.get("/students/");
  return normalize(res.data);
}
