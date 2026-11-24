// PATH: src/app_admin/domains/videos/utils/videoUpload.ts
// 영상 업로드 유틸리티 — 모달 밖에서 실행되어 작업 박스에서 진행률 표시
// 100MB 이하: 단일 PUT / 100MB 초과: R2 multipart upload

import api, { isApiError, type ApiRequestConfig } from "@/shared/api/axios";
import { captureVideoUploadConfig, completeVideoUpload } from "@/shared/api/videoUploadCompletion";
import { asyncStatusStore } from "@/shared/ui/asyncStatus";
import type { UploadInitResponse } from "../api/videos.api";

const videoTypesByExtension: Record<string, string> = {
  mp4: "video/mp4", m4v: "video/x-m4v", mov: "video/quicktime", webm: "video/webm",
  mkv: "video/x-matroska", avi: "video/x-msvideo", wmv: "video/x-ms-wmv",
  mpg: "video/mpeg", mpeg: "video/mpeg", mts: "video/mp2t", m2ts: "video/mp2t", "3gp": "video/3gpp",
};
export const videoFileAccept = ["video/*", ...Object.keys(videoTypesByExtension).map(ext => `.${ext}`)].join(",");

export function videoContentType(file: File): string | undefined {
  if (file.type.startsWith("video/")) return file.type;
  if (file.type && file.type !== "application/octet-stream") return undefined;
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1].toLowerCase();
  return ext && Object.prototype.hasOwnProperty.call(videoTypesByExtension, ext) ? videoTypesByExtension[ext] : undefined;
}

export interface VideoUploadParams {
  sessionId: number;
  file: File;
  title: string;
  description?: string;
  folderId?: number | null;
  reviewLimit?: boolean;
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
  config: ApiRequestConfig;
  completion?: { multipart?: Parameters<typeof completeVideoUpload>[2]; encodingRejected?: boolean };
}

export type VideoTransferPhase = "uploading" | "retrying" | "confirming";
export type VideoTransferProgress = { phase: VideoTransferPhase; bytes: number };
type ReportTransfer = (bytes: number, phase?: VideoTransferPhase) => void;

let activeBrowserUploadCount = 0;
let removeBrowserUploadBeforeUnload: (() => void) | null = null;

function handleBrowserUploadBeforeUnload(e: BeforeUnloadEvent): string {
  if (activeBrowserUploadCount <= 0) return "";
  e.preventDefault();
  e.returnValue = "";
  return "";
}

function installBrowserUploadGuard(): void {
  if (typeof window === "undefined") return;
  if (!removeBrowserUploadBeforeUnload) {
    window.addEventListener("beforeunload", handleBrowserUploadBeforeUnload);
    removeBrowserUploadBeforeUnload = () => {
      window.removeEventListener("beforeunload", handleBrowserUploadBeforeUnload);
    };
  }
}

function releaseBrowserUploadGuard(): void {
  if (activeBrowserUploadCount > 0) return;
  removeBrowserUploadBeforeUnload?.();
  removeBrowserUploadBeforeUnload = null;
}

function beginBrowserUploadGuard(): () => void {
  activeBrowserUploadCount += 1;
  installBrowserUploadGuard();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeBrowserUploadCount = Math.max(0, activeBrowserUploadCount - 1);
    releaseBrowserUploadGuard();
  };
}

export async function runWithVideoUploadGuard<T>(work: () => Promise<T>): Promise<T> {
  const release = beginBrowserUploadGuard();
  try {
    return await work();
  } finally {
    release();
  }
}

/**
 * 업로드 init만 수행 — DB에 영상 row 생성, 목록에 바로 표시 가능
 */
