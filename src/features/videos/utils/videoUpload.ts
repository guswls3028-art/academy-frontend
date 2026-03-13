// PATH: src/features/videos/utils/videoUpload.ts
// 영상 업로드 유틸리티 — 모달 밖에서 실행되어 작업 박스에서 진행률 표시

import api from "@/shared/api/axios";
import { asyncStatusStore } from "@/shared/ui/asyncStatus";

type UploadInitResponse = {
  video: { id: number };
  upload_url: string;
  file_key: string;
  content_type?: string;
};

export interface VideoUploadParams {
  sessionId: number;
  file: File;
  title: string;
  description?: string;
  showWatermark: boolean;
  allowSkip: boolean;
  maxSpeed: number;
}

export interface InitVideoResult {
  videoId: number;
  uploadUrl: string;
  putHeaders: Record<string, string>;
  tempId: string;
  contentType: string;
}

/**
 * 업로드 init만 수행 — DB에 영상 row 생성, 목록에 바로 표시 가능
 */
export async function initVideoUpload(params: VideoUploadParams): Promise<InitVideoResult> {
  const { sessionId, file, title, description, showWatermark, allowSkip, maxSpeed } = params;

  const initPayload = {
    session: sessionId,
    title: title.trim(),
    filename: file.name,
    content_type: file.type || "video/mp4",
    show_watermark: showWatermark,
    allow_skip: allowSkip,
    max_speed: maxSpeed,
    ...(description?.trim() ? { description: description.trim() } : {}),
  };

  const tempId = `video-upload-${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  asyncStatusStore.addTask("영상 추가", tempId);

  const initRes = await api.post<UploadInitResponse>("/media/videos/upload/init/", initPayload, {
    timeout: 60_000,
  });

  const uploadUrl = initRes.data?.upload_url;
  const videoId = initRes.data?.video?.id;
  const contentTypeFromServer = initRes.data?.content_type || "video/mp4";

  if (!uploadUrl || !videoId) {
    asyncStatusStore.completeTask(tempId, "error", "업로드 초기화에 실패했습니다.");
    throw new Error("업로드 초기화에 실패했습니다.");
  }

  // ✅ init 직후 바로 워커 메타 연결 — hydration 중복 방지
  asyncStatusStore.attachWorkerMeta(tempId, String(videoId), "video_processing");
  const taskId = String(videoId);

  const putHeaders: Record<string, string> = {};
  if (contentTypeFromServer) {
    putHeaders["Content-Type"] = contentTypeFromServer;
  }

  return { videoId, uploadUrl, putHeaders, tempId: taskId, contentType: contentTypeFromServer };
}

// ── R2 PUT with retry + URL refresh ──

const MAX_R2_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 3000;

/** Presigned URL 재발급 (만료 대비) */
async function refreshPresignedUrl(videoId: number, contentType: string): Promise<string> {
  const res = await api.post<{ upload_url: string }>(
    `/media/videos/${videoId}/upload/refresh-url/`,
    { content_type: contentType },
    { timeout: 30_000 },
  );
  return res.data.upload_url;
}

/** R2 PUT with progress tracking — single attempt */
function r2PutOnce(
  uploadUrl: string,
  file: File,
  putHeaders: Record<string, string>,
  tempId: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        asyncStatusStore.updateProgress(tempId, percent);
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else if (xhr.status === 403) {
        // 403 = presigned URL expired
        reject(new PresignedUrlExpiredError(`R2 URL 만료: ${xhr.status}`));
      } else {
        reject(new Error(`R2 업로드 실패: ${xhr.status} ${xhr.statusText}`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("R2 업로드 중 네트워크 오류")));
    xhr.addEventListener("timeout", () => reject(new Error("R2 업로드 시간 초과")));
    xhr.timeout = 30 * 60 * 1000; // 30 min timeout per attempt
    xhr.open("PUT", uploadUrl);
    Object.entries(putHeaders).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });
    xhr.send(file);
  });
}

class PresignedUrlExpiredError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "PresignedUrlExpiredError";
  }
}

/**
 * R2 PUT + complete — init 이후 백그라운드에서 실행.
 * 재시도 시 presigned URL 자동 갱신.
 */
export async function uploadFileToR2AndComplete(
  initResult: InitVideoResult,
  file: File
): Promise<number> {
  const { videoId, putHeaders, tempId, contentType } = initResult;
  let currentUrl = initResult.uploadUrl;

  try {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_R2_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          asyncStatusStore.updateProgress(tempId, 0);
          await new Promise((r) => setTimeout(r, delay));

          // 재시도 시 항상 새 presigned URL 발급 (만료 방지)
          try {
            currentUrl = await refreshPresignedUrl(videoId, contentType);
          } catch {
            // refresh 실패 시 기존 URL로 시도
          }
        }
        await r2PutOnce(currentUrl, file, putHeaders, tempId);
        lastError = null;
        break;
      } catch (e) {
        lastError = e as Error;
        // URL 만료 에러이면 즉시 새 URL 발급 후 재시도
        if (e instanceof PresignedUrlExpiredError && attempt < MAX_R2_RETRIES) {
          try {
            currentUrl = await refreshPresignedUrl(videoId, contentType);
          } catch {
            // refresh 실패해도 다음 루프에서 재시도
          }
        }
      }
    }
    if (lastError) throw lastError;

    await api.post<{ id: number }>(
      `/media/videos/${videoId}/upload/complete/`,
      { ok: true },
      { timeout: 60_000 }
    );

    return videoId;
  } catch (error) {
    const msg =
      (error as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
        ?.detail ||
      (error as Error)?.message ||
      "업로드에 실패했습니다.";
    asyncStatusStore.completeTask(tempId, "error", msg);
    throw error;
  }
}

// ── Concurrency-limited batch upload ──

/**
 * 동시 업로드 제한 실행기.
 * 대역폭 포화 방지를 위해 최대 concurrency개만 동시 R2 PUT.
 */
export async function uploadFilesWithLimit(
  items: { init: InitVideoResult; file: File }[],
  concurrency = 2,
): Promise<PromiseSettledResult<number>[]> {
  const results: PromiseSettledResult<number>[] = new Array(items.length);
  let cursor = 0;

  async function runNext(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++;
      const { init, file } = items[idx];
      try {
        const videoId = await uploadFileToR2AndComplete(init, file);
        results[idx] = { status: "fulfilled", value: videoId };
      } catch (reason) {
        results[idx] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

/**
 * 영상 업로드 전체 실행 — init + R2 + complete (기존 단일 호출용)
 * @returns videoId
 */
export async function uploadVideo(params: VideoUploadParams): Promise<number> {
  const initResult = await initVideoUpload(params);
  return uploadFileToR2AndComplete(initResult, params.file);
}
