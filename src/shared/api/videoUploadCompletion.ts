import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import api, { createAuthSessionBoundConfig, isApiError, type ApiRequestConfig } from "./axios";

type MultipartCompletion = {
  upload_id: string;
  parts: { ETag: string; PartNumber: number }[];
};

const RETRY_DELAYS_MS = [1_000, 3_000];

export function captureVideoUploadConfig(): ApiRequestConfig {
  const generation = readAuthTokenEnvelopeSafely()?.generation;
  const tenant = getTenantCodeForApiRequest();
  if (!generation || !tenant) throw new Error("로그인과 학원 정보를 확인한 뒤 다시 시도해 주세요.");
  return createAuthSessionBoundConfig(generation, undefined, tenant);
}

export async function completeVideoUpload(
  videoId: number, config: ApiRequestConfig, multipart?: MultipartCompletion,
): Promise<void> {
  const path = `/media/videos/${videoId}/upload/${multipart ? "multipart/" : ""}complete/`;
  for (let attempt = 0; ; attempt++) {
    try {
      await api.post(path, multipart ?? { ok: true }, { ...config, timeout: multipart ? 120_000 : 60_000 });
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
