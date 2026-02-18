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

/**
 * 영상 업로드 실행 — 모달 밖에서 실행되어 작업 박스에서 진행률 표시
 * @returns videoId
 */
export async function uploadVideo(params: VideoUploadParams): Promise<number> {
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

  const tempId = `video-upload-${sessionId}-${Date.now()}`;
  asyncStatusStore.addTask("영상 추가", tempId);

  try {
    const initRes = await api.post<UploadInitResponse>("/media/videos/upload/init/", initPayload);
    asyncStatusStore.updateProgress(tempId, 5);

    const uploadUrl = initRes.data?.upload_url;
    const videoId = initRes.data?.video?.id;
    const contentTypeFromServer = initRes.data?.content_type;

    if (!uploadUrl || !videoId) {
      throw new Error("업로드 초기화에 실패했습니다.");
    }

    const putHeaders: Record<string, string> = {};
    if (contentTypeFromServer) {
      putHeaders["Content-Type"] = contentTypeFromServer;
    }

    // 실제 업로드 진행률 추적 (5% ~ 70%)
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = 5 + (e.loaded / e.total) * 65; // 5% ~ 70%
          asyncStatusStore.updateProgress(tempId, Math.round(percent));
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

    asyncStatusStore.updateProgress(tempId, 70);

    const completeRes = await api.post<{ id: number }>(`/media/videos/${videoId}/upload/complete/`, {
      ok: true,
    });
    asyncStatusStore.updateProgress(tempId, 85);

    // 워커 작업으로 전환하여 폴링 시작
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
