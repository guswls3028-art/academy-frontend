import studentApi from "@student/shared/api/student.api";
import type { HomeworkDraftFile } from "@/shared/storage/homeworkDraftStorage";

/** Slow uploads may continue while bytes advance; stalled requests are bounded. */
export async function uploadHomeworkFile(
  target: { id: number; enrollmentId: number },
  item: HomeworkDraftFile,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
): Promise<void> {
  const controller = new AbortController();
  let stalled = false;
  let loaded = 0;
  let idle: ReturnType<typeof setTimeout>;
  const abort = () => controller.abort();
  const resetIdle = () => {
    clearTimeout(idle);
    idle = setTimeout(() => { stalled = true; controller.abort(); }, 120_000);
  };
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  resetIdle();
  const body = new FormData();
  body.append("enrollment_id", String(target.enrollmentId));
  body.append("client_file_id", item.clientFileId);
  body.append("upload_batch_id", item.uploadBatchId);
  body.append("position", String(item.position));
  body.append("file", item.file);
  try {
    await studentApi.post(`/submissions/submissions/homework/${target.id}/media/`, body, {
      timeout: 30 * 60_000,
      signal: controller.signal,
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (event.loaded > loaded) { loaded = event.loaded; resetIdle(); }
        if (event.total) onProgress(Math.min(100, Math.round(event.loaded / event.total * 100)));
      },
    });
  } catch (error) {
    if (stalled) throw new Error("전송이 오래 멈춰 잠시 중단했습니다. 연결을 확인한 뒤 이어서 제출해 주세요.");
    throw error;
  } finally {
    clearTimeout(idle!);
    signal.removeEventListener("abort", abort);
  }
}