export async function initVideoUpload(
  params: VideoUploadParams, config: ApiRequestConfig = captureVideoUploadConfig(),
): Promise<InitVideoResult> {
  const { sessionId, file, title, description, folderId, showWatermark, allowSkip, maxSpeed } = params;

  const initPayload = {
    session: sessionId,
    title: title.trim(),
    filename: file.name,
    content_type: videoContentType(file) || "video/mp4",
    review_watch_limit_enabled: params.reviewLimit ?? false,
    show_watermark: showWatermark,
    allow_skip: allowSkip,
    max_speed: maxSpeed,
    ...(folderId ? { folder: folderId } : {}),
    ...(description?.trim() ? { description: description.trim() } : {}),
  };

  const tempId = `video-upload-${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  asyncStatusStore.addTask(`영상 추가 · ${title.trim()}`, tempId);

  const initRes = await api.post<UploadInitResponse>("/media/videos/upload/init/", initPayload, {
    ...config,
    timeout: 60_000,
  }).catch((error: unknown) => {
    asyncStatusStore.completeTask(tempId, "error", uploadErrorMessage(error));
    throw error;
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

  return { videoId, uploadUrl, putHeaders, tempId: taskId, contentType: contentTypeFromServer, config };
}

// ═══════════════════════════════════════════════════════════════
// 단일 PUT (≤ 100MB) — 기존 방식
// ═══════════════════════════════════════════════════════════════

const MAX_R2_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 3000;

/** Presigned URL 재발급 (만료 대비) */
async function refreshPresignedUrl(videoId: number, contentType: string, config: ApiRequestConfig): Promise<string> {
  const res = await api.post<{ upload_url: string }>(
    `/media/videos/${videoId}/upload/refresh-url/`,
    { content_type: contentType },
    { ...config, timeout: 30_000 },
  );
  return res.data.upload_url;
}

function uploadErrorMessage(error: unknown): string {
  const failure = error as { response?: { data?: { detail?: string } }; message?: string } | null;
  return failure?.response?.data?.detail || failure?.message || "영상 업로드에 실패했습니다.";
}

/** Abort stalled transfers, including a missing response after the last byte. */
function putToStorage(
  url: string, blob: Blob, headers: Record<string, string>, onProgress: (bytes: number) => void,
): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let sentBytes = 0;
    const armIdleTimeout = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        reject(new Error("영상 전송이 90초 동안 멈췄습니다. 인터넷 연결을 확인해 주세요."));
        xhr.abort();
      }, 90_000);
    };
    xhr.upload.addEventListener("progress", (event) => {
      if (event.loaded <= sentBytes) return;
      sentBytes = event.loaded;
      armIdleTimeout();
      onProgress(Math.min(sentBytes, blob.size));
    });
    xhr.addEventListener("loadend", () => clearTimeout(idleTimer));
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr);
      else reject(new Error(`영상 저장소가 전송을 거절했습니다 (HTTP ${xhr.status}).`));
    });
    xhr.addEventListener("error", () => reject(new Error("영상 전송 중 네트워크 오류가 발생했습니다.")));
    xhr.addEventListener("abort", () => reject(new Error("영상 전송 연결이 끊겼습니다.")));
    xhr.open("PUT", url);
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    armIdleTimeout();
    try {
      xhr.send(blob);
    } catch (error) {
      clearTimeout(idleTimer);
      reject(error);
    }
  });
}

/** 단일 PUT + complete (≤ 100MB 파일용) */
async function singlePutAndComplete(
  initResult: InitVideoResult,
  file: File,
  report: ReportTransfer,
): Promise<number> {
  const { videoId, putHeaders, contentType, config } = initResult;
  let currentUrl = initResult.uploadUrl;

  for (let attempt = 0; ; attempt++) {
    try {
      if (attempt > 0) {
        report(0, "retrying");
        await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)));
        currentUrl = await refreshPresignedUrl(videoId, contentType, config);
      }
      await putToStorage(currentUrl, file, putHeaders, report);
      break;
    } catch (error) {
      if (attempt >= MAX_R2_RETRIES) throw error;
    }
  }

  initResult.completion = {};
  report(file.size, "confirming");
  await completeVideoUpload(videoId, config);

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

/** Multipart upload + complete (> 100MB 파일용) */
async function multipartUploadAndComplete(
  initResult: InitVideoResult,
  file: File,
  report: ReportTransfer,
): Promise<number> {
  const { videoId, contentType, config } = initResult;

  // 1. Multipart upload 생성
  const mpInitRes = await api.post<MultipartInitResponse>(
    `/media/videos/${videoId}/upload/multipart/init/`,
    { content_type: contentType },
    { ...config, timeout: 30_000 },
  );
  const uploadId = mpInitRes.data.upload_id;

  // 2. 파트 분할 계산 (동적 파트 크기)
  const partSize = calculatePartSize(file.size);
  const totalParts = Math.ceil(file.size / partSize);
  const completedParts: { ETag: string; PartNumber: number }[] = [];
  const partBytes = new Map<number, number>();
  const retryingParts = new Set<number>();
  let transferredBytes = 0;
  function updatePartBytes(part: number, bytes: number) {
    transferredBytes += bytes - (partBytes.get(part) ?? 0);
    partBytes.set(part, bytes);
    report(transferredBytes, retryingParts.size ? "retrying" : "uploading");
  }

  // 3. presigned URL 일괄 발급 (배치 단위)
  const allPartUrls: Record<number, string> = {};

  async function ensurePresignedUrls(partNumbers: number[]) {
    const needed = partNumbers.filter((pn) => !allPartUrls[pn]);
    if (needed.length === 0) return;

    const res = await api.post<MultipartPresignResponse>(
      `/media/videos/${videoId}/upload/multipart/presign/`,
      { upload_id: uploadId, part_numbers: needed },
      { ...config, timeout: 30_000 },
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
      let failed = false;

      async function uploadWorker() {
        while (!failed && cursor < batchParts.length) {
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
                retryingParts.add(partNumber);
                updatePartBytes(partNumber, 0);
                await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * Math.pow(2, retry - 1)));
                delete allPartUrls[partNumber];
                await ensurePresignedUrls([partNumber]);
              }

              const response = await putToStorage(allPartUrls[partNumber], blob, {}, bytes => updatePartBytes(partNumber, bytes));
              etag = response.getResponseHeader("ETag");
              if (!etag) throw new Error("파트 업로드 성공했으나 ETag 없음");
              break;
            } catch (e) {
              if (retry === PART_MAX_RETRIES) {
                failed = true;
                throw e;
              }
            }
          }

          if (etag) {
            completedParts.push({ ETag: etag, PartNumber: partNumber });
            retryingParts.delete(partNumber);
            updatePartBytes(partNumber, blob.size);
          }
        }
      }

      const workers = Array.from(
        { length: Math.min(PART_CONCURRENCY, batchParts.length) },
        () => uploadWorker(),
      );
      const outcomes = await Promise.allSettled(workers);
      const failure = outcomes.find((outcome) => outcome.status === "rejected");
      if (failure) throw failure.reason;
    }
  } catch (error) {
    await api.post(
      `/media/videos/${videoId}/upload/multipart/abort/`,
      { upload_id: uploadId },
      { ...config, timeout: 30_000 },
    ).catch(() => {});
    throw error;
  }

  // 완료 요청 중 연결이 끊겨도 저장소에서 조립이 진행 중일 수 있다.
  const orderedParts = completedParts.sort((left, right) => left.PartNumber - right.PartNumber);
  initResult.completion = { multipart: { upload_id: uploadId, parts: orderedParts } };
  report(file.size, "confirming");
  await completeVideoUpload(videoId, config, initResult.completion.multipart);
  return videoId;
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
  retry = false,
  onProgress?: (value: VideoTransferProgress) => void,
): Promise<number> {
  const { tempId } = initResult;
  let lastPhase: VideoTransferPhase | undefined;
  let lastPercent = -1;
  let lastBytes = 0;
  let lastUpdate = 0;
  const report: ReportTransfer = (bytes, phase = "uploading") => {
    const percent = file.size ? Math.floor(100 * bytes / file.size) : 0;
    const now = Date.now();
    // Multiple part streams feed one row. Keep the first movement visible and
    // avoid persisting the global task list for every browser progress event.
    if (percent === lastPercent && phase === lastPhase &&
        (bytes === lastBytes || (lastBytes > 0 && now - lastUpdate < 500))) return;
    if (percent !== lastPercent) asyncStatusStore.updateProgress(tempId, percent);
    lastPhase = phase;
    lastBytes = bytes;
    lastPercent = percent;
    lastUpdate = now;
    onProgress?.({ phase, bytes });
  };
  try {
    if (retry) asyncStatusStore.retryTask(tempId);
    if (initResult.completion) report(file.size, "confirming");
    else report(0);
    if (initResult.completion?.encodingRejected) {
      const path = `/media/videos/${initResult.videoId}/`;
      const { data } = await api.get<{ status: string }>(path, initResult.config);
      if (data.status === "FAILED") await api.post(`${path}retry/`, {}, initResult.config);
      else if (!["UPLOADED", "PROCESSING", "READY"].includes(data.status)) {
        throw new Error("영상 상태가 바뀌었습니다. 영상 목록에서 최신 처리 상태를 확인해 주세요.");
      }
      return initResult.videoId;
    }
    if (initResult.completion) {
      await completeVideoUpload(initResult.videoId, initResult.config, initResult.completion.multipart);
      return initResult.videoId;
    }
    if (file.size <= MULTIPART_THRESHOLD) {
      if (retry) initResult.uploadUrl = await refreshPresignedUrl(initResult.videoId, initResult.contentType, initResult.config);
      return await singlePutAndComplete(initResult, file, report);
    } else {
      return await multipartUploadAndComplete(initResult, file, report);
    }
  } catch (error) {
    if (initResult.completion && isApiError(error) &&
        (error.response?.data as { code?: string } | undefined)?.code === "VIDEO_BATCH_SUBMIT_FAILED") {
      initResult.completion.encodingRejected = true;
    }
    asyncStatusStore.completeTask(tempId, "error", uploadErrorMessage(error));
    throw error;
  }
}

/**
 * 영상 업로드 전체 실행 — init + R2 + complete (기존 단일 호출용)
 * @returns videoId
 */
export async function uploadVideo(params: VideoUploadParams): Promise<number> {
  const initResult = await initVideoUpload(params);
  return uploadFileToR2AndComplete(initResult, params.file);
}
