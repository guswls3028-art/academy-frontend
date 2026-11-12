import type { ErrorData } from "hls.js";

export function hlsErrorDetails(data: ErrorData, networkType: string, mediaType: string) {
  const detail = data.details || data.type || "알 수 없는 오류";
  const code = data.response?.code ?? (data as { code?: number }).code;
  return {
    detail,
    is404: code === 404 || detail.includes("404") || detail.includes("Not Found"),
    isServiceAuthError: code === 401 || code === 403,
    isServiceUnavailable: typeof code === "number" && code >= 500,
    isNetworkError: data.type === networkType || code === -1 || code === -2
      || /network|NetworkError|Timeout|manifestLoad/.test(detail),
    isMediaError: data.type === mediaType,
  };
}
