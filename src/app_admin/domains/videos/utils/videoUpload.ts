// PATH: src/app_admin/domains/videos/utils/videoUpload.ts
// 영상 업로드 유틸리티 — 모달 밖에서 실행되어 작업 박스에서 진행률 표시
// 100MB 이하: 단일 PUT / 100MB 초과: R2 multipart upload

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

// ═══════════════════════════════════════════════════════════════
// 단일 PUT (≤ 100MB) — 기존 방식
// ═══════════════════════════════════════════════════════════════

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
        reject(new PresignedUrlExpiredError(`R2 URL 만료: ${xhr.status}`));
      } else {
        reject(new Error(`R2 업로드 실패: ${xhr.status} ${xhr.statusText}`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("R2 업로드 중 네트워크 오류")));
    xhr.addEventListener("timeout", () => reject(new Error("R2 업로드 시간 초과")));
    xhr.timeout = 2 * 60 * 60 * 1000; // 2시간 — presigned URL 유효시간과 동일
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

/** 단일 PUT + complete (≤ 100MB 파일용) */
async function singlePutAndComplete(
  initResult: InitVideoResult,
  file: File,
): Promise<number> {
  const { videoId, putHeaders, tempId, contentType } = initResult;
  let currentUrl = initResult.uploadUrl;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_R2_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        asyncStatusStore.updateProgress(tempId, 0);
        await new Promise((r) => setTimeout(r, delay));
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
    { timeout: 60_000 },
  );

  return videoId;
}

// ═══════════════════════════════════════════════════════════════
// Multipart Upload (> 100MB) — 파트 단위 업로드, 실패 시 파트만 재시도
// ═══════════════════════════════════════════════════════════════

const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100MB
const DEFAULT_PART_SIZE = 100 * 1024 * 1024; // 100MB per part
const MIN_PART_SIZE = 5 * 1024 * 1024; // R2 최소 파트 크기: 5MB
const MAX_PARTS = 10_000; // R2/S3 최대 파트 수
const PART_CONCURRENCY = 3; // 동시 파트 업로드 수
const PART_MAX_RETRIES = 3;
const PRESIGN_BATCH_SIZE = 50; // 한 번에 presign 요청할 파트 수

/** 파일 크기에 따라 파트 크기 동적 계산 (R2: 최대 10,000 파트, 파트 최소 5MB) */
function calculatePartSize(fileSize: number): number {
  if (fileSize <= DEFAULT_PART_SIZE * MAX_PARTS) {
    return DEFAULT_PART_SIZE; // 100MB * 10,000 = ~1TB까지 기본값
  }
  // 1TB 초과: 파트 크기를 키워서 10,000 파트 이내로 유지
  const needed = Math.ceil(fileSize / MAX_PARTS);
  return Math.max(needed, MIN_PART_SIZE);
}

type MultipartInitResponse = {
  upload_id: string;
  video_id: number;
  file_key: string;
};

type MultipartPresignResponse = {
  urls: Record<string, string>;
};

/** 파트 1개를 XHR로 업로드, ETag 반환 */
function uploadPartOnce(url: string, blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) {
          reject(new Error("파트 업로드 성공했으나 ETag 없음"));
          return;
        }
        resolve(etag);
      } else if (xhr.status === 403) {
        reject(new PresignedUrlExpiredError(`파트 URL 만료: ${xhr.status}`));
      } else {
        reject(new Error(`파트 업로드 실패: ${xhr.status}`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("파트 업로드 네트워크 오류")));
    xhr.addEventListener("timeout", () => reject(new Error("파트 업로드 시간 초과")));
    xhr.timeout = 60 * 60 * 1000; // 1시간 (100MB 파트에 충분)
    xhr.open("PUT", url);
    xhr.send(blob);
  });
}

