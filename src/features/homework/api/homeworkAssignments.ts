// PATH: src/features/homework/api/homeworkAssignments.ts
/**
 * Homework Assignments API
 *
 * 단일 진실:
 * - GET  /homework/assignments/?homework_id=
 * - PUT  /homework/assignments/?homework_id=  { enrollment_ids: number[] }
 *
 * 응답 가정(현재 너 코드 기준):
 * - res.data.items: Array<{ enrollment_id, student_name, is_selected }>
 */

import api from "@/shared/api/axios";

export type HomeworkAssignmentItem = {
  enrollment_id: number;
  student_name: string;
  is_selected: boolean;
};

export type HomeworkAssignmentsResponse = {
  items: HomeworkAssignmentItem[];
  selected_ids: number[];
};

function normalizeItems(raw: any): HomeworkAssignmentItem[] {
  const list = Array.isArray(raw?.items) ? raw.items : [];
  return list.map((r: any) => ({
    enrollment_id: Number(r?.enrollment_id),
    student_name: String(r?.student_name ?? ""),
    is_selected: Boolean(r?.is_selected),
  }));
}

export async function fetchHomeworkAssignments(
  homeworkId: number
): Promise<HomeworkAssignmentsResponse> {
  const hid = Number(homeworkId);
  if (!Number.isFinite(hid) || hid <= 0) {
    return { items: [], selected_ids: [] };
  }

  const res = await api.get("/homework/assignments/", {
    params: { homework_id: hid },
  });

  const items = normalizeItems(res.data);
  const selected_ids = items
    .filter((x) => x.is_selected)
    .map((x) => x.enrollment_id);

  return { items, selected_ids };
}

export async function putHomeworkAssignments(params: {
  homeworkId: number;
  enrollment_ids: number[];
}): Promise<void> {
  const hid = Number(params.homeworkId);
  await api.put(
    "/homework/assignments/",
    { enrollment_ids: params.enrollment_ids },
    { params: { homework_id: hid } }
  );
}
