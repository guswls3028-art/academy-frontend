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

  const initRes = await api.post<UploadInitResponse>("/media/videos/upload/init/", initPayload);

  const uploadUrl = initRes.data?.upload_url;
  const videoId = initRes.data?.video?.id;
  const contentTypeFromServer = initRes.data?.content_type;

  if (!uploadUrl || !videoId) {
    asyncStatusStore.completeTask(tempId, "error", "업로드 초기화에 실패했습니다.");
    throw new Error("업로드 초기화에 실패했습니다.");
  }

  const putHeaders: Record<string, string> = {};
  if (contentTypeFromServer) {
    putHeaders["Content-Type"] = contentTypeFromServer;
  }

  return { videoId, uploadUrl, putHeaders, tempId };
}

/**
 * R2 PUT + complete — init 이후 백그라운드에서 실행
 */
export async function uploadFileToR2AndComplete(
  initResult: InitVideoResult,
  file: File
): Promise<number> {
  const { videoId, uploadUrl, putHeaders, tempId } = initResult;

  try {
    await new Promise<void>((resolve, reject) => {
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
        } else {
          reject(new Error(`R2 업로드 실패: ${xhr.status} ${xhr.statusText}`));
        }
      });
      xhr.addEventListener("error", () => reject(new Error("R2 업로드 중 네트워크 오류")));
      xhr.open("PUT", uploadUrl);
      Object.entries(putHeaders).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
      xhr.send(file);
    });

    await api.post<{ id: number }>(`/media/videos/${videoId}/upload/complete/`, {
      ok: true,
    });

    asyncStatusStore.attachWorkerMeta(tempId, String(videoId), "video_processing");
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

/**
 * 영상 업로드 전체 실행 — init + R2 + complete (기존 단일 호출용)
 * @returns videoId
 */
export async function uploadVideo(params: VideoUploadParams): Promise<number> {
  const initResult = await initVideoUpload(params);
  return uploadFileToR2AndComplete(initResult, params.file);
}
