import api, { type ApiRequestConfig } from "@/shared/api/axios";

import type { components } from "@/shared/api/generated/schema";

export type HomeworkSubmissionMediaFile = {
  id: string;
  legacy: boolean;
  position: number;
  original_filename: string;
  media_kind: "image" | "video";
  mime_type: string;
  file_size: number;
  status: string;
  error_message: string;
  uploaded_at: string | null;
  failed_at: string | null;
  removed_at: string | null;
  created_at: string | null;
};

export type HomeworkMediaPreview = {
  url: string;
  media_kind: "image" | "video";
  mime_type: string;
  original_filename: string;
  expires_in: number;
};

export async function fetchHomeworkMediaPreview(
  homeworkId: number,
  mediaId: string,
): Promise<HomeworkMediaPreview> {
  const res = await api.get<HomeworkMediaPreview>(
    `/submissions/submissions/homework/${homeworkId}/media/${encodeURIComponent(mediaId)}/preview/`,
  );
  return res.data;
}

type StudentHomeworkPage = components["schemas"]["StudentHomeworkFilesPage"];

export async function fetchStudentHomeworkFiles(studentId: number, page: number, signal: AbortSignal) {
  const { data } = await api.get<StudentHomeworkPage>(`/submissions/submissions/students/${studentId}/homework/`, {
    params: { page, page_size: 12 }, signal,
  });
  if (!Array.isArray(data?.results) || !Number.isInteger(data.count) || data.count < 0
    || !data.results.every(row => row && Array.isArray(row.files))) {
    throw new Error("학생 제출물 목록을 확인할 수 없습니다.");
  }
  return data;
}

export async function setHomeworkAcceptance(homeworkId: number, enrollmentId: number, accepted: boolean,
  expectedUpdatedAt: string | null, fingerprint: string, config?: ApiRequestConfig) {
  const { data } = await api.patch<components["schemas"]["HomeworkFileAcceptance"]>(`/submissions/submissions/homework/${homeworkId}/acceptance/`, {
    enrollment_id: enrollmentId, accepted, expected_updated_at: expectedUpdatedAt,
    expected_media_set_fingerprint: fingerprint,
  } satisfies Required<components["schemas"]["PatchedHomeworkFileAcceptanceUpdateRequest"]>, config);
  if (data?.teacher_accepted !== accepted) throw new Error("저장한 통과 판정을 확인할 수 없습니다. 최신 상태를 확인해 주세요.");
}
