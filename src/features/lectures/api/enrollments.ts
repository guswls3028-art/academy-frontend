import api from "@/shared/api/axios";

export async function fetchLectureEnrollments(lectureId: number) {
  const res = await api.get("/enrollments/", {
    params: { lecture: lectureId },
  });

  return Array.isArray(res.data) ? res.data : res.data.results;
}

export async function bulkCreateEnrollments(
  lectureId: number,
  studentIds: number[]
) {
  const res = await api.post("/enrollments/bulk_create/", {
    lecture: lectureId,
    students: studentIds,
  });
  return res.data;
}
