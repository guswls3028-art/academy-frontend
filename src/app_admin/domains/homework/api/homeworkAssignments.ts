// PATH: src/app_admin/domains/homework/api/homeworkAssignments.ts
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
  profile_photo_url?: string | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  parent_phone?: string | null;
  student_phone?: string | null;
  school?: string | null;
  grade?: number | null;
};

export type HomeworkAssignmentsResponse = {
  items: HomeworkAssignmentItem[];
  selected_ids: number[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asOptionalString(value: unknown): string | null | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumberOrNull(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeItems(raw: unknown): HomeworkAssignmentItem[] {
  const record = asRecord(raw);
  const list = Array.isArray(record.items) ? record.items : [];
  return list.map((item) => {
    const itemRecord = asRecord(item);
    return {
      enrollment_id: Number(itemRecord.enrollment_id),
      student_name: String(itemRecord.student_name ?? ""),
      is_selected: Boolean(itemRecord.is_selected),
      profile_photo_url: asOptionalString(itemRecord.profile_photo_url),
      lecture_title: asOptionalString(itemRecord.lecture_title),
      lecture_color: asOptionalString(itemRecord.lecture_color),
      lecture_chip_label: asOptionalString(itemRecord.lecture_chip_label),
      parent_phone: asNullableString(itemRecord.parent_phone),
      student_phone: asNullableString(itemRecord.student_phone),
      school: asNullableString(itemRecord.school),
      grade: asNumberOrNull(itemRecord.grade),
    };
  });
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
