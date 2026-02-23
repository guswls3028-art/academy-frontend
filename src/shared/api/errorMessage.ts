// PATH: src/shared/api/errorMessage.ts

/**
 * API 에러(주로 Axios 4xx)에서 사용자에게 보여줄 메시지 한 줄 추출.
 * - response.data.detail (DRF 문자열)
 * - response.data.video (DRF 필드 에러 배열)
 * - response.data가 배열인 경우 (DRF validation error 배열)
 */
export function getApiErrorMessage(e: unknown, defaultMessage: string): string {
  const err = e as {
    response?: { data?: unknown };
    message?: string;
  };
  const data = err?.response?.data;
  if (data == null) {
    return err?.message && typeof err.message === "string" ? err.message : defaultMessage;
  }
  if (typeof (data as { detail?: string }).detail === "string") {
    return (data as { detail: string }).detail;
  }
  const video = (data as { video?: string[] }).video;
  if (Array.isArray(video) && video.length > 0) {
    return video.join(" ");
  }
  if (Array.isArray(data)) {
    return data.map((x) => (typeof x === "string" ? x : String(x))).join(" ");
  }
  return err?.message && typeof err.message === "string" ? err.message : defaultMessage;
}
