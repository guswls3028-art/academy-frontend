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

    const uploadUrl = initRes.data?.upload_url;
    const videoId = initRes.data?.video?.id;
    const contentTypeFromServer = initRes.data?.content_type;

    if (!uploadUrl || !videoId) {
      throw new Error("업로드 초기화에 실패했습니다.");
    }

    // 백엔드 progress API를 폴링하여 실제 업로드 단계 정보 가져오기
    const pollUploadProgress = async () => {
      try {
        const res = await api.get<{
          status: string;
          upload_step_index?: number | null;
          upload_step_total?: number | null;
          upload_step_name?: string | null;
          upload_step_percent?: number | null;
          upload_progress?: number | null;
        }>(`/media/videos/${videoId}/progress/`);
        
        const stepIndex = res.data?.upload_step_index;
        const stepTotal = res.data?.upload_step_total;
        const stepName = res.data?.upload_step_name;
        const stepPercent = res.data?.upload_step_percent;
        const uploadProgress = res.data?.upload_progress;
        
        if (
          typeof stepIndex === "number" &&
          typeof stepTotal === "number" &&
          typeof stepName === "string" &&
          typeof stepPercent === "number"
        ) {
          const encodingStep = {
            index: stepIndex,
            total: stepTotal,
            name: stepName,
            percent: stepPercent,
          };
          const overallProgress = typeof uploadProgress === "number" ? uploadProgress : stepPercent;
          asyncStatusStore.updateProgress(tempId, overallProgress, null, encodingStep);
        } else if (typeof uploadProgress === "number") {
          asyncStatusStore.updateProgress(tempId, uploadProgress);
        }
      } catch (e) {
        // 폴링 실패는 무시
      }
    };

    // 업로드 시작 전 progress 폴링 시작
    const pollInterval = setInterval(pollUploadProgress, 1000);

    const putHeaders: Record<string, string> = {};
    if (contentTypeFromServer) {
      putHeaders["Content-Type"] = contentTypeFromServer;
    }

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", () => {
        pollUploadProgress();
      });
      xhr.addEventListener("load", () => {
        clearInterval(pollInterval);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`R2 업로드 실패: ${xhr.status} ${xhr.statusText}`));
        }
      });
      xhr.addEventListener("error", () => {
        clearInterval(pollInterval);
        reject(new Error("R2 업로드 중 네트워크 오류"));
      });
      xhr.open("PUT", uploadUrl);
      Object.entries(putHeaders).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
      xhr.send(file);
    });

    clearInterval(pollInterval);

    await api.post<{ id: number }>(`/media/videos/${videoId}/upload/complete/`, {
      ok: true,
    });

    // 워커 작업으로 전환하여 폴링 시작 (백엔드에서 실제 워커 단계 정보 제공)
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