/** Multipart upload + complete (> 100MB 파일용) */
async function multipartUploadAndComplete(
  initResult: InitVideoResult,
  file: File,
): Promise<number> {
  const { videoId, tempId, contentType } = initResult;

  // 1. Multipart upload 생성
  const mpInitRes = await api.post<MultipartInitResponse>(
    `/media/videos/${videoId}/upload/multipart/init/`,
    { content_type: contentType },
    { timeout: 30_000 },
  );
  const uploadId = mpInitRes.data.upload_id;

  // 2. 파트 분할 계산 (동적 파트 크기)
  const partSize = calculatePartSize(file.size);
  const totalParts = Math.ceil(file.size / partSize);
  const completedParts: { ETag: string; PartNumber: number }[] = [];
  let uploadedBytes = 0;

  // 3. presigned URL 일괄 발급 (배치 단위)
  const allPartUrls: Record<number, string> = {};

  async function ensurePresignedUrls(partNumbers: number[]) {
    const needed = partNumbers.filter((pn) => !allPartUrls[pn]);
    if (needed.length === 0) return;

    const res = await api.post<MultipartPresignResponse>(
      `/media/videos/${videoId}/upload/multipart/presign/`,
      { upload_id: uploadId, part_numbers: needed },
      { timeout: 30_000 },
    );
    for (const [pn, url] of Object.entries(res.data.urls)) {
      allPartUrls[Number(pn)] = url;
    }
  }

  // 4. 파트 업로드 (concurrency 제한 + 재시도)
  try {
    // 배치별로 presign + 업로드
    for (let batchStart = 0; batchStart < totalParts; batchStart += PRESIGN_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + PRESIGN_BATCH_SIZE, totalParts);
      const batchPartNumbers = Array.from(
        { length: batchEnd - batchStart },
        (_, i) => batchStart + i + 1, // 1-indexed
      );

      await ensurePresignedUrls(batchPartNumbers);

      // Concurrency-limited part upload within batch
      let cursor = 0;
      const batchParts = batchPartNumbers.map((pn) => pn);

      async function uploadWorker() {
        while (cursor < batchParts.length) {
          const idx = cursor++;
          if (idx >= batchParts.length) break;
          const partNumber = batchParts[idx];
          const start = (partNumber - 1) * partSize;
          const end = Math.min(start + partSize, file.size);
          const blob = file.slice(start, end);

          let etag: string | null = null;
          for (let retry = 0; retry <= PART_MAX_RETRIES; retry++) {
            try {
              // 재시도 시 새 presigned URL 발급
              if (retry > 0) {
                await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * Math.pow(2, retry - 1)));
                try {
                  await ensurePresignedUrls([partNumber]);
                  // 기존 URL이 만료되었을 수 있으므로 강제 갱신
                  const freshRes = await api.post<MultipartPresignResponse>(
                    `/media/videos/${videoId}/upload/multipart/presign/`,
                    { upload_id: uploadId, part_numbers: [partNumber] },
                    { timeout: 30_000 },
                  );
                  allPartUrls[partNumber] = freshRes.data.urls[String(partNumber)];
                } catch {
                  // 갱신 실패해도 기존 URL로 시도
                }
              }

              etag = await uploadPartOnce(allPartUrls[partNumber], blob);
              break;
            } catch (e) {
              if (retry === PART_MAX_RETRIES) throw e;
            }
          }

          if (etag) {
            completedParts.push({ ETag: etag, PartNumber: partNumber });
            uploadedBytes += blob.size;
            const percent = Math.round((uploadedBytes / file.size) * 100);
            asyncStatusStore.updateProgress(tempId, percent);
          }
        }
      }

      const workers = Array.from(
        { length: Math.min(PART_CONCURRENCY, batchParts.length) },
        () => uploadWorker(),
      );
      await Promise.all(workers);
    }

    // 5. Multipart complete (R2 조립 + 인코딩 파이프라인)
    await api.post(
      `/media/videos/${videoId}/upload/multipart/complete/`,
      { upload_id: uploadId, parts: completedParts },
      { timeout: 120_000 },
    );

    return videoId;
  } catch (error) {
    // 실패 시 abort 시도 (불완전 파트 정리)
    try {
      await api.post(
        `/media/videos/${videoId}/upload/multipart/abort/`,
        { upload_id: uploadId },
        { timeout: 30_000 },
      ).catch(() => {});
    } catch {
      // best-effort abort
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// Public API — 파일 크기에 따라 자동 분기
// ═══════════════════════════════════════════════════════════════

/**
 * R2 업로드 + complete — init 이후 백그라운드에서 실행.
 * ≤ 100MB: 단일 PUT / > 100MB: multipart upload
 */
export async function uploadFileToR2AndComplete(
  initResult: InitVideoResult,
  file: File,
): Promise<number> {
  const { tempId } = initResult;
  try {
    if (file.size <= MULTIPART_THRESHOLD) {
      return await singlePutAndComplete(initResult, file);
    } else {
      return await multipartUploadAndComplete(initResult, file);
    }
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
