import { createAuthSessionBoundConfig, type ApiRequestConfig } from "@/shared/api/axios";
import { setHomeworkAcceptance, type HomeworkSubmissionMediaFile } from "@/shared/api/contracts/staffHomeworkFiles";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { extractApiError } from "@/shared/utils/extractApiError";

export type ReviewRow = {
  enrollment_id: number;
  student_id?: number | null;
  student_name: string;
  teacher_accepted: boolean | null;
  teacher_accepted_updated_at: string | null;
  media_set_fingerprint: string | null;
  files: HomeworkSubmissionMediaFile[];
};

export function canSelect(row: ReviewRow): row is ReviewRow & { media_set_fingerprint: string } {
  const current = row.files.filter(file => !file.removed_at && file.status !== "removed");
  return row.enrollment_id > 0 && row.teacher_accepted === false && !!row.media_set_fingerprint
    && current.length > 0 && current.every(file => file.status === "uploaded");
}

export function batchSession() {
  const generation = readAuthTokenEnvelopeSafely()?.generation;
  const tenant = getTenantCodeForApiRequest();
  if (!generation || !tenant) throw new Error("로그인과 학원 정보를 확인해 주세요.");
  return createAuthSessionBoundConfig(generation, undefined, tenant);
}

export async function saveHomeworkBatch<T extends { homeworkId: number; row: ReviewRow & { media_set_fingerprint: string } }>(
  selected: T[], config: ApiRequestConfig,
) {
  const completed: T[] = [];
  const failed: { item: T; reason: string }[] = [];
  let cursor = 0;
  async function saveRows() {
    while (cursor < selected.length) {
      const item = selected[cursor++];
      const { row, homeworkId } = item;
      try {
        await setHomeworkAcceptance(homeworkId, row.enrollment_id, true,
          row.teacher_accepted_updated_at, row.media_set_fingerprint, config);
        completed.push(item);
      } catch (error) {
        failed.push({ item, reason: extractApiError(error, "저장하지 못했습니다. 다시 시도해 주세요.") });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, selected.length) }, saveRows));
  return { completed, failed };
}
