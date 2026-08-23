import studentApi from "@student/shared/api/student.api";


export type HomeworkMediaStatus = "uploading" | "uploaded" | "failed" | "removed" | string;

export type HomeworkMediaFile = {
  id: string;
  legacy: boolean;
  client_file_id: string | null;
  upload_batch_id: string | null;
  position: number;
  original_filename: string;
  media_kind: "image" | "video";
  mime_type: string;
  file_size: number;
  status: HomeworkMediaStatus;
  error_message: string;
  upload_started_at: string | null;
  uploaded_at: string | null;
  failed_at: string | null;
  removed_at: string | null;
  created_at: string | null;
  deduplicated?: boolean;
};

export type HomeworkMediaLimits = {
  max_files: number;
  max_file_size_bytes: number;
  max_total_size_bytes: number;
};

export type HomeworkMediaCollection = {
  files: HomeworkMediaFile[];
  limits: HomeworkMediaLimits;
};

const DEFAULT_LIMITS: HomeworkMediaLimits = {
  max_files: 20,
  max_file_size_bytes: 100 * 1024 * 1024,
  max_total_size_bytes: 500 * 1024 * 1024,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeCollection(value: unknown): HomeworkMediaCollection {
  const record = asRecord(value);
  const limits = asRecord(record.limits);
  return {
    files: Array.isArray(record.files) ? record.files as HomeworkMediaFile[] : [],
    limits: {
      max_files: Number(limits.max_files) || DEFAULT_LIMITS.max_files,
      max_file_size_bytes: Number(limits.max_file_size_bytes) || DEFAULT_LIMITS.max_file_size_bytes,
      max_total_size_bytes: Number(limits.max_total_size_bytes) || DEFAULT_LIMITS.max_total_size_bytes,
    },
  };
}

export async function fetchHomeworkMedia(
  homeworkId: number,
  enrollmentId: number,
): Promise<HomeworkMediaCollection> {
  const response = await studentApi.get<HomeworkMediaCollection>(
    `/submissions/submissions/homework/${homeworkId}/media/`,
    { params: { enrollment_id: enrollmentId } },
  );
  return normalizeCollection(response.data);
}

export async function removeHomeworkMedia(
  homeworkId: number,
  enrollmentId: number,
  mediaId: string,
): Promise<void> {
  await studentApi.delete(
    `/submissions/submissions/homework/${homeworkId}/media/${encodeURIComponent(mediaId)}/`,
    { data: { enrollment_id: enrollmentId } },
  );
}

export async function fetchHomeworkMediaPreview(
  homeworkId: number,
  mediaId: string,
): Promise<{ url: string }> {
  const response = await studentApi.get<{ url: string }>(
    `/submissions/submissions/homework/${homeworkId}/media/${encodeURIComponent(mediaId)}/preview/`,
  );
  return response.data;
}
