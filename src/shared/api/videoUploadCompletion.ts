import api, { isApiError } from "./axios";

type MultipartCompletion = {
  upload_id: string;
  parts: { ETag: string; PartNumber: number }[];
};

const RETRY_DELAYS_MS = [1_000, 3_000];

export async function completeVideoUpload(videoId: number, multipart?: MultipartCompletion): Promise<void> {
  const path = `/media/videos/${videoId}/upload/${multipart ? "multipart/" : ""}complete/`;
  for (let attempt = 0; ; attempt++) {
    try {
      await api.post(path, multipart ?? { ok: true }, { timeout: multipart ? 120_000 : 60_000 });
      return;
    } catch (error) {
      if (attempt >= RETRY_DELAYS_MS.length || !isApiError(error) || error.code === "ERR_CANCELED") {
        throw error;
      }
      const response = error.response;
      const body = response?.data as { code?: string } | undefined;
      if (response && (response.status < 500 || body?.code === "VIDEO_BATCH_SUBMIT_FAILED")) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}
