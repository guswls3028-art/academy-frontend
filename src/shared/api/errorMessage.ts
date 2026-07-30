// PATH: src/shared/api/errorMessage.ts

/**
 * API 에러(주로 Axios 4xx)에서 사용자에게 보여줄 메시지 한 줄 추출.
 * - response.data.detail (DRF 문자열)
 * - response.data의 DRF 필드 에러 문자열/배열
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

  const collectMessages = (value: unknown): string[] => {
    if (typeof value === "string" && value.trim()) return [value.trim()];
    if (Array.isArray(value)) return value.flatMap(collectMessages);
    if (value && typeof value === "object") {
      return Object.values(value as Record<string, unknown>).flatMap(collectMessages);
    }
    return [];
  };
  const validationMessages = collectMessages(data);
  if (validationMessages.length > 0) {
    return Array.from(new Set(validationMessages)).join(" ");
  }
  return err?.message && typeof err.message === "string" ? err.message : defaultMessage;
}
